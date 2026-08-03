function owner(request: Request) {
  const email = request.headers.get("oai-authenticated-user-email");
  const host = request.headers.get("host") ?? "";
  if (email) return email;
  if (host.includes("terminal.local") || host.includes("localhost")) return "preview@local";
  return null;
}

async function ready() {
  const { env } = await import("cloudflare:workers");
  const db = env.DB;
  if (!db) throw new Error("Gedächtnisspeicher ist noch nicht verbunden.");
  await db.prepare(`CREATE TABLE IF NOT EXISTS brain_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner TEXT NOT NULL,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    project TEXT NOT NULL DEFAULT 'Allgemein',
    done INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await db.prepare("CREATE INDEX IF NOT EXISTS brain_items_owner_kind_idx ON brain_items (owner, kind)").run();
  return db;
}

export async function GET(request: Request) {
  const who = owner(request);
  if (!who) return Response.json({ error: "Nicht angemeldet" }, { status: 401 });
  const kind = new URL(request.url).searchParams.get("kind") ?? "note";
  try {
    const db = await ready();
    const rows = await db.prepare("SELECT * FROM brain_items WHERE owner = ? AND kind = ? ORDER BY done ASC, id DESC LIMIT 100").bind(who, kind).all();
    return Response.json({ items: rows.results });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Fehler" }, { status: 500 }); }
}

export async function POST(request: Request) {
  const who = owner(request);
  if (!who) return Response.json({ error: "Nicht angemeldet" }, { status: 401 });
  const body = await request.json() as { kind?:string; title?:string; content?:string; project?:string };
  if (!body.title?.trim()) return Response.json({ error: "Titel fehlt" }, { status: 400 });
  try {
    const db = await ready();
    const row = await db.prepare("INSERT INTO brain_items (owner, kind, title, content, project) VALUES (?, ?, ?, ?, ?) RETURNING *")
      .bind(who, body.kind === "task" ? "task" : "note", body.title.trim(), body.content?.trim() ?? "", body.project?.trim() || "Allgemein").first();
    return Response.json({ item: row }, { status: 201 });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Fehler" }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  const who = owner(request);
  if (!who) return Response.json({ error: "Nicht angemeldet" }, { status: 401 });
  const body = await request.json() as { id?:number; done?:boolean };
  try {
    const db = await ready();
    await db.prepare("UPDATE brain_items SET done = ? WHERE id = ? AND owner = ?").bind(body.done ? 1 : 0, body.id, who).run();
    return Response.json({ ok: true });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Fehler" }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  const who = owner(request);
  if (!who) return Response.json({ error: "Nicht angemeldet" }, { status: 401 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  try { const db = await ready(); await db.prepare("DELETE FROM brain_items WHERE id = ? AND owner = ?").bind(id, who).run(); return Response.json({ ok:true }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Fehler" }, { status: 500 }); }
}
