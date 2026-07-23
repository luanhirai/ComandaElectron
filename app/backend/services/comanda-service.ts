import { RegraNegocioError } from "../errors.js";
import type { Comanda, Item } from "../models/comanda.js";
import type { Pagamento } from "../models/pagamento.js";
import type { MetodoPagamento, Venda } from "../models/venda.js";
import { COMANDAS_HEADER, parseComandaLine, serializeComanda } from "../utils/parsers.js";
import { formatFileDate } from "../utils/format.js";
import type { FileService } from "./file-service.js";
import type { PagamentoService } from "./pagamento-service.js";
import type { ProdutoService } from "./produto-service.js";
import type { VendaService } from "./venda-service.js";

export class ComandaService {
  private comandas = new Map<number, Comanda>();

  constructor(
    private readonly fileService: FileService,
    private readonly produtoService: ProdutoService,
    private readonly pagamentoService: PagamentoService,
    private readonly vendaService: VendaService
  ) {}

  async load(): Promise<void> {
    const lines = await this.fileService.readLines(this.fileService.comandasPath);
    this.comandas.clear();
    for (const line of lines) {
      const comanda = parseComandaLine(line);
      if (comanda) this.comandas.set(comanda.id, comanda);
    }
  }

  listar(): Comanda[] {
    return Array.from(this.comandas.values()).sort((a, b) => a.id - b.id);
  }

  listarAbertas(): Comanda[] {
    return this.listar().filter((comanda) => comanda.status === "ABERTA");
  }

  buscar(id: number): Comanda | undefined {
    return this.comandas.get(id);
  }

  async criar(nome: string): Promise<Comanda> {
    const nomeValidado = this.validarNomeDisponivel(nome);
    const id = this.proximoId();
    const comanda: Comanda = { id, nome: nomeValidado, status: "ABERTA", itens: [], desconto: 0, total: 0 };
    this.comandas.set(id, comanda);
    await this.persistir();
    return comanda;
  }

  async renomear(id: number, nome: string): Promise<Comanda> {
    const comanda = this.obterAberta(id);
    comanda.nome = this.validarNomeDisponivel(nome, id);
    await this.persistir();
    return comanda;
  }

  async definirDesconto(id: number, desconto: number): Promise<Comanda> {
    const comanda = this.obterAberta(id);
    const descontoValidado = this.validarDesconto(comanda, desconto);
    comanda.desconto = descontoValidado;
    this.recalcularTotal(comanda);
    await this.persistir();
    return comanda;
  }

  async adicionarItem(id: number, termo: string, quantidade = 1, precoUnitario?: number): Promise<Comanda> {
    if (!Number.isInteger(quantidade) || quantidade <= 0) {
      throw new RegraNegocioError("Quantidade deve ser maior que zero.");
    }

    const comanda = this.obterAberta(id);
    const produto = this.produtoService.buscarPorTermo(termo);
    if (!produto) throw new RegraNegocioError("Produto nao encontrado.");
    const codigo = produto.codigo;
    const precoNaComanda = precoUnitario === undefined ? undefined : this.validarPrecoUnitario(precoUnitario);

    const itemExistente = comanda.itens.find((item) => item.codigo === codigo);
    const quantidadeNaComanda = itemExistente?.quantidade ?? 0;
    if (produto.estoque < quantidadeNaComanda + quantidade) {
      throw new RegraNegocioError("Produto sem estoque suficiente.");
    }

    if (itemExistente) {
      itemExistente.quantidade += quantidade;
      if (precoNaComanda !== undefined) {
        itemExistente.precoUnitario = precoNaComanda;
        itemExistente.nome = itemExistente.nome ?? produto.nome;
        itemExistente.custoUnitario = itemExistente.custoUnitario ?? produto.custo;
      }
    } else {
      const novoItem: Item = { codigo, quantidade };
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

  async editarPrecoItem(id: number, codigo: string, precoUnitario: number): Promise<Comanda> {
    const comanda = this.obterAberta(id);
    const item = comanda.itens.find((entrada) => entrada.codigo === codigo);
    if (!item) throw new RegraNegocioError("Item nao encontrado na comanda.");
    if (this.isSaldoPendente(item.codigo)) throw new RegraNegocioError("Nao e possivel alterar o preco do saldo pendente.");

    const produto = this.produtoService.buscarPorCodigo(codigo);
    item.nome = item.nome ?? produto?.nome;
    item.custoUnitario = item.custoUnitario ?? produto?.custo;
    item.precoUnitario = this.validarPrecoUnitario(precoUnitario);

    this.recalcularTotal(comanda);
    await this.persistir();
    return comanda;
  }

  async removerItem(id: number, codigo: string, quantidade = 1): Promise<Comanda> {
    const comanda = this.obterAberta(id);
    const item = comanda.itens.find((entrada) => entrada.codigo === codigo);
    if (!item) throw new RegraNegocioError("Item nao encontrado na comanda.");

    item.quantidade -= quantidade;
    if (item.quantidade <= 0) {
      comanda.itens = comanda.itens.filter((entrada) => entrada.codigo !== codigo);
    }

    this.recalcularTotal(comanda);
    await this.persistir();
    return comanda;
  }

  async adicionarMaisItem(id: number, codigo: string, quantidade = 1): Promise<Comanda> {
    const comanda = this.obterAberta(id);
    const item = comanda.itens.find((entrada) => entrada.codigo === codigo);
    if (!item) throw new RegraNegocioError("Item nao encontrado na comanda.");
    
    item.quantidade += quantidade;
    this.recalcularTotal(comanda);
    await this.persistir();
    return comanda;
  }

  async cancelar(id: number): Promise<Comanda> {
    const comanda = this.obterAberta(id);
    comanda.status = "CANCELADA";
    await this.persistir();
    return comanda;
  }

  async pagarItens(
    id: number,
    itensSelecionados: { codigo: string; quantidade: number }[],
    metodoPagamento: MetodoPagamento,
    valorRecebido?: number,
    valorPagoOuData?: number | Date,
    data = new Date()
  ): Promise<{ comanda: Comanda; pagamento: Pagamento; troco: number }> {
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
      if (this.isSaldoPendente(item.codigo)) continue;
      await this.produtoService.baixarEstoque(item.codigo, item.quantidade);
    }

    const pagamento: Pagamento = {
      comandaId: comanda.id,
      comandaNome: comanda.nome,
      valor: valorDoPagamento,
      desconto: descontoAplicado,
      metodo: metodoPagamento,
      itensPagos: selecoes,
      itensDetalhados: selecoes.map((item) => this.criarDetalhePagamento(comanda, item)),
      data: `${formatFileDate(dataPagamento)}T${dataPagamento.toTimeString().slice(0, 8)}`,
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

  dividirConta(id: number, pessoas: number): { total: number; valorPorPessoa: number } {
    const comanda = this.obterAberta(id);
    if (!Number.isInteger(pessoas) || pessoas <= 0) {
      throw new RegraNegocioError("Quantidade de pessoas deve ser maior que zero.");
    }

    return {
      total: comanda.total,
      valorPorPessoa: comanda.total / pessoas
    };
  }

  async fechar(
    id: number,
    metodoPagamento: MetodoPagamento,
    valorRecebido?: number,
    data = new Date()
  ): Promise<{ comanda: Comanda; vendaPath: string; troco: number }> {
    const comanda = this.obterAberta(id);
    if (comanda.itens.length === 0) throw new RegraNegocioError("Nao e possivel fechar comanda vazia.");
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
    const venda: Venda = {
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

  private obterAberta(id: number): Comanda {
    const comanda = this.comandas.get(id);
    if (!comanda) throw new RegraNegocioError("Comanda nao encontrada.");
    if (comanda.status !== "ABERTA") {
      throw new RegraNegocioError("A comanda precisa estar aberta.");
    }
    return comanda;
  }

  private validarNomeDisponivel(nome: string, comandaIdIgnorada?: number): string {
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) throw new RegraNegocioError("Nome da comanda e obrigatorio.");

    const normalizado = nomeLimpo.toLocaleLowerCase("pt-BR");
    const conflito = this.listarAbertas().find(
      (comanda) => comanda.id !== comandaIdIgnorada && comanda.nome.trim().toLocaleLowerCase("pt-BR") === normalizado
    );
    if (conflito) {
      throw new RegraNegocioError("Ja existe uma comanda aberta com esse nome.");
    }

    return nomeLimpo;
  }

  private validarMetodoPagamento(metodoPagamento: MetodoPagamento): void {
    if (!["DINHEIRO", "CARTAO", "PIX", "FIADO"].includes(metodoPagamento)) {
      throw new RegraNegocioError("Metodo de pagamento invalido.");
    }
  }

  private normalizarSelecoes(
    comanda: Comanda,
    itensSelecionados: { codigo: string; quantidade: number }[]
  ): Item[] {
    if (!itensSelecionados.length) {
      throw new RegraNegocioError("Selecione ao menos um item para pagamento.");
    }

    return itensSelecionados.map((item) => {
      const itemComanda = comanda.itens.find((entry) => entry.codigo === item.codigo);
      if (!itemComanda) throw new RegraNegocioError("Nao permitir pagar item inexistente.");
      if (!Number.isInteger(item.quantidade) || item.quantidade <= 0 || item.quantidade > itemComanda.quantidade) {
        throw new RegraNegocioError("Quantidade invalida para pagamento.");
      }
      return { ...itemComanda, quantidade: item.quantidade };
    });
  }

  private calcularSubtotal(itensSelecionados: Item[]): number {
    return this.arredondar(
      itensSelecionados.reduce((total, item) => total + this.obterPrecoItem(item) * item.quantidade, 0)
    );
  }

  private calcularSubtotalComanda(comanda: Comanda): number {
    return this.calcularSubtotal(comanda.itens);
  }

  private validarDesconto(comanda: Comanda, desconto: number): number {
    if (!Number.isFinite(desconto) || desconto < 0) {
      throw new RegraNegocioError("Desconto deve ser um valor maior ou igual a zero.");
    }

    const subtotal = this.calcularSubtotalComanda(comanda);
    const descontoArredondado = this.arredondar(desconto);
    if (descontoArredondado > subtotal) {
      throw new RegraNegocioError("Desconto nao pode ser maior que o subtotal da comanda.");
    }

    return descontoArredondado;
  }

  private validarPrecoUnitario(precoUnitario: number): number {
    if (!Number.isFinite(precoUnitario) || precoUnitario <= 0) {
      throw new RegraNegocioError("Preco do item deve ser maior que zero.");
    }
    return this.arredondar(precoUnitario);
  }

  private calcularDescontoAplicado(comanda: Comanda, itensSelecionados: Item[], subtotal: number): number {
    if (comanda.desconto <= 0) return 0;
    if (!this.selecionouTodosItens(comanda, itensSelecionados)) return 0;
    return Math.min(comanda.desconto, subtotal);
  }

  private selecionouTodosItens(comanda: Comanda, itensSelecionados: Item[]): boolean {
    if (itensSelecionados.length !== comanda.itens.length) return false;
    return comanda.itens.every((item) => {
      const selecionado = itensSelecionados.find((entry) => entry.codigo === item.codigo);
      return selecionado?.quantidade === item.quantidade;
    });
  }

  private calcularTroco(total: number, metodoPagamento: MetodoPagamento, valorRecebido?: number): number {
    if (metodoPagamento === "FIADO") return 0;
    if (metodoPagamento !== "DINHEIRO") return 0;
    if (valorRecebido === undefined || !Number.isFinite(valorRecebido) || valorRecebido < total) {
      throw new RegraNegocioError("Pagamento em dinheiro deve ser maior ou igual ao total.");
    }
    return valorRecebido - total;
  }

  private removerItensDaComanda(comanda: Comanda, itensSelecionados: { codigo: string; quantidade: number }[]): void {
    for (const itemPago of itensSelecionados) {
      const itemComanda = comanda.itens.find((entry) => entry.codigo === itemPago.codigo);
      if (!itemComanda) continue;
      itemComanda.quantidade -= itemPago.quantidade;
    }

    comanda.itens = comanda.itens.filter((item) => item.quantidade > 0);
    this.recalcularTotal(comanda);
  }

  private recalcularTotal(comanda: Comanda): void {
    const subtotal = this.calcularSubtotalComanda(comanda);
    comanda.desconto = Math.min(comanda.desconto, subtotal);
    comanda.total = this.arredondar(Math.max(0, subtotal - comanda.desconto));
  }

  private calcularValorDoPagamento(subtotal: number, metodoPagamento: MetodoPagamento, valorPago?: number): number {
    if (metodoPagamento === "FIADO") return subtotal;
    if (valorPago === undefined) return subtotal;
    if (!Number.isFinite(valorPago) || valorPago <= 0 || valorPago > subtotal) {
      throw new RegraNegocioError("Valor pago deve ser maior que zero e menor ou igual ao total selecionado.");
    }
    return this.arredondar(valorPago);
  }

  private criarDetalhePagamento(comanda: Comanda, item: { codigo: string; quantidade: number }) {
    const itemComanda = comanda.itens.find((entry) => entry.codigo === item.codigo);
    if (!itemComanda) throw new RegraNegocioError("Item nao encontrado na comanda.");

    return {
      codigo: item.codigo,
      nome: this.obterNomeItem(itemComanda),
      quantidade: item.quantidade,
      precoUnitario: this.obterPrecoItem(itemComanda),
      custoUnitario: this.obterCustoItem(itemComanda)
    };
  }

  private obterNomeItem(item: Pick<Item, "codigo" | "nome">): string {
    return item.nome ?? this.produtoService.buscarPorCodigo(item.codigo)?.nome ?? item.codigo;
  }

  private obterPrecoItem(item: Pick<Item, "codigo" | "precoUnitario">): number {
    return item.precoUnitario ?? this.produtoService.buscarPorCodigo(item.codigo)?.preco ?? 0;
  }

  private obterCustoItem(item: Pick<Item, "codigo" | "custoUnitario">): number {
    return item.custoUnitario ?? this.produtoService.buscarPorCodigo(item.codigo)?.custo ?? 0;
  }

  private adicionarSaldoPendente(comanda: Comanda, valor: number): void {
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

  private isSaldoPendente(codigo: string): boolean {
    return codigo.startsWith("SALDO-PENDENTE-");
  }

  private arredondar(valor: number): number {
    return Math.round((valor + Number.EPSILON) * 100) / 100;
  }

  private proximoId(): number {
    const ids = Array.from(this.comandas.keys());
    return ids.length ? Math.max(...ids) + 1 : 1;
  }

  private async persistir(): Promise<void> {
    await this.fileService.writeLines(
      this.fileService.comandasPath,
      COMANDAS_HEADER,
      this.listar().map(serializeComanda)
    );
  }
}
