import type { Pagamento, RelatorioPeriodo } from "../models/pagamento.js";
import type { MetodoPagamento } from "../models/venda.js";
import { RegraNegocioError } from "../errors.js";
import { formatFileDate } from "../utils/format.js";
import { PAGAMENTOS_HEADER, parsePagamentoLine, serializePagamento } from "../utils/parsers.js";
import type { FileService } from "./file-service.js";

export class PagamentoService {
  private pagamentos: Pagamento[] = [];

  constructor(private readonly fileService: FileService) {}

  async load(): Promise<void> {
    const lines = await this.fileService.readLines(this.fileService.pagamentosPath);
    this.pagamentos = lines.map(parsePagamentoLine).filter((pagamento): pagamento is Pagamento => Boolean(pagamento));
  }

  listar(): Pagamento[] {
    return [...this.pagamentos].sort((a, b) => b.data.localeCompare(a.data));
  }

  listarPorComanda(comandaId: number): Pagamento[] {
    return this.pagamentos
      .filter((pagamento) => pagamento.comandaId === comandaId)
      .sort((a, b) => a.data.localeCompare(b.data));
  }

  gerarRelatorioPorPeriodo(inicio: string, fim: string): RelatorioPeriodo {
    const inicioDate = `${inicio}T00:00:00`;
    const fimDate = `${fim}T23:59:59`;
    const pagamentos = this.pagamentos
      .filter((pagamento) => pagamento.data >= inicioDate && pagamento.data <= fimDate)
      .filter((pagamento) => pagamento.metodo !== "FIADO")
      .sort((a, b) => a.data.localeCompare(b.data));

    const produtosMap = new Map<string, RelatorioPeriodo["produtos"][number]>();
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

  async registrar(pagamento: Pagamento): Promise<Pagamento> {
    this.pagamentos.push(pagamento);
    await this.persistir();
    return pagamento;
  }

  async quitarFiado(
    comandaId: number,
    dataFiado: string,
    metodoPagamento: Exclude<MetodoPagamento, "FIADO">,
    valorRecebido?: number,
    dataPagamento = new Date()
  ): Promise<{ pagamento: Pagamento; troco: number }> {
    if (!["DINHEIRO", "CARTAO", "PIX"].includes(metodoPagamento)) {
      throw new RegraNegocioError("Metodo de pagamento invalido para quitar fiado.");
    }

    const pagamento = this.obterFiado(comandaId, dataFiado);
    const troco = this.calcularTroco(pagamento.valor, metodoPagamento, valorRecebido);
    pagamento.metodo = metodoPagamento;
    pagamento.data = `${formatFileDate(dataPagamento)}T${dataPagamento.toTimeString().slice(0, 8)}`;
    pagamento.valorRecebido = metodoPagamento === "DINHEIRO" ? valorRecebido : undefined;
    pagamento.troco = troco;

    await this.persistir();
    return { pagamento, troco };
  }

  async cancelarFiado(comandaId: number, dataFiado: string): Promise<Pagamento> {
    const pagamento = this.obterFiado(comandaId, dataFiado);
    this.pagamentos = this.pagamentos.filter((entry) => entry !== pagamento);
    await this.persistir();
    return pagamento;
  }

  totalRecebidoNoDia(date = new Date()): number {
    const today = formatFileDate(date);
    return this.pagamentos
      .filter((pagamento) => pagamento.data.startsWith(today))
      .filter((pagamento) => pagamento.metodo !== "FIADO")
      .reduce((total, pagamento) => total + pagamento.valor, 0);
  }

  private async persistir(): Promise<void> {
    await this.fileService.writeLines(
      this.fileService.pagamentosPath,
      PAGAMENTOS_HEADER,
      this.listar().map(serializePagamento)
    );
  }

  private obterFiado(comandaId: number, dataFiado: string): Pagamento {
    const pagamento = this.pagamentos.find(
      (entry) => entry.comandaId === comandaId && entry.data === dataFiado && entry.metodo === "FIADO"
    );
    if (!pagamento) throw new RegraNegocioError("Fiado nao encontrado ou ja baixado.");
    return pagamento;
  }

  private calcularTroco(total: number, metodoPagamento: Exclude<MetodoPagamento, "FIADO">, valorRecebido?: number): number {
    if (metodoPagamento !== "DINHEIRO") return 0;
    if (valorRecebido === undefined || !Number.isFinite(valorRecebido) || valorRecebido < total) {
      throw new RegraNegocioError("Pagamento em dinheiro deve ser maior ou igual ao total.");
    }
    return valorRecebido - total;
  }
}
