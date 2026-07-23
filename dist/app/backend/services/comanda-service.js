"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComandaService = void 0;
const errors_js_1 = require("../errors.js");
const parsers_js_1 = require("../utils/parsers.js");
const format_js_1 = require("../utils/format.js");
class ComandaService {
    fileService;
    produtoService;
    pagamentoService;
    vendaService;
    comandas = new Map();
    constructor(fileService, produtoService, pagamentoService, vendaService) {
        this.fileService = fileService;
        this.produtoService = produtoService;
        this.pagamentoService = pagamentoService;
        this.vendaService = vendaService;
    }
    async load() {
        const lines = await this.fileService.readLines(this.fileService.comandasPath);
        this.comandas.clear();
        for (const line of lines) {
            const comanda = (0, parsers_js_1.parseComandaLine)(line);
            if (comanda)
                this.comandas.set(comanda.id, comanda);
        }
    }
    listar() {
        return Array.from(this.comandas.values()).sort((a, b) => a.id - b.id);
    }
    listarAbertas() {
        return this.listar().filter((comanda) => comanda.status === "ABERTA");
    }
    buscar(id) {
        return this.comandas.get(id);
    }
    async criar(nome) {
        const nomeValidado = this.validarNomeDisponivel(nome);
        const id = this.proximoId();
        const comanda = { id, nome: nomeValidado, status: "ABERTA", itens: [], desconto: 0, total: 0 };
        this.comandas.set(id, comanda);
        await this.persistir();
        return comanda;
    }
    async renomear(id, nome) {
        const comanda = this.obterAberta(id);
        comanda.nome = this.validarNomeDisponivel(nome, id);
        await this.persistir();
        return comanda;
    }
    async definirDesconto(id, desconto) {
        const comanda = this.obterAberta(id);
        const descontoValidado = this.validarDesconto(comanda, desconto);
        comanda.desconto = descontoValidado;
        this.recalcularTotal(comanda);
        await this.persistir();
        return comanda;
    }
    async adicionarItem(id, termo, quantidade = 1, precoUnitario) {
        if (!Number.isInteger(quantidade) || quantidade <= 0) {
            throw new errors_js_1.RegraNegocioError("Quantidade deve ser maior que zero.");
        }
        const comanda = this.obterAberta(id);
        const produto = this.produtoService.buscarPorTermo(termo);
        if (!produto)
            throw new errors_js_1.RegraNegocioError("Produto nao encontrado.");
        const codigo = produto.codigo;
        const precoNaComanda = precoUnitario === undefined ? undefined : this.validarPrecoUnitario(precoUnitario);
        const itemExistente = comanda.itens.find((item) => item.codigo === codigo);
        const quantidadeNaComanda = itemExistente?.quantidade ?? 0;
        if (produto.estoque < quantidadeNaComanda + quantidade) {
            throw new errors_js_1.RegraNegocioError("Produto sem estoque suficiente.");
        }
        if (itemExistente) {
            itemExistente.quantidade += quantidade;
            if (precoNaComanda !== undefined) {
                itemExistente.precoUnitario = precoNaComanda;
                itemExistente.nome = itemExistente.nome ?? produto.nome;
                itemExistente.custoUnitario = itemExistente.custoUnitario ?? produto.custo;
            }
        }
        else {
            const novoItem = { codigo, quantidade };
            if (precoNaComanda !== undefined) {
                novoItem.nome = produto.nome;
                novoItem.precoUnitario = precoNaComanda;
                novoItem.custoUnitario = produto.custo;
            }
            comanda.itens.push(novoItem);
        }
        this.recalcularTotal(comanda);
        await this.persistir();
        return comanda;
    }
    async editarPrecoItem(id, codigo, precoUnitario) {
        const comanda = this.obterAberta(id);
        const item = comanda.itens.find((entrada) => entrada.codigo === codigo);
        if (!item)
            throw new errors_js_1.RegraNegocioError("Item nao encontrado na comanda.");
        if (this.isSaldoPendente(item.codigo))
            throw new errors_js_1.RegraNegocioError("Nao e possivel alterar o preco do saldo pendente.");
        const produto = this.produtoService.buscarPorCodigo(codigo);
        item.nome = item.nome ?? produto?.nome;
        item.custoUnitario = item.custoUnitario ?? produto?.custo;
        item.precoUnitario = this.validarPrecoUnitario(precoUnitario);
        this.recalcularTotal(comanda);
        await this.persistir();
        return comanda;
    }
    async removerItem(id, codigo, quantidade = 1) {
        const comanda = this.obterAberta(id);
        const item = comanda.itens.find((entrada) => entrada.codigo === codigo);
        if (!item)
            throw new errors_js_1.RegraNegocioError("Item nao encontrado na comanda.");
        item.quantidade -= quantidade;
        if (item.quantidade <= 0) {
            comanda.itens = comanda.itens.filter((entrada) => entrada.codigo !== codigo);
        }
        this.recalcularTotal(comanda);
        await this.persistir();
        return comanda;
    }
    async adicionarMaisItem(id, codigo, quantidade = 1) {
        const comanda = this.obterAberta(id);
        const item = comanda.itens.find((entrada) => entrada.codigo === codigo);
        if (!item)
            throw new errors_js_1.RegraNegocioError("Item nao encontrado na comanda.");
        item.quantidade += quantidade;
        this.recalcularTotal(comanda);
        await this.persistir();
        return comanda;
    }
    async cancelar(id) {
        const comanda = this.obterAberta(id);
        comanda.status = "CANCELADA";
        await this.persistir();
        return comanda;
    }
    async pagarItens(id, itensSelecionados, metodoPagamento, valorRecebido, valorPagoOuData, data = new Date()) {
        const valorPago = valorPagoOuData instanceof Date ? undefined : valorPagoOuData;
        const dataPagamento = valorPagoOuData instanceof Date ? valorPagoOuData : data;
        const comanda = this.obterAberta(id);
        const selecoes = this.normalizarSelecoes(comanda, itensSelecionados);
        const subtotal = this.calcularSubtotal(selecoes);
        const descontoAplicado = this.calcularDescontoAplicado(comanda, selecoes, subtotal);
        const totalComDesconto = this.arredondar(subtotal - descontoAplicado);
        const valorDoPagamento = this.calcularValorDoPagamento(totalComDesconto, metodoPagamento, valorPago);
        const saldoPendente = this.arredondar(totalComDesconto - valorDoPagamento);
        const troco = this.calcularTroco(valorDoPagamento, metodoPagamento, valorRecebido);
        for (const item of selecoes) {
            if (this.isSaldoPendente(item.codigo))
                continue;
            await this.produtoService.baixarEstoque(item.codigo, item.quantidade);
        }
        const pagamento = {
            comandaId: comanda.id,
            comandaNome: comanda.nome,
            valor: valorDoPagamento,
            desconto: descontoAplicado,
            metodo: metodoPagamento,
            itensPagos: selecoes,
            itensDetalhados: selecoes.map((item) => this.criarDetalhePagamento(comanda, item)),
            data: `${(0, format_js_1.formatFileDate)(dataPagamento)}T${dataPagamento.toTimeString().slice(0, 8)}`,
            valorRecebido,
            troco
        };
        if (descontoAplicado > 0) {
            comanda.desconto = this.arredondar(comanda.desconto - descontoAplicado);
        }
        this.removerItensDaComanda(comanda, selecoes);
        if (saldoPendente > 0) {
            this.adicionarSaldoPendente(comanda, saldoPendente);
        }
        await this.pagamentoService.registrar(pagamento);
        await this.persistir();
        return { comanda, pagamento, troco };
    }
    dividirConta(id, pessoas) {
        const comanda = this.obterAberta(id);
        if (!Number.isInteger(pessoas) || pessoas <= 0) {
            throw new errors_js_1.RegraNegocioError("Quantidade de pessoas deve ser maior que zero.");
        }
        return {
            total: comanda.total,
            valorPorPessoa: comanda.total / pessoas
        };
    }
    async fechar(id, metodoPagamento, valorRecebido, data = new Date()) {
        const comanda = this.obterAberta(id);
        if (comanda.itens.length === 0)
            throw new errors_js_1.RegraNegocioError("Nao e possivel fechar comanda vazia.");
        this.validarMetodoPagamento(metodoPagamento);
        const itensParaFechar = comanda.itens.map((item) => ({ ...item }));
        const itensVenda = itensParaFechar.map((item) => {
            return {
                codigo: item.codigo,
                nome: this.obterNomeItem(item),
                quantidade: item.quantidade,
                precoUnitario: this.obterPrecoItem(item),
                subtotal: this.obterPrecoItem(item) * item.quantidade
            };
        });
        const { troco } = await this.pagarItens(id, itensParaFechar, metodoPagamento, valorRecebido, undefined, data);
        const pagamentosDaComanda = this.pagamentoService.listarPorComanda(comanda.id);
        const totalPago = pagamentosDaComanda.reduce((total, pagamento) => total + pagamento.valor, 0);
        const totalDesconto = pagamentosDaComanda.reduce((total, pagamento) => total + pagamento.desconto, 0);
        const venda = {
            comandaId: comanda.id,
            comandaNome: comanda.nome,
            data,
            itens: itensVenda,
            total: totalPago,
            desconto: totalDesconto,
            metodoPagamento,
            pagamentos: pagamentosDaComanda
        };
        comanda.status = "FECHADA";
        const vendaPath = await this.vendaService.gerarVenda(venda);
        await this.persistir();
        return { comanda, vendaPath, troco };
    }
    obterAberta(id) {
        const comanda = this.comandas.get(id);
        if (!comanda)
            throw new errors_js_1.RegraNegocioError("Comanda nao encontrada.");
        if (comanda.status !== "ABERTA") {
            throw new errors_js_1.RegraNegocioError("A comanda precisa estar aberta.");
        }
        return comanda;
    }
    validarNomeDisponivel(nome, comandaIdIgnorada) {
        const nomeLimpo = nome.trim();
        if (!nomeLimpo)
            throw new errors_js_1.RegraNegocioError("Nome da comanda e obrigatorio.");
        const normalizado = nomeLimpo.toLocaleLowerCase("pt-BR");
        const conflito = this.listarAbertas().find((comanda) => comanda.id !== comandaIdIgnorada && comanda.nome.trim().toLocaleLowerCase("pt-BR") === normalizado);
        if (conflito) {
            throw new errors_js_1.RegraNegocioError("Ja existe uma comanda aberta com esse nome.");
        }
        return nomeLimpo;
    }
    validarMetodoPagamento(metodoPagamento) {
        if (!["DINHEIRO", "CARTAO", "PIX", "FIADO"].includes(metodoPagamento)) {
            throw new errors_js_1.RegraNegocioError("Metodo de pagamento invalido.");
        }
    }
    normalizarSelecoes(comanda, itensSelecionados) {
        if (!itensSelecionados.length) {
            throw new errors_js_1.RegraNegocioError("Selecione ao menos um item para pagamento.");
        }
        return itensSelecionados.map((item) => {
            const itemComanda = comanda.itens.find((entry) => entry.codigo === item.codigo);
            if (!itemComanda)
                throw new errors_js_1.RegraNegocioError("Nao permitir pagar item inexistente.");
            if (!Number.isInteger(item.quantidade) || item.quantidade <= 0 || item.quantidade > itemComanda.quantidade) {
                throw new errors_js_1.RegraNegocioError("Quantidade invalida para pagamento.");
            }
            return { ...itemComanda, quantidade: item.quantidade };
        });
    }
    calcularSubtotal(itensSelecionados) {
        return this.arredondar(itensSelecionados.reduce((total, item) => total + this.obterPrecoItem(item) * item.quantidade, 0));
    }
    calcularSubtotalComanda(comanda) {
        return this.calcularSubtotal(comanda.itens);
    }
    validarDesconto(comanda, desconto) {
        if (!Number.isFinite(desconto) || desconto < 0) {
            throw new errors_js_1.RegraNegocioError("Desconto deve ser um valor maior ou igual a zero.");
        }
        const subtotal = this.calcularSubtotalComanda(comanda);
        const descontoArredondado = this.arredondar(desconto);
        if (descontoArredondado > subtotal) {
            throw new errors_js_1.RegraNegocioError("Desconto nao pode ser maior que o subtotal da comanda.");
        }
        return descontoArredondado;
    }
    validarPrecoUnitario(precoUnitario) {
        if (!Number.isFinite(precoUnitario) || precoUnitario <= 0) {
            throw new errors_js_1.RegraNegocioError("Preco do item deve ser maior que zero.");
        }
        return this.arredondar(precoUnitario);
    }
    calcularDescontoAplicado(comanda, itensSelecionados, subtotal) {
        if (comanda.desconto <= 0)
            return 0;
        if (!this.selecionouTodosItens(comanda, itensSelecionados))
            return 0;
        return Math.min(comanda.desconto, subtotal);
    }
    selecionouTodosItens(comanda, itensSelecionados) {
        if (itensSelecionados.length !== comanda.itens.length)
            return false;
        return comanda.itens.every((item) => {
            const selecionado = itensSelecionados.find((entry) => entry.codigo === item.codigo);
            return selecionado?.quantidade === item.quantidade;
        });
    }
    calcularTroco(total, metodoPagamento, valorRecebido) {
        if (metodoPagamento === "FIADO")
            return 0;
        if (metodoPagamento !== "DINHEIRO")
            return 0;
        if (valorRecebido === undefined || !Number.isFinite(valorRecebido) || valorRecebido < total) {
            throw new errors_js_1.RegraNegocioError("Pagamento em dinheiro deve ser maior ou igual ao total.");
        }
        return valorRecebido - total;
    }
    removerItensDaComanda(comanda, itensSelecionados) {
        for (const itemPago of itensSelecionados) {
            const itemComanda = comanda.itens.find((entry) => entry.codigo === itemPago.codigo);
            if (!itemComanda)
                continue;
            itemComanda.quantidade -= itemPago.quantidade;
        }
        comanda.itens = comanda.itens.filter((item) => item.quantidade > 0);
        this.recalcularTotal(comanda);
    }
    recalcularTotal(comanda) {
        const subtotal = this.calcularSubtotalComanda(comanda);
        comanda.desconto = Math.min(comanda.desconto, subtotal);
        comanda.total = this.arredondar(Math.max(0, subtotal - comanda.desconto));
    }
    calcularValorDoPagamento(subtotal, metodoPagamento, valorPago) {
        if (metodoPagamento === "FIADO")
            return subtotal;
        if (valorPago === undefined)
            return subtotal;
        if (!Number.isFinite(valorPago) || valorPago <= 0 || valorPago > subtotal) {
            throw new errors_js_1.RegraNegocioError("Valor pago deve ser maior que zero e menor ou igual ao total selecionado.");
        }
        return this.arredondar(valorPago);
    }
    criarDetalhePagamento(comanda, item) {
        const itemComanda = comanda.itens.find((entry) => entry.codigo === item.codigo);
        if (!itemComanda)
            throw new errors_js_1.RegraNegocioError("Item nao encontrado na comanda.");
        return {
            codigo: item.codigo,
            nome: this.obterNomeItem(itemComanda),
            quantidade: item.quantidade,
            precoUnitario: this.obterPrecoItem(itemComanda),
            custoUnitario: this.obterCustoItem(itemComanda)
        };
    }
    obterNomeItem(item) {
        return item.nome ?? this.produtoService.buscarPorCodigo(item.codigo)?.nome ?? item.codigo;
    }
    obterPrecoItem(item) {
        return item.precoUnitario ?? this.produtoService.buscarPorCodigo(item.codigo)?.preco ?? 0;
    }
    obterCustoItem(item) {
        return item.custoUnitario ?? this.produtoService.buscarPorCodigo(item.codigo)?.custo ?? 0;
    }
    adicionarSaldoPendente(comanda, valor) {
        comanda.itens.push({
            codigo: `SALDO-PENDENTE-${Date.now()}`,
            nome: "Saldo pendente",
            quantidade: 1,
            precoUnitario: valor,
            custoUnitario: 0,
            tipo: "SALDO_PENDENTE"
        });
        this.recalcularTotal(comanda);
    }
    isSaldoPendente(codigo) {
        return codigo.startsWith("SALDO-PENDENTE-");
    }
    arredondar(valor) {
        return Math.round((valor + Number.EPSILON) * 100) / 100;
    }
    proximoId() {
        const ids = Array.from(this.comandas.keys());
        return ids.length ? Math.max(...ids) + 1 : 1;
    }
    async persistir() {
        await this.fileService.writeLines(this.fileService.comandasPath, parsers_js_1.COMANDAS_HEADER, this.listar().map(parsers_js_1.serializeComanda));
    }
}
exports.ComandaService = ComandaService;
//# sourceMappingURL=comanda-service.js.map