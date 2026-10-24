/**
 * GET /api/v1/prices?product_id=&city= — ofertas de UM produto na cidade,
 * ja ordenadas pela regra de ranking (RN01–RN04). Contrato: docs/api.md (RF12).
 *
 * DONO: agente Backend/Dados. A validade/ordenacao vem SEMPRE de
 * `lib/prices.ts`; o SQL apenas filtra produto/cidade e pega a coleta mais
 * recente por mercado (RN06: o historico continua no banco, mas nao na API).
 */

import type { NextRequest } from "next/server";

import { getDb } from "@/lib/db";
import {
  CIDADE_PADRAO,
  cheapestOffers,
  rankOffers,
  type OfertaComMercado,
} from "@/lib/prices";

import {
  fail,
  isoUtcSeconds,
  ok,
  preflight,
  queryParam,
} from "../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ProductRow {
  id: number;
  nome: string;
  categoria: string;
  unidade: string;
  ean: string | null;
  ativo: number;
}

/**
 * Ultima coleta de cada mercado para o produto, dentro da cidade.
 * Empate de `data_coleta` -> maior `id` (registro mais novo, RN06).
 */
const ULTIMA_COLETA_POR_MERCADO = `
  SELECT price_id, market_id, market_nome, market_endereco, market_bairro,
         market_cidade, valor_centavos, data_coleta, fonte
    FROM (
      SELECT p.id             AS price_id,
             p.market_id      AS market_id,
             m.nome           AS market_nome,
             m.endereco       AS market_endereco,
             m.bairro         AS market_bairro,
             m.cidade         AS market_cidade,
             p.valor_centavos AS valor_centavos,
             p.data_coleta    AS data_coleta,
             p.fonte          AS fonte,
             ROW_NUMBER() OVER (
               PARTITION BY p.market_id
               ORDER BY p.data_coleta DESC, p.id DESC
             ) AS rn
        FROM price p
        JOIN market m ON m.id = p.market_id
       WHERE p.product_id = ?
         AND m.cidade = ?
         AND m.ativo = 1
    )
   WHERE rn = 1
`;

function erroProductIdAusente(): Response {
  return fail(
    400,
    "invalid_product_id",
    "product_id é obrigatório e deve ser inteiro.",
  );
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const bruto = queryParam(request, "product_id");
    if (bruto === null || !/^\d+$/.test(bruto)) {
      return erroProductIdAusente();
    }

    const productId = Number(bruto);
    if (!Number.isSafeInteger(productId) || productId <= 0) {
      return erroProductIdAusente();
    }

    const cidade = queryParam(request, "city") ?? CIDADE_PADRAO;
    const db = getDb();

    const produto = db
      .prepare(
        `SELECT id, nome, categoria, unidade, ean, ativo
           FROM product
          WHERE id = ? AND ativo = 1`,
      )
      .get(productId) as ProductRow | undefined;

    if (!produto) {
      return fail(404, "product_not_found", "Produto não encontrado.");
    }

    // Borda da aplicacao: unico lugar com o relogio real. A regra recebe `now`.
    const now = new Date();

    const ofertasBrutas = db
      .prepare(ULTIMA_COLETA_POR_MERCADO)
      .all(productId, cidade) as OfertaComMercado[];

    const rankeadas = rankOffers(ofertasBrutas, now);

    const ofertas = rankeadas.map((oferta) => ({
      price_id: oferta.price_id,
      market_id: oferta.market_id,
      market: {
        id: oferta.market_id,
        nome: oferta.market_nome,
        endereco: oferta.market_endereco,
        bairro: oferta.market_bairro,
        cidade: oferta.market_cidade,
      },
      valor_centavos: oferta.valor_centavos,
      data_coleta: oferta.data_coleta,
      fonte: oferta.fonte,
      valido: oferta.valido,
      dias_desde_coleta: oferta.dias_desde_coleta,
      posicao: oferta.posicao,
    }));

    const vencedoras = cheapestOffers(rankeadas);
    const totalValidas = rankeadas.filter((oferta) => oferta.valido).length;

    const data = {
      product: {
        id: produto.id,
        nome: produto.nome,
        categoria: produto.categoria,
        unidade: produto.unidade,
        ean: produto.ean,
        ativo: produto.ativo === 1,
      },
      ofertas,
      resumo: {
        menor_valor_centavos:
          vencedoras.length > 0 ? vencedoras[0].valor_centavos : null,
        vencedores: vencedoras.map((oferta) => ({
          price_id: oferta.price_id,
          market_id: oferta.market_id,
          valor_centavos: oferta.valor_centavos,
        })),
        total_ofertas: ofertas.length,
        total_validas: totalValidas,
        total_vencidas: ofertas.length - totalValidas,
      },
    };

    return ok(data, { cidade, gerado_em: isoUtcSeconds(now) });
  } catch (error) {
    console.error("GET /api/v1/prices", error);
    return fail(500, "internal_error", "Falha inesperada ao listar preços.");
  }
}

export async function OPTIONS(): Promise<Response> {
  return preflight();
}
