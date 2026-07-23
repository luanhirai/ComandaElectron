import type { MetodoPagamento } from "./venda.js";

export type Despesa = {
  id: number;
  descricao: string;
  categoria: string;
  valor: number;
  metodoPagamento: Exclude<MetodoPagamento, "FIADO">;
  data: string;
  observacao?: string;
};

export type NovaDespesa = Omit<Despesa, "id">;
