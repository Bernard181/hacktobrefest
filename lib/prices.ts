/**
 * Regras de preco — UNICA fonte da verdade para validade, ranking e moeda.
 *
 * DONO: agente Backend/Dados. Este arquivo foi criado no scaffold (fase 0)
 * apenas com a SUPERFICIE congelada do contrato. As implementacoes abaixo
 * lancam `NotImplementedError` ate a issue do backend.
 *
 * Invariantes (nao negociaveis):
 * - Dinheiro e sempre inteiro em centavos (RN09). Nada de float no dominio.
 * - Validade de 30 dias so existe aqui (RN01); nunca duplicar em SQL.
 * - `now` e sempre injetado: nada de Date.now() dentro das regras.
 * - Vencido nao ganha ranking, mas continua na lista com `valido: false` (RN04).
 */

/** Janela de validade do preco, em dias (RN01). */
export const VALIDADE_DIAS = 30;

/** Cidade fixa do MVP (REQUISITOS.md secao 2). */
export const CIDADE_PADRAO = "Rio Branco/AC";

/** Campo de data aceito pelas regras: ISO `YYYY-MM-DD` ou `Date`. */
export type DataColeta = string | Date;

/** Dados minimos para decidir validade. */
export interface PrecoComData {
  data_coleta: DataColeta;
}

/** Oferta ja hidratada com mercado, como a API devolve. */
export interface OfertaComMercado {
  price_id: number;
  market_id: number;
  market_nome: string;
  market_endereco: string;
  market_bairro: string;
  market_cidade: string;
  valor_centavos: number;
  data_coleta: string;
  fonte: "painel" | "api";
}

/** Oferta + veredito de validade/ranking. E o item de `data.ofertas` na API. */
export interface OfertaRankeada extends OfertaComMercado {
  valido: boolean;
  dias_desde_coleta: number;
  /** 1-based entre os validos; `null` para preco vencido (RN04). */
  posicao: number | null;
}

export class NotImplementedError extends Error {
  constructor(funcao: string) {
    super(`lib/prices.${funcao} ainda nao implementado (fase 0: so a superficie)`);
    this.name = "NotImplementedError";
  }
}

/**
 * RN01 — preco valido se `data_coleta >= now - 30 dias` (limite inclusivo).
 * Deve devolver `false` tambem para data futura (RN05 implica inconsistencia).
 */
export function isPriceValid(_preco: PrecoComData, _now: Date): boolean {
  throw new NotImplementedError("isPriceValid");
}

/** RN05 — `data_coleta` no futuro (comparada por dia, nao por hora). */
export function isFutureDate(_data_coleta: DataColeta, _now: Date): boolean {
  throw new NotImplementedError("isFutureDate");
}

/** Dias inteiros entre `data_coleta` e `now` (0 = hoje). Pode ser negativo. */
export function daysSinceCollection(_data_coleta: DataColeta, _now: Date): number {
  throw new NotImplementedError("daysSinceCollection");
}

/**
 * RN02/RN03/RN04 — ranking das ofertas de UM produto (mesma unidade).
 * Ordem: validas por `valor_centavos` asc; empate por `data_coleta` desc;
 * empate restante por `market_nome` asc. Vencidas ao final, data desc.
 * Nao muta o array recebido.
 */
export function rankOffers(_ofertas: OfertaComMercado[], _now: Date): OfertaRankeada[] {
  throw new NotImplementedError("rankOffers");
}

/** RN02/RN03 — todas as ofertas validas empatadas no menor valor. */
export function cheapestOffers(_ofertas: OfertaRankeada[]): OfertaRankeada[] {
  throw new NotImplementedError("cheapestOffers");
}

/** RN09 — `2890` -> `'R$ 28,90'`. Sem arredondamento, sem float. */
export function formatBRL(_centavos: number): string {
  throw new NotImplementedError("formatBRL");
}

/**
 * RN05/RN09 — valida uma escrita de preco; devolve a lista de erros por campo.
 * Lista vazia = aceito. Regra compartilhada por painel e API (POST stretch).
 */
export function validatePriceInput(
  _input: { valor_centavos: unknown; data_coleta: unknown },
  _now: Date,
): { campo: string; mensagem: string }[] {
  throw new NotImplementedError("validatePriceInput");
}
