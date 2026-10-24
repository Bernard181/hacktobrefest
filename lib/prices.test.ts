/**
 * UT-01..UT-10 e UT-15 — regras de negocio de `lib/prices.ts`.
 * Fixtures da secao 3 de TESTES.md, relogio fixo `AGORA`.
 */
import { describe, expect, it } from "vitest";

import {
  cheapestOffers,
  daysSinceCollection,
  formatBRL,
  isFutureDate,
  isPriceValid,
  rankOffers,
  validatePriceInput,
  type OfertaComMercado,
} from "./prices";

const NOW = new Date("2026-10-24T12:00:00Z");

function diasAtras(dias: number): string {
  return new Date(NOW.getTime() - dias * 86_400_000).toISOString().slice(0, 10);
}

function oferta(
  price_id: number,
  market_id: number,
  market_nome: string,
  market_endereco: string,
  market_bairro: string,
  valor_centavos: number,
  data_coleta: string,
): OfertaComMercado {
  return {
    price_id,
    market_id,
    market_nome,
    market_endereco,
    market_bairro,
    market_cidade: "Rio Branco/AC",
    valor_centavos,
    data_coleta,
    fonte: "painel",
  };
}

// P1 — Arroz Branco 5 kg. M3 vencido (34 dias, TESTES.md secao 3).
const P1: OfertaComMercado[] = [
  oferta(101, 1, "Mercado Centro", "Rua A, 100", "Centro", 2890, "2026-10-24"),
  oferta(102, 2, "Mercado Bosque", "Rua B, 200", "Bosque", 2750, "2026-10-23"),
  oferta(103, 3, "Mercado Floresta", "Rua C, 300", "Floresta", 2650, "2026-09-20"),
];

// P4 — Feijão Carioca 1 kg: empate 1990, M2 mais recente.
const P4: OfertaComMercado[] = [
  oferta(104, 1, "Mercado Centro", "Rua A, 100", "Centro", 1990, "2026-10-20"),
  oferta(105, 2, "Mercado Bosque", "Rua B, 200", "Bosque", 1990, "2026-10-22"),
];

describe("RN01 — validade de 30 dias", () => {
  it("UT-01 — aceita coleta de 29 dias", () => {
    expect(isPriceValid({ data_coleta: diasAtras(29) }, NOW)).toBe(true);
  });

  it("UT-02 — aceita exatamente 30 dias (limite inclusivo)", () => {
    expect(isPriceValid({ data_coleta: diasAtras(30) }, NOW)).toBe(true);
  });

  it("UT-03 — rejeita 31 dias", () => {
    expect(isPriceValid({ data_coleta: diasAtras(31) }, NOW)).toBe(false);
  });

  it("UT-03 — 34 dias (fixture do M3) tambem e invalido", () => {
    expect(isPriceValid({ data_coleta: "2026-09-20" }, NOW)).toBe(false);
  });

  it("compara por dia de calendario UTC, ignorando a hora de `now`", () => {
    const fimDoDia = new Date("2026-10-24T23:59:59Z");
    expect(isPriceValid({ data_coleta: "2026-09-24" }, fimDoDia)).toBe(true);
    expect(isPriceValid({ data_coleta: "2026-09-23" }, fimDoDia)).toBe(false);
  });

  it("data futura e invalida (RN05)", () => {
    expect(isPriceValid({ data_coleta: "2026-10-30" }, NOW)).toBe(false);
  });

  it("data inexistente no calendario e invalida", () => {
    expect(isPriceValid({ data_coleta: "2026-02-30" }, NOW)).toBe(false);
  });
});

describe("RN01/RN02 — ranking de P1", () => {
  it("UT-04 — exclui o M3 vencido e elege o M2 (2750)", () => {
    const ranking = rankOffers(P1, NOW);

    expect(ranking.map((o) => o.market_nome)).toEqual([
      "Mercado Bosque",
      "Mercado Centro",
      "Mercado Floresta",
    ]);
    expect(ranking[0].valor_centavos).toBe(2750);
    expect(ranking.filter((o) => o.valido)).toHaveLength(2);

    const vencedoras = cheapestOffers(ranking);
    expect(vencedoras).toHaveLength(1);
    expect(vencedoras[0].market_id).toBe(2);
  });

  it("UT-05 — preco vencido continua visivel, com valido:false e posicao null", () => {
    const ranking = rankOffers(P1, NOW);
    const vencido = ranking.find((o) => o.price_id === 103);

    expect(vencido).toBeDefined();
    expect(vencido?.valido).toBe(false);
    expect(vencido?.posicao).toBeNull();
    expect(vencido?.dias_desde_coleta).toBe(34);
    expect(ranking[ranking.length - 1].price_id).toBe(103);
  });

  it("posicao e 1-based apenas entre as validas", () => {
    const ranking = rankOffers(P1, NOW);
    expect(ranking.map((o) => o.posicao)).toEqual([1, 2, null]);
  });

  it("nao muta o array recebido", () => {
    const original = [...P1];
    rankOffers(P1, NOW);
    expect(P1).toEqual(original);
    expect(P1.map((o) => o.market_nome)).toEqual([
      "Mercado Centro",
      "Mercado Bosque",
      "Mercado Floresta",
    ]);
  });

  it("desempate final por market_nome asc quando valor, data e validade empatam", () => {
    const ranking = rankOffers(
      [
        oferta(12, 2, "Mercado Bosque", "Rua B, 200", "Bosque", 1000, "2026-10-24"),
        oferta(11, 1, "Mercado Centro", "Rua A, 100", "Centro", 1000, "2026-10-24"),
      ],
      NOW,
    );
    expect(ranking.map((o) => o.market_nome)).toEqual([
      "Mercado Bosque",
      "Mercado Centro",
    ]);
  });
});

describe("RN03 — empate", () => {
  it("UT-06 — retorna M1 e M2, com o mais recente (M2) primeiro", () => {
    const ranking = rankOffers(P4, NOW);
    expect(ranking.map((o) => o.market_id)).toEqual([2, 1]);

    const vencedoras = cheapestOffers(ranking);
    expect(vencedoras.map((o) => o.market_id)).toEqual([2, 1]);
    expect(vencedoras.every((o) => o.valor_centavos === 1990)).toBe(true);
  });
});

describe("RN09 — dinheiro em centavos inteiros", () => {
  it("UT-07 — formata 2890 centavos como 'R$ 28,90'", () => {
    expect(formatBRL(2890)).toBe("R$ 28,90");
  });

  it("UT-07 — formata zero e valores com milhar", () => {
    expect(formatBRL(0)).toBe("R$ 0,00");
    expect(formatBRL(5)).toBe("R$ 0,05");
    expect(formatBRL(100)).toBe("R$ 1,00");
    expect(formatBRL(123456)).toBe("R$ 1.234,56");
  });

  it("UT-07 — entrada invalida lanca RangeError", () => {
    expect(() => formatBRL(-1)).toThrow(RangeError);
    expect(() => formatBRL(12.5)).toThrow(RangeError);
    expect(() => formatBRL(Number.NaN)).toThrow(RangeError);
  });

  it("UT-08 — somar e comparar centavos nao gera artefato de float", () => {
    const total = 2890 + 2750;

    expect(Number.isInteger(total)).toBe(true);
    expect(total).toBe(5640);
    expect(formatBRL(total)).toBe("R$ 56,40");
    expect(1990 * 3).toBe(5970);
    expect(formatBRL(1990 + 1990)).toBe("R$ 39,80");
  });
});

describe("RN05 — data de coleta nao futura", () => {
  it("UT-09 — rejeita data futura na escrita", () => {
    const erros = validatePriceInput(
      { valor_centavos: 2890, data_coleta: "2026-10-30" },
      NOW,
    );

    expect(erros).toHaveLength(1);
    expect(erros[0].campo).toBe("data_coleta");
    expect(erros[0].mensagem).toMatch(/futura/i);
    expect(isFutureDate("2026-10-30", NOW)).toBe(true);
  });

  it("UT-09 — aceita hoje e o limite de 30 dias", () => {
    expect(validatePriceInput({ valor_centavos: 2890, data_coleta: "2026-10-24" }, NOW)).toEqual([]);
    expect(validatePriceInput({ valor_centavos: 2890, data_coleta: diasAtras(30) }, NOW)).toEqual([]);
  });

  it("UT-09 — rejeita valor nao inteiro ou <= 0 (RN09)", () => {
    for (const valor of [0, -10, 12.5, "2890", null]) {
      const erros = validatePriceInput(
        { valor_centavos: valor, data_coleta: "2026-10-24" },
        NOW,
      );
      expect(erros.some((erro) => erro.campo === "valor_centavos")).toBe(true);
    }
  });

  it("UT-09 — rejeita data malformada ou inexistente", () => {
    for (const data of ["24/10/2026", "2026-13-01", "2026-02-30", "", null]) {
      const erros = validatePriceInput(
        { valor_centavos: 2890, data_coleta: data },
        NOW,
      );
      expect(erros.some((erro) => erro.campo === "data_coleta")).toBe(true);
    }
  });
});

describe("RN10 — unidades diferentes nao entram no mesmo ranking", () => {
  it("UT-10 — P1 (5 kg) e P2 (1 kg) tem rankings independentes", () => {
    // Ofertas de P2 (Arroz Branco 1 kg) — outra unidade, outro product_id.
    const P2: OfertaComMercado[] = [
      oferta(201, 1, "Mercado Centro", "Rua A, 100", "Centro", 1200, "2026-10-24"),
    ];

    const rankingP1 = rankOffers(P1, NOW);
    const rankingP2 = rankOffers(P2, NOW);

    expect(rankingP1).toHaveLength(3);
    expect(rankingP1.some((o) => o.price_id === 201)).toBe(false);
    expect(cheapestOffers(rankingP1)[0].valor_centavos).toBe(2750);

    expect(rankingP2).toHaveLength(1);
    expect(cheapestOffers(rankingP2)[0].valor_centavos).toBe(1200);
  });
});

describe("RF01 — busca sem resultados", () => {
  it("UT-15 — lista vazia devolve [] sem erro", () => {
    expect(rankOffers([], NOW)).toEqual([]);
    expect(cheapestOffers([])).toEqual([]);
  });
});

describe("dias desde a coleta", () => {
  it("conta dias inteiros em UTC (0 = hoje) e aceita data futura (negativo)", () => {
    expect(daysSinceCollection("2026-10-24", NOW)).toBe(0);
    expect(daysSinceCollection("2026-10-23", NOW)).toBe(1);
    expect(daysSinceCollection("2026-09-20", NOW)).toBe(34);
    expect(daysSinceCollection("2026-10-30", NOW)).toBe(-6);
  });
});
