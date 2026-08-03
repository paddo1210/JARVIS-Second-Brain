function owner(request: Request) {
  const email = request.headers.get("oai-authenticated-user-email");
  const host = request.headers.get("host") ?? "";
  if (email) return email;
  if (host.includes("terminal.local") || host.includes("localhost")) return "preview@local";
  return null;
}

const base64ToBytes = (value: string) => Uint8Array.from(atob(value), char => char.charCodeAt(0));

// Must match the Cloudflare-compatible value used when sealing the vault.
const PBKDF2_ITERATIONS = 100000;

async function decrypt(ciphertext: string, salt: string, iv: string, password: string) {
  const encoder = new TextEncoder();
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: base64ToBytes(salt), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(iv) }, key, base64ToBytes(ciphertext));
  return new TextDecoder().decode(plain);
}

export async function POST(request: Request) {
  const who = owner(request);
  if (!who) return Response.json({ error: "Nicht angemeldet" }, { status: 401 });
  const body = await request.json() as { message?: string; password?: string; history?: Array<{ who: string; text: string }> };
  if (!body.message?.trim()) return Response.json({ error: "Nachricht fehlt" }, { status: 400 });
  if (!body.password) return Response.json({ error: "Tresor ist gesperrt", code: "VAULT_LOCKED" }, { status: 401 });
  try {
    const { env } = await import("cloudflare:workers");
    if (!env.DB) throw new Error("Second Brain ist noch nicht verbunden.");
    const vault = await env.DB.prepare("SELECT ciphertext, salt, iv FROM api_vault WHERE owner = ?").bind(who).first<{ciphertext:string;salt:string;iv:string}>();
    if (!vault) return Response.json({ error: "API-Key ist noch nicht eingerichtet", code: "VAULT_EMPTY" }, { status: 409 });
    let apiKey = "";
    try { apiKey = await decrypt(vault.ciphertext, vault.salt, vault.iv, body.password); }
    catch { return Response.json({ error: "Tresor-Passwort ist falsch", code: "BAD_PASSWORD" }, { status: 401 }); }
    const items = await env.DB.prepare("SELECT kind, title, content, project, done FROM brain_items WHERE owner = ? ORDER BY id DESC LIMIT 40").bind(who).all();
    const context = (items.results ?? []).map((item: any) => `- [${item.kind}${item.done ? ", erledigt" : ""}] ${item.project}: ${item.title}${item.content ? ` — ${item.content}` : ""}`).join("\n") || "Noch keine gespeicherten Einträge.";
    const history = (body.history ?? []).slice(-8).map(entry => `${entry.who}: ${entry.text}`).join("\n");
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "authorization": `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5.6-sol",
        instructions: "Du bist J.A.R.V.I.S., Paddos privater persönlicher Assistent. Antworte auf Deutsch, klar, ehrlich, hilfreich und knapp. Nutze das Second Brain als Kontext, behaupte aber nichts, was dort nicht steht. Weise auf Unsicherheit offen hin.",
        input: `SECOND BRAIN:\n${context}\n\nLETZTER GESPRÄCHSKONTEXT:\n${history || "Keiner"}\n\nPADDO:\n${body.message.trim()}`,
        max_output_tokens: 1200,
      }),
    });
    const data = await response.json() as any;
    if (!response.ok) return Response.json({ error: data?.error?.message || "OpenAI-Anfrage fehlgeschlagen" }, { status: response.status });
    const text = data.output_text || data.output?.flatMap((part:any) => part.content ?? []).find((part:any) => part.type === "output_text")?.text;
    return Response.json({ text: text || "Ich konnte keine Textantwort erzeugen." });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "KI-Verbindung fehlgeschlagen" }, { status: 500 });
  }
}
