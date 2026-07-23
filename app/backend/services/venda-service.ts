import { readFile } from "node:fs/promises";
import type { Venda } from "../models/venda.js";
import { formatDateBr, formatFileDate, isSameDay } from "../utils/format.js";
import type { FileService } from "./file-service.js";

export class VendaService {
  constructor(private readonly fileService: FileService) {}

  async gerarVenda(venda: Venda): Promise<string> {
    const dateKey = formatFileDate(venda.data);
    const files = await this.fileService.listSaleFiles();
    const sequence = files.filter((file) => file.startsWith(`venda_${dateKey}_`)).length + 1;
    const fileName = `venda_${dateKey}_${String(sequence).padStart(3, "0")}.txt`;
    return this.fileService.writeSaleFile(fileName, this.serializeVenda(venda));
  }

  async listarVendas(): Promise<{ arquivo: string; conteudo: string }[]> {
    const files = await this.fileService.listSaleFiles();
    const vendas = [];
    for (const arquivo of files) {
      const conteudo = await readFile(`${this.fileService.vendasDir}/${arquivo}`, "utf8");
      vendas.push({ arquivo, conteudo });
    }
    return vendas.reverse();
  }

  async totalVendidoNoDia(date = new Date()): Promise<number> {
    const files = await this.fileService.listSaleFiles();
    let total = 0;

    for (const file of files) {
      const match = file.match(/^venda_(\d{4})-(\d{2})-(\d{2})_/);
      if (!match) continue;
      const saleDate = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      if (!isSameDay(saleDate, date)) continue;

      const content = await readFile(`${this.fileService.vendasDir}/${file}`, "utf8");
      const totalLine = content.split(/\r?\n/).find((line) => line.startsWith("TOTAL:"));
      if (totalLine) total += Number(totalLine.replace("TOTAL:", "").trim());
    }

    return total;
  }

  private serializeVenda(venda: Venda): string {
    const itens = venda.itens
      .map((item) => `${item.nome} x${item.quantidade} = ${item.subtotal.toFixed(2)}`)
      .join("\n");
    const pagamentos = venda.pagamentos
      .map((pagamento) => {
        const partes = [`${pagamento.metodo} = ${pagamento.valor.toFixed(2)}`];
        if (pagamento.valorRecebido !== undefined) {
          partes.push(`RECEBIDO: ${pagamento.valorRecebido.toFixed(2)}`);
        }
        if (pagamento.troco !== undefined && pagamento.troco > 0) {
          partes.push(`TROCO: ${pagamento.troco.toFixed(2)}`);
        }
        if (pagamento.desconto > 0) {
          partes.push(`DESCONTO: ${pagamento.desconto.toFixed(2)}`);
        }
        return partes.join(" | ");
      })
      .join("\n");
    const totalPago = venda.pagamentos.reduce((total, pagamento) => total + pagamento.valor, 0);

    return [
      `COMANDA: ${venda.comandaId}`,
      `NOME: ${venda.comandaNome}`,
      `DATA: ${formatDateBr(venda.data)}`,
      `PAGAMENTO: ${venda.metodoPagamento}`,
      "ITENS:",
      itens,
      "PAGAMENTOS:",
      pagamentos,
      `DESCONTO: ${venda.desconto.toFixed(2)}`,
      `TOTAL PAGO: ${totalPago.toFixed(2)}`,
      `TOTAL: ${venda.total.toFixed(2)}`
    ].join("\n");
  }
}
