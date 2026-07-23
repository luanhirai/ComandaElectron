"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DESPESAS_HEADER = exports.PAGAMENTOS_HEADER = exports.COMANDAS_HEADER = exports.PRODUTOS_HEADER = void 0;
exports.parseProdutoLine = parseProdutoLine;
exports.serializeProduto = serializeProduto;
exports.parseItens = parseItens;
exports.serializeItens = serializeItens;
exports.parseComandaLine = parseComandaLine;
exports.serializeComanda = serializeComanda;
exports.parsePagamentoLine = parsePagamentoLine;
exports.serializePagamento = serializePagamento;
exports.parsePagamentoDetalhes = parsePagamentoDetalhes;
exports.serializePagamentoDetalhes = serializePagamentoDetalhes;
exports.parseDespesaLine = parseDespesaLine;
exports.serializeDespesa = serializeDespesa;
exports.PRODUTOS_HEADER = "COD|NOME|CUSTO|PRECO|ESTOQUE";
exports.COMANDAS_HEADER = "ID|NOME|STATUS|ITENS|DESCONTO|TOTAL";
exports.PAGAMENTOS_HEADER = "COMANDA|NOME_COMANDA|VALOR|DESCONTO|METODO|ITENS|DATA|VALOR_RECEBIDO|TROCO|DETALHES";
exports.DESPESAS_HEADER = "ID|DESCRICAO|CATEGORIA|VALOR|METODO|DATA|OBSERVACAO";
const LEGACY_COMANDAS_HEADER = "ID|NOME|STATUS|ITENS|TOTAL";
const LEGACY_PAGAMENTOS_HEADER = "COMANDA|NOME_COMANDA|VALOR|METODO|ITENS|DATA|VALOR_RECEBIDO|TROCO|DETALHES";
function parseProdutoLine(line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === exports.PRODUTOS_HEADER)
        return null;
    const parts = trimmed.split("|");
    if (parts.length === 4) {
        const [codigo, nome, preco, estoque] = parts;
        if (!codigo || !nome || preco === undefined || estoque === undefined)
            return null;
        return {
            codigo,
            nome,
            custo: 0,
            preco: Number(preco),
            estoque: Number(estoque)
        };
    }
    const [codigo, nome, custo, preco, estoque] = parts;
    if (!codigo || !nome || custo === undefined || preco === undefined || estoque === undefined)
        return null;
    return {
        codigo,
        nome,
        custo: Number(custo),
        preco: Number(preco),
        estoque: Number(estoque)
    };
}
function serializeProduto(produto) {
    return `${produto.codigo}|${produto.nome}|${produto.custo.toFixed(2)}|${produto.preco.toFixed(2)}|${produto.estoque}`;
}
function parseItens(raw) {
    if (!raw)
        return [];
    return raw
        .split(";")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
        const [codigo, quantidade, precoUnitario, nome, custoUnitario, tipo] = entry.split(",");
        const itemTipo = tipo === "SALDO_PENDENTE" ? "SALDO_PENDENTE" : undefined;
        return {
            codigo,
            quantidade: Number(quantidade),
            precoUnitario: precoUnitario ? Number(precoUnitario) : undefined,
            nome: nome ? decodeURIComponent(nome) : undefined,
            custoUnitario: custoUnitario ? Number(custoUnitario) : undefined,
            tipo: itemTipo
        };
    })
        .filter((item) => item.codigo && Number.isFinite(item.quantidade));
}
function serializeItens(itens) {
    return itens
        .map((item) => {
        if (item.precoUnitario === undefined && !item.nome && item.custoUnitario === undefined && !item.tipo) {
            return `${item.codigo},${item.quantidade}`;
        }
        return [
            item.codigo,
            item.quantidade,
            item.precoUnitario?.toFixed(2) ?? "",
            item.nome ? encodeURIComponent(item.nome) : "",
            item.custoUnitario?.toFixed(2) ?? "",
            item.tipo ?? ""
        ].join(",");
    })
        .join(";");
}
function parseComandaLine(line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === exports.COMANDAS_HEADER || trimmed === LEGACY_COMANDAS_HEADER)
        return null;
    const parts = trimmed.split("|");
    if (parts.length === 4) {
        const [id, status, itens, total] = parts;
        if (!id || !status || total === undefined)
            return null;
        return {
            id: Number(id),
            nome: `Comanda ${id}`,
            status: status === "FECHADA" || status === "CANCELADA" ? status : "ABERTA",
            itens: parseItens(itens ?? ""),
            desconto: 0,
            total: Number(total)
        };
    }
    if (parts.length === 5) {
        const [id, nome, status, itens, total] = parts;
        if (!id || !nome || !status || total === undefined)
            return null;
        return {
            id: Number(id),
            nome,
            status: status === "FECHADA" || status === "CANCELADA" ? status : "ABERTA",
            itens: parseItens(itens ?? ""),
            desconto: 0,
            total: Number(total)
        };
    }
    const [id, nome, status, itens, desconto, total] = parts;
    if (!id || !nome || !status || total === undefined)
        return null;
    return {
        id: Number(id),
        nome,
        status: status === "FECHADA" || status === "CANCELADA" ? status : "ABERTA",
        itens: parseItens(itens ?? ""),
        desconto: Number(desconto ?? 0),
        total: Number(total)
    };
}
function serializeComanda(comanda) {
    return `${comanda.id}|${comanda.nome}|${comanda.status}|${serializeItens(comanda.itens)}|${comanda.desconto.toFixed(2)}|${comanda.total.toFixed(2)}`;
}
function parsePagamentoLine(line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === exports.PAGAMENTOS_HEADER || trimmed === LEGACY_PAGAMENTOS_HEADER)
        return null;
    const parts = trimmed.split("|");
    if (parts.length < 5)
        return null;
    if (parts.length === 7) {
        const [comandaId, valor, metodo, itens, data, valorRecebido, troco] = parts;
        return {
            comandaId: Number(comandaId),
            comandaNome: `Comanda ${comandaId}`,
            valor: Number(valor),
            desconto: 0,
            metodo: metodo,
            itensPagos: parseItens(itens ?? ""),
            itensDetalhados: [],
            data,
            valorRecebido: valorRecebido ? Number(valorRecebido) : undefined,
            troco: troco ? Number(troco) : undefined
        };
    }
    if (parts.length === 9) {
        const [comandaId, comandaNome, valor, metodo, itens, data, valorRecebido, troco, detalhes] = parts;
        if (!comandaId || !comandaNome || !valor || !metodo || data === undefined)
            return null;
        return {
            comandaId: Number(comandaId),
            comandaNome,
            valor: Number(valor),
            desconto: 0,
            metodo: metodo,
            itensPagos: parseItens(itens ?? ""),
            itensDetalhados: parsePagamentoDetalhes(detalhes ?? ""),
            data,
            valorRecebido: valorRecebido ? Number(valorRecebido) : undefined,
            troco: troco ? Number(troco) : undefined
        };
    }
    const [comandaId, comandaNome, valor, desconto, metodo, itens, data, valorRecebido, troco, detalhes] = parts;
    if (!comandaId || !comandaNome || !valor || !metodo || data === undefined)
        return null;
    return {
        comandaId: Number(comandaId),
        comandaNome,
        valor: Number(valor),
        desconto: Number(desconto ?? 0),
        metodo: metodo,
        itensPagos: parseItens(itens ?? ""),
        itensDetalhados: parsePagamentoDetalhes(detalhes ?? ""),
        data,
        valorRecebido: valorRecebido ? Number(valorRecebido) : undefined,
        troco: troco ? Number(troco) : undefined
    };
}
function serializePagamento(pagamento) {
    return [
        pagamento.comandaId,
        pagamento.comandaNome,
        pagamento.valor.toFixed(2),
        pagamento.desconto.toFixed(2),
        pagamento.metodo,
        serializeItens(pagamento.itensPagos),
        pagamento.data,
        pagamento.valorRecebido?.toFixed(2) ?? "",
        pagamento.troco?.toFixed(2) ?? "",
        serializePagamentoDetalhes(pagamento.itensDetalhados)
    ].join("|");
}
function parsePagamentoDetalhes(raw) {
    if (!raw)
        return [];
    return raw
        .split(";")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
        const [codigo, nome, quantidade, precoUnitario, custoUnitario] = entry.split(",");
        return {
            codigo,
            nome,
            quantidade: Number(quantidade),
            precoUnitario: Number(precoUnitario),
            custoUnitario: Number(custoUnitario)
        };
    })
        .filter((item) => item.codigo && item.nome && Number.isFinite(item.quantidade));
}
function serializePagamentoDetalhes(itens) {
    return itens
        .map((item) => [item.codigo, item.nome, item.quantidade, item.precoUnitario.toFixed(2), item.custoUnitario.toFixed(2)].join(","))
        .join(";");
}
function parseDespesaLine(line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === exports.DESPESAS_HEADER)
        return null;
    const [id, descricao, categoria, valor, metodo, data, observacao] = trimmed.split("|");
    if (!id || !descricao || !categoria || !valor || !metodo || !data)
        return null;
    return {
        id: Number(id),
        descricao: decodeURIComponent(descricao),
        categoria: decodeURIComponent(categoria),
        valor: Number(valor),
        metodoPagamento: metodo,
        data,
        observacao: observacao ? decodeURIComponent(observacao) : undefined
    };
}
function serializeDespesa(despesa) {
    return [
        despesa.id,
        encodeURIComponent(despesa.descricao),
        encodeURIComponent(despesa.categoria),
        despesa.valor.toFixed(2),
        despesa.metodoPagamento,
        despesa.data,
        despesa.observacao ? encodeURIComponent(despesa.observacao) : ""
    ].join("|");
}
//# sourceMappingURL=parsers.js.map