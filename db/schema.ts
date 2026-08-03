import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const brainItems = sqliteTable("brain_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  owner: text("owner").notNull(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  project: text("project").notNull().default("Allgemein"),
  done: integer("done", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const apiVault = sqliteTable("api_vault", {
  owner: text("owner").primaryKey(),
  ciphertext: text("ciphertext").notNull(),
  salt: text("salt").notNull(),
  iv: text("iv").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
