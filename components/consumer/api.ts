/**
 * Leitura do envelope de erro congelado em `docs/api.md`:
 * `{ "error": { "code": string, "message": string } }`.
 */

import type { ApiErro } from "./types";

/** Devolve `error.message` do contrato; `null` se o corpo não for esse JSON. */
export async function lerMensagemDeErro(
  resposta: Response,
): Promise<string | null> {
  try {
    const corpo: unknown = await resposta.json();
    if (typeof corpo !== "object" || corpo === null || !("error" in corpo)) {
      return null;
    }

    const erro = (corpo as ApiErro).error;
    if (erro && typeof erro.message === "string" && erro.message.trim() !== "") {
      return erro.message;
    }
  } catch {
    // Corpo não é JSON (ex.: 404 do Next antes da API existir).
  }

  return null;
}

/**
 * Mensagem em pt-BR para o estado de erro. Diferencia rota ausente (404 sem
 * envelope, API ainda não integrada) de erro de contrato e de HTTP genérico.
 */
export function mensagemDeFalha(
  resposta: Response,
  detalheApi: string | null,
  contexto: "produtos" | "precos",
): string {
  if (detalheApi) return detalheApi;

  if (resposta.status === 404) {
    return contexto === "produtos"
      ? "A API pública ainda não está disponível neste ambiente (HTTP 404)."
      : "A API de preços ainda não está disponível neste ambiente (HTTP 404).";
  }

  return `A API respondeu com HTTP ${resposta.status}.`;
}
