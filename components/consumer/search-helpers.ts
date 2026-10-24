/**
 * Helpers puros da busca do consumidor (RF01–RF05, RN09, RN10).
 *
 * Sem React, sem DOM e sem fetch: tudo aqui roda no Vitest em ambiente node.
 * Ranking e validade NÃO moram aqui — vêm prontos de GET /api/v1/prices
 * (`valido`, `posicao`, ordem das ofertas). Este módulo só monta URLs,
 * formata data/selo, deriva categorias do catálogo e delega moeda a
 * `formatBRL` de `lib/prices.ts` (RN09).
 */

import { formatBRL } from "@/lib/prices";
import type { Offer, Product } from "./types";

/** Filtros da busca por nome (q) e categoria (RF01). */
export interface FiltroBusca {
  q?: string | null;
  category?: string | null;
}

function normalizar(valor: string | null | undefined): string {
  return valor?.trim() ?? "";
}

/**
 * RF01 — query string de GET /api/v1/products sem parâmetros vazios.
 * A API ignora `?q=&category=`; aqui o filtro em branco nem é enviado.
 */
export function buildProductsQuery(filtro: FiltroBusca): string {
  const params = new URLSearchParams();
  const q = normalizar(filtro.q);
  const category = normalizar(filtro.category);

  if (q) params.set("q", q);
  if (category) params.set("category", category);

  return params.toString();
}

/** URL do catálogo; sem filtros, sem `?` sobrando. */
export function buildProductsUrl(
  filtro: FiltroBusca = {},
  base = "/api/v1/products",
): string {
  const query = buildProductsQuery(filtro);
  return query ? `${base}?${query}` : base;
}

/** RF12 — URL das ofertas de um produto (a ordenação vem do servidor). */
export function buildPricesUrl(
  productId: number,
  base = "/api/v1/prices",
): string {
  const params = new URLSearchParams();
  params.set("product_id", String(productId));
  return `${base}?${params.toString()}`;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const DATA_INVALIDA = "Data inválida";

/**
 * RF03 — `2026-10-24` -> `24/10/2026`, sem `new Date` local para não
 * deslocar o dia por causa de fuso. Entrada fora do padrão (ou data
 * impossível, como 2026-02-30) devolve `DATA_INVALIDA`.
 */
export function formatarDataColeta(
  dataColeta: string | null | undefined,
): string {
  if (typeof dataColeta !== "string") return DATA_INVALIDA;

  const match = ISO_DATE.exec(dataColeta.trim());
  if (!match) return DATA_INVALIDA;

  const [, anoTexto, mesTexto, diaTexto] = match;
  const ano = Number(anoTexto);
  const mes = Number(mesTexto);
  const dia = Number(diaTexto);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  const existe =
    data.getUTCFullYear() === ano &&
    data.getUTCMonth() === mes - 1 &&
    data.getUTCDate() === dia;

  if (!existe) return DATA_INVALIDA;

  return `${diaTexto}/${mesTexto}/${anoTexto}`;
}

/** Estado visual de uma oferta, derivado só do que a API devolve. */
export interface EstadoSelo {
  /** RN04 — preço vencido (> 30 dias) continua visível, sinalizado. */
  desatualizado: boolean;
  /** RN04 — vencido nunca ocupa posição de ranking. */
  foraDoRanking: boolean;
  /** RN02 — vencedor(es) do ranking de menor preço. */
  maisBarato: boolean;
  selo: "Desatualizado" | "Mais barato" | null;
  textoAcessivel: string | null;
}

/**
 * SM-03/MV-05 — decide o selo a partir de `valido`/`posicao` da API.
 * A UI não recalcula validade (RN01 é exclusiva de `lib/prices.ts`).
 */
export function descreverSelo(
  oferta: Pick<Offer, "valido" | "posicao">,
): EstadoSelo {
  const desatualizado = oferta.valido === false;
  const foraDoRanking = oferta.posicao === null;
  const maisBarato = !desatualizado && oferta.posicao === 1;

  if (desatualizado) {
    return {
      desatualizado,
      foraDoRanking,
      maisBarato: false,
      selo: "Desatualizado",
      textoAcessivel:
        "Preço desatualizado: coleta com mais de 30 dias. Fora do ranking de menor preço.",
    };
  }

  if (maisBarato) {
    return {
      desatualizado,
      foraDoRanking,
      maisBarato,
      selo: "Mais barato",
      textoAcessivel: "Oferta mais barata entre as válidas.",
    };
  }

  return {
    desatualizado,
    foraDoRanking,
    maisBarato: false,
    selo: null,
    textoAcessivel: null,
  };
}

/** RF01 — categorias únicas do catálogo SEM filtro, ordenadas em pt-BR. */
export function deriveCategories(products: readonly Product[]): string[] {
  const categorias = new Set<string>();

  for (const produto of products) {
    const categoria = normalizar(produto.categoria);
    if (categoria) categorias.add(categoria);
  }

  return [...categorias].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/**
 * RN09 — centavos inteiros -> texto. A única conversão de moeda é
 * `formatBRL`: aqui não existe divisão nem aritmética de ponto flutuante.
 */
export function formatarPreco(valorCentavos: number): string {
  return formatBRL(valorCentavos);
}
