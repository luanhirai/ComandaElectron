import path from "node:path";
import { writeFile } from "node:fs/promises";
import { createAppServices } from "../backend/app-services.js";
import type { AppServices } from "../backend/app-services.js";
import type { RelatorioPeriodo } from "../backend/models/pagamento.js";

const { app, BrowserWindow, ipcMain } = require("electron") as typeof import("electron");
const projectRoot = path.resolve(__dirname, "../../..");
const rendererDir = path.join(projectRoot, "app", "renderer");
let mainWindow: InstanceType<typeof BrowserWindow> | null = null;
let services: AppServices | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: "#f6f7f9",
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  void mainWindow.loadFile(path.join(rendererDir, "index.html"));
}

app.whenReady().then(async () => {
  const databaseDir = process.env.BAR_DB_DIR || path.join(projectRoot, "app", "database");
  services = await createAppServices(databaseDir);
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

function getServices(): AppServices {
  if (!services) throw new Error("Servicos ainda nao inicializados.");
  return services;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function relatorioPdfHtml(relatorio: RelatorioPeriodo): string {
  const cards = [
    ["Valor Total", relatorio.totalRecebido],
    ["Dinheiro", relatorio.totaisPorMetodo.DINHEIRO],
    ["Cartao", relatorio.totaisPorMetodo.CARTAO],
    ["Pix", relatorio.totaisPorMetodo.PIX],
    ["Descontos", relatorio.totalDescontos],
    ["Total Custo", relatorio.totalCusto],
    ["Lucro Bruto", relatorio.lucroBruto],
    ["Troco", relatorio.totalTroco]
  ]
    .map(
      ([label, value]) => `
        <div class="metric">
          <span>${escapeHtml(String(label))}</span>
          <strong>${escapeHtml(formatCurrency(Number(value)))}</strong>
        </div>
      `
    )
    .join("");

  const pagamentos = relatorio.pagamentos.length
    ? relatorio.pagamentos
        .map(
          (pagamento) => `
            <div class="payment-row">
              <div>
                <strong>${escapeHtml(pagamento.comandaNome)}</strong>
                <div class="muted">${escapeHtml(pagamento.data.replace("T", " "))}</div>
              </div>
              <div class="right">
                <div>${escapeHtml(pagamento.metodo)}</div>
                <strong>${escapeHtml(formatCurrency(pagamento.valor))}</strong>
                ${pagamento.desconto > 0 ? `<div class="muted">Desconto ${escapeHtml(formatCurrency(pagamento.desconto))}</div>` : ""}
              </div>
            </div>
          `
        )
        .join("")
    : `<div class="empty">Sem pagamentos no periodo.</div>`;

  const produtos = relatorio.produtos.length
    ? relatorio.produtos
        .map(
          (produto) => `
            <div class="product-row">
              <div>
                <strong>${escapeHtml(produto.nome)}</strong>
                <div class="muted">${escapeHtml(produto.codigo)} | ${produto.quantidadeVendida} vendidos</div>
              </div>
              <div class="right">
                <div>Venda ${escapeHtml(formatCurrency(produto.totalVenda))}</div>
                <div>Custo ${escapeHtml(formatCurrency(produto.totalCusto))}</div>
                <strong>Lucro ${escapeHtml(formatCurrency(produto.lucroBruto))}</strong>
              </div>
            </div>
          `
        )
        .join("")
    : `<div class="empty">Sem produtos vendidos no periodo.</div>`;

  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>Relatorio de Vendas</title>
        <style>
          body {
            margin: 0;
            padding: 22px;
            background: #f6f3eb;
            color: #2a2119;
            font-family: Arial, sans-serif;
          }
          .sheet {
            border: 1px solid #d8cbb7;
            border-radius: 12px;
            background: #fffdf8;
            overflow: hidden;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 18px 20px;
            border-bottom: 1px solid #d8cbb7;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
          }
          .muted {
            color: #75695a;
            font-size: 12px;
          }
          .section {
            padding: 18px 20px;
            border-bottom: 1px solid #ece2d3;
          }
          .metrics {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }
          .metric {
            border: 1px solid #d8cbb7;
            border-radius: 10px;
            padding: 12px 14px;
            background: #f9f3e7;
            display: grid;
            gap: 6px;
          }
          .metric span, .label {
            color: #75695a;
            font-size: 12px;
            text-transform: uppercase;
          }
          .metric strong {
            color: #116f45;
            font-size: 18px;
          }
          .payment-row, .product-row {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            align-items: start;
            padding: 12px 0;
            border-top: 1px solid #ece2d3;
          }
          .payment-row:first-child, .product-row:first-child { border-top: 0; }
          .right { text-align: right; }
          .empty { color: #75695a; }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="header">
            <div>
              <div class="muted">RELATORIO</div>
              <h1>Vendas por Periodo</h1>
            </div>
            <div class="right">
              <div class="muted">Periodo</div>
              <strong>${escapeHtml(relatorio.periodo.inicio)} ate ${escapeHtml(relatorio.periodo.fim)}</strong>
            </div>
          </div>

          <div class="section">
            <div class="label">Resumo financeiro</div>
            <div class="metrics">${cards}</div>
          </div>

          <div class="section">
            <div class="label">Pagamentos do periodo</div>
            ${pagamentos}
          </div>

          <div class="section">
            <div class="label">Produtos vendidos</div>
            ${produtos}
          </div>
        </div>
      </body>
    </html>
  `;
}

ipcMain.handle("snapshot", async () => {
  const currentServices = getServices();
  const hoje = new Date().toISOString().slice(0, 10);
  return {
    produtos: currentServices.produtoService.listar(),
    comandas: currentServices.comandaService.listar(),
    pagamentos: currentServices.pagamentoService.listar(),
    despesas: currentServices.despesaService.listar(),
    vendas: await currentServices.vendaService.listarVendas(),
    totalDia: currentServices.pagamentoService.totalRecebidoNoDia(),
    relatorio: currentServices.pagamentoService.gerarRelatorioPorPeriodo(hoje, hoje)
  };
});

ipcMain.handle("produto:cadastrar", async (_event, produto) => getServices().produtoService.cadastrar(produto));
ipcMain.handle("produto:editar", async (_event, codigo, dados) => getServices().produtoService.editar(codigo, dados));
ipcMain.handle("produto:excluir", async (_event, codigo) => getServices().produtoService.excluir(codigo));
ipcMain.handle("despesa:cadastrar", async (_event, despesa) => getServices().despesaService.cadastrar(despesa));
ipcMain.handle("despesa:editar", async (_event, id, despesa) => getServices().despesaService.editar(id, despesa));
ipcMain.handle("despesa:excluir", async (_event, id) => getServices().despesaService.excluir(id));
ipcMain.handle("comanda:criar", async (_event, nome) => getServices().comandaService.criar(nome));
ipcMain.handle("comanda:renomear", async (_event, id, nome) => getServices().comandaService.renomear(id, nome));
ipcMain.handle("comanda:desconto", async (_event, id, desconto) => getServices().comandaService.definirDesconto(id, desconto));
ipcMain.handle("comanda:adicionar", async (_event, id, codigo, quantidade, precoUnitario) =>
  getServices().comandaService.adicionarItem(id, codigo, quantidade, precoUnitario)
);
ipcMain.handle("comanda:editar-preco-item", async (_event, id, codigo, precoUnitario) =>
  getServices().comandaService.editarPrecoItem(id, codigo, precoUnitario)
);
ipcMain.handle("comanda:remover", async (_event, id, codigo, quantidade) =>
  getServices().comandaService.removerItem(id, codigo, quantidade)
);
ipcMain.handle("comanda:adicionar-mais", async (_event, id, codigo, quantidade) =>
  getServices().comandaService.adicionarMaisItem(id, codigo, quantidade)
);
ipcMain.handle("comanda:cancelar", async (_event, id) => getServices().comandaService.cancelar(id));
ipcMain.handle("comanda:pagar-itens", async (_event, id, itensSelecionados, metodoPagamento, valorRecebido, valorPago) =>
  getServices().comandaService.pagarItens(id, itensSelecionados, metodoPagamento, valorRecebido, valorPago)
);
ipcMain.handle("comanda:dividir", async (_event, id, pessoas) => getServices().comandaService.dividirConta(id, pessoas));
ipcMain.handle("fiado:quitar", async (_event, comandaId, dataFiado, metodoPagamento, valorRecebido) =>
  getServices().pagamentoService.quitarFiado(comandaId, dataFiado, metodoPagamento, valorRecebido)
);
ipcMain.handle("fiado:cancelar", async (_event, comandaId, dataFiado) =>
  getServices().pagamentoService.cancelarFiado(comandaId, dataFiado)
);
ipcMain.handle("relatorio:periodo", async (_event, inicio, fim) =>
  getServices().pagamentoService.gerarRelatorioPorPeriodo(inicio, fim)
);
ipcMain.handle("relatorio:exportar-pdf", async (_event, inicio, fim) => {
  const currentServices = getServices();
  const relatorio = currentServices.pagamentoService.gerarRelatorioPorPeriodo(inicio, fim);
  const pdfWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: false
    }
  });

  const html = relatorioPdfHtml(relatorio);
  await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  const pdf = await pdfWindow.webContents.printToPDF({
    printBackground: true,
    pageSize: "A4",
    margins: {
      top: 0.4,
      bottom: 0.4,
      left: 0.4,
      right: 0.4
    }
  });
  pdfWindow.destroy();

  const safeInicio = inicio.replace(/[^0-9-]/g, "");
  const safeFim = fim.replace(/[^0-9-]/g, "");
  const filePath = path.join(currentServices.fileService.relatoriosDir, `relatorio_${safeInicio}_${safeFim}.pdf`);
  await writeFile(filePath, pdf);
  return { filePath };
});
ipcMain.handle("comanda:fechar", async (_event, id, metodoPagamento, valorRecebido) =>
  getServices().comandaService.fechar(id, metodoPagamento, valorRecebido)
);
