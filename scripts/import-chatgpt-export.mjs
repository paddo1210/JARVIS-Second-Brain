#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const DEFAULT_EXPORT = String.raw`C:\Users\paddo\Documents\JARVIS\data\imports\jarvis-chatgpt-export-2026-08-05.zip`;
const DEFAULT_OUTPUT = String.raw`C:\Users\paddo\Documents\JARVIS\data\processed`;

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function log(message) {
  process.stdout.write(`[J.A.R.V.I.S.] ${message}\n`);
}

function fail(message) {
  process.stderr.write(`[J.A.R.V.I.S.] FEHLER: ${message}\n`);
  process.exit(1);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function findFile(root, filename) {
  const ps = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-Command", `(Get-ChildItem -LiteralPath '${root.replaceAll("'", "''")}' -Filter '${filename}' -File -Recurse | Select-Object -First 1 -ExpandProperty FullName)`],
    { encoding: "utf8" },
  );
  return ps.status === 0 ? ps.stdout.trim() : "";
}

function extractZip(zipPath, destination) {
  log(`Entpacke ${basename(zipPath)} …`);
  const ps = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy", "Bypass",
      "-Command",
      `Expand-Archive -LiteralPath '${zipPath.replaceAll("'", "''")}' -DestinationPath '${destination.replaceAll("'", "''")}' -Force`,
    ],
    { stdio: "inherit" },
  );
  if (ps.status !== 0) fail("ZIP-Datei konnte nicht entpackt werden.");
}

function textFromMessage(message) {
  const parts = message?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object") return part.text ?? part.content ?? "";
      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function orderedMessages(conversation) {
  const mapping = conversation?.mapping ?? {};
  return Object.values(mapping)
    .map((node) => node?.message)
    .filter(Boolean)
    .map((message) => ({
      id: message.id,
      role: message.author?.role ?? "unknown",
      name: message.author?.name ?? null,
      createTime: message.create_time ?? null,
      updateTime: message.update_time ?? null,
      status: message.status ?? null,
      contentType: message.content?.content_type ?? null,
      text: textFromMessage(message),
      metadata: message.metadata ?? {},
    }))
    .filter((message) => message.text || message.contentType !== "text")
    .sort((a, b) => (a.createTime ?? 0) - (b.createTime ?? 0));
}

const inputPath = resolve(arg("input", DEFAULT_EXPORT));
const outputPath = resolve(arg("output", DEFAULT_OUTPUT));
const keepExtracted = process.argv.includes("--keep-extracted");

if (!existsSync(inputPath)) fail(`Datei oder Ordner nicht gefunden: ${inputPath}`);
mkdirSync(outputPath, { recursive: true });

let exportRoot = inputPath;
let temporaryRoot = null;
if (statSync(inputPath).isFile()) {
  if (extname(inputPath).toLowerCase() !== ".zip") fail("Als Datei wird eine ZIP-Datei erwartet.");
  temporaryRoot = await mkdtemp(join(tmpdir(), "jarvis-chatgpt-export-"));
  extractZip(inputPath, temporaryRoot);
  exportRoot = temporaryRoot;
}

const conversationsPath = findFile(exportRoot, "conversations.json");
if (!conversationsPath) fail("Keine conversations.json gefunden. Ist dies ein vollständiger OpenAI-Datenexport?");

log(`Lese ${conversationsPath} …`);
let conversations;
try {
  conversations = JSON.parse(readFileSync(conversationsPath, "utf8"));
} catch (error) {
  fail(`conversations.json ist ungültig oder zu groß: ${error instanceof Error ? error.message : String(error)}`);
}
if (!Array.isArray(conversations)) fail("Unerwartetes Format: conversations.json enthält keine Liste.");

const statePath = join(outputPath, "import-state.json");
let previousState = { conversationHashes: {} };
if (existsSync(statePath)) {
  try { previousState = JSON.parse(readFileSync(statePath, "utf8")); } catch { /* clean rebuild */ }
}

const conversationsStream = createWriteStream(join(outputPath, "conversations.jsonl"), { encoding: "utf8" });
const messagesStream = createWriteStream(join(outputPath, "messages.jsonl"), { encoding: "utf8" });
const nextHashes = {};
let newCount = 0;
let changedCount = 0;
let unchangedCount = 0;
let messageCount = 0;

for (let index = 0; index < conversations.length; index += 1) {
  const conversation = conversations[index];
  const id = conversation.id ?? conversation.conversation_id ?? sha256(`${conversation.title ?? ""}:${conversation.create_time ?? index}`);
  const messages = orderedMessages(conversation);
  const normalized = {
    id,
    title: conversation.title ?? "Ohne Titel",
    createTime: conversation.create_time ?? null,
    updateTime: conversation.update_time ?? null,
    currentNode: conversation.current_node ?? null,
    messageCount: messages.length,
  };
  const hash = sha256(JSON.stringify({ normalized, messages }));
  nextHashes[id] = hash;
  if (!previousState.conversationHashes?.[id]) newCount += 1;
  else if (previousState.conversationHashes[id] !== hash) changedCount += 1;
  else unchangedCount += 1;

  conversationsStream.write(`${JSON.stringify(normalized)}\n`);
  for (const message of messages) {
    messagesStream.write(`${JSON.stringify({ conversationId: id, conversationTitle: normalized.title, ...message })}\n`);
    messageCount += 1;
  }

  if ((index + 1) % 100 === 0 || index + 1 === conversations.length) {
    const percent = Math.round(((index + 1) / conversations.length) * 100);
    log(`${percent}% — ${index + 1}/${conversations.length} Konversationen verarbeitet`);
  }
}

await Promise.all([
  new Promise((resolveDone, reject) => conversationsStream.end((error) => error ? reject(error) : resolveDone())),
  new Promise((resolveDone, reject) => messagesStream.end((error) => error ? reject(error) : resolveDone())),
]);

const importedAt = new Date().toISOString();
const manifest = {
  schemaVersion: 1,
  source: "openai-chatgpt-data-export",
  sourceArchive: statSync(inputPath).isFile() ? basename(inputPath) : basename(exportRoot),
  sourceSizeBytes: statSync(inputPath).isFile() ? statSync(inputPath).size : null,
  importedAt,
  conversations: conversations.length,
  messages: messageCount,
  delta: { new: newCount, changed: changedCount, unchanged: unchangedCount },
  files: ["conversations.jsonl", "messages.jsonl", "manifest.json", "import-state.json"],
};
writeFileSync(join(outputPath, "manifest.json"), JSON.stringify(manifest, null, 2));
writeFileSync(statePath, JSON.stringify({ schemaVersion: 1, importedAt, conversationHashes: nextHashes }, null, 2));

if (temporaryRoot && !keepExtracted) rmSync(temporaryRoot, { recursive: true, force: true });
log(`IMPORT ABGESCHLOSSEN — ${conversations.length} Konversationen, ${messageCount} Nachrichten.`);
log(`Neu: ${newCount}, geändert: ${changedCount}, unverändert: ${unchangedCount}.`);
log(`Ausgabe: ${outputPath}`);
