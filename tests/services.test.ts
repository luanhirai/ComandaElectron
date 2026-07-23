import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createAppServices } from "../app/backend/app-services.js";
import { RegraNegocioError } from "../app/backend/errors.js";

async function withServices(
  fn: Awaited<ReturnType<typeof createAppServices>> extends infer T ? (services: T, dir: string) => Promise<void> : never
) {
  const dir = await mkdtemp(path.join(tmpdir(), "sistema-bar-"));
  try {
    const services = await createAppServices(dir);
    await fn(services, dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("cadastra, lista e impede codigo de barras duplicado", async () => {
  await withServices(async ({ produtoService }) => {
    await produtoService.cadastrar({ codigo: "123", nome: "Cerveja", custo: 6, preco: 10, estoque: 5 });

    assert.equal(produtoService.listar().length, 1);
    assert.equal(produtoService.buscarPorCodigo("123")?.nome, "Cerveja");
    assert.equal(produtoService.buscarPorCodigo("123")?.custo, 6);
    await assert.rejects(
      () => produtoService.cadastrar({ codigo: "123", nome: "Outra", custo: 7, preco: 11, estoque: 2 }),
      RegraNegocioError
    );
  });
});

test("adiciona item pelo nome e recalcula o total", async () => {
  await withServices(async ({ produtoService, comandaService }) => {
    await produtoService.cadastrar({ codigo: "123", nome: "Cerveja Lata", custo: 6, preco: 10, estoque: 5 });
    const comanda = await comandaService.criar("Mesa 1");

    const atualizada = await comandaService.adicionarItem(comanda.id, "cerveja lata", 2);

    assert.equal(atualizada.total, 20);
    assert.deepEqual(atualizada.itens, [{ codigo: "123", quantidade: 2 }]);
  });
});

test("permite alterar preco do produto apenas na comanda", async () => {
  await withServices(async ({ produtoService, comandaService }) => {
    await produtoService.cadastrar({ codigo: "123", nome: "Cerveja Lata", custo: 6, preco: 10, estoque: 5 });
    const comanda = await comandaService.criar("Mesa 1");

    const comPrecoCustomizado = await comandaService.adicionarItem(comanda.id, "123", 2, 12.5);
    assert.equal(comPrecoCustomizado.total, 25);

    const comPrecoEditado = await comandaService.editarPrecoItem(comanda.id, "123", 9);
    assert.equal(comPrecoEditado.total, 18);
    assert.equal(comPrecoEditado.itens[0].precoUnitario, 9);
    assert.equal(comPrecoEditado.itens[0].nome, "Cerveja Lata");
    assert.equal(produtoService.buscarPorCodigo("123")?.preco, 10);
  });
});

test("pagamento parcial registra pagamento, baixa estoque e mantem restante na comanda", async () => {
  await withServices(async ({ produtoService, comandaService, pagamentoService }, dir) => {
    await produtoService.cadastrar({ codigo: "123", nome: "Cerveja", custo: 6, preco: 10, estoque: 5 });
    await produtoService.cadastrar({ codigo: "789", nome: "Refri", custo: 2, preco: 5, estoque: 4 });
    const comanda = await comandaService.criar("Mesa 1");
    await comandaService.adicionarItem(comanda.id, "123", 2);
    await comandaService.adicionarItem(comanda.id, "789", 1);

    const resultado = await comandaService.pagarItens(comanda.id, [{ codigo: "123", quantidade: 2 }], "PIX");
    const pagamentosTxt = await readFile(path.join(dir, "pagamentos.txt"), "utf8");

    assert.equal(resultado.troco, 0);
    assert.equal(resultado.comanda.total, 5);
    assert.deepEqual(resultado.comanda.itens, [{ codigo: "789", quantidade: 1 }]);
    assert.equal(produtoService.buscarPorCodigo("123")?.estoque, 3);
    assert.equal(pagamentoService.totalRecebidoNoDia(new Date()), 20);
    assert.match(pagamentosTxt, /1\|Mesa 1\|20\.00\|0\.00\|PIX\|123,2\|.*\|\|/);
  });
});

test("pagamento menor que o selecionado cria saldo pendente na comanda", async () => {
  await withServices(async ({ produtoService, comandaService, pagamentoService }) => {
    await produtoService.cadastrar({ codigo: "123", nome: "Pao de alho", custo: 2, preco: 5, estoque: 5 });
    const comanda = await comandaService.criar("Mesa 1");
    await comandaService.adicionarItem(comanda.id, "123", 1);

    const resultado = await comandaService.pagarItens(comanda.id, [{ codigo: "123", quantidade: 1 }], "PIX", undefined, 3);
    const pagamento = pagamentoService.listarPorComanda(comanda.id)[0];

    assert.equal(pagamento.valor, 3);
    assert.equal(resultado.comanda.total, 2);
    assert.equal(resultado.comanda.itens.length, 1);
    assert.equal(resultado.comanda.itens[0].nome, "Saldo pendente");
    assert.equal(resultado.comanda.itens[0].precoUnitario, 2);
    assert.equal(produtoService.buscarPorCodigo("123")?.estoque, 4);
  });
});

test("permite colocar comanda no fiado sem somar ao caixa recebido", async () => {
  await withServices(async ({ produtoService, comandaService, pagamentoService }) => {
    await produtoService.cadastrar({ codigo: "123", nome: "Cerveja", custo: 6, preco: 10, estoque: 5 });
    const comanda = await comandaService.criar("Mesa Fiado");
    await comandaService.adicionarItem(comanda.id, "123", 2);

    const { comanda: fechada } = await comandaService.fechar(comanda.id, "FIADO", undefined, new Date(2026, 4, 3));
    const relatorio = pagamentoService.gerarRelatorioPorPeriodo("2026-05-03", "2026-05-03");

    assert.equal(fechada.status, "FECHADA");
    assert.equal(pagamentoService.totalRecebidoNoDia(new Date(2026, 4, 3)), 0);
    assert.equal(relatorio.totalRecebido, 0);
    assert.equal(relatorio.totalFiado, 0);
    assert.equal(relatorio.totaisPorMetodo.FIADO, 0);
    assert.equal(relatorio.pagamentos.length, 0);
    assert.equal(relatorio.produtos.length, 0);
  });
});

test("permite quitar fiado e incluir no relatorio do dia do pagamento", async () => {
  await withServices(async ({ produtoService, comandaService, pagamentoService }) => {
    await produtoService.cadastrar({ codigo: "123", nome: "Cerveja", custo: 6, preco: 10, estoque: 5 });
    const comanda = await comandaService.criar("Mesa Fiado");
    await comandaService.adicionarItem(comanda.id, "123", 2);

    await comandaService.fechar(comanda.id, "FIADO", undefined, new Date(2026, 4, 3));
    const fiado = pagamentoService.listarPorComanda(comanda.id)[0];

    await pagamentoService.quitarFiado(fiado.comandaId, fiado.data, "PIX", undefined, new Date(2026, 4, 5));
    const relatorioOriginal = pagamentoService.gerarRelatorioPorPeriodo("2026-05-03", "2026-05-03");
    const relatorioPagamento = pagamentoService.gerarRelatorioPorPeriodo("2026-05-05", "2026-05-05");

    assert.equal(pagamentoService.totalRecebidoNoDia(new Date(2026, 4, 5)), 20);
    assert.equal(relatorioOriginal.totalFiado, 0);
    assert.equal(relatorioPagamento.totalRecebido, 20);
    assert.equal(relatorioPagamento.totaisPorMetodo.PIX, 20);
    assert.equal(relatorioPagamento.produtos[0].codigo, "123");
  });
});

test("permite cancelar fiado pendente", async () => {
  await withServices(async ({ produtoService, comandaService, pagamentoService }) => {
    await produtoService.cadastrar({ codigo: "123", nome: "Agua", custo: 1, preco: 4, estoque: 5 });
    const comanda = await comandaService.criar("Cliente Balcao");
    await comandaService.adicionarItem(comanda.id, "123", 1);

    await comandaService.fechar(comanda.id, "FIADO", undefined, new Date(2026, 4, 3));
    const fiado = pagamentoService.listarPorComanda(comanda.id)[0];

    await pagamentoService.cancelarFiado(fiado.comandaId, fiado.data);
    const relatorio = pagamentoService.gerarRelatorioPorPeriodo("2026-05-03", "2026-05-03");

    assert.equal(pagamentoService.listarPorComanda(comanda.id).length, 0);
    assert.equal(relatorio.totalFiado, 0);
    assert.equal(relatorio.pagamentos.length, 0);
  });
});

test("divide comanda pelo numero de pessoas", async () => {
  await withServices(async ({ produtoService, comandaService }) => {
    await produtoService.cadastrar({ codigo: "123", nome: "Cerveja", custo: 8, preco: 12, estoque: 5 });
    const comanda = await comandaService.criar("Mesa 1");
    await comandaService.adicionarItem(comanda.id, "123", 3);

    const divisao = comandaService.dividirConta(comanda.id, 3);

    assert.equal(divisao.total, 36);
    assert.equal(divisao.valorPorPessoa, 12);
  });
});

test("aplica desconto fixo na comanda e mostra no relatorio", async () => {
  await withServices(async ({ produtoService, comandaService, pagamentoService }) => {
    await produtoService.cadastrar({ codigo: "123", nome: "Cerveja", custo: 6, preco: 10, estoque: 5 });
    const comanda = await comandaService.criar("Mesa Desconto");
    await comandaService.adicionarItem(comanda.id, "123", 2);

    const comDesconto = await comandaService.definirDesconto(comanda.id, 5);
    assert.equal(comDesconto.desconto, 5);
    assert.equal(comDesconto.total, 15);

    const { troco } = await comandaService.fechar(comanda.id, "DINHEIRO", 20, new Date(2026, 4, 3));
    const pagamento = pagamentoService.listarPorComanda(comanda.id)[0];
    const relatorio = pagamentoService.gerarRelatorioPorPeriodo("2026-05-03", "2026-05-03");

    assert.equal(troco, 5);
    assert.equal(pagamento.valor, 15);
    assert.equal(pagamento.desconto, 5);
    assert.equal(relatorio.totalRecebido, 15);
    assert.equal(relatorio.totalDescontos, 5);
    assert.equal(relatorio.lucroBruto, 3);
  });
});

test("permite cancelar comanda aberta", async () => {
  await withServices(async ({ produtoService, comandaService }) => {
    await produtoService.cadastrar({ codigo: "123", nome: "Cerveja", custo: 8, preco: 12, estoque: 5 });
    const comanda = await comandaService.criar("Mesa 1");
    await comandaService.adicionarItem(comanda.id, "123", 1);

    const cancelada = await comandaService.cancelar(comanda.id);

    assert.equal(cancelada.status, "CANCELADA");
    assert.equal(comandaService.listarAbertas().length, 0);
  });
});

test("cadastra, edita e exclui despesas", async () => {
  await withServices(async ({ despesaService }, dir) => {
    const despesa = await despesaService.cadastrar({
      descricao: "Compra de gelo",
      categoria: "Insumos",
      valor: 35,
      metodoPagamento: "PIX",
      data: "2026-05-03",
      observacao: "Fornecedor local"
    });

    const atualizada = await despesaService.editar(despesa.id, {
      descricao: "Compra de gelo e limao",
      categoria: "Insumos",
      valor: 45,
      metodoPagamento: "DINHEIRO",
      data: "2026-05-04",
      observacao: "Reposicao"
    });
    const despesasTxt = await readFile(path.join(dir, "despesas.txt"), "utf8");

    assert.equal(atualizada.id, despesa.id);
    assert.equal(despesaService.listar().length, 1);
    assert.match(despesasTxt, /1\|Compra%20de%20gelo%20e%20limao\|Insumos\|45\.00\|DINHEIRO\|2026-05-04\|Reposicao/);

    await despesaService.excluir(despesa.id);

    assert.equal(despesaService.listar().length, 0);
  });
});

test("permite renomear comanda aberta e bloqueia nome duplicado entre abertas", async () => {
  await withServices(async ({ comandaService }) => {
    const mesa1 = await comandaService.criar("Mesa 1");
    await comandaService.criar("Mesa 2");

    const renomeada = await comandaService.renomear(mesa1.id, "Balcao");

    assert.equal(renomeada.nome, "Balcao");
    await assert.rejects(() => comandaService.criar("balcao"), RegraNegocioError);
  });
});

test("permite repetir nome de comanda depois que a anterior foi fechada", async () => {
  await withServices(async ({ produtoService, comandaService }) => {
    await produtoService.cadastrar({ codigo: "123", nome: "Agua", custo: 1.5, preco: 3, estoque: 5 });
    const primeira = await comandaService.criar("Mesa VIP");
    await comandaService.adicionarItem(primeira.id, "123", 1);
    await comandaService.fechar(primeira.id, "DINHEIRO", 3, new Date(2026, 4, 3));

    const segunda = await comandaService.criar("Mesa VIP");

    assert.equal(segunda.nome, "Mesa VIP");
  });
});

test("fecha comanda com dinheiro, calcula troco e gera historico", async () => {
  await withServices(async ({ produtoService, comandaService, pagamentoService }, dir) => {
    await produtoService.cadastrar({ codigo: "123", nome: "Cerveja", custo: 6, preco: 10, estoque: 5 });
    await produtoService.cadastrar({ codigo: "789", nome: "Refri", custo: 2, preco: 5, estoque: 3 });
    const comanda = await comandaService.criar("Mesa 7");
    await comandaService.adicionarItem(comanda.id, "123", 2);
    await comandaService.adicionarItem(comanda.id, "789", 1);

    const { comanda: fechada, vendaPath, troco } = await comandaService.fechar(comanda.id, "DINHEIRO", 30, new Date(2026, 4, 3));
    const venda = await readFile(vendaPath, "utf8");
    const pagamentosTxt = await readFile(path.join(dir, "pagamentos.txt"), "utf8");
    const comandasTxt = await readFile(path.join(dir, "comandas.txt"), "utf8");

    assert.equal(troco, 5);
    assert.equal(fechada.status, "FECHADA");
    assert.equal(fechada.total, 0);
    assert.deepEqual(fechada.itens, []);
    assert.equal(produtoService.buscarPorCodigo("123")?.estoque, 3);
    assert.equal(produtoService.buscarPorCodigo("789")?.estoque, 2);
    assert.equal(pagamentoService.totalRecebidoNoDia(new Date(2026, 4, 3)), 25);
    assert.match(venda, /NOME: Mesa 7/);
    assert.match(venda, /PAGAMENTO: DINHEIRO/);
    assert.match(venda, /PAGAMENTOS:/);
    assert.match(venda, /DINHEIRO = 25.00 \| RECEBIDO: 30.00 \| TROCO: 5.00/);
    assert.match(venda, /TOTAL PAGO: 25.00/);
    assert.match(venda, /TOTAL: 25.00/);
    assert.match(pagamentosTxt, /1\|Mesa 7\|25\.00\|0\.00\|DINHEIRO\|123,2;789,1\|2026-05-03T.*\|30\.00\|5\.00\|123,Cerveja,2,10\.00,6\.00;789,Refri,1,5\.00,2\.00/);
    assert.match(comandasTxt, /1\|Mesa 7\|FECHADA\|\|0\.00/);
  });
});

test("nao permite inserir itens em comanda fechada", async () => {
  await withServices(async ({ produtoService, comandaService }) => {
    await produtoService.cadastrar({ codigo: "123", nome: "Cerveja", custo: 6, preco: 10, estoque: 5 });
    const comanda = await comandaService.criar("Mesa 1");
    await comandaService.adicionarItem(comanda.id, "123", 1);
    await comandaService.fechar(comanda.id, "DINHEIRO", 10, new Date(2026, 4, 3));

    await assert.rejects(() => comandaService.adicionarItem(comanda.id, "123", 1), RegraNegocioError);
  });
});

test("gera relatorio de vendas detalhado por periodo", async () => {
  await withServices(async ({ produtoService, comandaService, pagamentoService }) => {
    await produtoService.cadastrar({ codigo: "123", nome: "Cerveja", custo: 6, preco: 10, estoque: 10 });
    await produtoService.cadastrar({ codigo: "789", nome: "Refri", custo: 2, preco: 5, estoque: 10 });

    const mesa1 = await comandaService.criar("Mesa 1");
    await comandaService.adicionarItem(mesa1.id, "123", 2);
    await comandaService.pagarItens(mesa1.id, [{ codigo: "123", quantidade: 2 }], "PIX", undefined, new Date(2026, 4, 3));
    await comandaService.cancelar(mesa1.id);

    const mesa2 = await comandaService.criar("Mesa 2");
    await comandaService.adicionarItem(mesa2.id, "789", 3);
    await comandaService.fechar(mesa2.id, "DINHEIRO", 20, new Date(2026, 4, 4));

    const relatorio = pagamentoService.gerarRelatorioPorPeriodo("2026-05-03", "2026-05-04");

    assert.equal(relatorio.totalRecebido, 35);
    assert.equal(relatorio.totalCusto, 18);
    assert.equal(relatorio.lucroBruto, 17);
    assert.equal(relatorio.totalTroco, 5);
    assert.equal(relatorio.totaisPorMetodo.PIX, 20);
    assert.equal(relatorio.totaisPorMetodo.DINHEIRO, 15);
    assert.equal(relatorio.totaisPorMetodo.CARTAO, 0);
    assert.equal(relatorio.produtos.length, 2);
    assert.deepEqual(
      relatorio.produtos.map((produto) => ({
        codigo: produto.codigo,
        quantidadeVendida: produto.quantidadeVendida,
        totalVenda: produto.totalVenda,
        totalCusto: produto.totalCusto
      })),
      [
        { codigo: "123", quantidadeVendida: 2, totalVenda: 20, totalCusto: 12 },
        { codigo: "789", quantidadeVendida: 3, totalVenda: 15, totalCusto: 6 }
      ]
    );
  });
});
