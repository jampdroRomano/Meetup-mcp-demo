# 📋 Meetup MCP Demo

![Status](https://img.shields.io/badge/status-Concluído-green)
![Runtime](https://img.shields.io/badge/runtime-Node.js_18+-green)
![Protocol](https://img.shields.io/badge/protocol-MCP_(Model_Context_Protocol)-blue)
![Integração](https://img.shields.io/badge/integração-Google_Sheets_/_Forms-yellow)

---

## 📖 Descrição do Projeto

**Meetup MCP Demo** é um servidor **MCP (Model Context Protocol)** que se conecta ao Cursor (ou outro cliente MCP) e permite buscar as respostas de um formulário de meetup a partir de uma **planilha pública do Google Sheets** vinculada ao Google Forms. O servidor expõe duas ferramentas: `get_meetup_responses` (lê a planilha via CSV e retorna os dados em JSON) e `send_meetup_email` (envia um e-mail com a mensagem informada para todos os endereços de e-mail encontrados na planilha). A leitura da planilha não exige autenticação; o envio de e-mails usa SMTP configurado via `.env`.

---

## 🗂 Estrutura do Repositório

```text
Meetup-mcp-demo/
│
├── mcp-server.js       # Servidor MCP (get_meetup_responses, send_meetup_email)
├── email.js            # Envio de e-mail via SMTP (nodemailer)
├── .env.example        # Exemplo de variáveis para .env (copiar para .env)
├── package.json        # Dependências e script "start"
├── package-lock.json   # Lock das dependências
├── .gitignore          # node_modules e .env ignorados
└── README.md           # Este arquivo
```

| ID     | Funcionalidade              | Descrição                                                                 |
|--------|-----------------------------|----------------------------------------------------------------------------|
| RF01   | Ferramenta MCP              | Expõe `get_meetup_responses` para o assistente do Cursor usar no chat.    |
| RF02   | Leitura da planilha         | Busca dados da planilha do Google Sheets via URL de exportação CSV.        |
| RF03   | Sem autenticação            | Funciona com planilhas públicas ("Qualquer pessoa com o link pode ver").  |
| RF04   | Parâmetros opcionais        | Permite informar `spreadsheet_id` e `gid` para outra planilha/aba.         |
| RF05   | Envio de e-mail             | `send_meetup_email`: envia o texto (campo `message`) para todos os e-mails da planilha; requer `.env` com SMTP. |

---

## 🛠 Tecnologias Utilizadas

- **Runtime:** Node.js 18+
- **Protocolo:** Model Context Protocol (SDK `@modelcontextprotocol/sdk`)
- **HTTP:** node-fetch
- **CSV:** csv-parse (leitura do export do Google Sheets)
- **E-mail:** nodemailer (SMTP)
- **Ambiente:** dotenv (variáveis EMAIL_USER, EMAIL_PASS, SMTP_*)
- **Validação:** Zod (schemas da ferramenta)
- **Cliente:** Cursor (ou outro cliente MCP)

---

## ⚙️ Configuração do servidor MCP no Cursor

O servidor é iniciado pelo Cursor via configuração MCP. Adicione o bloco abaixo no arquivo de configuração dos servidores MCP (ex.: **Cursor Settings → MCP** ou `~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "meetup-forms": {
      "command": "node",
      "args": ["C:\\caminho\\completo\\ate\\Meetup-mcp-demo\\mcp-server.js"]
    }
  }
}
```

> **Importante:** Use o **caminho completo** até o `mcp-server.js` no seu computador. No Windows, use `\\` nas barras. Ajuste conforme o local em que você clonou o projeto.
>
> O Cursor inicia e encerra o processo automaticamente; não é necessário rodar `node mcp-server.js` manualmente no terminal para uso normal.

---

## 📧 Configuração de e-mail (send_meetup_email)

Para usar a ferramenta **send_meetup_email**, configure as variáveis de ambiente:

1. Copie o arquivo `.env.example` para `.env` na raiz do projeto.
2. Preencha no `.env`:
   - **EMAIL_USER:** endereço de e-mail que envia (ex.: seu_email@gmail.com)
   - **EMAIL_PASS:** senha ou, no Gmail com 2FA, use uma **Senha de app** (Google Account)
   - **SMTP_HOST**, **SMTP_PORT**, **SMTP_SECURE:** opcionais (padrão: Gmail, 587, false)

A planilha deve ter uma coluna de e-mail (ex.: **"Endereço de e-mail"**). Os endereços são lidos dessa coluna, validados e enviados em massa (sem duplicatas).

> **Segurança:** O arquivo `.env` está no `.gitignore` e não deve ser commitado. Nunca exponha credenciais no repositório.

---

## ⚠️ Pré-requisitos

- **Node.js** 18 ou superior ([nodejs.org](https://nodejs.org))
- **Cursor** (ou outro cliente que suporte MCP)
- Planilha do Google Sheets vinculada ao Forms com compartilhamento **"Qualquer pessoa com o link pode ver"** (ou publicada na web)

---

## 🚀 Instalação de Dependências

O repositório **não inclui** a pasta `node_modules` (está no `.gitignore`). Na raiz do projeto, execute:

```bash
npm install
```

Isso instala: `@modelcontextprotocol/sdk`, `node-fetch`, `csv-parse`, `zod`, `nodemailer` e `dotenv`.

---

## 💻 Como Rodar o Projeto

### Uso no Cursor (recomendado)

1. Configure o servidor MCP no Cursor (veja a seção **Configuração do servidor MCP** acima).
2. Ative o servidor **meetup-forms** (toggle verde em "Installed MCP Servers").
3. No chat, peça por exemplo:
   - *"Busque as respostas do meetup"* ou *"Use a ferramenta get_meetup_responses"*
   - *"Envie um e-mail para todos os inscritos do meetup com a mensagem: [texto]"* ou *"Use send_meetup_email com a mensagem: [texto]"*

O assistente chamará a ferramenta e exibirá o resumo (dados em JSON para `get_meetup_responses`; quantidade de e-mails enviados/falhas para `send_meetup_email`). Para enviar e-mails, o `.env` deve estar configurado (veja a seção **Configuração de e-mail**).

### Parâmetros opcionais da ferramenta

| Parâmetro         | Tipo   | Descrição                                                                 |
|-------------------|--------|----------------------------------------------------------------------------|
| `spreadsheet_id`  | string | ID de outra planilha. Se omitido, usa a planilha configurada no servidor. |
| `gid`             | number | ID da aba da planilha. Padrão: aba "Respostas ao formulário 1".            |

### Rodar o servidor manualmente (opcional)

Para apenas testar se o processo inicia sem erros:

```bash
npm start
```

ou:

```bash
node mcp-server.js
```

O processo ficará aguardando mensagens na entrada padrão (comportamento esperado). Para encerrar: **Ctrl+C**.

**Dica:** Após alterar o código do `mcp-server.js`, reinicie o servidor MCP no Cursor (desligue e ligue o toggle do meetup-forms) para carregar as mudanças.

---

## 📄 Planilha do Google Sheets

- A planilha e a aba padrão estão definidas no código (`SPREADSHEET_ID` e `DEFAULT_SHEET_GID` em `mcp-server.js`).
- A planilha precisa estar compartilhada como **"Qualquer pessoa com o link pode ver"** para a exportação CSV funcionar.
- Para usar outra planilha sem alterar o código, passe o parâmetro `spreadsheet_id` (e, se necessário, `gid`) na chamada da ferramenta.

---

## Licença

ISC
