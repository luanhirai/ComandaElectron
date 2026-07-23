import { RegraNegocioError } from "../errors.js";
import type { Produto } from "../models/produto.js";
import { parseProdutoLine, PRODUTOS_HEADER, serializeProduto } from "../utils/parsers.js";
import type { FileService } from "./file-service.js";

export class ProdutoService {
  private produtos = new Map<string, Produto>();

  constructor(private readonly fileService: FileService) {}

  async load(): Promise<void> {
    const lines = await this.fileService.readLines(this.fileService.produtosPath);
    this.produtos.clear();
    for (const line of lines) {
      const produto = parseProdutoLine(line);
      if (produto) this.produtos.set(produto.codigo, produto);
    }
  }

  listar(): Produto[] {
    return Array.from(this.produtos.values()).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }

  buscarPorCodigo(codigo: string): Produto | undefined {
    return this.produtos.get(codigo);
  }

  buscarPorTermo(termo: string): Produto | undefined {
    const query = this.normalize(termo);
    if (!query) return undefined;

    const byCode = this.produtos.get(termo.trim());
    if (byCode) return byCode;

    const produtos = this.listar();
    const exactName = produtos.find((produto) => this.normalize(produto.nome) === query);
    if (exactName) return exactName;

    const partialMatches = produtos.filter((produto) => {
      const normalizedName = this.normalize(produto.nome);
      return normalizedName.includes(query) || query.includes(normalizedName);
    });

    if (partialMatches.length === 1) return partialMatches[0];
    if (partialMatches.length > 1) {
      throw new RegraNegocioError("Mais de um produto encontrado para esse nome. Digite algo mais especifico.");
    }

    return undefined;
  }

  async cadastrar(produto: Produto): Promise<Produto> {
    this.validarProduto(produto);
    if (this.produtos.has(produto.codigo)) {
      throw new RegraNegocioError("Codigo de barras ja cadastrado.");
    }
    this.produtos.set(produto.codigo, { ...produto });
    await this.persistir();
    return produto;
  }

  async editar(codigo: string, dados: Omit<Produto, "codigo">): Promise<Produto> {
    const existente = this.produtos.get(codigo);
    if (!existente) throw new RegraNegocioError("Produto nao encontrado.");

    const atualizado = { ...existente, ...dados };
    this.validarProduto(atualizado);
    this.produtos.set(codigo, atualizado);
    await this.persistir();
    return atualizado;
  }

  async excluir(codigo: string): Promise<void> {
    if (!this.produtos.delete(codigo)) {
      throw new RegraNegocioError("Produto nao encontrado.");
    }
    await this.persistir();
  }

  async baixarEstoque(codigo: string, quantidade: number): Promise<Produto> {
    const produto = this.produtos.get(codigo);
    if (!produto) throw new RegraNegocioError("Produto nao encontrado.");
    if (produto.estoque < quantidade) throw new RegraNegocioError("Produto sem estoque suficiente.");

    const atualizado = { ...produto, estoque: produto.estoque - quantidade };
    this.produtos.set(codigo, atualizado);
    await this.persistir();
    return atualizado;
  }

  private validarProduto(produto: Produto): void {
    if (!produto.codigo.trim()) throw new RegraNegocioError("Codigo de barras e obrigatorio.");
    if (!produto.nome.trim()) throw new RegraNegocioError("Nome do produto e obrigatorio.");
    if (!Number.isFinite(produto.custo) || produto.custo < 0) {
      throw new RegraNegocioError("Preco de custo deve ser maior ou igual a zero.");
    }
    if (!Number.isFinite(produto.preco) || produto.preco <= 0) {
      throw new RegraNegocioError("Preco deve ser maior que zero.");
    }
    if (!Number.isInteger(produto.estoque) || produto.estoque < 0) {
      throw new RegraNegocioError("Estoque deve ser um numero inteiro maior ou igual a zero.");
    }
  }

  private normalize(value: string): string {
    return value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .trim()
      .toLowerCase();
  }

  private async persistir(): Promise<void> {
    await this.fileService.writeLines(
      this.fileService.produtosPath,
      PRODUTOS_HEADER,
      this.listar().map(serializeProduto)
    );
  }
}
