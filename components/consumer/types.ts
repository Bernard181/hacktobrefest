/**
 * Tipos do consumidor.
 *
 * Espelham EXATAMENTE o JSON congelado em `docs/api.md` (GET /products,
 * GET /prices). Se um campo não está no contrato, ele não entra aqui — a UI
 * nunca inventa campo que a API não devolve.
 */

export interface Product {
  id: number;
  nome: string;
  categoria: string;
  /** RN10 — unidade faz parte do produto (ex.: "5 kg", "1 kg", "1 L"). */
  unidade: string;
  ean: string | null;
  ativo: boolean;
}

export interface Market {
  id: number;
  nome: string;
  endereco: string;
  bairro: string;
  cidade: string;
}

/** Item de `data.ofertas` — já ordenado e classificado pelo servidor. */
export interface Offer {
  price_id: number;
  market_id: number;
  market: Market;
  /** RN09 — sempre inteiro em centavos. */
  valor_centavos: number;
  /** `YYYY-MM-DD`. */
  data_coleta: string;
  fonte: "painel" | "api";
  /** RN01/RN04 — veredito do servidor; a UI não recalcula. */
  valido: boolean;
  dias_desde_coleta: number;
  /** 1-based apenas entre as válidas; `null` para vencida (RN04). */
  posicao: number | null;
}

export interface ResumoOfertas {
  menor_valor_centavos: number | null;
  vencedores: { price_id: number; market_id: number; valor_centavos: number }[];
  total_ofertas: number;
  total_validas: number;
  total_vencidas: number;
}

/** `data` de GET /api/v1/prices. */
export interface PricesPayload {
  product: Product;
  ofertas: Offer[];
  resumo: ResumoOfertas;
}

/** Envelope de sucesso: `{ "data": ..., "meta": ... }`. */
export interface ApiEnvelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}

/** Envelope de erro: `{ "error": { "code": ..., "message": ... } }`. */
export interface ApiErro {
  error: { code: string; message: string };
}
