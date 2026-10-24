/**
 * Regras de preco — UNICA fonte da verdade para validade, ranking e moeda.
 *
 * DONO: agente Backend/Dados.
 *
 * Invariantes (nao negociaveis):
 * - Dinheiro e sempre inteiro em centavos (RN09). Nada de float no dominio.
 * - Validade de 30 dias so existe aqui (RN01); nunca duplicar em SQL.
 * - `now` e sempre injetado: nada de Date.now() dentro das regras.
 * - Vencido nao ganha ranking, mas continua na lista com `valido: false` (RN04).
 * - Comparacoes de data sao por DIA DE CALENDARIO em UTC:
 *   `data_coleta` 'YYYY-MM-DD' representa esse dia; `now` usa seus componentes
 *   UTC (hora/minuto nao influenciam a validade).
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

const MS_PER_DAY = 86_400_000;
const DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Converte `data_coleta` no instante UTC da meia-noite do dia representado.
 * Devolve `null` quando o valor nao e uma data real no formato esperado.
 */
function utcDayFrom(data: DataColeta): number | null {
  if (data instanceof Date) {
    const time = data.getTime();
    if (Number.isNaN(time)) return null;
    return Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate());
  }

  if (typeof data !== "string") return null;

  const match = DATA_ISO.exec(data.trim());
  if (!match) return null;

  const ano = Number(match[1]);
  const mes = Number(match[2]);
  const dia = Number(match[3]);
  const utc = Date.UTC(ano, mes - 1, dia);
  const check = new Date(utc);

  // Rejeita datas "reais no papel" mas inexistentes (ex.: 2026-02-30).
  if (
    check.getUTCFullYear() !== ano ||
    check.getUTCMonth() !== mes - 1 ||
    check.getUTCDate() !== dia
  ) {
    return null;
  }

  return utc;
}

/** Meia-noite UTC do dia de `now` (o relogio vem sempre por parametro). */
function utcDayFromNow(now: Date): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

/**
 * RN01 — preco valido se `data_coleta >= now - 30 dias` (limite inclusivo).
 * Devolve `false` tambem para data futura (RN05 implica inconsistencia) e para
 * data invalida.
 */
export function isPriceValid(preco: PrecoComData, now: Date): boolean {
  const day = utcDayFrom(preco.data_coleta);
  if (day === null) return false;

  const hoje = utcDayFromNow(now);
  if (day > hoje) return false;

  const dias = (hoje - day) / MS_PER_DAY;
  return dias <= VALIDADE_DIAS;
}

/** RN05 — `data_coleta` no futuro (comparada por dia, nao por hora). */
export function isFutureDate(data_coleta: DataColeta, now: Date): boolean {
  const day = utcDayFrom(data_coleta);
  if (day === null) return false;
  return day > utcDayFromNow(now);
}

/**
 * Dias inteiros entre `data_coleta` e `now` (0 = hoje). Pode ser negativo
 * (data futura). Devolve `NaN` para data invalida.
 */
export function daysSinceCollection(data_coleta: DataColeta, now: Date): number {
  const day = utcDayFrom(data_coleta);
  if (day === null) return Number.NaN;
  return Math.round((utcDayFromNow(now) - day) / MS_PER_DAY);
}

/** Compara ofertas validas: valor asc, data desc, mercado asc (RN02/RN03). */
function compararValidas(
  a: { oferta: OfertaComMercado; dias: number },
  b: { oferta: OfertaComMercado; dias: number },
): number {
  const porValor = a.oferta.valor_centavos - b.oferta.valor_centavos;
  if (porValor !== 0) return porValor;

  // data_coleta mais recente primeiro = menos dias desde a coleta.
  if (a.dias !== b.dias) return a.dias - b.dias;

  const porMercado = a.oferta.market_nome.localeCompare(
    b.oferta.market_nome,
    "pt-BR",
  );
  if (porMercado !== 0) return porMercado;

  // Desempate final deterministico (mesmo mercado/nome/valor/data).
  return a.oferta.price_id - b.oferta.price_id;
}

/** Compara ofertas vencidas: data_coleta desc (mais recente primeiro). */
function compararVencidas(
  a: { oferta: OfertaComMercado; dias: number },
  b: { oferta: OfertaComMercado; dias: number },
): number {
  const aValida = Number.isFinite(a.dias);
  const bValida = Number.isFinite(b.dias);
  if (aValida !== bValida) return aValida ? -1 : 1;

  if (aValida && bValida && a.dias !== b.dias) return a.dias - b.dias;

  const porMercado = a.oferta.market_nome.localeCompare(
    b.oferta.market_nome,
    "pt-BR",
  );
  if (porMercado !== 0) return porMercado;

  return a.oferta.price_id - b.oferta.price_id;
}

/**
 * RN02/RN03/RN04 — ranking das ofertas de UM produto (mesma unidade).
 *
 * IMPORTANTE (RN10): recebe apenas ofertas do MESMO produto/unidade. Comparar
 * '5 kg' com '1 kg' e responsabilidade de quem chama (a API filtra por
 * `product_id`). Nao muta o array recebido.
 *
 * Ordem: validas por `valor_centavos` asc; empate por `data_coleta` desc;
 * empate restante por `market_nome` asc (pt-BR). Vencidas ao final, data desc.
 */
export function rankOffers(
  ofertas: OfertaComMercado[],
  now: Date,
): OfertaRankeada[] {
  const hoje = utcDayFromNow(now);

  const decoradas = ofertas.map((oferta) => {
    const day = utcDayFrom(oferta.data_coleta);
    const dias =
      day === null ? Number.NaN : Math.round((hoje - day) / MS_PER_DAY);
    const valido =
      day !== null && day <= hoje && (hoje - day) / MS_PER_DAY <= VALIDADE_DIAS;

    return { oferta, dias, valido };
  });

  const validas = decoradas
    .filter((item) => item.valido)
    .sort(compararValidas);
  const vencidas = decoradas
    .filter((item) => !item.valido)
    .sort(compararVencidas);

  return [
    ...validas.map((item, index) => ({
      ...item.oferta,
      valido: true,
      dias_desde_coleta: item.dias,
      posicao: index + 1,
    })),
    ...vencidas.map((item) => ({
      ...item.oferta,
      valido: false,
      dias_desde_coleta: item.dias,
      posicao: null,
    })),
  ];
}

/**
 * RN02/RN03 — todas as ofertas validas empatadas no menor valor, na ordem
 * recebida (que deve ser a de `rankOffers`). Sem oferta valida -> `[]`.
 */
export function cheapestOffers(ofertas: OfertaRankeada[]): OfertaRankeada[] {
  const validas = ofertas.filter((oferta) => oferta.valido);
  if (validas.length === 0) return [];

  let menor = validas[0].valor_centavos;
  for (const oferta of validas) {
    if (oferta.valor_centavos < menor) menor = oferta.valor_centavos;
  }

  return validas.filter((oferta) => oferta.valor_centavos === menor);
}

/**
 * RN09 — `2890` -> `'R$ 28,90'`. Sem arredondamento, sem float.
 * A string e montada a partir dos digitos do inteiro de centavos.
 * Entrada invalida (negativa, fracionaria, NaN) -> `RangeError`.
 */
export function formatBRL(centavos: number): string {
  if (
    typeof centavos !== "number" ||
    !Number.isSafeInteger(centavos) ||
    centavos < 0
  ) {
    throw new RangeError(
      "formatBRL espera um inteiro de centavos maior ou igual a zero",
    );
  }

  const digitos = String(centavos).padStart(3, "0");
  const reais = digitos.slice(0, -2);
  const centavosFormatados = digitos.slice(-2);
  const reaisComMilhar = reais.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return `R$ ${reaisComMilhar},${centavosFormatados}`;
}

/**
 * RN05/RN09 — valida uma escrita de preco; devolve a lista de erros por campo.
 * Lista vazia = aceito. Regra compartilhada por painel e API (POST stretch).
 */
export function validatePriceInput(
  input: { valor_centavos: unknown; data_coleta: unknown },
  now: Date,
): { campo: string; mensagem: string }[] {
  const erros: { campo: string; mensagem: string }[] = [];

  const valor = input.valor_centavos;
  if (
    typeof valor !== "number" ||
    !Number.isSafeInteger(valor) ||
    valor <= 0
  ) {
    erros.push({
      campo: "valor_centavos",
      mensagem: "valor_centavos deve ser um inteiro positivo em centavos.",
    });
  }

  const data = input.data_coleta;
  if (typeof data !== "string" || utcDayFrom(data) === null) {
    erros.push({
      campo: "data_coleta",
      mensagem: "data_coleta deve ser uma data real no formato YYYY-MM-DD.",
    });
  } else if (isFutureDate(data, now)) {
    erros.push({
      campo: "data_coleta",
      mensagem: "data_coleta nao pode ser futura.",
    });
  }

  return erros;
}
