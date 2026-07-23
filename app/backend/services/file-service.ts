import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

export class FileService {
  constructor(private readonly databaseDir: string) {}

  get produtosPath(): string {
    return path.join(this.databaseDir, "produtos.txt");
  }

  get comandasPath(): string {
    return path.join(this.databaseDir, "comandas.txt");
  }

  get pagamentosPath(): string {
    return path.join(this.databaseDir, "pagamentos.txt");
  }

  get despesasPath(): string {
    return path.join(this.databaseDir, "despesas.txt");
  }

  get vendasDir(): string {
    return path.join(this.databaseDir, "historico-comandas");
  }

  get relatoriosDir(): string {
    return path.join(this.databaseDir, "relatorios");
  }

  async ensureDatabase(produtosHeader: string, comandasHeader: string, pagamentosHeader: string, despesasHeader?: string): Promise<void> {
    await mkdir(this.databaseDir, { recursive: true });
    await mkdir(this.vendasDir, { recursive: true });
    await mkdir(this.relatoriosDir, { recursive: true });
    await this.ensureFile(this.produtosPath, `${produtosHeader}\n`);
    await this.ensureFile(this.comandasPath, `${comandasHeader}\n`);
    await this.ensureFile(this.pagamentosPath, `${pagamentosHeader}\n`);
    if (despesasHeader) await this.ensureFile(this.despesasPath, `${despesasHeader}\n`);
  }

  async readLines(filePath: string): Promise<string[]> {
    try {
      const content = await readFile(filePath, "utf8");
      return content.split(/\r?\n/).filter(Boolean);
    } catch {
      return [];
    }
  }

  async writeLines(filePath: string, header: string, lines: string[]): Promise<void> {
    const content = [header, ...lines].join("\n");
    await writeFile(filePath, `${content}\n`, "utf8");
  }

  async writeSaleFile(fileName: string, content: string): Promise<string> {
    await mkdir(this.vendasDir, { recursive: true });
    const filePath = path.join(this.vendasDir, fileName);
    await writeFile(filePath, content, "utf8");
    return filePath;
  }

  async listSaleFiles(): Promise<string[]> {
    try {
      const files = await readdir(this.vendasDir);
      return files.filter((file) => file.endsWith(".txt")).sort();
    } catch {
      return [];
    }
  }

  private async ensureFile(filePath: string, initialContent: string): Promise<void> {
    try {
      await readFile(filePath, "utf8");
    } catch {
      await writeFile(filePath, initialContent, "utf8");
    }
  }
}
