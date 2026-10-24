/**
 * Seed de demonstracao — fixtures da secao 3 de TESTES.md.
 *
 * DONO: agente Backend/Dados. `npm run db:reset` aplica db/schema.sql e chama
 * `seed(db)` (ver db/reset.ts).
 *
 * Regras:
 * - Deterministico e relativo a `now`: as datas sao "hoje - N dias", entao a
 *   demo sempre tem um preco vencido (SEED-02) e nunca tem data futura
 *   (SEED-04 / RN05). O caso de data futura de TESTES.md (P3/M3) fica coberto
 *   por teste unitario (UT-09), nao pelo seed.
 * - IDs fixos: mercados 1..3, produtos 1..4, precos 101..107. Repetir o seed
 *   no mesmo banco nao duplica (INSERT OR IGNORE). Precificar de novo exige
 *   `npm run db:reset`, pois `price` e append-only (RN06).
 * - Senhas demo: apenas hash scrypt; texto puro e 'demo1234' (nunca logado).
 */

import type Database from "better-sqlite3";

const MS_PER_DAY = 86_400_000;

/** Data `YYYY-MM-DD` de `now - dias`, no dia de calendario UTC. */
function dataColetaDiasAtras(now: Date, dias: number): string {
  const hoje = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return new Date(hoje - dias * MS_PER_DAY).toISOString().slice(0, 10);
}

/** `created_at` em ISO 8601 UTC com segundos (contrato de docs/api.md). */
function createdAtUtc(now: Date): string {
  return now.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function seed(db: Database.Database, now: Date = new Date()): void {
  const createdAt = createdAtUtc(now);

  const mercados = [
    { id: 1, nome: "Mercado Centro", endereco: "Rua A, 100", bairro: "Centro" },
    { id: 2, nome: "Mercado Bosque", endereco: "Rua B, 200", bairro: "Bosque" },
    {
      id: 3,
      nome: "Mercado Floresta",
      endereco: "Rua C, 300",
      bairro: "Floresta",
    },
  ] as const;

  const produtos = [
    { id: 1, nome: "Arroz Branco", categoria: "Grãos", unidade: "5 kg" },
    { id: 2, nome: "Arroz Branco", categoria: "Grãos", unidade: "1 kg" },
    { id: 3, nome: "Leite Integral", categoria: "Laticínios", unidade: "1 L" },
    { id: 4, nome: "Feijão Carioca", categoria: "Grãos", unidade: "1 kg" },
  ] as const;

  // Fixtures da secao 3 de TESTES.md. P1/M3 tem 34 dias (vencido, SEED-02);
  // P4 tem empate 1990 com datas diferentes (SEED-03).
  const precos = [
    { id: 101, product_id: 1, market_id: 1, valor: 2890, dias: 0 },
    { id: 102, product_id: 1, market_id: 2, valor: 2750, dias: 1 },
    { id: 103, product_id: 1, market_id: 3, valor: 2650, dias: 34 },
    { id: 104, product_id: 4, market_id: 1, valor: 1990, dias: 4 },
    { id: 105, product_id: 4, market_id: 2, valor: 1990, dias: 2 },
    { id: 106, product_id: 3, market_id: 1, valor: 499, dias: 0 },
    { id: 107, product_id: 3, market_id: 2, valor: 519, dias: 0 },
  ] as const;

  // Usuarios demo de lojista (senha 'demo1234'). Hash scrypt literal,
  // compartilhado com lib/auth.ts; nunca guardamos texto puro (RNF03).
  const usuarios = [
    {
      email: "centro@demo.local",
      senha_hash:
        "scrypt$7c2ae12bb89ce7c50484fe2923c3f69a$e9025736c6d95765ab54f0b5cf147296b7f8fcc30d1600efb1b7e286d3ea13ef9601b0a50eefd938ddfb5cba79291c97b6913390787ab3423384b4da6dc40925",
      market_id: 1,
    },
    {
      email: "bosque@demo.local",
      senha_hash:
        "scrypt$d0ae1a9d374ebababb0c30e7031b7fac$3956ceb51831077e43251242687fef083b00d55e45b4b3590067e0b92c1b1894cd7b68c7698d05745bcc32bce88f8b1b4ce54a6518857dea6ce154b1fe5ded99",
      market_id: 2,
    },
  ] as const;

  const inserirMercado = db.prepare(
    `INSERT OR IGNORE INTO market (id, nome, endereco, bairro, cidade, ativo)
     VALUES (?, ?, ?, ?, 'Rio Branco/AC', 1)`,
  );
  const inserirProduto = db.prepare(
    `INSERT OR IGNORE INTO product (id, nome, categoria, unidade, ean, ativo)
     VALUES (?, ?, ?, ?, NULL, 1)`,
  );
  const inserirPreco = db.prepare(
    `INSERT OR IGNORE INTO price
       (id, market_id, product_id, valor_centavos, data_coleta, fonte, created_at)
     VALUES (?, ?, ?, ?, ?, 'painel', ?)`,
  );
  const inserirUsuario = db.prepare(
    `INSERT OR IGNORE INTO user (email, senha_hash, role, market_id, created_at)
     VALUES (?, ?, 'lojista', ?, ?)`,
  );

  const aplicar = db.transaction(() => {
    for (const mercado of mercados) {
      inserirMercado.run(
        mercado.id,
        mercado.nome,
        mercado.endereco,
        mercado.bairro,
      );
    }

    for (const produto of produtos) {
      inserirProduto.run(
        produto.id,
        produto.nome,
        produto.categoria,
        produto.unidade,
      );
    }

    for (const preco of precos) {
      inserirPreco.run(
        preco.id,
        preco.market_id,
        preco.product_id,
        preco.valor,
        dataColetaDiasAtras(now, preco.dias),
        createdAt,
      );
    }

    for (const usuario of usuarios) {
      inserirUsuario.run(
        usuario.email,
        usuario.senha_hash,
        usuario.market_id,
        createdAt,
      );
    }
  });

  aplicar();
}
