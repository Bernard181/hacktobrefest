/**
 * API-01..API-09 (+ UT-10/UT-11 no nivel do banco) — contrato JSON, CORS e
 * regras de leitura das rotas publicas `/api/v1/*`.
 *
 * Banco temporario exclusivo da suite: `DATABASE_PATH` e definido ANTES de
 * importar `lib/db` (import dinamico), o schema real e aplicado e o seed roda
 * com `new Date()`. Os handlers sao chamados diretamente com `NextRequest`,
 * sem subir servidor.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type Database from "better-sqlite3";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CIDADE_PADRAO } from "../lib/prices";

const schemaSql = fs.readFileSync(
  path.join(process.cwd(), "db", "schema.sql"),
  "utf8",
);

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "precos-api-"));
const dbFile = path.join(tmpDir, "api.db");
const previousDatabasePath = process.env.DATABASE_PATH;

type Handler = (request: NextRequest) => Promise<Response>;

let db: Database.Database;
let products: { GET: Handler; OPTIONS: () => Promise<Response> };
let prices: { GET: Handler; OPTIONS: () => Promise<Response> };
let markets: { GET: Handler; OPTIONS: () => Promise<Response> };
let notFound: { GET: Handler; OPTIONS: () => Promise<Response> };

function request(pathname: string): NextRequest {
  return new NextRequest(`http://localhost:3000${pathname}`);
}

async function call(handler: Handler, pathname: string) {
  const res = await handler(request(pathname));
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { res, body };
}

function hojeUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

beforeAll(async () => {
  process.env.DATABASE_PATH = dbFile;

  const { getDb } = await import("../lib/db");
  db = getDb();
  db.exec(schemaSql);

  const { seed } = await import("../db/seed");
  seed(db, new Date());

  products = await import("../app/api/v1/products/route");
  prices = await import("../app/api/v1/prices/route");
  markets = await import("../app/api/v1/markets/route");
  notFound = await import("../app/api/v1/[...slug]/route");
});

afterAll(async () => {
  const { closeDb } = await import("../lib/db");
  closeDb();

  if (previousDatabasePath === undefined) {
    delete process.env.DATABASE_PATH;
  } else {
    process.env.DATABASE_PATH = previousDatabasePath;
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("API-06 — CORS liberado em toda resposta", () => {
  it("GET 200 traz Access-Control-Allow-Origin e Cache-Control no-store", async () => {
    const { res } = await call(markets.GET, "/api/v1/markets");

    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("respostas de erro tambem trazem CORS e no-store", async () => {
    const casos = [
      await call(prices.GET, "/api/v1/prices?product_id=abc"),
      await call(prices.GET, "/api/v1/prices?product_id=9999"),
      await call(notFound.GET, "/api/v1/produtos-inexistentes"),
    ];

    expect(casos.map(({ res }) => res.status)).toEqual([400, 404, 404]);
    for (const { res } of casos) {
      expect(res.headers.get("access-control-allow-origin")).toBe("*");
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("OPTIONS responde 204 sem corpo com os metodos e headers do contrato", async () => {
    for (const rota of [products, prices, markets]) {
      const res = await rota.OPTIONS();

      expect(res.status).toBe(204);
      expect(await res.text()).toBe("");
      expect(res.headers.get("access-control-allow-origin")).toBe("*");
      expect(res.headers.get("access-control-allow-methods")).toContain("GET");
      expect(res.headers.get("access-control-allow-methods")).toContain(
        "OPTIONS",
      );
      expect(res.headers.get("access-control-allow-headers")).toContain(
        "X-API-Key",
      );
    }
  });
});

describe("API-07 — leitura publica sem credencial", () => {
  it("GET /api/v1/products responde 200 sem header de autenticacao", async () => {
    const { res, body } = await call(products.GET, "/api/v1/products");

    expect(res.status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta.total).toBe(4);
  });

  it("GET /api/v1/prices responde 200 sem credencial", async () => {
    const { res } = await call(prices.GET, "/api/v1/prices?product_id=1");
    expect(res.status).toBe(200);
  });
});

describe("API-01 — filtro por categoria", () => {
  it("retorna apenas produtos da categoria Grãos", async () => {
    const { res, body } = await call(
      products.GET,
      "/api/v1/products?category=Gr%C3%A3os",
    );

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(3);
    for (const produto of body.data) {
      expect(produto.categoria).toBe("Grãos");
    }
    expect(new Set(body.data.map((p: any) => p.id))).toEqual(new Set([1, 2, 4]));
    expect(body.meta.total).toBe(3);
  });

  it("nao diferencia caixa nem acento na categoria", async () => {
    const { body } = await call(
      products.GET,
      "/api/v1/products?category=graos",
    );
    expect(new Set(body.data.map((p: any) => p.id))).toEqual(new Set([1, 2, 4]));
  });
});

describe("API-02 — filtro por nome", () => {
  it("q=arroz encontra P1 e P2", async () => {
    const { body } = await call(products.GET, "/api/v1/products?q=arroz");

    expect(body.data.map((p: any) => p.id).sort()).toEqual([1, 2]);
    expect(body.meta.total).toBe(2);
  });

  it("q sem caixa/acento encontra Feijão Carioca", async () => {
    const { body } = await call(products.GET, "/api/v1/products?q=FEIJAO");

    expect(body.data).toHaveLength(1);
    expect(body.data[0].nome).toBe("Feijão Carioca");
  });

  it("q casa apenas com o nome, nunca com a categoria", async () => {
    const { body } = await call(products.GET, "/api/v1/products?q=graos");
    expect(body.data).toEqual([]);
  });

  it("ordena por nome e depois por unidade", async () => {
    const { body } = await call(
      products.GET,
      "/api/v1/products?category=Gr%C3%A3os",
    );
    expect(body.data.map((p: any) => p.id)).toEqual([2, 1, 4]);
  });
});

describe("API-03 — JSON de preços do P1", () => {
  it("devolve produto, mercado, endereco, valor e data de coleta", async () => {
    const { res, body } = await call(
      prices.GET,
      "/api/v1/prices?product_id=1",
    );

    expect(res.status).toBe(200);
    expect(body.data.product).toMatchObject({
      id: 1,
      nome: "Arroz Branco",
      categoria: "Grãos",
      unidade: "5 kg",
      ean: null,
      ativo: true,
    });

    expect(body.data.ofertas).toHaveLength(3);
    expect(body.data.ofertas[0]).toMatchObject({
      price_id: 102,
      market_id: 2,
      market: {
        id: 2,
        nome: "Mercado Bosque",
        endereco: "Rua B, 200",
        bairro: "Bosque",
        cidade: CIDADE_PADRAO,
      },
      valor_centavos: 2750,
      fonte: "painel",
      valido: true,
      dias_desde_coleta: 1,
      posicao: 1,
    });
    expect(body.data.ofertas[0].data_coleta).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    expect(body.data.ofertas[1]).toMatchObject({
      price_id: 101,
      market_id: 1,
      valor_centavos: 2890,
      valido: true,
      dias_desde_coleta: 0,
      posicao: 2,
    });

    expect(body.meta.cidade).toBe(CIDADE_PADRAO);
    expect(body.meta.gerado_em).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });
});

describe("API-04 — preco vencido fora do ranking, mas visivel", () => {
  it("M3 vem por ultimo com valido:false, posicao null e resumo correto", async () => {
    const { body } = await call(prices.GET, "/api/v1/prices?product_id=1");
    const ofertas = body.data.ofertas;
    const vencida = ofertas.find((o: any) => o.market_id === 3);

    expect(vencida).toMatchObject({
      price_id: 103,
      valor_centavos: 2650,
      valido: false,
      posicao: null,
      dias_desde_coleta: 34,
    });
    expect(ofertas[ofertas.length - 1].market_id).toBe(3);
    expect(
      ofertas.filter((o: any) => !o.valido).every((o: any) => o.posicao === null),
    ).toBe(true);

    expect(body.data.resumo).toEqual({
      menor_valor_centavos: 2750,
      vencedores: [{ price_id: 102, market_id: 2, valor_centavos: 2750 }],
      total_ofertas: 3,
      total_validas: 2,
      total_vencidas: 1,
    });
  });
});

describe("API-05 — product_id inexistente ou inativo", () => {
  it("devolve 404 product_not_found", async () => {
    const { res, body } = await call(
      prices.GET,
      "/api/v1/prices?product_id=9999",
    );

    expect(res.status).toBe(404);
    expect(body).toEqual({
      error: {
        code: "product_not_found",
        message: "Produto não encontrado.",
      },
    });
  });

  it("produto inativo tambem responde 404", async () => {
    db.prepare(
      `INSERT INTO product (id, nome, categoria, unidade, ativo)
       VALUES (50, 'Produto Inativo', 'Teste', '1 un', 0)`,
    ).run();

    const { res, body } = await call(
      prices.GET,
      "/api/v1/prices?product_id=50",
    );

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("product_not_found");
  });
});

describe("API-08 — mercados da cidade", () => {
  it("lista mercados de Rio Branco com nome e endereco", async () => {
    const { res, body } = await call(markets.GET, "/api/v1/markets");

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(3);
    expect(body.meta).toEqual({ total: 3, cidade: CIDADE_PADRAO });

    for (const mercado of body.data) {
      expect(mercado).toMatchObject({
        cidade: CIDADE_PADRAO,
        ativo: true,
      });
      expect(mercado.nome.length).toBeGreaterThan(0);
      expect(mercado.endereco.length).toBeGreaterThan(0);
      expect(Object.keys(mercado).sort()).toEqual(
        ["ativo", "bairro", "cidade", "endereco", "id", "nome"].sort(),
      );
    }
  });

  it("nunca expoe api_key_hash (RN08/RNF04)", async () => {
    const { body } = await call(markets.GET, "/api/v1/markets");
    expect(JSON.stringify(body)).not.toContain("api_key_hash");
  });

  it("cidade desconhecida devolve lista vazia, nunca 500", async () => {
    const { res, body } = await call(
      markets.GET,
      "/api/v1/markets?city=Atlantis",
    );
    expect(res.status).toBe(200);
    expect(body.data).toEqual([]);
    expect(body.meta.total).toBe(0);
  });
});

describe("API-09 — query invalida nunca gera 500", () => {
  it("category/q em branco sao ignorados (filtro ausente)", async () => {
    const semFiltro = await call(products.GET, "/api/v1/products");
    const categoriaVazia = await call(
      products.GET,
      "/api/v1/products?category=",
    );
    const termoVazio = await call(products.GET, "/api/v1/products?q=%20");

    expect(categoriaVazia.res.status).toBe(200);
    expect(termoVazio.res.status).toBe(200);
    expect(categoriaVazia.body.data).toHaveLength(semFiltro.body.data.length);
    expect(termoVazio.body.data).toHaveLength(semFiltro.body.data.length);
  });

  it("product_id ausente ou malformado responde 400 invalid_product_id", async () => {
    const caminhos = [
      "/api/v1/prices",
      "/api/v1/prices?product_id=",
      "/api/v1/prices?product_id=abc",
      "/api/v1/prices?product_id=1.5",
      "/api/v1/prices?product_id=-1",
      "/api/v1/prices?product_id=999999999999999999999",
    ];

    for (const caminho of caminhos) {
      const { res, body } = await call(prices.GET, caminho);
      expect(res.status, caminho).toBe(400);
      expect(body.error.code).toBe("invalid_product_id");
      expect(res.status).toBeLessThan(500);
    }
  });

  it("produto sem oferta na cidade devolve 200 com resumo zerado", async () => {
    const { res, body } = await call(
      prices.GET,
      "/api/v1/prices?product_id=1&city=Atlantis",
    );

    expect(res.status).toBe(200);
    expect(body.data.ofertas).toEqual([]);
    expect(body.data.resumo).toEqual({
      menor_valor_centavos: null,
      vencedores: [],
      total_ofertas: 0,
      total_validas: 0,
      total_vencidas: 0,
    });
  });

  it("rota desconhecida sob /api/v1 responde 404 not_found no envelope", async () => {
    const { res, body } = await call(notFound.GET, "/api/v1/nao-existe");

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("not_found");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});

describe("UT-10 — unidades diferentes nao se misturam (RN10)", () => {
  it("P1 (5 kg) e P2 (1 kg) sao produtos distintos com rankings separados", async () => {
    // P2 nao tem preco no seed; inserimos um bem mais barato para provar que
    // ele NAO contamina o ranking do P1.
    db.prepare(
      `INSERT INTO price (id, market_id, product_id, valor_centavos, data_coleta, fonte)
       VALUES (201, 1, 2, 1200, ?, 'painel')`,
    ).run(hojeUtc());

    const p1 = await call(prices.GET, "/api/v1/prices?product_id=1");
    const p2 = await call(prices.GET, "/api/v1/prices?product_id=2");

    expect(p1.body.data.product.unidade).toBe("5 kg");
    expect(p2.body.data.product.unidade).toBe("1 kg");
    expect(p1.body.data.resumo.menor_valor_centavos).toBe(2750);
    expect(
      p1.body.data.ofertas.some((o: any) => o.price_id === 201),
    ).toBe(false);

    expect(p2.body.data.ofertas).toHaveLength(1);
    expect(p2.body.data.resumo.menor_valor_centavos).toBe(1200);
  });
});

describe("UT-11 — preco append-only (RN06)", () => {
  it("dois INSERTs geram dois registros e UPDATE e bloqueado pelo trigger", async () => {
    db.prepare(
      `INSERT INTO product (id, nome, categoria, unidade, ativo)
       VALUES (99, 'Produto Append', 'Teste', '1 un', 1)`,
    ).run();

    const inserir = db.prepare(
      `INSERT INTO price (id, market_id, product_id, valor_centavos, data_coleta, fonte)
       VALUES (?, 1, 99, ?, ?, 'painel')`,
    );
    inserir.run(901, 1000, hojeUtc());
    inserir.run(902, 1100, hojeUtc());

    const total = db
      .prepare("SELECT COUNT(*) AS total FROM price WHERE product_id = 99")
      .get() as { total: number };
    expect(total.total).toBe(2);

    expect(() =>
      db
        .prepare("UPDATE price SET valor_centavos = 999 WHERE id = 901")
        .run(),
    ).toThrow(/append-only/);

    const atual = db
      .prepare("SELECT valor_centavos FROM price WHERE id = 901")
      .get() as { valor_centavos: number };
    expect(atual.valor_centavos).toBe(1000);
  });
});
