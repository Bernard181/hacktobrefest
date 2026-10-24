/**
 * Utilidades HTTP compartilhadas pelas rotas publicas `/api/v1/*`.
 *
 * DONO: agente Backend/Dados. Contrato em docs/api.md:
 * - envelope de sucesso `{ data, meta }`; erro `{ error: { code, message } }`;
 * - CORS liberado em TODA resposta, inclusive OPTIONS (204) e erros (RF14);
 * - `Cache-Control: no-store` (SM-05 precisa refletir alteracao no reload);
 * - nunca vazar SQL nem `api_key_hash`.
 */

import { NextResponse } from "next/server";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
};

const RESPONSE_HEADERS: Record<string, string> = {
  ...CORS_HEADERS,
  "Cache-Control": "no-store",
};

/** Resposta JSON com CORS e no-store. */
export function jsonResponse(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: RESPONSE_HEADERS });
}

/** Sucesso no envelope `{ data, meta? }`. */
export function ok(
  data: unknown,
  meta?: Record<string, unknown>,
  status = 200,
): NextResponse {
  return jsonResponse(meta === undefined ? { data } : { data, meta }, status);
}

/** Erro no envelope `{ error: { code, message } }`. */
export function fail(
  status: number,
  code: string,
  message: string,
): NextResponse {
  return jsonResponse({ error: { code, message } }, status);
}

/** Preflight CORS: 204 sem corpo. */
export function preflight(): NextResponse {
  return new NextResponse(null, { status: 204, headers: RESPONSE_HEADERS });
}

/**
 * Normaliza texto para busca sem diferenciar caixa/acento (RF11).
 * NFD separa o acento e o range de marcas combinantes o remove.
 */
export function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Le um query param tratando branco como ausente (docs/api.md).
 * `?category=` -> null, igual a nao enviar.
 */
export function queryParam(request: Request, name: string): string | null {
  const value = new URL(request.url).searchParams.get(name);
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** ISO 8601 UTC com segundos, como no contrato (`2026-10-24T12:00:00Z`). */
export function isoUtcSeconds(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}
