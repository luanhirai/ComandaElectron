"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const promises_1 = require("node:fs/promises");
const node_os_1 = require("node:os");
const node_path_1 = __importDefault(require("node:path"));
const node_test_1 = __importDefault(require("node:test"));
const app_services_js_1 = require("../app/backend/app-services.js");
const errors_js_1 = require("../app/backend/errors.js");
async function withServices(fn) {
    const dir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "sistema-bar-"));
    try {
        const services = await (0, app_services_js_1.createAppServices)(dir);
        await fn(services, dir);
    }
    finally {
        await (0, promises_1.rm)(dir, { recursive: true, force: true });
    }
}
(0, node_test_1.default)("cadastra, lista e impede codigo de barras duplicado", async () => {
    await withServices(async ({ produtoService }) => {
        await produtoService.cadastrar({ codigo: "123", nome: "Cerveja", custo: 6, preco: 10, estoque: 5 });
        strict_1.default.equal(produtoService.listar().length, 1);
        strict_1.default.equal(produtoService.buscarPorCodigo("123")?.nome, "Cerveja");
        strict_1.default.equal(produtoService.buscarPorCodigo("123")?.custo, 6);
        await strict_1.default.rejects(() => produtoService.cadastrar({ codigo: "123", nome: "Outra", custo: 7, preco: 11, estoque: 2 }), errors_js_1.RegraNegocioError);
    });
});
(0, node_test_1.default)("adiciona item pelo nome e recalcula o total", async () => {
    await withServices(async ({ produtoService, comandaService }) => {
        await produtoService.cadastrar({ codigo: "123", nome: "Cerveja Lata", custo: 6, preco: 10, estoque: 5 });
        const comanda = await comandaService.criar("Mesa 1");
        const atualizada = await comandaService.adicionarItem(comanda.id, "cerveja lata", 2);
        strict_1.default.equal(atualizada.total, 20);
        strict_1.default.deepEqual(atualizada.itens, [{ codigo: "123", quantidade: 2 }]);
    });
});
(0, node_test_1.default)("permite alterar preco do produto apenas na comanda", async () => {
    await withServices(async ({ produtoService, comandaService }) => {
        await produtoService.cadastrar({ codigo: "123", nome: "Cerveja Lata", custo: 6, preco: 10, estoque: 5 });
        const comanda = await comandaService.criar("Mesa 1");
        const comPrecoCustomizado = await comandaService.adicionarItem(comanda.id, "123", 2, 12.5);
        strict_1.default.equal(comPrecoCustomizado.total, 25);
        const comPrecoEditado = await comandaService.editarPrecoItem(comanda.id, "123", 9);
        strict_1.default.equal(comPrecoEditado.total, 18);
        strict_1.default.equal(comPrecoEditado.itens[0].precoUnitario, 9);
        strict_1.default.equal(comPrecoEditado.itens[0].nome, "Cerveja Lata");
        strict_1.default.equal(produtoService.buscarPorCodigo("123")?.preco, 10);
    });
});
(0, node_test_1.default)("pagamento parcial registra pagamento, baixa estoque e mantem restante na comanda", async () => {
    await withServices(async ({ produtoService, comandaService, pagamentoService }, dir) => {
        await produtoService.cadastrar({ codigo: "123", nome: "Cerveja", custo: 6, preco: 10, estoque: 5 });
        await produtoService.cadastrar({ codigo: "789", nome: "Refri", custo: 2, preco: 5, estoque: 4 });
        const comanda = await comandaService.criar("Mesa 1");
        await comandaService.adicionarItem(comanda.id, "123", 2);
        await comandaService.adicionarItem(comanda.id, "789", 1);
        const resultado = await comandaService.pagarItens(comanda.id, [{ codigo: "123", quantidade: 2 }], "PIX");
        const pagamentosTxt = await (0, promises_1.readFile)(node_path_1.default.join(dir, "pagamentos.txt"), "utf8");
        strict_1.default.equal(resultado.troco, 0);
        strict_1.default.equal(resultado.comanda.total, 5);
        strict_1.default.deepEqual(resultado.comanda.itens, [{ codigo: "789", quantidade: 1 }]);
        strict_1.default.equal(produtoService.buscarPorCodigo("123")?.estoque, 3);
        strict_1.default.equal(pagamentoService.totalRecebidoNoDia(new Date()), 20);
        strict_1.default.match(pagamentosTxt, /1\|Mesa 1\|20\.00\|0\.00\|PIX\|123,2\|.*\|\|/);
    });
});
(0, node_test_1.default)("pagamento menor que o selecionado cria saldo pendente na comanda", async () => {
    await withServices(async ({ produtoService, comandaService, pagamentoService }) => {
        await produtoService.cadastrar({ codigo: "123", nome: "Pao de alho", custo: 2, preco: 5, estoque: 5 });
        const comanda = await comandaService.criar("Mesa 1");
        await comandaService.adicionarItem(comanda.id, "123", 1);
        const resultado = await comandaService.pagarItens(comanda.id, [{ codigo: "123", quantidade: 1 }], "PIX", undefined, 3);
        const pagamento = pagamentoService.listarPorComanda(comanda.id)[0];
        strict_1.default.equal(pagamento.valor, 3);
        strict_1.default.equal(resultado.comanda.total, 2);
        strict_1.default.equal(resultado.comanda.itens.length, 1);
        strict_1.default.equal(resultado.comanda.itens[0].nome, "Saldo pendente");
        strict_1.default.equal(resultado.comanda.itens[0].precoUnitario, 2);
        strict_1.default.equal(produtoService.buscarPorCodigo("123")?.estoque, 4);
    });
});
(0, node_test_1.default)("permite colocar comanda no fiado sem somar ao caixa recebido", async () => {
    await withServices(async ({ produtoService, comandaService, pagamentoService }) => {
        await produtoService.cadastrar({ codigo: "123", nome: "Cerveja", custo: 6, preco: 10, estoque: 5 });
        const comanda = await comandaService.criar("Mesa Fiado");
        await comandaService.adicionarItem(comanda.id, "123", 2);
        const { comanda: fechada } = await comandaService.fechar(comanda.id, "FIADO", undefined, new Date(2026, 4, 3));
        const relatorio = pagamentoService.gerarRelatorioPorPeriodo("2026-05-03", "2026-05-03");
        strict_1.default.equal(fechada.status, "FECHADA");
        strict_1.default.equal(pagamentoService.totalRecebidoNoDia(new Date(2026, 4, 3)), 0);
        strict_1.default.equal(relatorio.totalRecebido, 0);
        strict_1.default.equal(relatorio.totalFiado, 0);
        strict_1.default.equal(relatorio.totaisPorMetodo.FIADO, 0);
        strict_1.default.equal(relatorio.pagamentos.length, 0);
        strict_1.default.equal(relatorio.produtos.length, 0);
    });
});
(0, node_test_1.default)("permite quitar fiado e incluir no relatorio do dia do pagamento", async () => {
    await withServices(async ({ produtoService, comandaService, pagamentoService }) => {
        await produtoService.cadastrar({ codigo: "123", nome: "Cerveja", custo: 6, preco: 10, estoque: 5 });
        const comanda = await comandaService.criar("Mesa Fiado");
        await comandaService.adicionarItem(comanda.id, "123", 2);
        await comandaService.fechar(comanda.id, "FIADO", undefined, new Date(2026, 4, 3));
        const fiado = pagamentoService.listarPorComanda(comanda.id)[0];
        await pagamentoService.quitarFiado(fiado.comandaId, fiado.data, "PIX", undefined, new Date(2026, 4, 5));
        const relatorioOriginal = pagamentoService.gerarRelatorioPorPeriodo("2026-05-03", "2026-05-03");
        const relatorioPagamento = pagamentoService.gerarRelatorioPorPeriodo("2026-05-05", "2026-05-05");
        strict_1.default.equal(pagamentoService.totalRecebidoNoDia(new Date(2026, 4, 5)), 20);
        strict_1.default.equal(relatorioOriginal.totalFiado, 0);
        strict_1.default.equal(relatorioPagamento.totalRecebido, 20);
        strict_1.default.equal(relatorioPagamento.totaisPorMetodo.PIX, 20);
        strict_1.default.equal(relatorioPagamento.produtos[0].codigo, "123");
    });
});
(0, node_test_1.default)("permite cancelar fiado pendente", async () => {
    await withServices(async ({ produtoService, comandaService, pagamentoService }) => {
        await produtoService.cadastrar({ codigo: "123", nome: "Agua", custo: 1, preco: 4, estoque: 5 });
        const comanda = await comandaService.criar("Cliente Balcao");
        await comandaService.adicionarItem(comanda.id, "123", 1);
        await comandaService.fechar(comanda.id, "FIADO", undefined, new Date(2026, 4, 3));
        const fiado = pagamentoService.listarPorComanda(comanda.id)[0];
        await pagamentoService.cancelarFiado(fiado.comandaId, fiado.data);
        const relatorio = pagamentoService.gerarRelatorioPorPeriodo("2026-05-03", "2026-05-03");
        strict_1.default.equal(pagamentoService.listarPorComanda(comanda.id).length, 0);
        strict_1.default.equal(relatorio.totalFiado, 0);
        strict_1.default.equal(relatorio.pagamentos.length, 0);
    });
});
(0, node_test_1.default)("divide comanda pelo numero de pessoas", async () => {
    await withServices(async ({ produtoService, comandaService }) => {
        await produtoService.cadastrar({ codigo: "123", nome: "Cerveja", custo: 8, preco: 12, estoque: 5 });
        const comanda = await comandaService.criar("Mesa 1");
        await comandaService.adicionarItem(comanda.id, "123", 3);
        const divisao = comandaService.dividirConta(comanda.id, 3);
        strict_1.default.equal(divisao.total, 36);
        strict_1.default.equal(divisao.valorPorPessoa, 12);
    });
});
(0, node_test_1.default)("aplica desconto fixo na comanda e mostra no relatorio", async () => {
    await withServices(async ({ produtoService, comandaService, pagamentoService }) => {
        await produtoService.cadastrar({ codigo: "123", nome: "Cerveja", custo: 6, preco: 10, estoque: 5 });
        const comanda = await comandaService.criar("Mesa Desconto");
        await comandaService.adicionarItem(comanda.id, "123", 2);
        const comDesconto = await comandaService.definirDesconto(comanda.id, 5);
        strict_1.default.equal(comDesconto.desconto, 5);
        strict_1.default.equal(comDesconto.total, 15);
        const { troco } = await comandaService.fechar(comanda.id, "DINHEIRO", 20, new Date(2026, 4, 3));
        const pagamento = pagamentoService.listarPorComanda(comanda.id)[0];
        const relatorio = pagamentoService.gerarRelatorioPorPeriodo("2026-05-03", "2026-05-03");
        strict_1.default.equal(troco, 5);
        strict_1.default.equal(pagamento.valor, 15);
        strict_1.default.equal(pagamento.desconto, 5);
        strict_1.default.equal(relatorio.totalRecebido, 15);
        strict_1.default.equal(relatorio.totalDescontos, 5);
        strict_1.default.equal(relatorio.lucroBruto, 3);
    });
});
(0, node_test_1.default)("permite cancelar comanda aberta", async () => {
    await withServices(async ({ produtoService, comandaService }) => {
        await produtoService.cadastrar({ codigo: "123", nome: "Cerveja", custo: 8, preco: 12, estoque: 5 });
        const comanda = await comandaService.criar("Mesa 1");
        await comandaService.adicionarItem(comanda.id, "123", 1);
        const cancelada = await comandaService.cancelar(comanda.id);
        strict_1.default.equal(cancelada.status, "CANCELADA");
        strict_1.default.equal(comandaService.listarAbertas().length, 0);
    });
});
(0, node_test_1.default)("cadastra, edita e exclui despesas", async () => {
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
        const despesasTxt = await (0, promises_1.readFile)(node_path_1.default.join(dir, "despesas.txt"), "utf8");
        strict_1.default.equal(atualizada.id, despesa.id);
        strict_1.default.equal(despesaService.listar().length, 1);
        strict_1.default.match(despesasTxt, /1\|Compra%20de%20gelo%20e%20limao\|Insumos\|45\.00\|DINHEIRO\|2026-05-04\|Reposicao/);
        await despesaService.excluir(despesa.id);
        strict_1.default.equal(despesaService.listar().length, 0);
    });
});
(0, node_test_1.default)("permite renomear comanda aberta e bloqueia nome duplicado entre abertas", async () => {
    await withServices(async ({ comandaService }) => {
        const mesa1 = await comandaService.criar("Mesa 1");
        await comandaService.criar("Mesa 2");
        const renomeada = await comandaService.renomear(mesa1.id, "Balcao");
        strict_1.default.equal(renomeada.nome, "Balcao");
        await strict_1.default.rejects(() => comandaService.criar("balcao"), errors_js_1.RegraNegocioError);
    });
});
(0, node_test_1.default)("permite repetir nome de comanda depois que a anterior foi fechada", async () => {
    await withServices(async ({ produtoService, comandaService }) => {
        await produtoService.cadastrar({ codigo: "123", nome: "Agua", custo: 1.5, preco: 3, estoque: 5 });
        const primeira = await comandaService.criar("Mesa VIP");
        await comandaService.adicionarItem(primeira.id, "123", 1);
        await comandaService.fechar(primeira.id, "DINHEIRO", 3, new Date(2026, 4, 3));
        const segunda = await comandaService.criar("Mesa VIP");
        strict_1.default.equal(segunda.nome, "Mesa VIP");
    });
});
(0, node_test_1.default)("fecha comanda com dinheiro, calcula troco e gera historico", async () => {
    await withServices(async ({ produtoService, comandaService, pagamentoService }, dir) => {
        await produtoService.cadastrar({ codigo: "123", nome: "Cerveja", custo: 6, preco: 10, estoque: 5 });
        await produtoService.cadastrar({ codigo: "789", nome: "Refri", custo: 2, preco: 5, estoque: 3 });
        const comanda = await comandaService.criar("Mesa 7");
        await comandaService.adicionarItem(comanda.id, "123", 2);
        await comandaService.adicionarItem(comanda.id, "789", 1);
        const { comanda: fechada, vendaPath, troco } = await comandaService.fechar(comanda.id, "DINHEIRO", 30, new Date(2026, 4, 3));
        const venda = await (0, promises_1.readFile)(vendaPath, "utf8");
        const pagamentosTxt = await (0, promises_1.readFile)(node_path_1.default.join(dir, "pagamentos.txt"), "utf8");
        const comandasTxt = await (0, promises_1.readFile)(node_path_1.default.join(dir, "comandas.txt"), "utf8");
        strict_1.default.equal(troco, 5);
        strict_1.default.equal(fechada.status, "FECHADA");
        strict_1.default.equal(fechada.total, 0);
        strict_1.default.deepEqual(fechada.itens, []);
        strict_1.default.equal(produtoService.buscarPorCodigo("123")?.estoque, 3);
        strict_1.default.equal(produtoService.buscarPorCodigo("789")?.estoque, 2);
        strict_1.default.equal(pagamentoService.totalRecebidoNoDia(new Date(2026, 4, 3)), 25);
        strict_1.default.match(venda, /NOME: Mesa 7/);
        strict_1.default.match(venda, /PAGAMENTO: DINHEIRO/);
        strict_1.default.match(venda, /PAGAMENTOS:/);
        strict_1.default.match(venda, /DINHEIRO = 25.00 \| RECEBIDO: 30.00 \| TROCO: 5.00/);
        strict_1.default.match(venda, /TOTAL PAGO: 25.00/);
        strict_1.default.match(venda, /TOTAL: 25.00/);
        strict_1.default.match(pagamentosTxt, /1\|Mesa 7\|25\.00\|0\.00\|DINHEIRO\|123,2;789,1\|2026-05-03T.*\|30\.00\|5\.00\|123,Cerveja,2,10\.00,6\.00;789,Refri,1,5\.00,2\.00/);
        strict_1.default.match(comandasTxt, /1\|Mesa 7\|FECHADA\|\|0\.00/);
    });
});
(0, node_test_1.default)("nao permite inserir itens em comanda fechada", async () => {
    await withServices(async ({ produtoService, comandaService }) => {
        await produtoService.cadastrar({ codigo: "123", nome: "Cerveja", custo: 6, preco: 10, estoque: 5 });
        const comanda = await comandaService.criar("Mesa 1");
        await comandaService.adicionarItem(comanda.id, "123", 1);
        await comandaService.fechar(comanda.id, "DINHEIRO", 10, new Date(2026, 4, 3));
        await strict_1.default.rejects(() => comandaService.adicionarItem(comanda.id, "123", 1), errors_js_1.RegraNegocioError);
    });
});
(0, node_test_1.default)("gera relatorio de vendas detalhado por periodo", async () => {
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
        strict_1.default.equal(relatorio.totalRecebido, 35);
        strict_1.default.equal(relatorio.totalCusto, 18);
        strict_1.default.equal(relatorio.lucroBruto, 17);
        strict_1.default.equal(relatorio.totalTroco, 5);
        strict_1.default.equal(relatorio.totaisPorMetodo.PIX, 20);
        strict_1.default.equal(relatorio.totaisPorMetodo.DINHEIRO, 15);
        strict_1.default.equal(relatorio.totaisPorMetodo.CARTAO, 0);
        strict_1.default.equal(relatorio.produtos.length, 2);
        strict_1.default.deepEqual(relatorio.produtos.map((produto) => ({
            codigo: produto.codigo,
            quantidadeVendida: produto.quantidadeVendida,
            totalVenda: produto.totalVenda,
            totalCusto: produto.totalCusto
        })), [
            { codigo: "123", quantidadeVendida: 2, totalVenda: 20, totalCusto: 12 },
            { codigo: "789", quantidadeVendida: 3, totalVenda: 15, totalCusto: 6 }
        ]);
    });
});
//# sourceMappingURL=services.test.js.map