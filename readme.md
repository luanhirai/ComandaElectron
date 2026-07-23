# 🧾 Sistema Desktop de Caixa para Bar

## 📌 Objetivo
* TUDO DEVE SER UI/UX* TUDO DEVE SER UI/UX* TUDO DEVE SER UI/UX* TUDO DEVE SER UI/UX* TUDO DEVE SER UI/UX* TUDO DEVE SER UI/UX* TUDO DEVE SER UI/UX
Sistema desktop offline para gerenciamento de caixa de bar, permitindo:

* Controle de comandas
* Venda por leitura de código de barras (scanner)
* Cadastro e gestão de produtos
* Persistência leve em arquivos `.txt`

---

## 🏗️ Arquitetura

* **Frontend (Desktop UI):** Electron
* **Backend:** Node.js + TypeScript
* **Banco de dados:** Arquivos `.txt` (persistência simples)
* **Execução:** 100% offline

📁 Estrutura sugerida:

```
/app
 ├── main (Electron)
 ├── renderer (UI)
 ├── backend
 │    ├── services
 │    ├── models
 │    ├── controllers
 │    └── utils (manipulação de arquivos)
 └── database
      ├── produtos.txt
      ├── comandas.txt
      └── vendas/
```

---

## 🧩 Funcionalidades

### 1. 🛒 Gestão de Produtos

* Cadastrar produto:

  * Código de barras
  * Nome
  * Preço
  * Estoque
* Editar produto
* Excluir produto
* Listar produtos

📄 Exemplo `produtos.txt`:

```
COD|NOME|PRECO|ESTOQUE
123456|Cerveja|10.00|50
789101|Refrigerante|5.00|30
```

---

### 2. 🍺 Sistema de Comandas

#### Funcionalidades:

* Criar comanda
* Adicionar produto via:

  * Scanner (código de barras)
  * Seleção manual
* Remover produto
* Listar itens da comanda
* Fechar comanda

📄 Exemplo `comandas.txt`:

```
ID|STATUS|ITENS|TOTAL
1|ABERTA|123456,2;789101,1|25.00
```

📌 Estrutura dos itens:

```
CODIGO,QUANTIDADE;
```

---

### 3. 🔫 Leitura via Scanner

* Scanner funciona como teclado (input)
* Campo focado para leitura automática
* Ao bipar:

  * Buscar produto pelo código
  * Adicionar na comanda aberta

---

### 4. 💰 Fechamento de Comanda

* Calcular total automaticamente
* Gerar registro de venda

📁 Pasta `/vendas`:

```
venda_2026-05-03_001.txt
```

Conteúdo:

```
COMANDA: 1
DATA: 03/05/2026
ITENS:
Cerveja x2 = 20.00
Refrigerante x1 = 5.00
TOTAL: 25.00
```

* Atualizar estoque automaticamente

---

### 5. 📊 Caixa

* Total vendido no dia
* Listagem de vendas
* (Opcional) relatório simples

---

## ⚙️ Regras de Negócio

* Não permitir:

  * Produto sem estoque
* Comanda:

  * Só pode adicionar itens se estiver ABERTA
* Fechamento:

  * Atualiza estoque
  * Move para histórico (vendas)
* Código de barras deve ser único

---

## 🧠 Modelos (TypeScript)

### Produto

```ts
type Produto = {
  codigo: string;
  nome: string;
  preco: number;
  estoque: number;
};
```

### ItemComanda

```ts
type Item = {
  codigo: string;
  quantidade: number;
};
```

### Comanda

```ts
type Comanda = {
  id: number;
  status: "ABERTA" | "FECHADA";
  itens: Item[];
  total: number;
};
```

---

## 🔄 Fluxo principal

1. Abrir sistema
2. Criar comanda
3. Bipar produtos
4. Itens são adicionados automaticamente
5. Cliente finaliza consumo
6. Fechar comanda
7. Sistema:

   * Calcula total
   * Salva venda
   * Atualiza estoque

---

## 🧰 Serviços (Backend)

* `ProdutoService`

  * CRUD
  * Buscar por código

* `ComandaService`

  * Criar
  * Adicionar item
  * Remover item
  * Fechar comanda

* `VendaService`

  * Gerar arquivo de venda

* `FileService`

  * Ler/escrever `.txt`

---

## 🖥️ Telas (Electron)

### 1. Tela Inicial

* Abrir comanda
* Listar comandas abertas

### 2. Tela de Comanda

* Campo de scanner
* Lista de itens
* Total
* Botão fechar comanda

### 3. Tela de Produtos

* Cadastro
* Edição
* Listagem

### 4. Tela de Caixa

* Total do dia
* Histórico

---

## 🚀 Extras (se quiser evoluir depois)

* Atalhos de teclado (F1 abrir comanda)
* Impressão de comanda
* Backup automático dos `.txt`
* Interface mais moderna (Tailwind no Electron)

---

## 💡 Observações importantes

* Use **append em arquivos** para performance
* Sempre carregar dados em memória ao iniciar
* Criar camada de parsing (txt → objeto)
* Evitar concorrência (um usuário por máquina)
* TUDO DEVE SER UI/UX
