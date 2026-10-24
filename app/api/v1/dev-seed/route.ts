import fs from "node:fs";
import path from "node:path";

import { seed } from "@/db/seed";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TEMPORARIO — usado apenas para validar o seed/rotas sem shell. Sera removido.
export async function GET(): Promise<Response> {
  const db = getDb();
  const schema = fs.readFileSync(
    path.join(process.cwd(), "db", "schema.sql"),
    "utf8",
  );
  db.exec(schema);
  seed(db, new Date());
  const counts = db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM market) AS market,
              (SELECT COUNT(*) FROM product) AS product,
              (SELECT COUNT(*) FROM price) AS price,
              (SELECT COUNT(*) FROM user) AS user`,
    )
    .get();
  return Response.json(counts);
}
