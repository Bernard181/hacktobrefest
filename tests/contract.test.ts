/**
 * Contrato da fase 0 (Integrador).
 *
 * Garante que a superficie publicada em lib/prices.ts, o schema e docs/api.md
 * nao divergem. Quando o Backend implementar as funcoes, estes testes devem
 * continuar verdes — eles guardam o contrato, nao o comportamento (RN01–RN10
 * ficam em lib/prices.test.ts, com UT-01..UT-15 de TESTES.md).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as prices from "../lib/prices";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("contrato — lib/prices.ts", () => {
  it("expoe a janela de validade de 30 dias (RN01)", () => {
    expect(prices.VALIDADE_DIAS).toBe(30);
  });

  it("expoe a cidade fixa do MVP", () => {
    expect(prices.CIDADE_PADRAO).toBe("Rio Branco/AC");
  });

  it("expoe as regras como funcoes", () => {
    const funcoes = [
      "isPriceValid",
      "isFutureDate",
      "daysSinceCollection",
      "rankOffers",
      "cheapestOffers",
      "formatBRL",
      "validatePriceInput",
    ] as const;

    for (const nome of funcoes) {
      expect(typeof prices[nome], `${nome} deve existir`).toBe("function");
    }
  });

  it("nao aceita relogio global: as regras recebem `now` (testabilidade)", () => {
    const fonte = read(path.join("lib", "prices.ts"));
    const assinaturas = fonte.match(/export function [^)]+\)/g) ?? [];
    expect(assinaturas.length).toBeGreaterThan(0);
    for (const assinatura of assinaturas) {
      // Funcoes puras sem dependencia de tempo: formatacao e selecao do vencedor.
      if (/formatBRL|cheapestOffers/.test(assinatura)) continue;
      expect(assinatura).toContain("now");
    }
    expect(prices.formatBRL.length).toBe(1);
  });
});

describe("contrato — db/schema.sql", () => {
  const schema = read(path.join("db", "schema.sql"));

  it("tem as quatro tabelas da secao 7 do REQUISITOS.md", () => {
    for (const tabela of ["market", "product", "price", "user"]) {
      expect(schema).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS ${tabela}\\b`));
    }
  });

  it("guarda dinheiro em centavos inteiros (RN09)", () => {
    expect(schema).toContain("valor_centavos INTEGER NOT NULL");
  });

  it("proibe UPDATE/DELETE em price (RN06 append-only)", () => {
    expect(schema).toMatch(/BEFORE UPDATE ON price/);
    expect(schema).toMatch(/BEFORE DELETE ON price/);
  });

  it("guarda apenas hash da API key (RN08)", () => {
    expect(schema).toContain("api_key_hash");
    expect(schema).not.toMatch(/\bapi_key\s+TEXT/);
  });

  it("exige market_id para lojista e proibe para consumidor (RN07)", () => {
    expect(schema).toMatch(/role <> 'lojista' OR market_id IS NOT NULL/);
    expect(schema).toMatch(/role <> 'consumidor' OR market_id IS NULL/);
  });

  it("cria o indice de ranking price(product_id, data_coleta)", () => {
    expect(schema).toMatch(/price \(product_id, data_coleta DESC\)/);
    expect(schema).toMatch(/product \(categoria\)/);
  });
});

describe("contrato — docs/api.md", () => {
  const doc = read(path.join("docs", "api.md"));

  it("documenta os tres GETs publicos (RF11–RF13)", () => {
    for (const rota of ["/api/v1/products", "/api/v1/prices", "/api/v1/markets"]) {
      expect(doc).toContain(rota);
    }
  });

  it("declara CORS liberado e leitura sem auth (RF14)", () => {
    expect(doc).toMatch(/Access-Control-Allow-Origin/);
    expect(doc).toMatch(/sem autentica/i);
  });
});
