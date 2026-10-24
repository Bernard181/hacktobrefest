/**
 * Fallback das rotas desconhecidas sob `/api/v1`.
 * Contrato: docs/api.md — 404 `not_found` no mesmo envelope de erro, com CORS.
 *
 * DONO: agente Backend/Dados. Rotas estaticas (`products`, `prices`,
 * `markets`) tem precedencia sobre este catch-all.
 */

import { fail, preflight } from "../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return fail(404, "not_found", "Rota não encontrada.");
}

export async function OPTIONS(): Promise<Response> {
  return preflight();
}
