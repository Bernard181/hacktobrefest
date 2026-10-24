/**
 * GET /api/v1/products — catalogo ativo filtrado por categoria e/ou nome.
 * Contrato: docs/api.md (RF11).
 *
 * DONO: agente Backend/Dados.
 */

import type { NextRequest } from "next/server";

import { getDb } from "@/lib/db";

import {
  fail,
  normalizeSearch,
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

interface ProductDto {
  id: number;
  nome: string;
  categoria: string;
  unidade: string;
  ean: string | null;
  ativo: boolean;
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const categoria = queryParam(request, "category");
    const termo = queryParam(request, "q");

    // Volume da demo e pequeno (<= 40): filtramos em JS para aplicar a mesma
    // normalizacao (sem caixa/acento) da busca sem depender de extensao SQL.
    const rows = getDb()
      .prepare(
        `SELECT id, nome, categoria, unidade, ean, ativo
           FROM product
          WHERE ativo = 1`,
      )
      .all() as ProductRow[];

    const categoriaNormalizada = categoria ? normalizeSearch(categoria) : null;
    const termoNormalizado = termo ? normalizeSearch(termo) : null;

    const filtrados = rows.filter((row) => {
      if (
        categoriaNormalizada !== null &&
        normalizeSearch(row.categoria) !== categoriaNormalizada
      ) {
        return false;
      }
      if (
        termoNormalizado !== null &&
        !normalizeSearch(row.nome).includes(termoNormalizado)
      ) {
        return false;
      }
      return true;
    });

    filtrados.sort(
      (a, b) =>
        a.nome.localeCompare(b.nome, "pt-BR") ||
        a.unidade.localeCompare(b.unidade, "pt-BR"),
    );

    const data: ProductDto[] = filtrados.map((row) => ({
      id: row.id,
      nome: row.nome,
      categoria: row.categoria,
      unidade: row.unidade,
      ean: row.ean,
      ativo: row.ativo === 1,
    }));

    return ok(data, { total: data.length });
  } catch (error) {
    console.error("GET /api/v1/products", error);
    return fail(500, "internal_error", "Falha inesperada ao listar produtos.");
  }
}

export async function OPTIONS(): Promise<Response> {
  return preflight();
}
