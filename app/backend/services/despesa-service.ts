import { RegraNegocioError } from "../errors.js";
import type { Despesa, NovaDespesa } from "../models/despesa.js";
import { DESPESAS_HEADER, parseDespesaLine, serializeDespesa } from "../utils/parsers.js";
import type { FileService } from "./file-service.js";

export class DespesaService {
  private despesas = new Map<number, Despesa>();

  constructor(private readonly fileService: FileService) {}

  async load(): Promise<void> {
    const lines = await this.fileService.readLines(this.fileService.despesasPath);
    this.despesas.clear();
    for (const line of lines) {
      const despesa = parseDespesaLine(line);
      if (despesa) this.despesas.set(despesa.id, despesa);
    }
  }

  listar(): Despesa[] {
    return Array.from(this.despesas.values()).sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id);
  }

  async cadastrar(dados: NovaDespesa): Promise<Despesa> {
    const despesa = { ...dados, id: this.proximoId() };
    this.validar(despesa);
    this.despesas.set(despesa.id, despesa);
    await this.persistir();
    return despesa;
  }

  async editar(id: number, dados: NovaDespesa): Promise<Despesa> {
    const existente = this.despesas.get(id);
    if (!existente) throw new RegraNegocioError("Despesa nao encontrada.");

    const atualizada = { ...existente, ...dados, id };
    this.validar(atualizada);
    this.despesas.set(id, atualizada);
    await this.persistir();
    return atualizada;
  }

  async excluir(id: number): Promise<void> {
    if (!this.despesas.delete(id)) throw new RegraNegocioError("Despesa nao encontrada.");
    await this.persistir();
  }

  private proximoId(): number {
    const ids = Array.from(this.despesas.keys());
    return ids.length ? Math.max(...ids) + 1 : 1;
  }

  private validar(despesa: Despesa): void {
    if (!despesa.descricao.trim()) throw new RegraNegocioError("Descricao da despesa e obrigatoria.");
    if (!despesa.categoria.trim()) throw new RegraNegocioError("Categoria da despesa e obrigatoria.");
    if (!Number.isFinite(despesa.valor) || despesa.valor <= 0) {
      throw new RegraNegocioError("Valor da despesa deve ser maior que zero.");
    }
    if (!["DINHEIRO", "CARTAO", "PIX"].includes(despesa.metodoPagamento)) {
      throw new RegraNegocioError("Metodo de pagamento invalido para despesa.");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(despesa.data)) {
      throw new RegraNegocioError("Data da despesa e obrigatoria.");
    }
  }

  private async persistir(): Promise<void> {
    await this.fileService.writeLines(
      this.fileService.despesasPath,
      DESPESAS_HEADER,
      this.listar().map(serializeDespesa)
    );
  }
}
