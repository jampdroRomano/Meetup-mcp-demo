import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fetch from "node-fetch";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import express from "express";
import { sendEmail } from "./email.js";

// Arquivo para persistir cliques (mesmo processo do terminal e processo MCP do Cursor veem os mesmos dados)
// Usar cwd para o arquivo ficar na pasta de onde o servidor foi iniciado
const CLICKS_FILE = path.resolve(process.cwd(), "clicks.json");

async function readClicksFromFile() {
  try {
    const data = await fs.readFile(CLICKS_FILE, "utf-8");
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    if (e?.code !== "ENOENT") console.error("[clicks] Erro ao ler arquivo:", e?.message || e);
    return [];
  }
}

async function appendClickToFile(click) {
  const list = await readClicksFromFile();
  list.push(click);
  await fs.writeFile(CLICKS_FILE, JSON.stringify(list, null, 2), "utf-8");
}

// Estado em memória (usado pelas rotas HTTP; get_clicks lê do arquivo para ver cliques de qualquer processo)
const clicks = [];

// Servidor HTTP para rastrear cliques (link no email → GET /click/:user)
const TRACK_PORT = Number(process.env.TRACK_PORT) || 3000;
const app = express();
app.use(express.json());

// Rota raiz: link simples no email (só o domínio ngrok) também registra clique
app.get("/", async (req, res) => {
  const user = "visitante";
  const click = { user, time: new Date().toISOString() };
  clicks.push(click);
  try {
    await appendClickToFile(click);
    console.log(`${user} clicou no link! (salvo em ${CLICKS_FILE})`);
  } catch (err) {
    console.error("[clicks] Erro ao salvar clique:", err?.message || err);
  }
  res.send("Obrigado por clicar!");
});

app.get("/click/:user", async (req, res) => {
  const user = decodeURIComponent(req.params.user || "");
  const click = { user, time: new Date().toISOString() };
  clicks.push(click);
  try {
    await appendClickToFile(click);
    console.log(`${user} clicou no link! (salvo em ${CLICKS_FILE})`);
  } catch (err) {
    console.error("[clicks] Erro ao salvar clique:", err?.message || err);
  }
  res.send("Obrigado por clicar!");
});

app.get("/clicks", async (req, res) => {
  const list = await readClicksFromFile();
  res.json(list);
});

app.listen(TRACK_PORT, () => {
  console.log(`Servidor HTTP (rastreio de cliques): http://localhost:${TRACK_PORT}`);
});

// ID da planilha de respostas do Google Sheets (vinculada ao Forms do Meetup)
// URL: https://docs.google.com/spreadsheets/d/1P3LoDlfpV4G4SCzNAaTjMMn82pXwFz9zY7dQCgi6-eo/edit
const SPREADSHEET_ID = "1P3LoDlfpV4G4SCzNAaTjMMn82pXwFz9zY7dQCgi6-eo";
// gid da aba "Respostas ao formulário 1" (obtido da URL da planilha)
const DEFAULT_SHEET_GID = 1051106952;

function getSheetExportUrl(spreadsheetId, gid = 0) {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
}

async function fetchSheetAsCsv(spreadsheetId, gid = 0) {
  const id = (spreadsheetId || "").trim();
  if (!id) {
    throw new Error("ID da planilha não informado.");
  }
  const url = getSheetExportUrl(id, gid);
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Meetup-MCP-Demo/1.0)" },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(
      `Falha ao buscar planilha (${res.status}): ${res.statusText}. Verifique se a planilha está "Qualquer pessoa com o link pode ver".`
    );
  }
  const text = await res.text();
  // Google às vezes devolve HTML (página de login) em vez de CSV quando a planilha não é pública
  const trimmed = text.trim();
  if (trimmed.startsWith("<!") || trimmed.startsWith("<html") || trimmed.toLowerCase().includes("<!doctype")) {
    throw new Error(
      "A planilha não está acessível como CSV (resposta em HTML). Confira se está compartilhada como \"Qualquer pessoa com o link pode ver\"."
    );
  }
  return text;
}

function parseCsvToRows(csvText) {
  if (!csvText || typeof csvText !== "string") {
    return [];
  }
  const rows = parse(csvText, {
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
    bom: true,
    cast: false,
  });
  return Array.isArray(rows) ? rows : [];
}

const EMAIL_HEADER_REGEX = /e-mail|email|endereço de e-mail/i;
const BASIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function getEmailsFromSheet() {
  const csvText = await fetchSheetAsCsv(SPREADSHEET_ID, DEFAULT_SHEET_GID);
  const rows = parseCsvToRows(csvText);
  if (rows.length < 2) return [];

  const [rawHeaders, ...dataRows] = rows;
  const headers = (rawHeaders || []).map((h, i) =>
    h != null && String(h).trim() !== "" ? String(h).trim() : `Coluna_${i + 1}`
  );
  const emailColIndex = headers.findIndex((h) => EMAIL_HEADER_REGEX.test(String(h).trim().toLowerCase()));
  if (emailColIndex === -1) return [];

  const emails = new Set();
  for (const row of dataRows) {
    if (!Array.isArray(row)) continue;
    const value = row[emailColIndex] != null ? String(row[emailColIndex]).trim() : "";
    if (value && BASIC_EMAIL_REGEX.test(value)) emails.add(value);
  }
  return [...emails];
}

const server = new McpServer({
  name: "meetup-forms",
  version: "1.0.0",
});

server.registerTool(
  "get_meetup_responses",
  {
    description:
      "Busca respostas do formulário do meetup a partir da planilha pública do Google Sheets vinculada ao Forms.",
    inputSchema: {
      gid: z.number().optional().describe("ID da aba (gid) da planilha. Use 0 para a primeira aba."),
      spreadsheet_id: z.string().optional().describe("ID da planilha. Se não informado, usa a planilha configurada no servidor."),
    },
  },
  async (args) => {
    const spreadsheetId = args?.spreadsheet_id || SPREADSHEET_ID;
    const gid = args?.gid ?? DEFAULT_SHEET_GID;

    try {
      const csvText = await fetchSheetAsCsv(spreadsheetId, gid);
      const rows = parseCsvToRows(csvText);

      if (rows.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "Planilha vazia ou sem dados.",
            },
          ],
        };
      }

      const [rawHeaders, ...dataRows] = rows;
      const headers = (rawHeaders || []).map((h, i) => (h != null && String(h).trim() !== "" ? String(h).trim() : `Coluna_${i + 1}`));
      const responses = dataRows
        .filter((row) => Array.isArray(row) && row.some((cell) => cell != null && String(cell).trim() !== ""))
        .map((row) => {
          const obj = {};
          headers.forEach((h, i) => {
            obj[h] = row[i] != null ? String(row[i]).trim() : "";
          });
          return obj;
        });

      const summary = `Total de respostas: ${responses.length}\nCabeçalhos: ${headers.join(", ")}`;
      if (responses.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "Nenhuma resposta encontrada na planilha (apenas cabeçalhos ou linhas vazias).\n" + summary,
            },
          ],
        };
      }
      const body = JSON.stringify(responses, null, 2);

      return {
        content: [
          {
            type: "text",
            text: `${summary}\n\n--- Dados (JSON) ---\n${body}`,
          },
        ],
      };
    } catch (err) {
      const message =
        (err && err.message) ||
        String(err) ||
        "Erro desconhecido ao acessar a planilha. Confira se o link está público (Qualquer pessoa com o link pode ver).";
      return {
        content: [
          {
            type: "text",
            text: `Erro: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "send_meetup_email",
  {
    description:
      "Envia um e-mail com a mensagem informada para todos os endereços de e-mail encontrados na planilha de respostas do meetup. Requer .env configurado (EMAIL_USER, EMAIL_PASS).",
    inputSchema: {
      message: z.string().describe("Texto do e-mail a ser enviado a todos os inscritos da planilha."),
    },
  },
  async (args) => {
    const message = args?.message ?? "";
    if (!message.trim()) {
      return {
        content: [{ type: "text", text: "O campo message não pode estar vazio." }],
        isError: true,
      };
    }

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return {
        content: [
          {
            type: "text",
            text:
              "Configure o .env: copie .env.example para .env e preencha EMAIL_USER e EMAIL_PASS (e opcionalmente SMTP_HOST, SMTP_PORT).",
          },
        ],
        isError: true,
      };
    }

    try {
      const emails = await getEmailsFromSheet();
      if (emails.length === 0) {
        return {
          content: [
            {
              type: "text",
              text:
                "Nenhum e-mail encontrado na planilha. Verifique se existe uma coluna de e-mail (ex.: \"Endereço de e-mail\").",
            },
          ],
        };
      }

      const sent = [];
      const failed = [];
      for (const email of emails) {
        try {
          await sendEmail(email, message);
          sent.push(email);
        } catch (err) {
          failed.push({ email, error: (err && err.message) || String(err) });
        }
      }

      let text = `E-mails enviados: ${sent.length}. Falhas: ${failed.length}.`;
      if (failed.length > 0) {
        text += ` Endereços que falharam: ${failed.map((f) => f.email).join(", ")}.`;
      }
      return { content: [{ type: "text", text }] };
    } catch (err) {
      const msg = (err && err.message) || String(err);
      return {
        content: [{ type: "text", text: `Erro ao enviar e-mails: ${msg}` }],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "get_clicks",
  {
    description:
      "Retorna todos os cliques que chegaram pelo link do email (rastreamento). Use após colocar o link do ngrok no email para saber quantas pessoas acessaram.",
    inputSchema: {},
  },
  async () => {
    const clicksList = await readClicksFromFile();
    const total = clicksList.length;
    let text = `Total de cliques: ${total}`;
    if (clicksList.length > 0) {
      text += "\n\n";
      text += clicksList
        .map((c, i) => `${i + 1}. ${c.user} - ${c.time}`)
        .join("\n");
    }
    return {
      content: [{ type: "text", text }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
