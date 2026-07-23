import type { Pagamento } from "./pagamento.js";

export type VendaItem = {
  codigo: string;
  nome: string;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
};

export type MetodoPagamento = "DINHEIRO" | "CARTAO" | "PIX" | "FIADO";

export type Venda = {
  comandaId: number;
  comandaNome: string;
  data: Date;
  itens: VendaItem[];
  total: number;
  desconto: number;
  metodoPagamento: MetodoPagamento;
  pagamentos: Pagamento[];
};
