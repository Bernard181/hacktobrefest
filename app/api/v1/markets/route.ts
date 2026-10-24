/**
 * GET /api/v1/markets?city= — mercados ativos da cidade.
 * Contrato: docs/api.md (RF13). Nunca expor `api_key_hash` (RN08, RNF04).
 *
 * DONO: agente Backend/Dados.
 */

import type { NextRequest } from "next/server";

import { getDb } from "@/lib/db";
import { CIDADE_PADRAO } from "@/lib/prices";

import { fail, ok, preflight, queryParam } from "../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface MarketRow {
  id: number;
  nome: string;
  endereco: string;
  bairro: string;
  cidade: string;
  ativo: number;
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const cidade = queryParam(request, "city") ?? CIDADE_PADRAO;

    const rows = getDb()
      .prepare(
        `SELECT id, nome, endereco, bairro, cidade, ativo
           FROM market
          WHERE ativo = 1 AND cidade = ?`,
      )
      .all(cidade) as MarketRow[];

    rows.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    const data = rows.map((row) => ({
      id: row.id,
      nome: row.nome,
      endereco: row.endereco,
      bairro: row.bairro,
      cidade: row.cidade,
      ativo: row.ativo === 1,
    }));

    return ok(data, { total: data.length, cidade });
  } catch (error) {
    console.error("GET /api/v1/markets", error);
    return fail(500, "internal_error", "Falha inesperada ao listar mercados.");
  }
}

export async function OPTIONS(): Promise<Response> {
  return preflight();
}
