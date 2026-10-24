/**
 * Testes de autenticação, sessão, API key e escrita de preço do lojista.
 *
 * IDs de TESTES.md: UT-09, UT-11, UT-12, UT-13, UT-14, SM-04, SM-05.
 * Banco isolado em arquivo temporário (schema real), relógio fixo injetado.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertMarketAccess,
  generateApiKey,
  hashApiKey,
  hashPassword,
  isDataColetaFutura,
  isValidISODate,
  parseValorParaCentavos,
  resolveSessionSecret,
  signSession,
  verifyPassword,
  verifySession,
  type SessionInput,
} from "./auth";
import {
  autenticarLojista,
  gerarApiKeyDaLoja,
  listarUltimaColetaPorProduto,
  normalizeNextPath,
  registrarPreco,
} from "../app/(merchant)/lojista/merchant";

const NOW = new Date("2026-10-24T12:00:00Z");
const SEGREDO = "segredo-de-teste-isolado";
const SESSAO_M1: SessionInput = { userId: 1, marketId: 1, role: "lojista" };
const SESSAO_M2: SessionInput = { userId: 2, marketId: 2, role: "lojista" };

let db: Database.Database;
let diretorio: string;

function criarBanco(): Database.Database {
  const conexao = new Database(path.join(diretorio, "teste.db"));
  conexao.pragma("foreign_keys = ON");
  const schema = fs.readFileSync(
    path.join(process.cwd(), "db", "schema.sql"),
    "utf8",
  );
  conexao.exec(schema);
  return conexao;
}

function semear(conexao: Database.Database): void {
  conexao
    .prepare(
      `INSERT INTO market (id, nome, endereco, bairro, cidade, ativo)
       VALUES (?, ?, ?, ?, ?, 1)`,
    )
    .run(1, "Mercado Centro", "Rua A, 100", "Centro", "Rio Branco/AC");
  conexao
    .prepare(
      `INSERT INTO market (id, nome, endereco, bairro, cidade, ativo)
       VALUES (?, ?, ?, ?, ?, 1)`,
    )
    .run(2, "Mercado Bosque", "Rua B, 200", "Bosque", "Rio Branco/AC");

  conexao
    .prepare(
      `INSERT INTO product (id, nome, categoria, unidade, ativo)
       VALUES (?, ?, ?, ?, 1)`,
    )
    .run(1, "Arroz Branco", "Grãos", "5 kg");
  conexao
    .prepare(
      `INSERT INTO product (id, nome, categoria, unidade, ativo)
       VALUES (?, ?, ?, ?, 1)`,
    )
    .run(2, "Feijão Carioca", "Grãos", "1 kg");
  conexao
    .prepare(
      `INSERT INTO product (id, nome, categoria, unidade, ativo)
       VALUES (?, ?, ?, ?, 0)`,
    )
    .run(3, "Leite Integral", "Laticínios", "1 L");

  const hashDemo = hashPassword("demo1234");
  conexao
    .prepare(
      `INSERT INTO user (id, email, senha_hash, role, market_id)
       VALUES (?, ?, ?, 'lojista', ?)`,
    )
    .run(1, "centro@demo.local", hashDemo, 1);
  conexao
    .prepare(
      `INSERT INTO user (id, email, senha_hash, role, market_id)
       VALUES (?, ?, ?, 'lojista', ?)`,
    )
    .run(2, "bosque@demo.local", hashDemo, 2);
  conexao
    .prepare(
      `INSERT INTO user (id, email, senha_hash, role, market_id)
       VALUES (?, ?, ?, 'consumidor', NULL)`,
    )
    .run(3, "consumidor@demo.local", hashDemo);
}

function contarPrecos(marketId: number): number {
  const linha = db
    .prepare("SELECT COUNT(*) AS total FROM price WHERE market_id = ?")
    .get(marketId) as { total: number };
  return linha.total;
}

beforeEach(() => {
  diretorio = fs.mkdtempSync(path.join(os.tmpdir(), "comparador-auth-"));
  db = criarBanco();
  semear(db);
});

afterEach(() => {
  db.close();
  fs.rmSync(diretorio, { recursive: true, force: true });
});

/* -------------------------------------------------------------------------- */
/* UT-14 / RNF03 — senha nunca em texto puro                                  */
/* -------------------------------------------------------------------------- */

describe("UT-14 — senha armazenada com hash (RNF03)", () => {
  it("gera hash no formato scrypt$saltHex$hashHex, sem a senha em texto", () => {
    const hash = hashPassword("demo1234");
    expect(hash).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(hash).not.toContain("demo1234");
    expect(hash.split("$")[2]).not.toBe("demo1234");
  });

  it("usa salt aleatório: a mesma senha gera hashes diferentes", () => {
    const primeiro = hashPassword("demo1234");
    const segundo = hashPassword("demo1234");
    expect(primeiro).not.toBe(segundo);
    expect(verifyPassword("demo1234", primeiro)).toBe(true);
    expect(verifyPassword("demo1234", segundo)).toBe(true);
  });

  it("aceita a senha correta e rejeita a errada", () => {
    const hash = hashPassword("demo1234");
    expect(verifyPassword("demo1234", hash)).toBe(true);
    expect(verifyPassword("demo12345", hash)).toBe(false);
    expect(verifyPassword("", hash)).toBe(false);
    expect(verifyPassword("DEMO1234", hash)).toBe(false);
  });

  it("hash malformado devolve false sem lançar", () => {
    const malformados = [
      "",
      "demo1234",
      "scrypt$",
      "scrypt$zz$zz",
      "scrypt$00$00",
      "bcrypt$00112233445566778899aabbccddeeff$" + "a".repeat(128),
      "scrypt$00112233445566778899aabbccddeeff$" + "a".repeat(127),
      "scrypt$00112233445566778899aabbccddeeff$" + "g".repeat(128),
    ];

    for (const hash of malformados) {
      expect(() => verifyPassword("demo1234", hash)).not.toThrow();
      expect(verifyPassword("demo1234", hash)).toBe(false);
    }
  });

  it("autentica somente lojista e rejeita senha errada ou perfil consumidor", () => {
    const ok = autenticarLojista(db, "centro@demo.local", "demo1234");
    expect(ok).toEqual({
      userId: 1,
      email: "centro@demo.local",
      marketId: 1,
    });

    expect(autenticarLojista(db, "centro@demo.local", "errada")).toBeNull();
    expect(
      autenticarLojista(db, "consumidor@demo.local", "demo1234"),
    ).toBeNull();
    expect(autenticarLojista(db, "naoexiste@demo.local", "demo1234")).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* UT-12 / RN07 — lojista não escreve em outro mercado                        */
/* -------------------------------------------------------------------------- */

describe("UT-12 — RN07 lojista de M1 não grava em M2", () => {
  it("assertMarketAccess aceita o próprio mercado e rejeita o alheio", () => {
    expect(assertMarketAccess(SESSAO_M1, 1)).toBe(1);
    expect(() => assertMarketAccess(SESSAO_M1, 2)).toThrow();
    expect(() =>
      assertMarketAccess(
        { role: "consumidor", marketId: null },
        1,
      ),
    ).toThrow();
    expect(() => assertMarketAccess(null, 1)).toThrow();
  });

  it("registrarPreco com marketIdAlvo de outro mercado não grava nada", () => {
    const resultado = registrarPreco({
      db,
      sessao: SESSAO_M1,
      marketIdAlvo: 2,
      entrada: { productId: 1, valorTexto: "28,90", dataColeta: "2026-10-24" },
      now: NOW,
    });

    expect(resultado.ok).toBe(false);
    expect(resultado.erros.some((erro) => erro.campo === "market_id")).toBe(
      true,
    );
    expect(contarPrecos(1)).toBe(0);
    expect(contarPrecos(2)).toBe(0);
  });

  it("SM-04 — grava só no mercado da sessão e não vaza para o outro", () => {
    const resultado = registrarPreco({
      db,
      sessao: SESSAO_M1,
      marketIdAlvo: SESSAO_M1.marketId as number,
      entrada: { productId: 1, valorTexto: "28,90", dataColeta: "2026-10-24" },
      now: NOW,
    });

    expect(resultado.ok).toBe(true);
    expect(contarPrecos(1)).toBe(1);
    expect(contarPrecos(2)).toBe(0);

    const doM1 = listarUltimaColetaPorProduto(db, 1);
    expect(doM1).toHaveLength(1);
    expect(doM1[0]).toMatchObject({
      productId: 1,
      produto: "Arroz Branco",
      unidade: "5 kg",
      valorCentavos: 2890,
      dataColeta: "2026-10-24",
      fonte: "painel",
    });
    expect(listarUltimaColetaPorProduto(db, 2)).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/* UT-13 / RN08 / RNF04 — API key só como hash, exibida uma vez               */
/* -------------------------------------------------------------------------- */

describe("UT-13 — API key guardada como SHA-256 (RN08, RNF04)", () => {
  it("generateApiKey produz 32 bytes em base64url e chaves distintas", () => {
    const primeira = generateApiKey();
    const segunda = generateApiKey();
    expect(primeira).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(segunda).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(primeira).not.toBe(segunda);
  });

  it("hashApiKey é SHA-256 determinístico em hex", () => {
    const chave = "chave-de-teste";
    const esperado = createHash("sha256").update(chave, "utf8").digest("hex");
    expect(hashApiKey(chave)).toBe(esperado);
    expect(hashApiKey(chave)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashApiKey(chave)).toBe(hashApiKey(chave));
  });

  it("grava apenas o hash e devolve o texto puro uma única vez", () => {
    const { chave, marketId } = gerarApiKeyDaLoja({
      db,
      sessao: SESSAO_M1,
      marketIdAlvo: 1,
    });

    const linha = db
      .prepare("SELECT api_key_hash FROM market WHERE id = ?")
      .get(marketId) as { api_key_hash: string | null };

    expect(linha.api_key_hash).toBe(hashApiKey(chave));
    expect(linha.api_key_hash).not.toBe(chave);
    expect(linha.api_key_hash?.includes(chave)).toBe(false);
    expect(chave).not.toBe("");

    // Recarregar a página lê só o hash: a chave não volta do banco.
    const relido = db
      .prepare("SELECT api_key_hash FROM market WHERE id = ?")
      .get(marketId) as { api_key_hash: string | null };
    expect(relido.api_key_hash).not.toContain(chave);
  });

  it("gerar outra chave revoga a anterior (o hash antigo é substituído)", () => {
    const primeira = gerarApiKeyDaLoja({
      db,
      sessao: SESSAO_M1,
      marketIdAlvo: 1,
    });
    const hashPrimeira = hashApiKey(primeira.chave);

    const segunda = gerarApiKeyDaLoja({
      db,
      sessao: SESSAO_M1,
      marketIdAlvo: 1,
    });
    const atual = db
      .prepare("SELECT api_key_hash FROM market WHERE id = ?")
      .get(1) as { api_key_hash: string };

    expect(atual.api_key_hash).toBe(hashApiKey(segunda.chave));
    expect(atual.api_key_hash).not.toBe(hashPrimeira);
    expect(segunda.chave).not.toBe(primeira.chave);
  });

  it("não loga a chave em texto puro nem o hash", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const erro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      const { chave } = gerarApiKeyDaLoja({
        db,
        sessao: SESSAO_M1,
        marketIdAlvo: 1,
      });
      const saida = [...log.mock.calls, ...erro.mock.calls, ...info.mock.calls, ...warn.mock.calls]
        .flat()
        .join(" ");
      expect(saida).not.toContain(chave);
      expect(saida).not.toContain(hashApiKey(chave));
    } finally {
      log.mockRestore();
      erro.mockRestore();
      info.mockRestore();
      warn.mockRestore();
    }
  });

  it("rejeita mercado alheio ao gerar API key (RN07)", () => {
    expect(() =>
      gerarApiKeyDaLoja({ db, sessao: SESSAO_M1, marketIdAlvo: 2 }),
    ).toThrow();

    const linha = db
      .prepare("SELECT api_key_hash FROM market WHERE id = 2")
      .get() as { api_key_hash: string | null };
    expect(linha.api_key_hash).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* Sessão — HMAC, adulteração e expiração                                     */
/* -------------------------------------------------------------------------- */

describe("sessão — assinatura HMAC e expiração de 8 h", () => {
  const opcoes = { secret: SEGREDO, now: NOW };

  it("assina e verifica o payload", () => {
    const token = signSession(SESSAO_M1, opcoes);
    expect(token.split(".")).toHaveLength(2);

    const payload = verifySession(token, opcoes);
    expect(payload).not.toBeNull();
    expect(payload?.userId).toBe(1);
    expect(payload?.marketId).toBe(1);
    expect(payload?.role).toBe("lojista");
    expect((payload?.exp ?? 0) - (payload?.iat ?? 0)).toBe(8 * 60 * 60);
  });

  it("token adulterado, assinatura de outro segredo ou formato inválido → null", () => {
    const token = signSession(SESSAO_M1, opcoes);
    const [payload, assinatura] = token.split(".");

    expect(verifySession(`${payload}.${assinatura}x`, opcoes)).toBeNull();
    expect(verifySession(token, { secret: "outro-segredo", now: NOW })).toBeNull();
    expect(verifySession("", opcoes)).toBeNull();
    expect(verifySession("sem-ponto", opcoes)).toBeNull();
    expect(verifySession("a.b.c", opcoes)).toBeNull();
    expect(verifySession(null, opcoes)).toBeNull();
  });

  it("token expirado (9 h depois) → null; 7 h depois ainda vale", () => {
    const token = signSession(SESSAO_M1, opcoes);

    const seteHoras = new Date(NOW.getTime() + 7 * 60 * 60 * 1000);
    expect(verifySession(token, { secret: SEGREDO, now: seteHoras })).not.toBeNull();

    const noveHoras = new Date(NOW.getTime() + 9 * 60 * 60 * 1000);
    expect(verifySession(token, { secret: SEGREDO, now: noveHoras })).toBeNull();
  });

  it("payload adulterado é recusado mesmo com assinatura preservada", () => {
    const token = signSession(SESSAO_M1, opcoes);
    const [, assinatura] = token.split(".");
    const falso = Buffer.from(
      JSON.stringify({
        userId: 1,
        marketId: 2,
        role: "lojista",
        iat: Math.floor(NOW.getTime() / 1000),
        exp: Math.floor(NOW.getTime() / 1000) + 3600,
      }),
      "utf8",
    ).toString("base64url");

    expect(verifySession(`${falso}.${assinatura}`, opcoes)).toBeNull();
  });

  it("produção sem SESSION_SECRET lança erro; dev usa fallback", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "");
    try {
      expect(() => resolveSessionSecret()).toThrow(/SESSION_SECRET/);
      expect(() => signSession(SESSAO_M1)).toThrow(/SESSION_SECRET/);
    } finally {
      vi.unstubAllEnvs();
    }

    expect(() => resolveSessionSecret()).not.toThrow();
  });
});

/* -------------------------------------------------------------------------- */
/* UT-09 / RN05 — data de coleta não pode ser futura                          */
/* -------------------------------------------------------------------------- */

describe("UT-09 — data_coleta futura é rejeitada na escrita (RN05)", () => {
  it("data de hoje é aceita; amanhã é rejeitada", () => {
    expect(isValidISODate("2026-10-24")).toBe(true);
    expect(isValidISODate("2026-02-30")).toBe(false);
    expect(isDataColetaFutura("2026-10-24", NOW)).toBe(false);
    expect(isDataColetaFutura("2026-10-25", NOW)).toBe(true);
  });

  it("registrarPreco rejeita data futura sem inserir", () => {
    const resultado = registrarPreco({
      db,
      sessao: SESSAO_M1,
      marketIdAlvo: 1,
      entrada: {
        productId: 1,
        valorTexto: "28,90",
        dataColeta: "2026-10-25",
      },
      now: NOW,
    });

    expect(resultado.ok).toBe(false);
    expect(resultado.erros).toContainEqual({
      campo: "data_coleta",
      mensagem: "A data de coleta não pode ser futura.",
    });
    expect(contarPrecos(1)).toBe(0);
  });

  it("registrarPreco aceita a data de hoje", () => {
    const resultado = registrarPreco({
      db,
      sessao: SESSAO_M1,
      marketIdAlvo: 1,
      entrada: {
        productId: 1,
        valorTexto: "28,90",
        dataColeta: "2026-10-24",
      },
      now: NOW,
    });

    expect(resultado.ok).toBe(true);
    expect(contarPrecos(1)).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */
/* UT-11 / RN06 — append-only                                                 */
/* -------------------------------------------------------------------------- */

describe("UT-11 — atualizar preço cria novo registro (RN06)", () => {
  it("dois registros coexistem e o primeiro permanece intacto", () => {
    const primeiro = registrarPreco({
      db,
      sessao: SESSAO_M1,
      marketIdAlvo: 1,
      entrada: { productId: 1, valorTexto: "28,90", dataColeta: "2026-10-24" },
      now: NOW,
    });
    const segundo = registrarPreco({
      db,
      sessao: SESSAO_M1,
      marketIdAlvo: 1,
      entrada: { productId: 1, valorTexto: "27,50", dataColeta: "2026-10-24" },
      now: new Date(NOW.getTime() + 60_000),
    });

    expect(primeiro.ok).toBe(true);
    expect(segundo.ok).toBe(true);
    expect(segundo.priceId).not.toBe(primeiro.priceId);
    expect(contarPrecos(1)).toBe(2);

    const registros = db
      .prepare(
        "SELECT valor_centavos FROM price WHERE market_id = 1 ORDER BY id ASC",
      )
      .all() as { valor_centavos: number }[];
    expect(registros.map((r) => r.valor_centavos)).toEqual([2890, 2750]);
  });

  it("SM-05 — a última coleta reflete o novo valor sem apagar o histórico", () => {
    registrarPreco({
      db,
      sessao: SESSAO_M1,
      marketIdAlvo: 1,
      entrada: { productId: 1, valorTexto: "28,90", dataColeta: "2026-10-24" },
      now: NOW,
    });
    registrarPreco({
      db,
      sessao: SESSAO_M1,
      marketIdAlvo: 1,
      entrada: { productId: 1, valorTexto: "27,50", dataColeta: "2026-10-24" },
      now: new Date(NOW.getTime() + 60_000),
    });

    const lista = listarUltimaColetaPorProduto(db, 1);
    const arroz = lista.find((item) => item.productId === 1);
    expect(arroz?.valorCentavos).toBe(2750);
    expect(contarPrecos(1)).toBe(2);
  });
});

/* -------------------------------------------------------------------------- */
/* RN09 — parsing de valor em centavos, sem float                             */
/* -------------------------------------------------------------------------- */

describe("RN09 — valor em centavos sem arredondamento", () => {
  it.each<[string, number]>([
    ["28,90", 2890],
    ["28.90", 2890],
    ["1.234,56", 123456],
    ["R$ 28,90", 2890],
    ["1,234.56", 123456],
    ["10", 1000],
    ["0,99", 99],
    ["2.750,00", 275000],
  ])("converte %s em %i centavos", (texto, esperado) => {
    const valor = parseValorParaCentavos(texto);
    expect(valor).toBe(esperado);
    expect(Number.isInteger(valor)).toBe(true);
  });

  it.each<string>([
    "0",
    "0,00",
    "-1",
    "-1,00",
    "abc",
    "",
    "R$",
    "1,234",
    "1.2345",
    ".50",
    "50,",
  ])("rejeita %s", (texto) => {
    expect(parseValorParaCentavos(texto)).toBeNull();
  });

  it("registrarPreco grava inteiro em centavos (sem float)", () => {
    const resultado = registrarPreco({
      db,
      sessao: SESSAO_M1,
      marketIdAlvo: 1,
      entrada: {
        productId: 1,
        valorTexto: "1.234,56",
        dataColeta: "2026-10-24",
      },
      now: NOW,
    });

    expect(resultado.ok).toBe(true);
    const linha = db
      .prepare("SELECT valor_centavos FROM price WHERE id = ?")
      .get(resultado.priceId) as { valor_centavos: number };
    expect(linha.valor_centavos).toBe(123456);
    expect(Number.isInteger(linha.valor_centavos)).toBe(true);
  });

  it("rejeita valor inválido sem inserir", () => {
    const resultado = registrarPreco({
      db,
      sessao: SESSAO_M1,
      marketIdAlvo: 1,
      entrada: { productId: 1, valorTexto: "-1", dataColeta: "2026-10-24" },
      now: NOW,
    });

    expect(resultado.ok).toBe(false);
    expect(resultado.erros.some((erro) => erro.campo === "valor")).toBe(true);
    expect(contarPrecos(1)).toBe(0);
  });

  it("rejeita produto inexistente ou inativo", () => {
    const inexistente = registrarPreco({
      db,
      sessao: SESSAO_M1,
      marketIdAlvo: 1,
      entrada: { productId: 999, valorTexto: "10,00", dataColeta: "2026-10-24" },
      now: NOW,
    });
    const inativo = registrarPreco({
      db,
      sessao: SESSAO_M1,
      marketIdAlvo: 1,
      entrada: { productId: 3, valorTexto: "10,00", dataColeta: "2026-10-24" },
      now: NOW,
    });

    expect(inexistente.ok).toBe(false);
    expect(inativo.ok).toBe(false);
    expect(contarPrecos(1)).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Redirecionamento seguro pós-login                                          */
/* -------------------------------------------------------------------------- */

describe("normalizeNextPath — apenas caminho interno", () => {
  it("aceita caminho interno e recusa URL absoluta/protocol-relative", () => {
    expect(normalizeNextPath("/lojista")).toBe("/lojista");
    expect(normalizeNextPath("/lojista?aba=precos")).toBe("/lojista?aba=precos");
    expect(normalizeNextPath("https://evil.example")).toBe("/lojista");
    expect(normalizeNextPath("//evil.example")).toBe("/lojista");
    expect(normalizeNextPath("/\\evil.example")).toBe("/lojista");
    expect(normalizeNextPath("/lojista/login")).toBe("/lojista");
    expect(normalizeNextPath(undefined)).toBe("/lojista");
    expect(normalizeNextPath(42)).toBe("/lojista");
  });
});
