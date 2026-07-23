"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PagamentoService = void 0;
const errors_js_1 = require("../errors.js");
const format_js_1 = require("../utils/format.js");
const parsers_js_1 = require("../utils/parsers.js");
class PagamentoService {
    fileService;
    pagamentos = [];
    constructor(fileService) {
        this.fileService = fileService;
    }
    async load() {
        const lines = await this.fileService.readLines(this.fileService.pagamentosPath);
        this.pagamentos = lines.map(parsers_js_1.parsePagamentoLine).filter((pagamento) => Boolean(pagamento));
    }
    listar() {
        return [...this.pagamentos].sort((a, b) => b.data.localeCompare(a.data));
    }
    listarPorComanda(comandaId) {
        return this.pagamentos
            .filter((pagamento) => pagamento.comandaId === comandaId)
            .sort((a, b) => a.data.localeCompare(b.data));
    }
    gerarRelatorioPorPeriodo(inicio, fim) {
        const inicioDate = `${inicio}T00:00:00`;
        const fimDate = `${fim}T23:59:59`;
        const pagamentos = this.pagamentos
            .filter((pagamento) => pagamento.data >= inicioDate && pagamento.data <= fimDate)
            .filter((pagamento) => pagamento.metodo !== "FIADO")
            .sort((a, b) => a.data.localeCompare(b.data));
        const produtosMap = new Map();
        const totaisPorMetodo = {
            DINHEIRO: 0,
            CARTAO: 0,
            PIX: 0,
            FIADO: 0
        };
        let totalRecebido = 0;
        let totalCusto = 0;
        let totalDescontos = 0;
        let totalTroco = 0;
        for (const pagamento of pagamentos) {
            totalRecebido += pagamento.valor;
            totalDescontos += pagamento.desconto;
            totalTroco += pagamento.troco ?? 0;
            totaisPorMetodo[pagamento.metodo] += pagamento.valor;
            for (const item of pagamento.itensDetalhados) {
                const current = produtosMap.get(item.codigo) ?? {
                    codigo: item.codigo,
                    nome: item.nome,
                    quantidadeVendida: 0,
                    totalVenda: 0,
                    totalCusto: 0,
                    lucroBruto: 0
                };
                current.quantidadeVendida += item.quantidade;
                current.totalVenda += item.quantidade * item.precoUnitario;
                current.totalCusto += item.quantidade * item.custoUnitario;
                current.lucroBruto = current.totalVenda - current.totalCusto;
                totalCusto += item.quantidade * item.custoUnitario;
                produtosMap.set(item.codigo, current);
            }
        }
        return {
            periodo: { inicio, fim },
            totalRecebido,
            totalFiado: 0,
            totalCusto,
            lucroBruto: totalRecebido - totalCusto,
            totaisPorMetodo,
            totalDescontos,
            totalTroco,
            pagamentos,
            produtos: Array.from(produtosMap.values()).sort((a, b) => b.totalVenda - a.totalVenda || a.nome.localeCompare(b.nome, "pt-BR"))
        };
    }
    async registrar(pagamento) {
        this.pagamentos.push(pagamento);
        await this.persistir();
        return pagamento;
    }
    async quitarFiado(comandaId, dataFiado, metodoPagamento, valorRecebido, dataPagamento = new Date()) {
        if (!["DINHEIRO", "CARTAO", "PIX"].includes(metodoPagamento)) {
            throw new errors_js_1.RegraNegocioError("Metodo de pagamento invalido para quitar fiado.");
        }
        const pagamento = this.obterFiado(comandaId, dataFiado);
        const troco = this.calcularTroco(pagamento.valor, metodoPagamento, valorRecebido);
        pagamento.metodo = metodoPagamento;
        pagamento.data = `${(0, format_js_1.formatFileDate)(dataPagamento)}T${dataPagamento.toTimeString().slice(0, 8)}`;
        pagamento.valorRecebido = metodoPagamento === "DINHEIRO" ? valorRecebido : undefined;
        pagamento.troco = troco;
        await this.persistir();
        return { pagamento, troco };
    }
    async cancelarFiado(comandaId, dataFiado) {
        const pagamento = this.obterFiado(comandaId, dataFiado);
        this.pagamentos = this.pagamentos.filter((entry) => entry !== pagamento);
        await this.persistir();
        return pagamento;
    }
    totalRecebidoNoDia(date = new Date()) {
        const today = (0, format_js_1.formatFileDate)(date);
        return this.pagamentos
            .filter((pagamento) => pagamento.data.startsWith(today))
            .filter((pagamento) => pagamento.metodo !== "FIADO")
            .reduce((total, pagamento) => total + pagamento.valor, 0);
    }
    async persistir() {
        await this.fileService.writeLines(this.fileService.pagamentosPath, parsers_js_1.PAGAMENTOS_HEADER, this.listar().map(parsers_js_1.serializePagamento));
    }
    obterFiado(comandaId, dataFiado) {
        const pagamento = this.pagamentos.find((entry) => entry.comandaId === comandaId && entry.data === dataFiado && entry.metodo === "FIADO");
        if (!pagamento)
            throw new errors_js_1.RegraNegocioError("Fiado nao encontrado ou ja baixado.");
        return pagamento;
    }
    calcularTroco(total, metodoPagamento, valorRecebido) {
        if (metodoPagamento !== "DINHEIRO")
            return 0;
        if (valorRecebido === undefined || !Number.isFinite(valorRecebido) || valorRecebido < total) {
            throw new errors_js_1.RegraNegocioError("Pagamento em dinheiro deve ser maior ou igual ao total.");
        }
        return valorRecebido - total;
    }
}
exports.PagamentoService = PagamentoService;
//# sourceMappingURL=pagamento-service.js.map