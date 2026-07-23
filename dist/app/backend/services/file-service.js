"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileService = void 0;
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
class FileService {
    databaseDir;
    constructor(databaseDir) {
        this.databaseDir = databaseDir;
    }
    get produtosPath() {
        return node_path_1.default.join(this.databaseDir, "produtos.txt");
    }
    get comandasPath() {
        return node_path_1.default.join(this.databaseDir, "comandas.txt");
    }
    get pagamentosPath() {
        return node_path_1.default.join(this.databaseDir, "pagamentos.txt");
    }
    get despesasPath() {
        return node_path_1.default.join(this.databaseDir, "despesas.txt");
    }
    get vendasDir() {
        return node_path_1.default.join(this.databaseDir, "historico-comandas");
    }
    get relatoriosDir() {
        return node_path_1.default.join(this.databaseDir, "relatorios");
    }
    async ensureDatabase(produtosHeader, comandasHeader, pagamentosHeader, despesasHeader) {
        await (0, promises_1.mkdir)(this.databaseDir, { recursive: true });
        await (0, promises_1.mkdir)(this.vendasDir, { recursive: true });
        await (0, promises_1.mkdir)(this.relatoriosDir, { recursive: true });
        await this.ensureFile(this.produtosPath, `${produtosHeader}\n`);
        await this.ensureFile(this.comandasPath, `${comandasHeader}\n`);
        await this.ensureFile(this.pagamentosPath, `${pagamentosHeader}\n`);
        if (despesasHeader)
            await this.ensureFile(this.despesasPath, `${despesasHeader}\n`);
    }
    async readLines(filePath) {
        try {
            const content = await (0, promises_1.readFile)(filePath, "utf8");
            return content.split(/\r?\n/).filter(Boolean);
        }
        catch {
            return [];
        }
    }
    async writeLines(filePath, header, lines) {
        const content = [header, ...lines].join("\n");
        await (0, promises_1.writeFile)(filePath, `${content}\n`, "utf8");
    }
    async writeSaleFile(fileName, content) {
        await (0, promises_1.mkdir)(this.vendasDir, { recursive: true });
        const filePath = node_path_1.default.join(this.vendasDir, fileName);
        await (0, promises_1.writeFile)(filePath, content, "utf8");
        return filePath;
    }
    async listSaleFiles() {
        try {
            const files = await (0, promises_1.readdir)(this.vendasDir);
            return files.filter((file) => file.endsWith(".txt")).sort();
        }
        catch {
            return [];
        }
    }
    async ensureFile(filePath, initialContent) {
        try {
            await (0, promises_1.readFile)(filePath, "utf8");
        }
        catch {
            await (0, promises_1.writeFile)(filePath, initialContent, "utf8");
        }
    }
}
exports.FileService = FileService;
//# sourceMappingURL=file-service.js.map