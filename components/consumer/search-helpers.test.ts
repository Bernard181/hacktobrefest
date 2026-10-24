/**
 * Helpers puros da busca do consumidor (Vitest, ambiente node, sem DOM).
 *
 * Cobre o que é nosso: montagem de URL sem filtros vazios (RF01/SM-01),
 * data de coleta em pt-BR (RF03), selo de preço vencido (SM-03/MV-05),
 * categorias derivadas do catálogo da API (RF01/MV-04) e delegação da
 * moeda a `formatBRL` (RN09/SM-02).
 *
 * Ranking, validade e posição NÃO são testados aqui: vêm prontos da API
 * (docs/api.md) e são responsabilidade de lib/prices.ts + backend.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DATA_INVALIDA,
  buildPricesUrl,
  buildProductsQuery,
  buildProductsUrl,
  deriveCategories,
  descreverSelo,
  formatarDataColeta,
  formatarPreco,
} from "./search-helpers";
import type { Product } from "./types";

const PRODUTOS: Product[] = [
  {
    id: 1,
    nome: "Arroz Branco",
    categoria: "Grãos",
    unidade: "5 kg",
    ean: null,
    ativo: true,
  },
  {
    id: 2,
    nome: "Arroz Branco",
    categoria: "Grãos",
    unidade: "1 kg",
    ean: null,
    ativo: true,
  },
  {
    id: 3,
    nome: "Leite Integral",
    categoria: "Laticínios",
    unidade: "1 L",
    ean: null,
    ativo: true,
  },
  {
    id: 4,
    nome: "Feijão Carioca",
    categoria: "Grãos",
    unidade: "1 kg",
    ean: null,
    ativo: true,
  },
];

describe("RF01/SM-01 — busca sem login por nome e categoria", () => {
  it("envia q e category quando preenchidos", () => {
    expect(buildProductsQuery({ q: "arroz", category: "Grãos" })).toBe(
      "q=arroz&category=Gr%C3%A3os",
    );
  });

  it("omite parâmetros vazios (a API ignora, mas não enviamos lixo)", () => {
    expect(buildProductsQuery({ q: "", category: "" })).toBe("");
    expect(buildProductsQuery({})).toBe("");
    expect(buildProductsQuery({ q: "   ", category: "  " })).toBe("");
    expect(buildProductsUrl({ q: "", category: "" })).toBe("/api/v1/products");
    expect(buildProductsUrl()).toBe("/api/v1/products");
  });

  it("omite só o filtro em branco e preserva o outro", () => {
    expect(buildProductsQuery({ q: "leite", category: "" })).toBe("q=leite");
    expect(buildProductsQuery({ q: "", category: "Laticínios" })).toBe(
      "category=Latic%C3%ADnios",
    );
  });

  it("aplica trim antes de montar a query", () => {
    expect(buildProductsQuery({ q: "  arroz ", category: " Grãos " })).toBe(
      "q=arroz&category=Gr%C3%A3os",
    );
  });

  it("RF12/SM-06 — consulta as ofertas pelo product_id inteiro", () => {
    expect(buildPricesUrl(1)).toBe("/api/v1/prices?product_id=1");
    expect(buildPricesUrl(42)).toBe("/api/v1/prices?product_id=42");
  });
});

describe("RF03 — data de coleta em dd/mm/aaaa", () => {
  it("converte ISO YYYY-MM-DD sem deslocar o dia por fuso", () => {
    expect(formatarDataColeta("2026-10-24")).toBe("24/10/2026");
    expect(formatarDataColeta("2026-09-20")).toBe("20/09/2026");
    expect(formatarDataColeta("2026-01-01")).toBe("01/01/2026");
  });

  it("devolve rótulo de data inválida para entrada malformada ou impossível", () => {
    expect(formatarDataColeta("")).toBe(DATA_INVALIDA);
    expect(formatarDataColeta("   ")).toBe(DATA_INVALIDA);
    expect(formatarDataColeta("24/10/2026")).toBe(DATA_INVALIDA);
    expect(formatarDataColeta("2026-13-01")).toBe(DATA_INVALIDA);
    expect(formatarDataColeta("2026-02-30")).toBe(DATA_INVALIDA);
    expect(formatarDataColeta("2026-10-24T12:00:00Z")).toBe(DATA_INVALIDA);
    expect(formatarDataColeta(null)).toBe(DATA_INVALIDA);
    expect(formatarDataColeta(undefined)).toBe(DATA_INVALIDA);
  });
});

describe("SM-03/MV-05 — selo de preço desatualizado e posição no ranking", () => {
  it("marca valido=false como Desatualizado e fora do ranking (posicao null)", () => {
    const estado = descreverSelo({ valido: false, posicao: null });

    expect(estado.desatualizado).toBe(true);
    expect(estado.foraDoRanking).toBe(true);
    expect(estado.maisBarato).toBe(false);
    expect(estado.selo).toBe("Desatualizado");
    expect(estado.textoAcessivel).toContain("Fora do ranking");
  });

  it("destaca Mais barato apenas para a posição 1 válida", () => {
    const vencedora = descreverSelo({ valido: true, posicao: 1 });
    expect(vencedora.selo).toBe("Mais barato");
    expect(vencedora.maisBarato).toBe(true);
    expect(vencedora.desatualizado).toBe(false);
    expect(vencedora.foraDoRanking).toBe(false);
    expect(vencedora.textoAcessivel).toBeTruthy();

    const segunda = descreverSelo({ valido: true, posicao: 2 });
    expect(segunda.selo).toBeNull();
    expect(segunda.maisBarato).toBe(false);
    expect(segunda.desatualizado).toBe(false);
  });

  it("nunca deixa preço vencido vencer o ranking, mesmo com posicao=1", () => {
    const estado = descreverSelo({ valido: false, posicao: 1 });
    expect(estado.selo).toBe("Desatualizado");
    expect(estado.maisBarato).toBe(false);
  });
});

describe("RF01/MV-04 — categorias derivadas do catálogo sem filtro", () => {
  it("devolve categorias únicas e ordenadas em pt-BR", () => {
    expect(deriveCategories(PRODUTOS)).toEqual(["Grãos", "Laticínios"]);
  });

  it("não altera a lista original recebida", () => {
    const lista = [...PRODUTOS];
    deriveCategories(lista);
    expect(lista).toEqual(PRODUTOS);
  });

  it("ignora categoria em branco e catálogo vazio (estado vazio)", () => {
    const comBranco: Product[] = [
      ...PRODUTOS,
      { ...PRODUTOS[0], id: 99, categoria: "   " },
    ];

    expect(deriveCategories(comBranco)).toEqual(["Grãos", "Laticínios"]);
    expect(deriveCategories([])).toEqual([]);
  });
});

describe("RN09/SM-02 — moeda inteira em centavos, formatada por formatBRL", () => {
  it("formata 2890 centavos como R$ 28,90 sem passar por float", () => {
    expect(formatarPreco(2890)).toBe("R$ 28,90");
  });

  it("formata valores com milhar e centavos exatos", () => {
    expect(formatarPreco(2750)).toBe("R$ 27,50");
    expect(formatarPreco(123456)).toBe("R$ 1.234,56");
  });

  it("não converte centavos para reais na mão (nem /100, nem toFixed)", () => {
    const fonte = fs.readFileSync(
      path.join(process.cwd(), "components", "consumer", "search-helpers.ts"),
      "utf8",
    );

    expect(fonte).toContain("formatBRL(");
    expect(fonte).not.toMatch(/\/\s*100/);
    expect(fonte).not.toMatch(/toFixed\s*\(/);
    expect(fonte).not.toMatch(/parseFloat\s*\(/);
  });
});
