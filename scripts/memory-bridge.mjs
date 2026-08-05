#!/usr/bin/env node

import { createServer } from "node:http";
import { existsSync, readFileSync, statSync, watchFile } from "node:fs";
import { createInterface } from "node:readline";
import { createReadStream } from "node:fs";
import { join, resolve } from "node:path";

const DATA_DIR = resolve(process.env.JARVIS_MEMORY_DIR || String.raw`C:\Users\paddo\Documents\JARVIS\data\processed`);
const PORT = Number(process.env.JARVIS_MEMORY_PORT || 4317);
const HOST = "127.0.0.1";
const MESSAGE_FILE = join(DATA_DIR, "messages.jsonl");
const MANIFEST_FILE = join(DATA_DIR, "manifest.json");

let records = [];
let loadedAt = null;
let loading = false;

function tokenize(value) {
  return String(value || "").toLocaleLowerCase("de-DE").match(/[\p{L}\p{N}]{2,}/gu) || [];
}

function scoreRecord(record, terms) {
  const title = String(record.conversationTitle || "").toLocaleLowerCase("de-DE");
  const text = String(record.text || "").toLocaleLowerCase("de-DE");
  let score = 0;
  for (const term of terms) {
    if (title.includes(term)) score += 8;
    const hits = text.split(term).length - 1;
    score += Math.min(hits, 6) * 2;
  }
  if (record.role === "user") score += 0.25;
  return score;
}

async function loadIndex() {
  if (loading) return;
  loading = true;
  try {
    if (!existsSync(MESSAGE_FILE)) throw new Error(`Nicht gefunden: ${MESSAGE_FILE}`);
    const next = [];
    const rl = createInterface({ input: createReadStream(MESSAGE_FILE, { encoding: "utf8" }), crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const item = JSON.parse(line);
        if (item.text) next.push(item);
      } catch { /* einzelne beschädigte Zeile überspringen */ }
    }
    records = next;
    loadedAt = new Date().toISOString();
    console.log(`[J.A.R.V.I.S.] Memory Index geladen: ${records.length} Nachrichten`);
  } finally {
    loading = false;
  }
}

function search(query, limit = 8) {
  const terms = [...new Set(tokenize(query))].filter(term => term.length > 2).slice(0, 16);
  if (!terms.length) return [];
  return records
    .map(record => ({ record, score: scoreRecord(record, terms) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || (b.record.createTime || 0) - (a.record.createTime || 0))
    .slice(0, Math.max(1, Math.min(limit, 12)))
    .map(({ record, score }) => ({
      conversationId: record.conversationId,
      conversationTitle: record.conversationTitle,
      role: record.role,
      createTime: record.createTime,
      text: String(record.text).slice(0, 1800),
      score,
    }));
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  };
}

function json(response, status, payload) {
  response.writeHead(status, corsHeaders());
  response.end(JSON.stringify(payload));
}

await loadIndex();
if (existsSync(MESSAGE_FILE)) watchFile(MESSAGE_FILE, { interval: 5000 }, () => loadIndex().catch(console.error));

createServer(async (request, response) => {
  if (request.method === "OPTIONS") return json(response, 204, {});
  const url = new URL(request.url || "/", `http://${HOST}:${PORT}`);
  if (request.method === "GET" && url.pathname === "/health") {
    let manifest = null;
    try { if (existsSync(MANIFEST_FILE)) manifest = JSON.parse(readFileSync(MANIFEST_FILE, "utf8")); } catch { /* optional */ }
    return json(response, 200, { ok: true, records: records.length, loadedAt, dataDir: DATA_DIR, manifest });
  }
  if (request.method === "POST" && url.pathname === "/search") {
    let body = "";
    for await (const chunk of request) body += chunk;
    try {
      const parsed = JSON.parse(body || "{}");
      return json(response, 200, { results: search(parsed.query, parsed.limit) });
    } catch (error) {
      return json(response, 400, { error: error instanceof Error ? error.message : "Ungültige Anfrage" });
    }
  }
  return json(response, 404, { error: "Nicht gefunden" });
}).listen(PORT, HOST, () => {
  console.log(`[J.A.R.V.I.S.] Memory Bridge aktiv: http://${HOST}:${PORT}`);
  console.log(`[J.A.R.V.I.S.] Daten: ${DATA_DIR}`);
});
