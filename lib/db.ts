/**
 * Acesso ao SQLite (better-sqlite3).
 *
 * DONO: agente Backend/Dados. Criado no scaffold pelo Integrador para que
 * `npm run db:reset` e a API tenham uma base comum; a partir daqui, mudancas
 * de assinatura passam pelo Backend.
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export type DB = Database.Database;

const DEFAULT_PATH = path.join("data", "app.db");

export function databasePath(): string {
  return path.resolve(process.env.DATABASE_PATH ?? DEFAULT_PATH);
}

/**
 * Conexao singleton (o Next recarrega modulos em dev; guardamos no globalThis).
 * WAL fica ligado para leitura concorrente durante a demo.
 */
const globalForDb = globalThis as unknown as { __db?: DB };

export function getDb(): DB {
  if (globalForDb.__db) return globalForDb.__db;

  const file = databasePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");

  globalForDb.__db = db;
  return db;
}

/** Fecha a conexao (testes e scripts). */
export function closeDb(): void {
  globalForDb.__db?.close();
  globalForDb.__db = undefined;
}
