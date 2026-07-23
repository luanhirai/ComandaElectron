import type { Comanda } from "../backend/models/comanda.js";
import type { Despesa, NovaDespesa } from "../backend/models/despesa.js";
import type { Pagamento, RelatorioPeriodo } from "../backend/models/pagamento.js";
import type { Produto } from "../backend/models/produto.js";
import type { MetodoPagamento } from "../backend/models/venda.js";

const { contextBridge, ipcRenderer } = require("electron") as typeof import("electron");

type Snapshot = {
  produtos: Produto[];
  comandas: Comanda[];
  pagamentos: Pagamento[];
  despesas: Despesa[];
  vendas: { arquivo: string; conteudo: string }[];
  totalDia: number;
  relatorio: RelatorioPeriodo;
};

const api = {
  snapshot: (): Promise<Snapshot> => ipcRenderer.invoke("snapshot"),
  cadastrarProduto: (produto: Produto): Promise<Produto> => ipcRenderer.invoke("produto:cadastrar", produto),
  editarProduto: (codigo: string, dados: Omit<Produto, "codigo">): Promise<Produto> =>
    ipcRenderer.invoke("produto:editar", codigo, dados),
  excluirProduto: (codigo: string): Promise<void> => ipcRenderer.invoke("produto:excluir", codigo),
  cadastrarDespesa: (despesa: NovaDespesa): Promise<Despesa> => ipcRenderer.invoke("despesa:cadastrar", despesa),
  editarDespesa: (id: number, despesa: NovaDespesa): Promise<Despesa> => ipcRenderer.invoke("despesa:editar", id, despesa),
  excluirDespesa: (id: number): Promise<void> => ipcRenderer.invoke("despesa:excluir", id),
  criarComanda: (nome: string): Promise<Comanda> => ipcRenderer.invoke("comanda:criar", nome),
  renomearComanda: (id: number, nome: string): Promise<Comanda> => ipcRenderer.invoke("comanda:renomear", id, nome),
  definirDescontoComanda: (id: number, desconto: number): Promise<Comanda> =>
    ipcRenderer.invoke("comanda:desconto", id, desconto),
  adicionarItem: (id: number, termo: string, quantidade: number, precoUnitario?: number): Promise<Comanda> =>
    ipcRenderer.invoke("comanda:adicionar", id, termo, quantidade, precoUnitario),
  editarPrecoItem: (id: number, codigo: string, precoUnitario: number): Promise<Comanda> =>
    ipcRenderer.invoke("comanda:editar-preco-item", id, codigo, precoUnitario),
  removerItem: (id: number, codigo: string, quantidade: number): Promise<Comanda> =>
    ipcRenderer.invoke("comanda:remover", id, codigo, quantidade),
  adicionarMaisItem: (id: number, codigo: string, quantidade: number): Promise<Comanda> =>
    ipcRenderer.invoke("comanda:adicionar-mais", id, codigo, quantidade),
  cancelarComanda: (id: number): Promise<Comanda> => ipcRenderer.invoke("comanda:cancelar", id),
  pagarItens: (
    id: number,
    itensSelecionados: { codigo: string; quantidade: number }[],
    metodoPagamento: MetodoPagamento,
    valorRecebido?: number,
    valorPago?: number
  ): Promise<{ comanda: Comanda; pagamento: Pagamento; troco: number }> =>
    ipcRenderer.invoke("comanda:pagar-itens", id, itensSelecionados, metodoPagamento, valorRecebido, valorPago),
  dividirComanda: (id: number, pessoas: number): Promise<{ total: number; valorPorPessoa: number }> =>
    ipcRenderer.invoke("comanda:dividir", id, pessoas),
  quitarFiado: (
    comandaId: number,
    dataFiado: string,
    metodoPagamento: Exclude<MetodoPagamento, "FIADO">,
    valorRecebido?: number
  ): Promise<{ pagamento: Pagamento; troco: number }> =>
    ipcRenderer.invoke("fiado:quitar", comandaId, dataFiado, metodoPagamento, valorRecebido),
  cancelarFiado: (comandaId: number, dataFiado: string): Promise<Pagamento> =>
    ipcRenderer.invoke("fiado:cancelar", comandaId, dataFiado),
  relatorioPorPeriodo: (inicio: string, fim: string): Promise<RelatorioPeriodo> =>
    ipcRenderer.invoke("relatorio:periodo", inicio, fim),
  exportarRelatorioPdf: (inicio: string, fim: string): Promise<{ filePath: string }> =>
    ipcRenderer.invoke("relatorio:exportar-pdf", inicio, fim),
  fecharComanda: (
    id: number,
    metodoPagamento: MetodoPagamento,
    valorRecebido?: number
  ): Promise<{ comanda: Comanda; vendaPath: string; troco: number }> =>
    ipcRenderer.invoke("comanda:fechar", id, metodoPagamento, valorRecebido)
};

contextBridge.exposeInMainWorld("barApi", api);

export type BarApi = typeof api;
