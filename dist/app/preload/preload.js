"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { contextBridge, ipcRenderer } = require("electron");
const api = {
    snapshot: () => ipcRenderer.invoke("snapshot"),
    cadastrarProduto: (produto) => ipcRenderer.invoke("produto:cadastrar", produto),
    editarProduto: (codigo, dados) => ipcRenderer.invoke("produto:editar", codigo, dados),
    excluirProduto: (codigo) => ipcRenderer.invoke("produto:excluir", codigo),
    cadastrarDespesa: (despesa) => ipcRenderer.invoke("despesa:cadastrar", despesa),
    editarDespesa: (id, despesa) => ipcRenderer.invoke("despesa:editar", id, despesa),
    excluirDespesa: (id) => ipcRenderer.invoke("despesa:excluir", id),
    criarComanda: (nome) => ipcRenderer.invoke("comanda:criar", nome),
    renomearComanda: (id, nome) => ipcRenderer.invoke("comanda:renomear", id, nome),
    definirDescontoComanda: (id, desconto) => ipcRenderer.invoke("comanda:desconto", id, desconto),
    adicionarItem: (id, termo, quantidade, precoUnitario) => ipcRenderer.invoke("comanda:adicionar", id, termo, quantidade, precoUnitario),
    editarPrecoItem: (id, codigo, precoUnitario) => ipcRenderer.invoke("comanda:editar-preco-item", id, codigo, precoUnitario),
    removerItem: (id, codigo, quantidade) => ipcRenderer.invoke("comanda:remover", id, codigo, quantidade),
    adicionarMaisItem: (id, codigo, quantidade) => ipcRenderer.invoke("comanda:adicionar-mais", id, codigo, quantidade),
    cancelarComanda: (id) => ipcRenderer.invoke("comanda:cancelar", id),
    pagarItens: (id, itensSelecionados, metodoPagamento, valorRecebido, valorPago) => ipcRenderer.invoke("comanda:pagar-itens", id, itensSelecionados, metodoPagamento, valorRecebido, valorPago),
    dividirComanda: (id, pessoas) => ipcRenderer.invoke("comanda:dividir", id, pessoas),
    quitarFiado: (comandaId, dataFiado, metodoPagamento, valorRecebido) => ipcRenderer.invoke("fiado:quitar", comandaId, dataFiado, metodoPagamento, valorRecebido),
    cancelarFiado: (comandaId, dataFiado) => ipcRenderer.invoke("fiado:cancelar", comandaId, dataFiado),
    relatorioPorPeriodo: (inicio, fim) => ipcRenderer.invoke("relatorio:periodo", inicio, fim),
    exportarRelatorioPdf: (inicio, fim) => ipcRenderer.invoke("relatorio:exportar-pdf", inicio, fim),
    fecharComanda: (id, metodoPagamento, valorRecebido) => ipcRenderer.invoke("comanda:fechar", id, metodoPagamento, valorRecebido)
};
contextBridge.exposeInMainWorld("barApi", api);
//# sourceMappingURL=preload.js.map