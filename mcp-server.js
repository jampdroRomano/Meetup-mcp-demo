import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fetch from "node-fetch";
import { parse } from "csv-parse/sync";
import { z } from "zod";

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

const transport = new StdioServerTransport();
await server.connect(transport);
