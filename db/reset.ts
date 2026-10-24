/**
 * Gera o banco de dados a partir de db/schema.sql e, quando existir,
 * executa db/seed.ts (fixtures de demonstracao).
 *
 * DONO: Integrador. O seed em si (db/seed.*) e do agente Backend/Dados.
 *
 *   npm run db:reset
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Database from "better-sqlite3";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaFile = path.join(root, "db", "schema.sql");
const seedFile = path.join(root, "db", "seed.ts");
const dbFile = path.resolve(
  root,
  process.env.DATABASE_PATH ?? path.join("data", "app.db"),
);

function removeIfExists(file: string): void {
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    const target = `${file}${suffix}`;
    if (fs.existsSync(target)) fs.rmSync(target);
  }
}

async function main(): Promise<void> {
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  removeIfExists(dbFile);

  const db = new Database(dbFile);
  try {
    db.exec(fs.readFileSync(schemaFile, "utf8"));

    if (fs.existsSync(seedFile)) {
      const seed = (await import(pathToFileURL(seedFile).href)) as {
        seed?: (database: Database.Database) => void | Promise<void>;
      };
      if (typeof seed.seed !== "function") {
        throw new Error("db/seed.ts precisa exportar `seed(db)`.");
      }
      await seed.seed(db);
      const { market, product, price } = db
        .prepare(
          `SELECT (SELECT COUNT(*) FROM market) AS market,
                  (SELECT COUNT(*) FROM product) AS product,
                  (SELECT COUNT(*) FROM price) AS price`,
        )
        .get() as { market: number; product: number; price: number };
      console.log(
        `seed aplicado: ${market} mercado(s), ${product} produto(s), ${price} preco(s).`,
      );
    } else {
      console.log(
        "aviso: db/seed.ts ainda nao existe — apenas o schema foi aplicado (issue do backend).",
      );
    }
  } finally {
    db.close();
  }

  console.log(`banco recriado em ${dbFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
