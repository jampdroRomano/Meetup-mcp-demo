# Meetup MCP Demo

Servidor MCP (Model Context Protocol) que conecta ao Cursor (ou outro cliente MCP) e permite buscar as respostas de um formulário do meetup a partir de uma **planilha pública do Google Sheets** vinculada ao Google Forms.

## O que este projeto faz

- Expõe a ferramenta **`get_meetup_responses`** para o assistente do Cursor.
- Ao ser chamada, o servidor lê a planilha do Google Sheets em modo público (export CSV) e devolve as respostas em JSON.
- Não é necessário autenticação: a planilha precisa apenas estar com **“Qualquer pessoa com o link pode ver”**.

## Requisitos

- **Node.js** 18 ou superior ([nodejs.org](https://nodejs.org))
- **Cursor** (ou outro cliente que suporte MCP)

## Instalação

O repositório **não inclui** a pasta `node_modules` (está no `.gitignore`). É preciso instalar as dependências depois de clonar:

```bash
# Entrar na pasta do projeto
cd Meetup-mcp-demo

# Instalar dependências
npm install
```

Isso instala:

- `@modelcontextprotocol/sdk` – servidor MCP
- `node-fetch` – requisições HTTP para o Google Sheets
- `csv-parse` – leitura do CSV exportado pela planilha

## Configurar o servidor MCP no Cursor

1. Abra **Cursor Settings** → **MCP** (ou o arquivo de configuração dos servidores MCP).
2. Inclua o servidor **meetup-forms** na configuração. Exemplo de `mcp.json`:

```json
{
  "mcpServers": {
    "meetup-forms": {
      "command": "node",
      "args": ["C:\\Users\\User\\Desktop\\Geral\\GITHUB\\Meetup-mcp-demo\\mcp-server.js"]
    }
  }
}
```

**Importante:** use o **caminho completo** até o `mcp-server.js` no seu PC (no Windows, use `\\` nas barras). Ajuste conforme o local em que você clonou o projeto.

3. Salve e deixe o servidor **ativado** (toggle verde em “Installed MCP Servers”).

O Cursor vai iniciar o processo `node mcp-server.js` quando precisar da ferramenta; você **não** precisa rodar o servidor manualmente no terminal para uso normal.

## Planilha do Google Sheets

- A planilha usada por padrão está definida no código (constante `SPREADSHEET_ID` em `mcp-server.js`).
- Ela precisa estar com compartilhamento **“Qualquer pessoa com o link pode ver”** (ou “Publicado na Web”, dependendo do caso), senão a exportação em CSV falha.
- Para usar **outra planilha** sem alterar o código, a ferramenta aceita o parâmetro opcional `spreadsheet_id` na chamada.

## Como usar

1. Com o MCP configurado e o servidor **meetup-forms** ligado no Cursor.
2. No chat do Cursor, peça algo como:
   - *“Busque as respostas do meetup”*
   - *“Chama a ferramenta get_meetup_responses”*
3. O assistente usará a ferramenta **get_meetup_responses** e mostrará o resumo e os dados (JSON) das respostas da planilha.

### Parâmetros opcionais da ferramenta

- **`spreadsheet_id`** (string): ID de outra planilha. Se não for passado, usa o ID configurado no servidor.
- **`gid`** (número): ID da aba (gid). Use `0` para a primeira aba. Opcional.

## Rodar o servidor manualmente (opcional)

Só para testar se o processo sobe sem erro:

```bash
npm start
```

ou:

```bash
node mcp-server.js
```

O processo fica “parado” esperando mensagens na entrada padrão — isso é o esperado. Para encerrar: **Ctrl+C**. No uso com o Cursor, o Cursor é quem inicia e encerra o servidor.

## Estrutura do projeto

```
Meetup-mcp-demo/
├── mcp-server.js    # Servidor MCP e ferramenta get_meetup_responses
├── package.json     # Dependências e script "start"
├── .gitignore       # node_modules e .env ignorados
└── README.md        # Este arquivo
```

## Licença

ISC
