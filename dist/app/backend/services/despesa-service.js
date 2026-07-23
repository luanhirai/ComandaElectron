"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DespesaService = void 0;
const errors_js_1 = require("../errors.js");
const parsers_js_1 = require("../utils/parsers.js");
class DespesaService {
    fileService;
    despesas = new Map();
    constructor(fileService) {
        this.fileService = fileService;
    }
    async load() {
        const lines = await this.fileService.readLines(this.fileService.despesasPath);
        this.despesas.clear();
        for (const line of lines) {
            const despesa = (0, parsers_js_1.parseDespesaLine)(line);
            if (despesa)
                this.despesas.set(despesa.id, despesa);
        }
    }
    listar() {
        return Array.from(this.despesas.values()).sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id);
    }
    async cadastrar(dados) {
        const despesa = { ...dados, id: this.proximoId() };
        this.validar(despesa);
        this.despesas.set(despesa.id, despesa);
        await this.persistir();
        return despesa;
    }
    async editar(id, dados) {
        const existente = this.despesas.get(id);
        if (!existente)
            throw new errors_js_1.RegraNegocioError("Despesa nao encontrada.");
        const atualizada = { ...existente, ...dados, id };
        this.validar(atualizada);
        this.despesas.set(id, atualizada);
        await this.persistir();
        return atualizada;
    }
    async excluir(id) {
        if (!this.despesas.delete(id))
            throw new errors_js_1.RegraNegocioError("Despesa nao encontrada.");
        await this.persistir();
    }
    proximoId() {
        const ids = Array.from(this.despesas.keys());
        return ids.length ? Math.max(...ids) + 1 : 1;
    }
    validar(despesa) {
        if (!despesa.descricao.trim())
            throw new errors_js_1.RegraNegocioError("Descricao da despesa e obrigatoria.");
        if (!despesa.categoria.trim())
            throw new errors_js_1.RegraNegocioError("Categoria da despesa e obrigatoria.");
        if (!Number.isFinite(despesa.valor) || despesa.valor <= 0) {
            throw new errors_js_1.RegraNegocioError("Valor da despesa deve ser maior que zero.");
        }
        if (!["DINHEIRO", "CARTAO", "PIX"].includes(despesa.metodoPagamento)) {
            throw new errors_js_1.RegraNegocioError("Metodo de pagamento invalido para despesa.");
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(despesa.data)) {
            throw new errors_js_1.RegraNegocioError("Data da despesa e obrigatoria.");
        }
    }
    async persistir() {
        await this.fileService.writeLines(this.fileService.despesasPath, parsers_js_1.DESPESAS_HEADER, this.listar().map(parsers_js_1.serializeDespesa));
    }
}
exports.DespesaService = DespesaService;
//# sourceMappingURL=despesa-service.js.map