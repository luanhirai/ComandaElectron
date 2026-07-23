"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProdutoService = void 0;
const errors_js_1 = require("../errors.js");
const parsers_js_1 = require("../utils/parsers.js");
class ProdutoService {
    fileService;
    produtos = new Map();
    constructor(fileService) {
        this.fileService = fileService;
    }
    async load() {
        const lines = await this.fileService.readLines(this.fileService.produtosPath);
        this.produtos.clear();
        for (const line of lines) {
            const produto = (0, parsers_js_1.parseProdutoLine)(line);
            if (produto)
                this.produtos.set(produto.codigo, produto);
        }
    }
    listar() {
        return Array.from(this.produtos.values()).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    }
    buscarPorCodigo(codigo) {
        return this.produtos.get(codigo);
    }
    buscarPorTermo(termo) {
        const query = this.normalize(termo);
        if (!query)
            return undefined;
        const byCode = this.produtos.get(termo.trim());
        if (byCode)
            return byCode;
        const produtos = this.listar();
        const exactName = produtos.find((produto) => this.normalize(produto.nome) === query);
        if (exactName)
            return exactName;
        const partialMatches = produtos.filter((produto) => {
            const normalizedName = this.normalize(produto.nome);
            return normalizedName.includes(query) || query.includes(normalizedName);
        });
        if (partialMatches.length === 1)
            return partialMatches[0];
        if (partialMatches.length > 1) {
            throw new errors_js_1.RegraNegocioError("Mais de um produto encontrado para esse nome. Digite algo mais especifico.");
        }
        return undefined;
    }
    async cadastrar(produto) {
        this.validarProduto(produto);
        if (this.produtos.has(produto.codigo)) {
            throw new errors_js_1.RegraNegocioError("Codigo de barras ja cadastrado.");
        }
        this.produtos.set(produto.codigo, { ...produto });
        await this.persistir();
        return produto;
    }
    async editar(codigo, dados) {
        const existente = this.produtos.get(codigo);
        if (!existente)
            throw new errors_js_1.RegraNegocioError("Produto nao encontrado.");
        const atualizado = { ...existente, ...dados };
        this.validarProduto(atualizado);
        this.produtos.set(codigo, atualizado);
        await this.persistir();
        return atualizado;
    }
    async excluir(codigo) {
        if (!this.produtos.delete(codigo)) {
            throw new errors_js_1.RegraNegocioError("Produto nao encontrado.");
        }
        await this.persistir();
    }
    async baixarEstoque(codigo, quantidade) {
        const produto = this.produtos.get(codigo);
        if (!produto)
            throw new errors_js_1.RegraNegocioError("Produto nao encontrado.");
        if (produto.estoque < quantidade)
            throw new errors_js_1.RegraNegocioError("Produto sem estoque suficiente.");
        const atualizado = { ...produto, estoque: produto.estoque - quantidade };
        this.produtos.set(codigo, atualizado);
        await this.persistir();
        return atualizado;
    }
    validarProduto(produto) {
        if (!produto.codigo.trim())
            throw new errors_js_1.RegraNegocioError("Codigo de barras e obrigatorio.");
        if (!produto.nome.trim())
            throw new errors_js_1.RegraNegocioError("Nome do produto e obrigatorio.");
        if (!Number.isFinite(produto.custo) || produto.custo < 0) {
            throw new errors_js_1.RegraNegocioError("Preco de custo deve ser maior ou igual a zero.");
        }
        if (!Number.isFinite(produto.preco) || produto.preco <= 0) {
            throw new errors_js_1.RegraNegocioError("Preco deve ser maior que zero.");
        }
        if (!Number.isInteger(produto.estoque) || produto.estoque < 0) {
            throw new errors_js_1.RegraNegocioError("Estoque deve ser um numero inteiro maior ou igual a zero.");
        }
    }
    normalize(value) {
        return value
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
            .trim()
            .toLowerCase();
    }
    async persistir() {
        await this.fileService.writeLines(this.fileService.produtosPath, parsers_js_1.PRODUTOS_HEADER, this.listar().map(parsers_js_1.serializeProduto));
    }
}
exports.ProdutoService = ProdutoService;
//# sourceMappingURL=produto-service.js.map