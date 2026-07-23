export type Item = {
  codigo: string;
  quantidade: number;
  nome?: string;
  precoUnitario?: number;
  custoUnitario?: number;
  tipo?: "PRODUTO" | "SALDO_PENDENTE";
};

export type ComandaStatus = "ABERTA" | "FECHADA" | "CANCELADA";

export type Comanda = {
  id: number;
  nome: string;
  status: ComandaStatus;
  itens: Item[];
  desconto: number;
  total: number;
};
