import assert from "node:assert/strict";
import { access, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { _electron as electron } from "playwright";

test("fluxo completo: home, cadastro, pagamento parcial, fechamento e caixa", { timeout: 120000 }, async () => {
  const dbDir = await mkdtemp(path.join(tmpdir(), "sistema-bar-e2e-"));
  const appPath = path.resolve(".");
  let electronApp;
  const { ELECTRON_RUN_AS_NODE, ...cleanEnv } = process.env;
  const hoje = new Date();
  const hojeArquivo = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;

  try {
    electronApp = await electron.launch({
      args: [appPath],
      env: {
        ...cleanEnv,
        BAR_DB_DIR: dbDir
      }
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState("domcontentloaded");
    await window.waitForSelector("text=Sistema de Bar");

    await window.click('button[data-nav="cadastro"]');
    await window.fill("#codigo", "123456");
    await window.fill("#nome", "Cerveja");
    await window.fill("#custo", "6");
    await window.fill("#preco", "10");
    await window.fill("#estoque", "5");
    await window.click("#salvarProduto");
    await window.waitForSelector("text=Produto salvo");

    await window.fill("#codigo", "789101");
    await window.fill("#nome", "Refrigerante");
    await window.fill("#custo", "2");
    await window.fill("#preco", "5");
    await window.fill("#estoque", "4");
    await window.click("#salvarProduto");
    await window.waitForSelector("text=Refrigerante");

    await window.click('button[data-view="venda"]');
    await window.click("#criarComanda");
    await window.fill("#modalNomeComanda", "Mesa Azul");
    await window.click("#confirmarNomeComanda");
    await window.waitForSelector("text=Mesa Azul");

    await window.click("#criarComanda");
    await window.fill("#modalNomeComanda", "Mesa Verde");
    await window.click("#confirmarNomeComanda");
    await window.waitForSelector("text=Mesa Verde");
    await window.click('[data-action="selecionar-comanda"][data-id="2"]');
    await window.click('button[data-action="cancelar-comanda"]');
    await window.waitForFunction(() => {
      const list = document.querySelector("#comandasList");
      return !(list?.textContent ?? "").includes("Mesa Verde");
    });
    await window.click('[data-action="selecionar-comanda"][data-id="1"]');

    await window.fill("#scannerInput", "123456");
    await window.fill("#quantidadeInput", "2");
    await window.click("#adicionarItem");
    await window.waitForSelector("text=Item adicionado");

    await window.fill("#scannerInput", "Refr");
    await window.waitForSelector("#autocompleteList");
    await window.click('button[data-view="cadastro"]');
    await window.waitForFunction(() => {
      const list = document.querySelector("#autocompleteList");
      return !list || list.classList.contains("hidden");
    });
    await window.click('button[data-view="venda"]');
    await window.fill("#scannerInput", "Refr");
    await window.waitForSelector("#autocompleteList");
    await window.click('button[data-action="selecionar-sugestao"][data-codigo="789101"]');
    await window.fill("#quantidadeInput", "1");
    await window.click("#adicionarItem");
    await window.waitForFunction(() => {
      const detail = document.querySelector("#comandaDetalhe");
      const texto = (detail?.textContent ?? "").replace(/\s+/g, " ");
      return texto.includes("Refrigerante") && texto.includes("25,00");
    });

    await window.check('input[data-codigo="123456"]');
    await window.click('button[data-action="abrir-pagamento-parcial"]');
    await window.selectOption("#modalMetodo", "PIX");
    await window.click("#confirmarPagamento");
    await window.waitForSelector("text=Pagamento parcial registrado");
    await window.waitForFunction(() => {
      const detail = document.querySelector("#comandaDetalhe");
      const texto = (detail?.textContent ?? "").replace(/\s+/g, " ");
      return texto.includes("5,00") && texto.includes("Refrigerante");
    });

    await window.click('button[data-action="abrir-fechamento-total"]');
    await window.selectOption("#modalMetodo", "DINHEIRO");
    await window.fill("#modalValorRecebido", "10");
    await window.click("#confirmarPagamento");
    await window.waitForFunction(() => {
      const toast = document.querySelector("#toast")?.textContent ?? "";
      return toast.includes("Troco:");
    });
    await window.waitForFunction(() => {
      const list = document.querySelector("#comandasList");
      return !(list?.textContent ?? "").includes("Mesa Azul");
    });

    await window.click('button[data-view="fechamento"]');
    await window.waitForFunction(() => {
      const total = document.querySelector("#totalDia")?.textContent ?? "";
      return total.includes("25,00");
    });
    await window.click('button[data-view="relatorio"]');
    await window.fill("#reportInicio", hojeArquivo);
    await window.fill("#reportFim", hojeArquivo);
    await window.click("#buscarRelatorio");
    await window.waitForFunction(() => {
      const view = document.querySelector("#relatorioView");
      if (!view || view.classList.contains("hidden")) return false;
      const text = (view.textContent ?? "").replace(/\s+/g, " ");
      return (
        text.includes("Valor Total") &&
        text.includes("PIX") &&
        text.includes("Dinheiro") &&
        text.includes("Total de custo") &&
        text.includes("Refrigerante")
      );
    });
    await window.click("#exportarRelatorioPdf");
    await window.waitForSelector("text=PDF gerado em");

    const produtosPath = path.join(dbDir, "produtos.txt");
    const pagamentosPath = path.join(dbDir, "pagamentos.txt");
    const vendasDir = path.join(dbDir, "historico-comandas");
    const relatoriosDir = path.join(dbDir, "relatorios");

    await access(produtosPath);
    await access(pagamentosPath);
    await access(vendasDir);
    await access(relatoriosDir);

    const produtos = await readFile(produtosPath, "utf8");
    const pagamentos = await readFile(pagamentosPath, "utf8");
    const saleFiles = (await readdir(vendasDir)).filter((file) => file.endsWith(".txt"));
    const pdfFiles = (await readdir(relatoriosDir)).filter((file) => file.endsWith(".pdf"));
    assert.equal(saleFiles.length, 1);
    assert.equal(pdfFiles.length, 1);
    const venda = await readFile(path.join(vendasDir, saleFiles[0]), "utf8");

    assert.match(produtos, /123456\|Cerveja\|6\.00\|10\.00\|3/);
    assert.match(produtos, /789101\|Refrigerante\|2\.00\|5\.00\|3/);
    assert.match(pagamentos, /1\|Mesa Azul\|20\.00\|0\.00\|PIX\|123456,2\|.*\|\|0\.00\|123456,Cerveja,2,10\.00,6\.00/);
    assert.match(pagamentos, /1\|Mesa Azul\|5\.00\|0\.00\|DINHEIRO\|789101,1\|.*\|10\.00\|5\.00\|789101,Refrigerante,1,5\.00,2\.00/);
    assert.match(venda, /PAGAMENTOS:/);
    assert.match(venda, /NOME: Mesa Azul/);
    assert.match(venda, /PIX = 20.00/);
    assert.match(venda, /PAGAMENTO: DINHEIRO/);
    assert.match(venda, /DINHEIRO = 5.00 \| RECEBIDO: 10.00 \| TROCO: 5.00/);
    assert.match(venda, /TOTAL PAGO: 25.00/);
    assert.match(venda, /TOTAL: 25.00/);
  } finally {
    if (electronApp) {
      await electronApp.close();
    }
    await rm(dbDir, { recursive: true, force: true });
  }
});
