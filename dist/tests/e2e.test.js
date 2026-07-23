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
const playwright_1 = require("playwright");
(0, node_test_1.default)("fluxo completo: home, cadastro, pagamento parcial, fechamento e caixa", { timeout: 120000 }, async () => {
    const dbDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "sistema-bar-e2e-"));
    const appPath = node_path_1.default.resolve(".");
    let electronApp;
    const { ELECTRON_RUN_AS_NODE, ...cleanEnv } = process.env;
    const hoje = new Date();
    const hojeArquivo = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
    try {
        electronApp = await playwright_1._electron.launch({
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
            if (!view || view.classList.contains("hidden"))
                return false;
            const text = (view.textContent ?? "").replace(/\s+/g, " ");
            return (text.includes("Valor Total") &&
                text.includes("PIX") &&
                text.includes("Dinheiro") &&
                text.includes("Total de custo") &&
                text.includes("Refrigerante"));
        });
        await window.click("#exportarRelatorioPdf");
        await window.waitForSelector("text=PDF gerado em");
        const produtosPath = node_path_1.default.join(dbDir, "produtos.txt");
        const pagamentosPath = node_path_1.default.join(dbDir, "pagamentos.txt");
        const vendasDir = node_path_1.default.join(dbDir, "historico-comandas");
        const relatoriosDir = node_path_1.default.join(dbDir, "relatorios");
        await (0, promises_1.access)(produtosPath);
        await (0, promises_1.access)(pagamentosPath);
        await (0, promises_1.access)(vendasDir);
        await (0, promises_1.access)(relatoriosDir);
        const produtos = await (0, promises_1.readFile)(produtosPath, "utf8");
        const pagamentos = await (0, promises_1.readFile)(pagamentosPath, "utf8");
        const saleFiles = (await (0, promises_1.readdir)(vendasDir)).filter((file) => file.endsWith(".txt"));
        const pdfFiles = (await (0, promises_1.readdir)(relatoriosDir)).filter((file) => file.endsWith(".pdf"));
        strict_1.default.equal(saleFiles.length, 1);
        strict_1.default.equal(pdfFiles.length, 1);
        const venda = await (0, promises_1.readFile)(node_path_1.default.join(vendasDir, saleFiles[0]), "utf8");
        strict_1.default.match(produtos, /123456\|Cerveja\|6\.00\|10\.00\|3/);
        strict_1.default.match(produtos, /789101\|Refrigerante\|2\.00\|5\.00\|3/);
        strict_1.default.match(pagamentos, /1\|Mesa Azul\|20\.00\|0\.00\|PIX\|123456,2\|.*\|\|0\.00\|123456,Cerveja,2,10\.00,6\.00/);
        strict_1.default.match(pagamentos, /1\|Mesa Azul\|5\.00\|0\.00\|DINHEIRO\|789101,1\|.*\|10\.00\|5\.00\|789101,Refrigerante,1,5\.00,2\.00/);
        strict_1.default.match(venda, /PAGAMENTOS:/);
        strict_1.default.match(venda, /NOME: Mesa Azul/);
        strict_1.default.match(venda, /PIX = 20.00/);
        strict_1.default.match(venda, /PAGAMENTO: DINHEIRO/);
        strict_1.default.match(venda, /DINHEIRO = 5.00 \| RECEBIDO: 10.00 \| TROCO: 5.00/);
        strict_1.default.match(venda, /TOTAL PAGO: 25.00/);
        strict_1.default.match(venda, /TOTAL: 25.00/);
    }
    finally {
        if (electronApp) {
            await electronApp.close();
        }
        await (0, promises_1.rm)(dbDir, { recursive: true, force: true });
    }
});
//# sourceMappingURL=e2e.test.js.map