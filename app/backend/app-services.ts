import path from "node:path";
import { COMANDAS_HEADER, DESPESAS_HEADER, PAGAMENTOS_HEADER, PRODUTOS_HEADER } from "./utils/parsers.js";
import { FileService } from "./services/file-service.js";
import { DespesaService } from "./services/despesa-service.js";
import { PagamentoService } from "./services/pagamento-service.js";
import { ProdutoService } from "./services/produto-service.js";
import { ComandaService } from "./services/comanda-service.js";
import { VendaService } from "./services/venda-service.js";

export type AppServices = {
  fileService: FileService;
  pagamentoService: PagamentoService;
  produtoService: ProdutoService;
  comandaService: ComandaService;
  vendaService: VendaService;
  despesaService: DespesaService;
};

export async function createAppServices(databaseDir = path.resolve("app", "database")): Promise<AppServices> {
  const fileService = new FileService(databaseDir);
  await fileService.ensureDatabase(PRODUTOS_HEADER, COMANDAS_HEADER, PAGAMENTOS_HEADER, DESPESAS_HEADER);

  const despesaService = new DespesaService(fileService);
  const pagamentoService = new PagamentoService(fileService);
  const produtoService = new ProdutoService(fileService);
  const vendaService = new VendaService(fileService);
  const comandaService = new ComandaService(fileService, produtoService, pagamentoService, vendaService);

  await pagamentoService.load();
  await despesaService.load();
  await produtoService.load();
  await comandaService.load();

  return { fileService, pagamentoService, produtoService, comandaService, vendaService, despesaService };
}
