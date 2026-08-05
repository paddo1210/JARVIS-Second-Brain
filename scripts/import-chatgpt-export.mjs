#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const DEFAULT_EXPORT = String.raw`C:\Users\paddo\Documents\JARVIS\data\imports\jarvis-chatgpt-export-2026-08-05.zip`;
const DEFAULT_OUTPUT = String.raw`C:\Users\paddo\Documents\JARVIS\data\processed`;

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}
function log(message) { process.stdout.write(`[J.A.R.V.I.S.] ${message}\n`); }
function fail(message) { process.stderr.write(`[J.A.R.V.I.S.] FEHLER: ${message}\n`); process.exit(1); }
function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
function psEscape(value) { return value.replaceAll("'", "''"); }

function extractZip(zipPath, destination) {
  log(`Entpacke ${basename(zipPath)} …`);
  mkdirSync(destination, { recursive: true });
  const ps = spawnSync("powershell.exe", [
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command",
    `Expand-Archive -LiteralPath '${psEscape(zipPath)}' -DestinationPath '${psEscape(destination)}' -Force`,
  ], { stdio: "inherit" });
  if (ps.status !== 0) fail(`ZIP-Datei konnte nicht entpackt werden: ${zipPath}`);
}

function walk(root, predicate, results = []) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) walk(fullPath, predicate, results);
    else if (predicate(entry.name, fullPath)) results.push(fullPath);
  }
  return results;
}

function findConversationFiles(root) {
  return walk(root, (name) => /^conversations(?:[-_].+)?\.json$/i.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function expandNestedArchives(root) {
  const handled = new Set();
  let round = 0;
  while (round < 4) {
    const archives = walk(root, (name, fullPath) => extname(name).toLowerCase() === ".zip" && !handled.has(fullPath));
    if (!archives.length) return;
    for (const archive of archives) {
      handled.add(archive);
      const destination = `${archive}.extracted`;
      extractZip(archive, destination);
    }
    round += 1;
  }
}

function textFromMessage(message) {
  const parts = message?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((part) => {
    if (typeof part === "string") return part;
    if (part && typeof part === "object") return part.text ?? part.content ?? "";
    return "";
  }).filter(Boolean).join("\n").trim();
}

function orderedMessages(conversation) {
  return Object.values(conversation?.mapping ?? {}).map((node) => node?.message).filter(Boolean).map((message) => ({
    id: message.id,
    role: message.author?.role ?? "unknown",
    name: message.author?.name ?? null,
    createTime: message.create_time ?? null,
    updateTime: message.update_time ?? null,
    status: message.status ?? null,
    contentType: message.content?.content_type ?? null,
    text: textFromMessage(message),
    metadata: message.metadata ?? {},
  })).filter((message) => message.text || message.contentType !== "text")
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

let conversationFiles = findConversationFiles(exportRoot);
if (!conversationFiles.length) {
  const nestedZips = walk(exportRoot, (name) => extname(name).toLowerCase() === ".zip");
  if (nestedZips.length) {
    log(`${nestedZips.length} eingebettete ZIP-Datei(en) gefunden — entpacke weiter …`);
    expandNestedArchives(exportRoot);
    conversationFiles = findConversationFiles(exportRoot);
  }
}
if (!conversationFiles.length) {
  const jsonExamples = walk(exportRoot, (name) => extname(name).toLowerCase() === ".json").slice(0, 12).map(basename);
  const hint = jsonExamples.length ? ` Gefundene JSON-Dateien: ${jsonExamples.join(", ")}` : " Es wurden überhaupt keine JSON-Dateien gefunden.";
  fail(`Keine conversations.json oder conversations-*.json gefunden.${hint}`);
}

log(`${conversationFiles.length} Konversationsdatei(en) gefunden.`);
const conversations = [];
for (const file of conversationFiles) {
  log(`Lese ${file} …`);
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    if (Array.isArray(parsed)) conversations.push(...parsed);
    else if (Array.isArray(parsed?.conversations)) conversations.push(...parsed.conversations);
    else log(`Überspringe Datei mit unbekanntem Format: ${basename(file)}`);
  } catch (error) {
    fail(`${basename(file)} ist ungültig: ${error instanceof Error ? error.message : String(error)}`);
  }
}
if (!conversations.length) fail("Die gefundenen Konversationsdateien enthalten keine lesbaren Konversationen.");

const statePath = join(outputPath, "import-state.json");
let previousState = { conversationHashes: {} };
if (existsSync(statePath)) {
  try { previousState = JSON.parse(readFileSync(statePath, "utf8")); } catch { /* sauber neu aufbauen */ }
}

const conversationsStream = createWriteStream(join(outputPath, "conversations.jsonl"), { encoding: "utf8" });
const messagesStream = createWriteStream(join(outputPath, "messages.jsonl"), { encoding: "utf8" });
const nextHashes = {};
let newCount = 0, changedCount = 0, unchangedCount = 0, messageCount = 0;

for (let index = 0; index < conversations.length; index += 1) {
  const conversation = conversations[index];
  const id = conversation.id ?? conversation.conversation_id ?? sha256(`${conversation.title ?? ""}:${conversation.create_time ?? index}`);
  const messages = orderedMessages(conversation);
  const normalized = {
    id, title: conversation.title ?? "Ohne Titel", createTime: conversation.create_time ?? null,
    updateTime: conversation.update_time ?? null, currentNode: conversation.current_node ?? null,
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
    log(`${Math.round(((index + 1) / conversations.length) * 100)}% — ${index + 1}/${conversations.length} Konversationen verarbeitet`);
  }
}

await Promise.all([
  new Promise((done, reject) => conversationsStream.end((error) => error ? reject(error) : done())),
  new Promise((done, reject) => messagesStream.end((error) => error ? reject(error) : done())),
]);

const importedAt = new Date().toISOString();
const manifest = {
  schemaVersion: 2,
  source: "openai-chatgpt-data-export",
  sourceArchive: statSync(inputPath).isFile() ? basename(inputPath) : basename(exportRoot),
  sourceSizeBytes: statSync(inputPath).isFile() ? statSync(inputPath).size : null,
  importedAt,
  conversationSourceFiles: conversationFiles.map((file) => basename(file)),
  conversations: conversations.length,
  messages: messageCount,
  delta: { new: newCount, changed: changedCount, unchanged: unchangedCount },
  files: ["conversations.jsonl", "messages.jsonl", "manifest.json", "import-state.json"],
};
writeFileSync(join(outputPath, "manifest.json"), JSON.stringify(manifest, null, 2));
writeFileSync(statePath, JSON.stringify({ schemaVersion: 2, importedAt, conversationHashes: nextHashes }, null, 2));
if (temporaryRoot && !keepExtracted) rmSync(temporaryRoot, { recursive: true, force: true });
log(`IMPORT ABGESCHLOSSEN — ${conversations.length} Konversationen, ${messageCount} Nachrichten.`);
log(`Neu: ${newCount}, geändert: ${changedCount}, unverändert: ${unchangedCount}.`);
log(`Ausgabe: ${outputPath}`);
