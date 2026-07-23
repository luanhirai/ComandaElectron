import type { Item } from "./comanda.js";
import type { MetodoPagamento } from "./venda.js";

export type PagamentoItemDetalhe = {
  codigo: string;
  nome: string;
  quantidade: number;
  precoUnitario: number;
  custoUnitario: number;
};

export type Pagamento = {
  comandaId: number;
  comandaNome: string;
  valor: number;
  desconto: number;
  metodo: MetodoPagamento;
  itensPagos: Item[];
  itensDetalhados: PagamentoItemDetalhe[];
  data: string;
  valorRecebido?: number;
  troco?: number;
};

export type RelatorioProduto = {
  codigo: string;
  nome: string;
  quantidadeVendida: number;
  totalVenda: number;
  totalCusto: number;
  lucroBruto: number;
};

export type RelatorioPeriodo = {
  periodo: {
    inicio: string;
    fim: string;
  };
  totalRecebido: number;
  totalFiado: number;
  totalCusto: number;
  lucroBruto: number;
  totaisPorMetodo: Record<MetodoPagamento, number>;
  totalDescontos: number;
  totalTroco: number;
  pagamentos: Pagamento[];
  produtos: RelatorioProduto[];
};
