const formatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const state = {
  produtos: [],
  comandas: [],
  pagamentos: [],
  despesas: [],
  vendas: [],
  totalDia: 0,
  relatorio: null
};

const ui = {
  currentView: "home",
  selectedComandaId: null,
  selectedItens: new Set(),
  editingCodigo: null,
  editingDespesaId: null,
  produtoSearch: "",
  fiadoSearch: "",
  modal: null,
  autocomplete: {
    items: [],
    highlightedIndex: -1,
    open: false,
    focused: false
  }
};

const elements = {
  homeView: document.querySelector("#homeView"),
  vendaView: document.querySelector("#vendaView"),
  fechamentoView: document.querySelector("#fechamentoView"),
  fiadosView: document.querySelector("#fiadosView"),
  despesasView: document.querySelector("#despesasView"),
  relatorioView: document.querySelector("#relatorioView"),
  cadastroView: document.querySelector("#cadastroView"),
  navButtons: Array.from(document.querySelectorAll(".nav-button")),
  criarComanda: document.querySelector("#criarComanda"),
  comandasResumo: document.querySelector("#comandasResumo"),
  comandasList: document.querySelector("#comandasList"),
  comandaDetalhe: document.querySelector("#comandaDetalhe"),
  totalDia: document.querySelector("#totalDia"),
  produtoForm: document.querySelector("#produtoForm"),
  codigo: document.querySelector("#codigo"),
  nome: document.querySelector("#nome"),
  custo: document.querySelector("#custo"),
  preco: document.querySelector("#preco"),
  estoque: document.querySelector("#estoque"),
  salvarProduto: document.querySelector("#salvarProduto"),
  produtoSearch: document.querySelector("#produtoSearch"),
  produtosList: document.querySelector("#produtosList"),
  pagamentosList: document.querySelector("#pagamentosList"),
  vendasList: document.querySelector("#vendasList"),
  fiadosResumo: document.querySelector("#fiadosResumo"),
  fiadoSearch: document.querySelector("#fiadoSearch"),
  fiadosList: document.querySelector("#fiadosList"),
  despesaForm: document.querySelector("#despesaForm"),
  despesaDescricao: document.querySelector("#despesaDescricao"),
  despesaCategoria: document.querySelector("#despesaCategoria"),
  despesaValor: document.querySelector("#despesaValor"),
  despesaMetodo: document.querySelector("#despesaMetodo"),
  despesaData: document.querySelector("#despesaData"),
  despesaObservacao: document.querySelector("#despesaObservacao"),
  salvarDespesa: document.querySelector("#salvarDespesa"),
  despesasResumo: document.querySelector("#despesasResumo"),
  despesasList: document.querySelector("#despesasList"),
  modalOverlay: document.querySelector("#modalOverlay"),
  modalEyebrow: document.querySelector("#modalEyebrow"),
  modalTitle: document.querySelector("#modalTitle"),
  modalBody: document.querySelector("#modalBody"),
  fecharModal: document.querySelector("#fecharModal"),
  toast: document.querySelector("#toast"),
  reportInicio: document.querySelector("#reportInicio"),
  reportFim: document.querySelector("#reportFim"),
  buscarRelatorio: document.querySelector("#buscarRelatorio"),
  reportSummary: document.querySelector("#reportSummary"),
  reportProducts: document.querySelector("#reportProducts"),
  reportPayments: document.querySelector("#reportPayments"),
  reportPeriodHeader: document.querySelector("#reportPeriodHeader"),
  exportarRelatorioPdf: document.querySelector("#exportarRelatorioPdf")
};

async function refresh() {
  const snapshot = await window.barApi.snapshot();
  Object.assign(state, snapshot);
  if (elements.reportInicio instanceof HTMLInputElement && elements.reportFim instanceof HTMLInputElement) {
    if (!elements.reportInicio.value) elements.reportInicio.value = snapshot.relatorio.periodo.inicio;
    if (!elements.reportFim.value) elements.reportFim.value = snapshot.relatorio.periodo.fim;
  }

  const abertas = getComandasAbertas();
  if (!abertas.find((comanda) => comanda.id === ui.selectedComandaId)) {
    ui.selectedComandaId = abertas[0]?.id ?? null;
    ui.selectedItens.clear();
  }

  if (ui.editingCodigo && !state.produtos.find((produto) => produto.codigo === ui.editingCodigo)) {
    resetProdutoForm();
  }
  if (ui.editingDespesaId && !state.despesas.find((despesa) => despesa.id === ui.editingDespesaId)) {
    resetDespesaForm();
  }
  if (elements.despesaData instanceof HTMLInputElement && !elements.despesaData.value) {
    elements.despesaData.value = new Date().toISOString().slice(0, 10);
  }

  render();
}

function render() {
  renderViews();
  renderCurrentView();
  syncScannerFocus();
}

function renderCurrentView() {
  if (ui.currentView === "home") renderHome();
  if (ui.currentView === "venda") renderVenda();
  if (ui.currentView === "cadastro") renderCadastro();
  if (ui.currentView === "fechamento") renderFechamento();
  if (ui.currentView === "fiados") renderFiados();
  if (ui.currentView === "despesas") renderDespesas();
  if (ui.currentView === "relatorio") renderRelatorio();
}

function renderViews() {
  for (const button of elements.navButtons) {
    button.classList.toggle("active", button.dataset.view === ui.currentView);
  }

  elements.homeView.classList.toggle("hidden", ui.currentView !== "home");
  elements.vendaView.classList.toggle("hidden", ui.currentView !== "venda");
  elements.fechamentoView.classList.toggle("hidden", ui.currentView !== "fechamento");
  elements.fiadosView.classList.toggle("hidden", ui.currentView !== "fiados");
  elements.despesasView.classList.toggle("hidden", ui.currentView !== "despesas");
  elements.relatorioView.classList.toggle("hidden", ui.currentView !== "relatorio");
  elements.cadastroView.classList.toggle("hidden", ui.currentView !== "cadastro");
}

function renderHome() {
  const abertas = getComandasAbertas();
  const produtos = state.produtos.length;
  const pagamentosHoje = getPagamentosRecebidos().length;
  const fiados = getFiados();
  const totalFiado = fiados.reduce((total, pagamento) => total + pagamento.valor, 0);
  const totalDespesas = state.despesas.reduce((total, despesa) => total + despesa.valor, 0);

  elements.homeView.innerHTML = `
    <div class="home-grid home-grid--six">
      <article class="home-card">
        <div>
          <p class="eyebrow">Venda</p>
          <h2>Atendimento de Comandas</h2>
        </div>
        <p>Crie comandas, selecione a comanda aberta e registre itens por nome ou codigo de barras com foco no scanner.</p>
        <div class="home-stats">
          <span class="stat-pill">${abertas.length} comandas abertas</span>
          <span class="stat-pill">${formatter.format(abertas.reduce((total, comanda) => total + comanda.total, 0))} em aberto</span>
        </div>
        <button data-nav="venda">Entrar em Venda</button>
      </article>

      <article class="home-card">
        <div>
          <p class="eyebrow">Fechamento</p>
          <h2>Caixa do Dia</h2>
        </div>
        <p>Acompanhe pagamentos, troco, historico das comandas fechadas e total recebido no dia em uma tela separada.</p>
        <div class="home-stats">
          <span class="stat-pill">${formatter.format(state.totalDia)} recebidos</span>
          <span class="stat-pill">${pagamentosHoje} pagamentos registrados</span>
        </div>
        <button data-nav="fechamento">Abrir Fechamento</button>
      </article>

      <article class="home-card">
        <div>
          <p class="eyebrow">Fiados</p>
          <h2>Contas Pendentes</h2>
        </div>
        <p>Consulte todas as comandas registradas como fiado, com valor, itens e data da pendencia.</p>
        <div class="home-stats">
          <span class="stat-pill">${formatter.format(totalFiado)} em fiado</span>
          <span class="stat-pill">${fiados.length} registros</span>
        </div>
        <button data-nav="fiados">Ver Fiados</button>
      </article>

      <article class="home-card">
        <div>
          <p class="eyebrow">Despesas</p>
          <h2>Saidas do Caixa</h2>
        </div>
        <p>Registre pagamentos de despesas por dinheiro, cartao ou Pix, com edicao e exclusao quando precisar corrigir.</p>
        <div class="home-stats">
          <span class="stat-pill">${formatter.format(totalDespesas)} em despesas</span>
          <span class="stat-pill">${state.despesas.length} registros</span>
        </div>
        <button data-nav="despesas">Abrir Despesas</button>
      </article>

      <article class="home-card">
        <div>
          <p class="eyebrow">Relatorio</p>
          <h2>Analise por Periodo</h2>
        </div>
        <p>Veja totais por forma de pagamento, custo, lucro bruto e a lista de produtos vendidos em uma tela dedicada.</p>
        <div class="home-stats">
          <span class="stat-pill">${formatter.format(state.relatorio?.totalRecebido ?? 0)} no periodo</span>
          <span class="stat-pill">${state.relatorio?.produtos.length ?? 0} produtos no relatorio</span>
        </div>
        <button data-nav="relatorio">Abrir Relatorio</button>
      </article>

      <article class="home-card">
        <div>
          <p class="eyebrow">Cadastro</p>
          <h2>Produtos</h2>
        </div>
        <p>Cadastre, edite e remova produtos com controle leve em TXT para manter a operacao 100% offline.</p>
        <div class="home-stats">
          <span class="stat-pill">${produtos} produtos cadastrados</span>
        </div>
        <button data-nav="cadastro">Abrir Cadastro</button>
      </article>
    </div>
  `;
}

function renderVenda() {
  const abertas = getComandasAbertas();
  elements.comandasResumo.innerHTML = abertas.length
    ? abertas
        .map(
          (comanda) =>
            `${comanda.nome} | Total: ${formatter.format(comanda.total)} | Desconto: ${formatter.format(comanda.desconto ?? 0)} | ${getQuantidadeItens(comanda)} itens`
        )
        .join("<br />")
    : "Nenhuma comanda aberta no momento.";

  elements.comandasList.innerHTML = abertas.length
    ? abertas
        .map((comanda) => {
          const active = comanda.id === ui.selectedComandaId ? "active" : "";
          return `
            <div class="row-card selectable ${active}" data-action="selecionar-comanda" data-id="${comanda.id}">
              <div class="row-title">
                <strong>${comanda.nome}</strong>
                <span class="status aberta">ABERTA</span>
              </div>
              <div class="meta-line">ID interno: ${comanda.id}</div>
              <div class="meta-line">Desconto: ${formatter.format(comanda.desconto ?? 0)}</div>
              <div class="meta-line">Total: ${formatter.format(comanda.total)}</div>
              <div class="meta-line">${getQuantidadeItens(comanda)} itens</div>
            </div>`;
        })
        .join("")
    : `<div class="empty">Crie a primeira comanda para iniciar a venda.</div>`;

  const comanda = getSelectedComanda();
  if (!comanda) {
    elements.comandaDetalhe.innerHTML = `
      <div class="card-header">
        <div>
          <p class="eyebrow">Comanda</p>
          <h2>Detalhe da Comanda</h2>
        </div>
      </div>
      <div class="empty">Selecione uma comanda aberta para visualizar os itens.</div>
    `;
    return;
  }

  const itens = comanda.itens
    .map((item) => {
      const produto = produtoPorCodigo(item.codigo);
      const checked = ui.selectedItens.has(item.codigo) ? "checked" : "";
      const subtotal = getItemPreco(item) * item.quantidade;
      return `
        <label class="item-row">
          <input type="checkbox" data-action="toggle-item" data-codigo="${item.codigo}" ${checked} />
          <div>
          <strong>${getItemNome(item)}</strong>
            <div class="product-meta">${item.codigo} | Unitario ${formatter.format(getItemPreco(item))}</div>
          </div>
          <span>x${item.quantidade}</span>
          <strong>${formatter.format(subtotal)}</strong>
          <div class="inline-actions">
            <button class="secondary" data-action="editar-preco-item" data-id="${comanda.id}" data-codigo="${item.codigo}">Preco</button>
            <button class="secondary" data-action="remover" data-id="${comanda.id}" data-codigo="${item.codigo}">-1</button>
            <button class="secondary" data-action="adicionar-mais" data-id="${comanda.id}" data-codigo="${item.codigo}">+1</button>
          </div>
        </label>`;
    })
    .join("");

  elements.comandaDetalhe.innerHTML = `
    <div class="card-header">
      <div>
        <p class="eyebrow">Comanda ${comanda.id}</p>
        <h2>Detalhe da Comanda</h2>
        <div class="meta-line">${comanda.nome}</div>
      </div>
      <span class="status aberta">ABERTA</span>
    </div>

    <div class="detail-layout">
      <div class="detail-summary">
        <div class="summary-box">
          <span>Total atual</span>
          <strong>${formatter.format(comanda.total)}</strong>
        </div>
        <div class="summary-box">
          <span>Subtotal</span>
          <strong>${formatter.format(getSubtotalComanda(comanda))}</strong>
        </div>
        <div class="summary-box">
          <span>Desconto</span>
          <strong>${formatter.format(comanda.desconto ?? 0)}</strong>
        </div>
        <div class="summary-box">
          <span>Itens</span>
          <strong>${getQuantidadeItens(comanda)}</strong>
        </div>
        <div class="summary-box">
          <span>Selecionados</span>
          <strong>${formatter.format(getSubtotalSelecionado(comanda))}</strong>
        </div>
        <div class="summary-box">
          <span>Status</span>
          <strong>ABERTA</strong>
        </div>
      </div>

      <div class="scanner-panel">
        <div class="autocomplete">
          <input id="scannerInput" placeholder="Digite nome do produto ou codigo de barras" autocomplete="off" />
          <div id="autocompleteList" class="autocomplete-list hidden"></div>
        </div>
        <input id="quantidadeInput" type="number" min="1" value="1" aria-label="Quantidade" />
        <input id="precoItemInput" type="number" min="0.01" step="0.01" placeholder="Preco" aria-label="Preco na comanda" />
        <button id="adicionarItem">Adicionar</button>
      </div>

      <div class="detail-actions">
        <button class="secondary" data-action="editar-nome-comanda">Editar nome</button>
        <button class="secondary" data-action="editar-desconto-comanda">Editar desconto</button>
        <button class="secondary" data-action="abrir-pagamento-parcial">Pagamento parcial</button>
        <button class="secondary" data-action="abrir-divisao">Dividir comanda</button>
        <button class="secondary" data-action="abrir-fiado">Colocar no fiado</button>
        <button data-action="abrir-fechamento-total">Fechar comanda</button>
        <button class="danger" data-action="cancelar-comanda">Cancelar comanda</button>
      </div>

      <div class="items">
        ${itens || `<div class="empty">A comanda esta vazia.</div>`}
      </div>
    </div>
  `;
}

function renderCadastro() {
  elements.salvarProduto.textContent = ui.editingCodigo ? "Atualizar produto" : "Salvar produto";
  const produtosFiltrados = filtrarProdutos();
  elements.produtosList.innerHTML = produtosFiltrados.length
    ? produtosFiltrados
        .map(
          (produto) => `
            <div class="row-card">
              <div class="row-title">
                <strong>${produto.nome}</strong>
                <span class="status aberta">Estoque ${produto.estoque}</span>
              </div>
              <div class="product-meta">${produto.codigo} | Custo ${formatter.format(produto.custo)} | Venda ${formatter.format(produto.preco)}</div>
              <div class="product-actions">
                <button class="secondary" data-action="editar-produto" data-codigo="${produto.codigo}">Editar</button>
                <button class="danger" data-action="excluir-produto" data-codigo="${produto.codigo}">Excluir</button>
              </div>
            </div>`
        )
        .join("")
    : `<div class="empty">${state.produtos.length ? "Nenhum produto encontrado para essa pesquisa." : "Cadastre o primeiro produto para iniciar as vendas."}</div>`;
}

function renderFechamento() {
  const pagamentosRecebidos = getPagamentosRecebidos();
  const vendasRecebidas = state.vendas.filter((venda) => !venda.conteudo.includes("PAGAMENTO: FIADO"));
  elements.totalDia.textContent = formatter.format(state.totalDia);
  elements.pagamentosList.innerHTML = pagamentosRecebidos.length
    ? pagamentosRecebidos
        .map((pagamento) => {
          const itens = pagamento.itensPagos.map((item) => `${item.codigo} x${item.quantidade}`).join(", ");
          return `
            <div class="row-card">
              <div class="row-title">
                <strong>${state.comandas.find((comanda) => comanda.id === pagamento.comandaId)?.nome ?? `Comanda ${pagamento.comandaId}`}</strong>
                <span class="status aberta">${pagamento.metodo}</span>
              </div>
              <div class="payment-meta">ID interno: ${pagamento.comandaId}</div>
              <div class="payment-meta">Valor: ${formatter.format(pagamento.valor)}</div>
              <div class="payment-meta">Desconto: ${formatter.format(pagamento.desconto ?? 0)}</div>
              <div class="payment-meta">Itens pagos: ${itens}</div>
              <div class="payment-meta">Data: ${pagamento.data.replace("T", " ")}</div>
            </div>`;
        })
        .join("")
    : `<div class="empty">Nenhum pagamento registrado ainda.</div>`;

  elements.vendasList.innerHTML = vendasRecebidas.length
    ? vendasRecebidas
        .map(
          (venda) => `
            <div class="row-card">
              <div class="row-title">
                <strong>${venda.arquivo}</strong>
              </div>
              <pre class="history-meta">${venda.conteudo}</pre>
            </div>`
        )
        .join("")
    : `<div class="empty">Nenhuma comanda foi fechada ainda.</div>`;
}

function renderFiados() {
  const fiados = getFiados();
  const fiadosFiltrados = filtrarFiados(fiados);
  const totalFiado = fiados.reduce((total, pagamento) => total + pagamento.valor, 0);
  const totalFiadoFiltrado = fiadosFiltrados.reduce((total, pagamento) => total + pagamento.valor, 0);

  elements.fiadosResumo.innerHTML = `
    <div class="summary-box">
      <span>Total em fiado</span>
      <strong>${formatter.format(totalFiado)}</strong>
    </div>
    <div class="summary-box">
      <span>Registros</span>
      <strong>${fiados.length}</strong>
    </div>
    <div class="summary-box">
      <span>Resultado da busca</span>
      <strong>${formatter.format(totalFiadoFiltrado)} / ${fiadosFiltrados.length}</strong>
    </div>
    <div class="summary-box">
      <span>Ultimo fiado</span>
      <strong>${fiados[0]?.data.replace("T", " ") ?? "Sem registro"}</strong>
    </div>
  `;

  elements.fiadosList.innerHTML = fiadosFiltrados.length
    ? fiadosFiltrados
        .map((pagamento) => {
          const itens = pagamento.itensDetalhados.length
            ? pagamento.itensDetalhados
                .map((item) => `${item.nome} x${item.quantidade} (${formatter.format(item.precoUnitario * item.quantidade)})`)
                .join(", ")
            : pagamento.itensPagos.map((item) => `${item.codigo} x${item.quantidade}`).join(", ");

          return `
            <div class="row-card">
              <div class="row-title">
                <strong>${pagamento.comandaNome}</strong>
                <span class="status fiado">FIADO</span>
              </div>
              <div class="payment-meta">ID interno: ${pagamento.comandaId}</div>
              <div class="payment-meta">Valor pendente: ${formatter.format(pagamento.valor)}</div>
              <div class="payment-meta">Desconto: ${formatter.format(pagamento.desconto ?? 0)}</div>
              <div class="payment-meta">Itens: ${itens || "Sem itens detalhados"}</div>
              <div class="payment-meta">Data: ${pagamento.data.replace("T", " ")}</div>
              <div class="fiado-actions">
                <button data-action="quitar-fiado" data-id="${pagamento.comandaId}" data-data="${encodeURIComponent(pagamento.data)}">Marcar como pago</button>
                <button class="danger" data-action="cancelar-fiado" data-id="${pagamento.comandaId}" data-data="${encodeURIComponent(pagamento.data)}">Cancelar fiado</button>
              </div>
            </div>`;
        })
        .join("")
    : `<div class="empty">${fiados.length ? "Nenhum devedor encontrado para essa pesquisa." : "Nenhum fiado registrado ainda."}</div>`;
}

function renderDespesas() {
  elements.salvarDespesa.textContent = ui.editingDespesaId ? "Atualizar despesa" : "Salvar despesa";
  const total = state.despesas.reduce((sum, despesa) => sum + despesa.valor, 0);
  const totaisPorMetodo = state.despesas.reduce(
    (acc, despesa) => {
      acc[despesa.metodoPagamento] += despesa.valor;
      return acc;
    },
    { DINHEIRO: 0, CARTAO: 0, PIX: 0 }
  );

  elements.despesasResumo.innerHTML = `
    <div class="summary-box">
      <span>Total de despesas</span>
      <strong>${formatter.format(total)}</strong>
    </div>
    <div class="summary-box">
      <span>Dinheiro</span>
      <strong>${formatter.format(totaisPorMetodo.DINHEIRO)}</strong>
    </div>
    <div class="summary-box">
      <span>Cartao</span>
      <strong>${formatter.format(totaisPorMetodo.CARTAO)}</strong>
    </div>
    <div class="summary-box">
      <span>Pix</span>
      <strong>${formatter.format(totaisPorMetodo.PIX)}</strong>
    </div>
  `;

  elements.despesasList.innerHTML = state.despesas.length
    ? state.despesas
        .map(
          (despesa) => `
            <div class="row-card">
              <div class="row-title">
                <strong>${despesa.descricao}</strong>
                <span class="status aberta">${despesa.metodoPagamento}</span>
              </div>
              <div class="payment-meta">Categoria: ${despesa.categoria}</div>
              <div class="payment-meta">Valor: ${formatter.format(despesa.valor)}</div>
              <div class="payment-meta">Data: ${despesa.data}</div>
              ${despesa.observacao ? `<div class="payment-meta">Observacao: ${despesa.observacao}</div>` : ""}
              <div class="product-actions">
                <button class="secondary" data-action="editar-despesa" data-id="${despesa.id}">Editar</button>
                <button class="danger" data-action="excluir-despesa" data-id="${despesa.id}">Excluir</button>
              </div>
            </div>`
        )
        .join("")
    : `<div class="empty">Nenhuma despesa registrada ainda.</div>`;
}

function renderRelatorio() {
  const relatorio = state.relatorio;
  if (!relatorio) {
    elements.reportSummary.innerHTML = `<div class="empty">Sem relatorio carregado.</div>`;
    elements.reportPeriodHeader.innerHTML = "";
    elements.reportPayments.innerHTML = "";
    elements.reportProducts.innerHTML = "";
    return;
  }

  elements.reportPeriodHeader.innerHTML = `
    <div>
      <p class="eyebrow">Periodo selecionado</p>
      <strong>${relatorio.periodo.inicio} ate ${relatorio.periodo.fim}</strong>
    </div>
    <div class="meta-line">${relatorio.pagamentos.length} pagamentos no periodo</div>
  `;

  const summaryRows = [
    ["Valor Total", relatorio.totalRecebido, true],
    ["Dinheiro", relatorio.totaisPorMetodo.DINHEIRO, true],
    ["Cartao", relatorio.totaisPorMetodo.CARTAO, true],
    ["Pix", relatorio.totaisPorMetodo.PIX, true],
    ["Descontos", relatorio.totalDescontos ?? 0, false],
    ["Total de custo", relatorio.totalCusto, false],
    ["Lucro bruto", relatorio.lucroBruto, true],
    ["Troco", relatorio.totalTroco, false]
  ];

  elements.reportSummary.innerHTML = summaryRows
    .map(
      ([label, value, positive]) => `
        <div class="report-summary-row">
          <span>${label}</span>
          <strong class="value ${positive ? "positive" : ""}">${formatter.format(value)}</strong>
        </div>
      `
    )
    .join("");

  elements.reportPayments.innerHTML = `
    <div class="report-block-title">Pagamentos do periodo</div>
    ${
      relatorio.pagamentos.length
        ? relatorio.pagamentos
            .map(
              (pagamento) => `
                <div class="row-card">
                  <div class="row-title">
                    <strong>${pagamento.comandaNome}</strong>
                    <span class="status aberta">${pagamento.metodo}</span>
                  </div>
                  <div class="payment-meta">Valor: ${formatter.format(pagamento.valor)}</div>
                  <div class="payment-meta">Desconto: ${formatter.format(pagamento.desconto ?? 0)}</div>
                  <div class="payment-meta">Recebido: ${formatter.format(pagamento.valorRecebido ?? pagamento.valor)}</div>
                  <div class="payment-meta">Troco: ${formatter.format(pagamento.troco ?? 0)}</div>
                  <div class="payment-meta">Data: ${pagamento.data.replace("T", " ")}</div>
                </div>`
            )
            .join("")
        : `<div class="empty">Sem pagamentos no periodo.</div>`
    }
  `;

  elements.reportProducts.innerHTML = relatorio.produtos.length
    ? `
        <div class="report-block-title">Produtos vendidos</div>
        ${relatorio.produtos
          .map(
            (produto) => `
              <div class="row-card">
                <div class="row-title">
                  <strong>${produto.nome}</strong>
                  <span class="status aberta">${produto.quantidadeVendida} vendidos</span>
                </div>
                <div class="product-meta">Codigo: ${produto.codigo}</div>
                <div class="product-meta">Total venda: ${formatter.format(produto.totalVenda)}</div>
                <div class="product-meta">Total custo: ${formatter.format(produto.totalCusto)}</div>
                <div class="product-meta">Lucro bruto: ${formatter.format(produto.lucroBruto)}</div>
              </div>`
          )
          .join("")}
      `
    : `<div class="report-block-title">Produtos vendidos</div><div class="empty">Nenhum produto vendido no periodo selecionado.</div>`;
}

function getComandasAbertas() {
  return state.comandas.filter((comanda) => comanda.status === "ABERTA");
}

function getFiados() {
  return state.pagamentos.filter((pagamento) => pagamento.metodo === "FIADO");
}

function getPagamentosRecebidos() {
  return state.pagamentos.filter((pagamento) => pagamento.metodo !== "FIADO");
}

function getFiadoByKey(comandaId, data) {
  return getFiados().find((pagamento) => pagamento.comandaId === comandaId && pagamento.data === data) ?? null;
}

function filtrarProdutos() {
  const query = normalizeText(ui.produtoSearch);
  if (!query) return state.produtos;
  return state.produtos.filter((produto) =>
    [produto.nome, produto.codigo, String(produto.custo), String(produto.preco), String(produto.estoque)]
      .some((value) => normalizeText(value).includes(query))
  );
}

function filtrarFiados(fiados) {
  const query = normalizeText(ui.fiadoSearch);
  if (!query) return fiados;
  return fiados.filter((pagamento) => {
    const itensDetalhados = pagamento.itensDetalhados
      .map((item) => `${item.codigo} ${item.nome} ${item.quantidade}`)
      .join(" ");
    const itensPagos = pagamento.itensPagos.map((item) => `${item.codigo} ${item.nome ?? ""} ${item.quantidade}`).join(" ");
    return [
      pagamento.comandaNome,
      String(pagamento.comandaId),
      formatter.format(pagamento.valor),
      pagamento.data,
      itensDetalhados,
      itensPagos
    ].some((value) => normalizeText(value).includes(query));
  });
}

function getSelectedComanda() {
  return getComandasAbertas().find((comanda) => comanda.id === ui.selectedComandaId) ?? null;
}

function getQuantidadeItens(comanda) {
  return comanda.itens.reduce((total, item) => total + item.quantidade, 0);
}

function getSubtotalComanda(comanda) {
  return comanda.itens.reduce((total, item) => total + getItemPreco(item) * item.quantidade, 0);
}

function getSubtotalSelecionado(comanda) {
  return comanda.itens.reduce((total, item) => {
    if (!ui.selectedItens.has(item.codigo)) return total;
    return total + getItemPreco(item) * item.quantidade;
  }, 0);
}

function produtoPorCodigo(codigo) {
  return state.produtos.find((produto) => produto.codigo === codigo);
}

function getItemNome(item) {
  return item.nome ?? produtoPorCodigo(item.codigo)?.nome ?? item.codigo;
}

function getItemPreco(item) {
  return item.precoUnitario ?? produtoPorCodigo(item.codigo)?.preco ?? 0;
}

function normalizeText(value) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

function getAutocompleteMatches(query) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return [];

  const scored = state.produtos
    .map((produto) => {
      const normalizedName = normalizeText(produto.nome);
      const normalizedCode = normalizeText(produto.codigo);
      let score = 0;

      if (normalizedCode === normalizedQuery) score = 100;
      else if (normalizedName === normalizedQuery) score = 95;
      else if (normalizedName.startsWith(normalizedQuery)) score = 80;
      else if (normalizedCode.startsWith(normalizedQuery)) score = 70;
      else if (normalizedName.includes(normalizedQuery)) score = 60;
      else if (normalizedCode.includes(normalizedQuery)) score = 50;

      return score ? { produto, score } : null;
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score || left.produto.nome.localeCompare(right.produto.nome, "pt-BR"))
    .slice(0, 6);

  return scored.map((entry) => entry.produto);
}

function renderAutocomplete(query) {
  const list = document.querySelector("#autocompleteList");
  if (!(list instanceof HTMLElement)) return;

  const items = getAutocompleteMatches(query);
  ui.autocomplete.items = items;
  ui.autocomplete.open = ui.autocomplete.focused && items.length > 0 && Boolean(query.trim());
  if (!ui.autocomplete.open) {
    ui.autocomplete.highlightedIndex = -1;
    list.innerHTML = "";
    list.classList.add("hidden");
    return;
  }

  if (ui.autocomplete.highlightedIndex >= items.length) {
    ui.autocomplete.highlightedIndex = 0;
  }

  list.innerHTML = items
    .map((produto, index) => {
      const active = index === ui.autocomplete.highlightedIndex ? "active" : "";
      return `
        <button
          type="button"
          class="autocomplete-item ${active}"
          data-action="selecionar-sugestao"
          data-codigo="${produto.codigo}"
          data-nome="${produto.nome}"
        >
          <span>${produto.nome}</span>
          <small>${produto.codigo}</small>
        </button>
      `;
    })
    .join("");

  list.classList.remove("hidden");
}

function closeAutocomplete() {
  ui.autocomplete.items = [];
  ui.autocomplete.highlightedIndex = -1;
  ui.autocomplete.open = false;
  ui.autocomplete.focused = false;
  const list = document.querySelector("#autocompleteList");
  if (list instanceof HTMLElement) {
    list.innerHTML = "";
    list.classList.add("hidden");
  }
}

function applyAutocompleteSelection(produto) {
  const scannerInput = document.querySelector("#scannerInput");
  if (!(scannerInput instanceof HTMLInputElement)) return;
  scannerInput.value = produto.nome;
  closeAutocomplete();
  scannerInput.focus();
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => elements.toast.classList.remove("show"), 2600);
}

async function handleAction(fn, successMessage) {
  try {
    const result = await fn();
    await refresh();
    if (successMessage) showToast(successMessage);
    return result;
  } catch (error) {
    showToast(error?.message ?? "Nao foi possivel concluir a acao.");
    throw error;
  }
}

function switchView(view) {
  closeAutocomplete();
  ui.currentView = view;
  render();
}

function resetProdutoForm() {
  ui.editingCodigo = null;
  elements.produtoForm.reset();
}

function resetDespesaForm() {
  ui.editingDespesaId = null;
  elements.despesaForm.reset();
  elements.despesaData.value = new Date().toISOString().slice(0, 10);
}

function openModal(config) {
  ui.modal = config;
  elements.modalEyebrow.textContent = config.eyebrow;
  elements.modalTitle.textContent = config.title;
  elements.modalBody.innerHTML = config.render();
  elements.modalOverlay.classList.remove("hidden");
}

function closeModal() {
  ui.modal = null;
  elements.modalOverlay.classList.add("hidden");
  elements.modalBody.innerHTML = "";
}

function syncScannerFocus() {
  if (ui.currentView !== "venda" || ui.modal || !getSelectedComanda()) return;
  requestAnimationFrame(() => {
    const input = document.querySelector("#scannerInput");
    if (input instanceof HTMLInputElement) input.focus();
  });
}

function currentScannerElements() {
  return {
    scannerInput: document.querySelector("#scannerInput"),
    quantidadeInput: document.querySelector("#quantidadeInput"),
    precoItemInput: document.querySelector("#precoItemInput")
  };
}

async function submitScannerInput() {
  const comanda = getSelectedComanda();
  const { scannerInput, quantidadeInput, precoItemInput } = currentScannerElements();
  if (!comanda || !(scannerInput instanceof HTMLInputElement) || !(quantidadeInput instanceof HTMLInputElement)) return;

  await handleAction(
    async () => {
      const precoUnitario =
        precoItemInput instanceof HTMLInputElement && precoItemInput.value ? Number(precoItemInput.value) : undefined;
      await window.barApi.adicionarItem(comanda.id, scannerInput.value.trim(), Number(quantidadeInput.value || 1), precoUnitario);
      scannerInput.value = "";
      if (precoItemInput instanceof HTMLInputElement) precoItemInput.value = "";
      closeAutocomplete();
      scannerInput.focus();
    },
    "Item adicionado"
  );
}

function openEditarPrecoItemModal(comandaId, codigo) {
  const comanda = getSelectedComanda();
  const item = comanda?.itens.find((entrada) => entrada.codigo === codigo);
  if (!comanda || !item) {
    showToast("Item nao encontrado na comanda.");
    return;
  }

  openModal({
    eyebrow: "Preco na Comanda",
    title: `Alterar ${getItemNome(item)}`,
    render: () => `
      <div class="modal-summary">
        <span>Preco cadastrado</span>
        <strong>${formatter.format(produtoPorCodigo(codigo)?.preco ?? getItemPreco(item))}</strong>
        <span>Essa alteracao vale somente para esta comanda.</span>
      </div>
      <label>
        <span class="eyebrow">Preco unitario</span>
        <input id="modalPrecoItem" type="number" min="0.01" step="0.01" value="${getItemPreco(item).toFixed(2)}" />
      </label>
      <div class="modal-actions">
        <button class="secondary" id="cancelarPrecoItem">Cancelar</button>
        <button id="confirmarPrecoItem">Salvar preco</button>
      </div>
    `
  });

  const precoInput = document.querySelector("#modalPrecoItem");
  const cancelar = document.querySelector("#cancelarPrecoItem");
  const confirmar = document.querySelector("#confirmarPrecoItem");
  cancelar.addEventListener("click", closeModal);
  confirmar.addEventListener("click", async () => {
    await handleAction(
      () => window.barApi.editarPrecoItem(comandaId, codigo, Number(precoInput.value)),
      "Preco do item atualizado"
    );
    closeModal();
  });
}

function getItensSelecionadosDaComanda(comanda) {
  return comanda.itens
    .filter((item) => ui.selectedItens.has(item.codigo))
    .map((item) => ({ ...item }));
}

function selecionouComandaInteira(comanda, itens) {
  if (itens.length !== comanda.itens.length) return false;
  return comanda.itens.every((item) => itens.find((entry) => entry.codigo === item.codigo)?.quantidade === item.quantidade);
}

function openPagamentoModal(mode, preferredMethod = "DINHEIRO") {
  const comanda = getSelectedComanda();
  if (!comanda) {
    showToast("Selecione uma comanda.");
    return;
  }

  const itens = mode === "partial" ? getItensSelecionadosDaComanda(comanda) : comanda.itens.map((item) => ({ ...item }));
  if (!itens.length) {
    showToast("Selecione ao menos um item para pagamento.");
    return;
  }

  const subtotal = itens.reduce((total, item) => {
    return total + getItemPreco(item) * item.quantidade;
  }, 0);
  const descontoAplicado = selecionouComandaInteira(comanda, itens) ? Math.min(comanda.desconto ?? 0, subtotal) : 0;
  const totalAPagar = Math.max(0, subtotal - descontoAplicado);

  openModal({
    eyebrow: preferredMethod === "FIADO" ? "Devedores" : mode === "partial" ? "Pagamento Parcial" : "Fechar Comanda",
    title:
      preferredMethod === "FIADO"
        ? `Colocar ${comanda.nome} no fiado`
        : mode === "partial"
          ? `Pagamento parcial de ${comanda.nome}`
          : `Fechar ${comanda.nome}`,
    render: () => `
      <div class="modal-summary">
        <strong>Itens selecionados</strong>
        ${itens
          .map((item) => {
            return `<span>${getItemNome(item)} x${item.quantidade}</span>`;
          })
          .join("")}
        <strong>Subtotal: ${formatter.format(subtotal)}</strong>
        <span>Desconto: ${formatter.format(descontoAplicado)}</span>
      </div>

      <div class="modal-grid">
        <label>
          <span class="eyebrow">Metodo</span>
          <select id="modalMetodo">
            <option value="DINHEIRO">Dinheiro</option>
            <option value="CARTAO">Cartao</option>
            <option value="PIX">Pix</option>
            <option value="FIADO">Fiado (devedor)</option>
          </select>
        </label>
        ${
          mode === "partial"
            ? `<label id="valorPagoWrap">
                <span class="eyebrow">Valor pago agora</span>
                <input id="modalValorPago" type="number" min="0.01" max="${totalAPagar.toFixed(2)}" step="0.01" value="${totalAPagar.toFixed(2)}" />
              </label>`
            : ""
        }
        <label id="valorRecebidoWrap">
          <span class="eyebrow">Valor recebido</span>
          <input id="modalValorRecebido" type="number" min="${totalAPagar.toFixed(2)}" step="0.01" placeholder="Somente dinheiro" />
        </label>
      </div>

      <div class="modal-summary">
        <span>Total a pagar</span>
        <strong>${formatter.format(totalAPagar)}</strong>
        ${mode === "partial" ? `<span id="saldoPendentePreview">Saldo pendente: ${formatter.format(0)}</span>` : ""}
        <span id="trocoPreview">Troco: ${formatter.format(0)}</span>
      </div>

      <div class="modal-actions">
        <button class="secondary" id="cancelarPagamento">Cancelar</button>
        <button id="confirmarPagamento">${preferredMethod === "FIADO" ? "Confirmar fiado" : mode === "partial" ? "Finalizar pagamento" : "Fechar comanda"}</button>
      </div>
    `
  });

  const metodo = document.querySelector("#modalMetodo");
  const valorRecebido = document.querySelector("#modalValorRecebido");
  const valorPago = document.querySelector("#modalValorPago");
  const valorPagoWrap = document.querySelector("#valorPagoWrap");
  const valorWrap = document.querySelector("#valorRecebidoWrap");
  const trocoPreview = document.querySelector("#trocoPreview");
  const saldoPendentePreview = document.querySelector("#saldoPendentePreview");
  const confirmar = document.querySelector("#confirmarPagamento");
  const cancelar = document.querySelector("#cancelarPagamento");
  metodo.value = preferredMethod;

  const syncPagamentoPreview = () => {
    const metodoAtual = metodo.value;
    const pagoAgora = mode === "partial" && valorPago instanceof HTMLInputElement ? Number(valorPago.value || 0) : totalAPagar;
    const totalReferencia = metodoAtual === "FIADO" ? totalAPagar : Math.min(Math.max(pagoAgora, 0), totalAPagar);
    valorWrap.classList.toggle("hidden", metodoAtual !== "DINHEIRO");
    if (valorPagoWrap instanceof HTMLElement) valorPagoWrap.classList.toggle("hidden", metodoAtual === "FIADO");
    const valor = Number(valorRecebido.value || 0);
    const troco = metodoAtual === "DINHEIRO" ? Math.max(0, valor - totalReferencia) : 0;
    trocoPreview.textContent = `Troco: ${formatter.format(troco)}`;
    if (saldoPendentePreview) {
      const saldo = metodoAtual === "FIADO" ? 0 : Math.max(0, totalAPagar - totalReferencia);
      saldoPendentePreview.textContent = `Saldo pendente: ${formatter.format(saldo)}`;
    }
  };

  metodo.addEventListener("change", syncPagamentoPreview);
  valorRecebido.addEventListener("input", syncPagamentoPreview);
  if (valorPago instanceof HTMLInputElement) valorPago.addEventListener("input", syncPagamentoPreview);
  cancelar.addEventListener("click", closeModal);
  confirmar.addEventListener("click", async () => {
    const metodoPagamento = metodo.value;
    const pagoAgora =
      mode === "partial" && valorPago instanceof HTMLInputElement && metodoPagamento !== "FIADO"
        ? Number(valorPago.value || 0)
        : undefined;
    const valor = valorRecebido.value
      ? Number(valorRecebido.value)
      : metodoPagamento === "DINHEIRO"
        ? (pagoAgora ?? totalAPagar)
        : undefined;
    const response =
      mode === "partial"
        ? await handleAction(
            () => window.barApi.pagarItens(comanda.id, itens, metodoPagamento, valor, pagoAgora),
            metodoPagamento === "FIADO" ? "Fiado registrado" : "Pagamento parcial registrado"
          )
        : await handleAction(
            () => window.barApi.fecharComanda(comanda.id, metodoPagamento, valor),
            "Comanda fechada"
          );

    closeModal();
    if (response?.troco) {
      showToast(`Troco: ${formatter.format(response.troco)}`);
    }
  });

  syncPagamentoPreview();
}

function openDivisaoModal() {
  const comanda = getSelectedComanda();
  if (!comanda) {
    showToast("Selecione uma comanda.");
    return;
  }

  openModal({
    eyebrow: "Dividir Conta",
    title: `Dividir ${comanda.nome}`,
    render: () => `
      <div class="modal-grid">
        <label>
          <span class="eyebrow">Dividir em</span>
          <input id="modalPessoas" type="number" min="1" step="1" value="2" />
        </label>
        <div class="modal-summary">
          <span>Total da comanda</span>
          <strong>${formatter.format(comanda.total)}</strong>
        </div>
      </div>
      <div class="modal-summary">
        <span>Cada pessoa paga</span>
        <strong class="split-result" id="resultadoDivisao">${formatter.format(comanda.total / 2)}</strong>
      </div>
      <div class="modal-actions">
        <button class="secondary" id="fecharDivisao">Fechar</button>
      </div>
    `
  });

  const pessoasInput = document.querySelector("#modalPessoas");
  const resultado = document.querySelector("#resultadoDivisao");
  const fechar = document.querySelector("#fecharDivisao");

  const recalc = async () => {
    const pessoas = Number(pessoasInput.value || 1);
    const divisao = await window.barApi.dividirComanda(comanda.id, pessoas);
    resultado.textContent = formatter.format(divisao.valorPorPessoa);
  };

  pessoasInput.addEventListener("input", recalc);
  fechar.addEventListener("click", closeModal);
}

function openDescontoComandaModal() {
  const comanda = getSelectedComanda();
  if (!comanda) {
    showToast("Selecione uma comanda.");
    return;
  }

  const subtotal = getSubtotalComanda(comanda);
  openModal({
    eyebrow: "Desconto",
    title: `Desconto de ${comanda.nome}`,
    render: () => `
      <div class="modal-summary">
        <span>Subtotal da comanda</span>
        <strong>${formatter.format(subtotal)}</strong>
        <span>Informe o desconto em valor fixo, nao em porcentagem.</span>
      </div>
      <label>
        <span class="eyebrow">Desconto em R$</span>
        <input id="modalDescontoComanda" type="number" min="0" max="${subtotal.toFixed(2)}" step="0.01" value="${(comanda.desconto ?? 0).toFixed(2)}" />
      </label>
      <div class="modal-summary">
        <span>Total com desconto</span>
        <strong id="totalComDescontoPreview">${formatter.format(comanda.total)}</strong>
      </div>
      <div class="modal-actions">
        <button class="secondary" id="cancelarDescontoComanda">Cancelar</button>
        <button id="confirmarDescontoComanda">Salvar desconto</button>
      </div>
    `
  });

  const descontoInput = document.querySelector("#modalDescontoComanda");
  const preview = document.querySelector("#totalComDescontoPreview");
  const cancelar = document.querySelector("#cancelarDescontoComanda");
  const confirmar = document.querySelector("#confirmarDescontoComanda");

  const syncPreview = () => {
    const desconto = Math.min(Math.max(Number(descontoInput.value || 0), 0), subtotal);
    preview.textContent = formatter.format(subtotal - desconto);
  };

  descontoInput.addEventListener("input", syncPreview);
  cancelar.addEventListener("click", closeModal);
  confirmar.addEventListener("click", async () => {
    const desconto = Number(descontoInput.value || 0);
    await handleAction(() => window.barApi.definirDescontoComanda(comanda.id, desconto), "Desconto atualizado");
    closeModal();
  });

  syncPreview();
}

function openQuitarFiadoModal(pagamento) {
  openModal({
    eyebrow: "Baixar Fiado",
    title: `Marcar ${pagamento.comandaNome} como pago`,
    render: () => `
      <div class="modal-summary">
        <span>Valor pendente</span>
        <strong>${formatter.format(pagamento.valor)}</strong>
        <span>Registrado em ${pagamento.data.replace("T", " ")}</span>
      </div>

      <div class="modal-grid">
        <label>
          <span class="eyebrow">Metodo</span>
          <select id="modalMetodoFiado">
            <option value="DINHEIRO">Dinheiro</option>
            <option value="CARTAO">Cartao</option>
            <option value="PIX">Pix</option>
          </select>
        </label>
        <label id="valorRecebidoFiadoWrap">
          <span class="eyebrow">Valor recebido</span>
          <input id="modalValorRecebidoFiado" type="number" min="${pagamento.valor.toFixed(2)}" step="0.01" value="${pagamento.valor.toFixed(2)}" />
        </label>
      </div>

      <div class="modal-summary">
        <span id="trocoFiadoPreview">Troco: ${formatter.format(0)}</span>
      </div>

      <div class="modal-actions">
        <button class="secondary" id="cancelarQuitarFiado">Voltar</button>
        <button id="confirmarQuitarFiado">Confirmar pagamento</button>
      </div>
    `
  });

  const metodo = document.querySelector("#modalMetodoFiado");
  const valorRecebido = document.querySelector("#modalValorRecebidoFiado");
  const valorWrap = document.querySelector("#valorRecebidoFiadoWrap");
  const trocoPreview = document.querySelector("#trocoFiadoPreview");
  const cancelar = document.querySelector("#cancelarQuitarFiado");
  const confirmar = document.querySelector("#confirmarQuitarFiado");

  const syncPreview = () => {
    const isDinheiro = metodo.value === "DINHEIRO";
    valorWrap.classList.toggle("hidden", !isDinheiro);
    const recebido = Number(valorRecebido.value || 0);
    const troco = isDinheiro ? Math.max(0, recebido - pagamento.valor) : 0;
    trocoPreview.textContent = `Troco: ${formatter.format(troco)}`;
  };

  metodo.addEventListener("change", syncPreview);
  valorRecebido.addEventListener("input", syncPreview);
  cancelar.addEventListener("click", closeModal);
  confirmar.addEventListener("click", async () => {
    const metodoPagamento = metodo.value;
    const valor = metodoPagamento === "DINHEIRO" ? Number(valorRecebido.value || 0) : undefined;
    const response = await handleAction(
      () => window.barApi.quitarFiado(pagamento.comandaId, pagamento.data, metodoPagamento, valor),
      "Fiado marcado como pago"
    );
    closeModal();
    if (response?.troco) showToast(`Troco: ${formatter.format(response.troco)}`);
  });

  syncPreview();
}

function openCancelarFiadoModal(pagamento) {
  openModal({
    eyebrow: "Cancelar Fiado",
    title: `Cancelar fiado de ${pagamento.comandaNome}`,
    render: () => `
      <div class="modal-summary">
        <span>Valor pendente</span>
        <strong>${formatter.format(pagamento.valor)}</strong>
        <span>Esse registro saira da lista de fiados e dos relatorios.</span>
      </div>
      <div class="modal-actions">
        <button class="secondary" id="voltarCancelarFiado">Voltar</button>
        <button class="danger" id="confirmarCancelarFiado">Cancelar fiado</button>
      </div>
    `
  });

  const voltar = document.querySelector("#voltarCancelarFiado");
  const confirmar = document.querySelector("#confirmarCancelarFiado");
  voltar.addEventListener("click", closeModal);
  confirmar.addEventListener("click", async () => {
    await handleAction(
      () => window.barApi.cancelarFiado(pagamento.comandaId, pagamento.data),
      "Fiado cancelado"
    );
    closeModal();
  });
}

function openNomeComandaModal(mode) {
  const comanda = mode === "edit" ? getSelectedComanda() : null;
  openModal({
    eyebrow: mode === "edit" ? "Editar Comanda" : "Nova Comanda",
    title: mode === "edit" ? `Editar nome de ${comanda.nome}` : "Abrir nova comanda",
    render: () => `
      <label>
        <span class="eyebrow">Nome da comanda</span>
        <input id="modalNomeComanda" value="${comanda?.nome ?? ""}" placeholder="Ex.: Mesa 4" />
      </label>
      <div class="modal-actions">
        <button class="secondary" id="cancelarNomeComanda">Cancelar</button>
        <button id="confirmarNomeComanda">${mode === "edit" ? "Salvar nome" : "Criar comanda"}</button>
      </div>
    `
  });

  const nomeInput = document.querySelector("#modalNomeComanda");
  const cancelar = document.querySelector("#cancelarNomeComanda");
  const confirmar = document.querySelector("#confirmarNomeComanda");
  cancelar.addEventListener("click", closeModal);
  confirmar.addEventListener("click", async () => {
    const nome = nomeInput.value.trim();
    const resposta =
      mode === "edit"
        ? await handleAction(() => window.barApi.renomearComanda(comanda.id, nome), "Nome da comanda atualizado")
        : await handleAction(() => window.barApi.criarComanda(nome), "Comanda criada");

    ui.selectedComandaId = resposta.id;
    closeModal();
    switchView("venda");
  });
}

elements.navButtons.forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.view));
});

elements.criarComanda.addEventListener("click", async () => {
  openNomeComandaModal("create");
});

elements.produtoForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    codigo: elements.codigo.value.trim(),
    nome: elements.nome.value.trim(),
    custo: Number(elements.custo.value),
    preco: Number(elements.preco.value),
    estoque: Number(elements.estoque.value)
  };

  if (ui.editingCodigo) {
    await handleAction(
      () =>
        window.barApi.editarProduto(ui.editingCodigo, {
          nome: payload.nome,
          custo: payload.custo,
          preco: payload.preco,
          estoque: payload.estoque
        }),
      "Produto atualizado"
    );
  } else {
    await handleAction(() => window.barApi.cadastrarProduto(payload), "Produto salvo");
  }

  resetProdutoForm();
});

elements.despesaForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    descricao: elements.despesaDescricao.value.trim(),
    categoria: elements.despesaCategoria.value.trim(),
    valor: Number(elements.despesaValor.value),
    metodoPagamento: elements.despesaMetodo.value,
    data: elements.despesaData.value,
    observacao: elements.despesaObservacao.value.trim() || undefined
  };

  if (ui.editingDespesaId) {
    await handleAction(() => window.barApi.editarDespesa(ui.editingDespesaId, payload), "Despesa atualizada");
  } else {
    await handleAction(() => window.barApi.cadastrarDespesa(payload), "Despesa salva");
  }

  resetDespesaForm();
});

elements.fecharModal.addEventListener("click", closeModal);
elements.modalOverlay.addEventListener("click", (event) => {
  if (event.target === elements.modalOverlay) closeModal();
});
elements.buscarRelatorio.addEventListener("click", async () => {
  const inicio = elements.reportInicio.value;
  const fim = elements.reportFim.value;
  if (!inicio || !fim) {
    showToast("Selecione o periodo inicial e final.");
    return;
  }

  try {
    state.relatorio = await window.barApi.relatorioPorPeriodo(inicio, fim);
    renderRelatorio();
    renderHome();
  } catch (error) {
    showToast(error?.message ?? "Nao foi possivel gerar o relatorio.");
  }
});
elements.exportarRelatorioPdf.addEventListener("click", async () => {
  const inicio = elements.reportInicio.value;
  const fim = elements.reportFim.value;
  if (!inicio || !fim) {
    showToast("Selecione o periodo inicial e final.");
    return;
  }

  try {
    const resposta = await window.barApi.exportarRelatorioPdf(inicio, fim);
    showToast(`PDF gerado em ${resposta.filePath}`);
  } catch (error) {
    showToast(error?.message ?? "Nao foi possivel gerar o PDF.");
  }
});

document.body.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const navTarget = target.closest("[data-nav]");
  const nav = navTarget instanceof HTMLElement ? navTarget.dataset.nav : undefined;
  if (nav) {
    switchView(nav);
    return;
  }

  const actionTarget = target.closest("[data-action]");
  if (!(actionTarget instanceof HTMLElement)) return;

  const action = actionTarget.dataset.action;
  if (action === "selecionar-comanda") {
    ui.selectedComandaId = Number(actionTarget.dataset.id);
    ui.selectedItens.clear();
    closeAutocomplete();
    renderVenda();
    syncScannerFocus();
    return;
  }

  if (action === "remover") {
    await handleAction(
      () => window.barApi.removerItem(Number(actionTarget.dataset.id), String(actionTarget.dataset.codigo), 1),
      "Item removido"
    );
    return;
  }

  if (action === "adicionar-mais") {
    await handleAction(
      () => window.barApi.adicionarMaisItem(Number(actionTarget.dataset.id), String(actionTarget.dataset.codigo), 1),
      "Item adicionado"
    );
    return;
  }

  if (action === "editar-preco-item") {
    openEditarPrecoItemModal(Number(actionTarget.dataset.id), String(actionTarget.dataset.codigo));
    return;
  }

  if (action === "abrir-pagamento-parcial") {
    openPagamentoModal("partial");
    return;
  }

  if (action === "editar-nome-comanda") {
    openNomeComandaModal("edit");
    return;
  }

  if (action === "editar-desconto-comanda") {
    openDescontoComandaModal();
    return;
  }

  if (action === "abrir-fechamento-total") {
    openPagamentoModal("full");
    return;
  }

  if (action === "abrir-fiado") {
    openPagamentoModal("full", "FIADO");
    return;
  }

  if (action === "cancelar-comanda") {
    const comanda = getSelectedComanda();
    if (!comanda) return;
    await handleAction(() => window.barApi.cancelarComanda(comanda.id), "Comanda cancelada");
    closeAutocomplete();
    return;
  }

  if (action === "abrir-divisao") {
    openDivisaoModal();
    return;
  }

  if (action === "quitar-fiado") {
    const pagamento = getFiadoByKey(Number(actionTarget.dataset.id), decodeURIComponent(String(actionTarget.dataset.data)));
    if (pagamento) openQuitarFiadoModal(pagamento);
    return;
  }

  if (action === "cancelar-fiado") {
    const pagamento = getFiadoByKey(Number(actionTarget.dataset.id), decodeURIComponent(String(actionTarget.dataset.data)));
    if (pagamento) openCancelarFiadoModal(pagamento);
    return;
  }

  if (action === "editar-produto") {
    const produto = produtoPorCodigo(String(actionTarget.dataset.codigo));
    if (!produto) return;
    ui.editingCodigo = produto.codigo;
    elements.codigo.value = produto.codigo;
    elements.nome.value = produto.nome;
    elements.custo.value = String(produto.custo);
    elements.preco.value = String(produto.preco);
    elements.estoque.value = String(produto.estoque);
    switchView("cadastro");
    return;
  }

  if (action === "excluir-produto") {
    await handleAction(() => window.barApi.excluirProduto(String(actionTarget.dataset.codigo)), "Produto excluido");
    return;
  }

  if (action === "editar-despesa") {
    const despesa = state.despesas.find((entry) => entry.id === Number(actionTarget.dataset.id));
    if (!despesa) return;
    ui.editingDespesaId = despesa.id;
    elements.despesaDescricao.value = despesa.descricao;
    elements.despesaCategoria.value = despesa.categoria;
    elements.despesaValor.value = String(despesa.valor);
    elements.despesaMetodo.value = despesa.metodoPagamento;
    elements.despesaData.value = despesa.data;
    elements.despesaObservacao.value = despesa.observacao ?? "";
    switchView("despesas");
    return;
  }

  if (action === "excluir-despesa") {
    await handleAction(() => window.barApi.excluirDespesa(Number(actionTarget.dataset.id)), "Despesa excluida");
    return;
  }

  if (action === "selecionar-sugestao") {
    const produto = state.produtos.find((entry) => entry.codigo === String(actionTarget.dataset.codigo));
    if (produto) applyAutocompleteSelection(produto);
  }
});

document.body.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  if (target.dataset.action === "toggle-item" && target instanceof HTMLInputElement) {
    if (target.checked) ui.selectedItens.add(String(target.dataset.codigo));
    else ui.selectedItens.delete(String(target.dataset.codigo));
    renderVenda();
  }
});

document.body.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.id === "produtoSearch" && target instanceof HTMLInputElement) {
    ui.produtoSearch = target.value;
    renderCadastro();
    return;
  }
  if (target.id === "fiadoSearch" && target instanceof HTMLInputElement) {
    ui.fiadoSearch = target.value;
    renderFiados();
    return;
  }
  if (target.id !== "scannerInput" || !(target instanceof HTMLInputElement)) return;
  ui.autocomplete.focused = true;
  ui.autocomplete.highlightedIndex = 0;
  renderAutocomplete(target.value);
});

document.body.addEventListener("focusin", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.id !== "scannerInput") return;
  ui.autocomplete.focused = true;
  if (target instanceof HTMLInputElement) {
    renderAutocomplete(target.value);
  }
});

document.body.addEventListener("focusout", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.id !== "scannerInput") return;
  window.setTimeout(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest(".autocomplete")) return;
    closeAutocomplete();
  }, 120);
});

document.body.addEventListener("keydown", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.id !== "scannerInput") return;

  if (event.key === "ArrowDown" && ui.autocomplete.items.length) {
    event.preventDefault();
    ui.autocomplete.highlightedIndex = (ui.autocomplete.highlightedIndex + 1) % ui.autocomplete.items.length;
    renderAutocomplete(target.value);
    return;
  }

  if (event.key === "ArrowUp" && ui.autocomplete.items.length) {
    event.preventDefault();
    ui.autocomplete.highlightedIndex =
      (ui.autocomplete.highlightedIndex - 1 + ui.autocomplete.items.length) % ui.autocomplete.items.length;
    renderAutocomplete(target.value);
    return;
  }

  if (event.key === "Escape") {
    closeAutocomplete();
    return;
  }

  if (event.key !== "Enter") return;
  event.preventDefault();

  if (ui.autocomplete.open && ui.autocomplete.items[ui.autocomplete.highlightedIndex]) {
    applyAutocompleteSelection(ui.autocomplete.items[ui.autocomplete.highlightedIndex]);
    return;
  }

  await submitScannerInput();
});

document.body.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.id !== "adicionarItem") return;

  await submitScannerInput();
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.closest(".autocomplete")) return;
  const list = document.querySelector("#autocompleteList");
  if (!(list instanceof HTMLElement) || list.classList.contains("hidden")) return;
  closeAutocomplete();
});

void refresh();
