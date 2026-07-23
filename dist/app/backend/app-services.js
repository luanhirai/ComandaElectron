"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAppServices = createAppServices;
const node_path_1 = __importDefault(require("node:path"));
const parsers_js_1 = require("./utils/parsers.js");
const file_service_js_1 = require("./services/file-service.js");
const despesa_service_js_1 = require("./services/despesa-service.js");
const pagamento_service_js_1 = require("./services/pagamento-service.js");
const produto_service_js_1 = require("./services/produto-service.js");
const comanda_service_js_1 = require("./services/comanda-service.js");
const venda_service_js_1 = require("./services/venda-service.js");
async function createAppServices(databaseDir = node_path_1.default.resolve("app", "database")) {
    const fileService = new file_service_js_1.FileService(databaseDir);
    await fileService.ensureDatabase(parsers_js_1.PRODUTOS_HEADER, parsers_js_1.COMANDAS_HEADER, parsers_js_1.PAGAMENTOS_HEADER, parsers_js_1.DESPESAS_HEADER);
    const despesaService = new despesa_service_js_1.DespesaService(fileService);
    const pagamentoService = new pagamento_service_js_1.PagamentoService(fileService);
    const produtoService = new produto_service_js_1.ProdutoService(fileService);
    const vendaService = new venda_service_js_1.VendaService(fileService);
    const comandaService = new comanda_service_js_1.ComandaService(fileService, produtoService, pagamentoService, vendaService);
    await pagamentoService.load();
    await despesaService.load();
    await produtoService.load();
    await comandaService.load();
    return { fileService, pagamentoService, produtoService, comandaService, vendaService, despesaService };
}
//# sourceMappingURL=app-services.js.map