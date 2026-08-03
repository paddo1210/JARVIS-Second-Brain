function owner(request: Request) {
  const email = request.headers.get("oai-authenticated-user-email");
  const host = request.headers.get("host") ?? "";
  if (email) return email;
  if (host.includes("terminal.local") || host.includes("localhost")) return "preview@local";
  return null;
}

async function db() {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) throw new Error("Tresorspeicher ist noch nicht verbunden.");
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS api_vault (
    owner TEXT PRIMARY KEY,
    ciphertext TEXT NOT NULL,
    salt TEXT NOT NULL,
    iv TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  return env.DB;
}

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((byte) => binary += String.fromCharCode(byte));
  return btoa(binary);
};

// Cloudflare Workers currently cap PBKDF2 at 100,000 iterations.
// Keep this value in sync with the decrypt path in /api/chat.
const PBKDF2_ITERATIONS = 100000;

async function encrypt(secret: string, password: string) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(secret));
  return { ciphertext: bytesToBase64(new Uint8Array(ciphertext)), salt: bytesToBase64(salt), iv: bytesToBase64(iv) };
}

export async function GET(request: Request) {
  const who = owner(request);
  if (!who) return Response.json({ error: "Nicht angemeldet" }, { status: 401 });
  try {
    const store = await db();
    const row = await store.prepare("SELECT updated_at FROM api_vault WHERE owner = ?").bind(who).first();
    return Response.json({ configured: Boolean(row), updatedAt: row?.updated_at ?? null });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Tresor nicht erreichbar" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const who = owner(request);
  if (!who) return Response.json({ error: "Nicht angemeldet" }, { status: 401 });
  const body = await request.json() as { apiKey?: string; password?: string };
  if (!body.apiKey?.startsWith("sk-") || body.apiKey.length < 30) return Response.json({ error: "Der API-Key sieht nicht gültig aus." }, { status: 400 });
  if (!body.password || body.password.length < 8) return Response.json({ error: "Das Tresor-Passwort braucht mindestens 8 Zeichen." }, { status: 400 });
  try {
    const sealed = await encrypt(body.apiKey.trim(), body.password);
    const store = await db();
    await store.prepare(`INSERT INTO api_vault (owner, ciphertext, salt, iv, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(owner) DO UPDATE SET ciphertext=excluded.ciphertext, salt=excluded.salt, iv=excluded.iv, updated_at=CURRENT_TIMESTAMP`)
      .bind(who, sealed.ciphertext, sealed.salt, sealed.iv).run();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Verschlüsselung fehlgeschlagen" }, { status: 500 });
  }
}
