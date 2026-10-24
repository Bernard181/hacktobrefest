/**
 * SEED-01..SEED-04 — integridade das fixtures de `db/seed.ts`.
 *
 * Banco temporario exclusivo da suite: aplica o schema real e roda o seed com
 * relogio fixo. Nenhum teste depende do `data/app.db` do desenvolvedor.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { seed } from "../db/seed";
import { VALIDADE_DIAS, daysSinceCollection } from "../lib/prices";

const NOW = new Date("2026-10-24T12:00:00Z");
const schemaSql = fs.readFileSync(
  path.join(process.cwd(), "db", "schema.sql"),
  "utf8",
);

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "precos-seed-"));
const dbFile = path.join(tmpDir, "seed.db");

let db: Database.Database;

beforeAll(() => {
  db = new Database(dbFile);
  db.pragma("foreign_keys = ON");
  db.exec(schemaSql);
  seed(db, NOW);
});

afterAll(() => {
  db.close();
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    const file = `${dbFile}${suffix}`;
    if (fs.existsSync(file)) fs.rmSync(file);
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

interface MarketRow {
  id: number;
  nome: string;
  endereco: string;
  bairro: string;
  cidade: string;
  ativo: number;
}

interface PriceRow {
  id: number;
  market_id: number;
  product_id: number;
  valor_centavos: number;
  data_coleta: string;
}

describe("SEED-01 — mercados da demo", () => {
  it("cria 3 mercados ativos em Rio Branco com nome e endereco", () => {
    const mercados = db
      .prepare("SELECT * FROM market ORDER BY id")
      .all() as MarketRow[];

    expect(mercados).toHaveLength(3);
    for (const mercado of mercados) {
      expect(mercado.ativo).toBe(1);
      expect(mercado.cidade).toBe("Rio Branco/AC");
      expect(mercado.nome.trim().length).toBeGreaterThan(0);
      expect(mercado.endereco.trim().length).toBeGreaterThan(0);
    }

    expect(mercados.map((m) => m.nome)).toEqual([
      "Mercado Centro",
      "Mercado Bosque",
      "Mercado Floresta",
    ]);
  });
});

describe("SEED-02 — fixture do P1 (vencido fora do ranking)", () => {
  it("tem P1 em M1, M2 e M3 com exatamente um preco vencido", () => {
    const precos = db
      .prepare("SELECT * FROM price WHERE product_id = 1 ORDER BY id")
      .all() as PriceRow[];

    expect(precos).toHaveLength(3);
    expect(new Set(precos.map((p) => p.market_id))).toEqual(new Set([1, 2, 3]));

    const vencidos = precos.filter(
      (p) => daysSinceCollection(p.data_coleta, NOW) > VALIDADE_DIAS,
    );
    expect(vencidos).toHaveLength(1);
    expect(vencidos[0].market_id).toBe(3);
    expect(vencidos[0].valor_centavos).toBe(2650);
  });

  it("P1/M3 tem mais de 30 dias para demonstrar RN04", () => {
    const precos = db
      .prepare("SELECT * FROM price WHERE product_id = 1 ORDER BY id")
      .all() as PriceRow[];
    const dias = precos.map((p) => daysSinceCollection(p.data_coleta, NOW));

    expect(dias.filter((d) => d > VALIDADE_DIAS)).toHaveLength(1);
    expect(dias.filter((d) => d <= VALIDADE_DIAS)).toHaveLength(2);
  });
});

describe("SEED-03 — empate do P4", () => {
  it("tem dois precos iguais em mercados distintos com datas diferentes", () => {
    const precos = db
      .prepare("SELECT * FROM price WHERE product_id = 4 ORDER BY id")
      .all() as PriceRow[];

    expect(precos).toHaveLength(2);
    expect(precos[0].market_id).not.toBe(precos[1].market_id);
    expect(precos[0].valor_centavos).toBe(1990);
    expect(precos[1].valor_centavos).toBe(1990);
    expect(precos[0].data_coleta).not.toBe(precos[1].data_coleta);
  });
});

describe("SEED-04 — sanidade dos precos", () => {
  it("nao insere data futura (RN05)", () => {
    const precos = db.prepare("SELECT * FROM price").all() as PriceRow[];

    expect(precos.length).toBeGreaterThan(0);
    for (const preco of precos) {
      expect(daysSinceCollection(preco.data_coleta, NOW)).toBeGreaterThanOrEqual(0);
    }
  });

  it("todo valor e inteiro e maior que zero (RN09)", () => {
    const precos = db.prepare("SELECT * FROM price").all() as PriceRow[];

    for (const preco of precos) {
      expect(Number.isInteger(preco.valor_centavos)).toBe(true);
      expect(preco.valor_centavos).toBeGreaterThan(0);
    }
  });

  it("todos os precos apontam para mercado e produto existentes", () => {
    const orfaos = db
      .prepare(
        `SELECT COUNT(*) AS total
           FROM price p
           LEFT JOIN market m ON m.id = p.market_id
           LEFT JOIN product pr ON pr.id = p.product_id
          WHERE m.id IS NULL OR pr.id IS NULL`,
      )
      .get() as { total: number };

    expect(orfaos.total).toBe(0);
  });
});
