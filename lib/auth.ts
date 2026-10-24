/**
 * Autenticação e sessão do lojista (RF06–RF10, RN07, RN08, RNF03, RNF04).
 *
 * DONO: agente Auth/Lojista.
 *
 * Este módulo roda só no runtime Node (better-sqlite3 + node:crypto). O
 * `middleware.ts` NÃO pode importá-lo: lá a validação é feita só com Web Crypto.
 *
 * Invariantes de segurança:
 * - senha nunca em texto puro: scrypt com salt aleatório (RNF03);
 * - API key nunca é persistida nem logada: só o SHA-256 vai para o banco (RN08);
 * - token de sessão é assinado com HMAC-SHA256 e expira em 8 h;
 * - RN07 é validado no servidor por `assertMarketAccess`, não no front.
 */
import {
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

import { getDb } from "@/lib/db";

/* -------------------------------------------------------------------------- */
/* Senhas (RNF03)                                                             */
/* -------------------------------------------------------------------------- */

/** Parâmetros do scrypt combinados com o seed do backend. */
const SCRYPT_KEYLEN = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 } as const;

/**
 * Gera `scrypt$<saltHex>$<hashHex>`.
 * O formato é o mesmo usado no `db/seed.ts` (`scryptSync(..., 64, opts)`).
 */
export function hashPassword(senha: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(senha, salt, SCRYPT_KEYLEN, SCRYPT_OPTIONS);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

/**
 * Compara a senha com o hash armazenado usando `timingSafeEqual`.
 * Hash malformado (de qualquer formato) devolve `false`, nunca lança.
 */
export function verifyPassword(senha: string, hashArmazenado: string): boolean {
  if (typeof senha !== "string" || typeof hashArmazenado !== "string") {
    return false;
  }

  const partes = hashArmazenado.split("$");
  if (partes.length !== 3 || partes[0] !== "scrypt") return false;

  const [, saltHex, hashHex] = partes;
  if (!/^[0-9a-f]+$/i.test(saltHex) || saltHex.length !== 32) return false;
  if (!/^[0-9a-f]+$/i.test(hashHex) || hashHex.length !== SCRYPT_KEYLEN * 2) {
    return false;
  }

  try {
    const esperado = Buffer.from(hashHex, "hex");
    const calculado = scryptSync(
      senha,
      Buffer.from(saltHex, "hex"),
      SCRYPT_KEYLEN,
      SCRYPT_OPTIONS,
    );
    if (esperado.length !== calculado.length) return false;
    return timingSafeEqual(esperado, calculado);
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* API key (RN08, RNF04)                                                      */
/* -------------------------------------------------------------------------- */

/** SHA-256 em hex — é isso que pode ir para `market.api_key_hash`. */
export function hashApiKey(chave: string): string {
  return createHash("sha256").update(chave, "utf8").digest("hex");
}

/** Gera 32 bytes aleatórios em base64url (nunca logar o retorno). */
export function generateApiKey(): string {
  return randomBytes(32).toString("base64url");
}

/* -------------------------------------------------------------------------- */
/* Sessão — token assinado + cookie HttpOnly                                  */
/* -------------------------------------------------------------------------- */

export const SESSION_COOKIE = "sessao_lojista";
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

/**
 * Fallback usado APENAS fora de produção (dev/test). Em produção sem
 * `SESSION_SECRET` a assinatura é recusada com erro explícito.
 */
const DEV_SESSION_SECRET = "comparador-dev-session-secret-nao-use-em-producao";

export type SessionRole = "consumidor" | "lojista";

/** Dados mínimos que entram no token. Sem e-mail (LGPD, RNF06). */
export interface SessionInput {
  userId: number;
  marketId: number | null;
  role: SessionRole;
}

export interface SessionPayload extends SessionInput {
  iat: number;
  exp: number;
}

export interface SessionOptions {
  now?: Date;
  secret?: string;
}

/** Resolve o segredo; lança em produção sem configuração (RNF05). */
export function resolveSessionSecret(override?: string): string {
  const candidato =
    typeof override === "string" && override.length > 0
      ? override
      : process.env.SESSION_SECRET;

  if (candidato && candidato.length > 0) return candidato;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET não configurado: defina a variável de ambiente em produção.",
    );
  }

  return DEV_SESSION_SECRET;
}

function base64url(valor: Buffer): string {
  return valor.toString("base64url");
}

function assinatura(payloadB64: string, secret: string): string {
  return base64url(createHmac("sha256", secret).update(payloadB64).digest());
}

/** `base64url(payload).hmacSHA256` — 8 h de validade. */
export function signSession(
  sessao: SessionInput,
  opcoes: SessionOptions = {},
): string {
  const secret = resolveSessionSecret(opcoes.secret);
  const agora = opcoes.now ?? new Date();
  const iat = Math.floor(agora.getTime() / 1000);

  const payload: SessionPayload = {
    userId: sessao.userId,
    marketId: sessao.marketId,
    role: sessao.role,
    iat,
    exp: iat + SESSION_TTL_SECONDS,
  };

  const payloadB64 = base64url(Buffer.from(JSON.stringify(payload), "utf8"));
  return `${payloadB64}.${assinatura(payloadB64, secret)}`;
}

function ehInteiroPositivo(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isInteger(valor) && valor > 0;
}

/** Valida assinatura + expiração. Devolve `null` para qualquer token inválido. */
export function verifySession(
  token: string | null | undefined,
  opcoes: SessionOptions = {},
): SessionPayload | null {
  if (typeof token !== "string" || token.length === 0) return null;

  const partes = token.split(".");
  if (partes.length !== 2) return null;

  const [payloadB64, assinaturaRecebida] = partes;
  if (!payloadB64 || !assinaturaRecebida) return null;

  let secret: string;
  try {
    secret = resolveSessionSecret(opcoes.secret);
  } catch {
    return null;
  }

  const esperada = Buffer.from(assinatura(payloadB64, secret), "utf8");
  const recebida = Buffer.from(assinaturaRecebida, "utf8");
  if (esperada.length !== recebida.length) return null;
  if (!timingSafeEqual(esperada, recebida)) return null;

  let bruto: unknown;
  try {
    bruto = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (typeof bruto !== "object" || bruto === null) return null;
  const payload = bruto as Record<string, unknown>;

  if (!ehInteiroPositivo(payload.userId)) return null;
  if (payload.marketId !== null && !ehInteiroPositivo(payload.marketId)) {
    return null;
  }
  if (payload.role !== "consumidor" && payload.role !== "lojista") return null;
  if (!Number.isInteger(payload.iat) || !Number.isInteger(payload.exp)) {
    return null;
  }
  if (payload.role === "lojista" && payload.marketId === null) return null;

  const agora = opcoes.now ?? new Date();
  const agoraSegundos = Math.floor(agora.getTime() / 1000);
  if ((payload.exp as number) <= agoraSegundos) return null;

  return {
    userId: payload.userId,
    marketId: payload.marketId as number | null,
    role: payload.role as SessionRole,
    iat: payload.iat as number,
    exp: payload.exp as number,
  };
}

function opcoesCookie() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

/** Grava o cookie HttpOnly da sessão. Uso: Server Action / Route Handler. */
export async function setSessionCookie(sessao: SessionInput): Promise<void> {
  const token = signSession(sessao);
  const { cookies } = await import("next/headers");
  (await cookies()).set(SESSION_COOKIE, token, opcoesCookie());
}

/** Remove o cookie de sessão. */
export async function clearSessionCookie(): Promise<void> {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { ...opcoesCookie(), maxAge: 0 });
  jar.delete(SESSION_COOKIE);
}

/** Usuário lojista já hidratado com o mercado vinculado. */
export interface MerchantUser {
  userId: number;
  email: string;
  role: "lojista";
  marketId: number;
  marketNome: string;
  marketEndereco: string;
  marketBairro: string;
  marketCidade: string;
}

interface LinhaSessao {
  user_id: number;
  email: string;
  role: string;
  market_id: number | null;
  market_nome: string;
  market_endereco: string;
  market_bairro: string;
  market_cidade: string;
  market_ativo: number;
}

/**
 * Lê o cookie, valida o token e reconfere no banco (fonte da verdade):
 * usuário existe, é `lojista`, `market_id` do token é o do banco e o mercado
 * está ativo. Qualquer divergência → `null`.
 */
export async function getSessionUser(): Promise<MerchantUser | null> {
  const { cookies } = await import("next/headers");
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const payload = verifySession(token);
  if (!payload) return null;
  if (payload.role !== "lojista" || payload.marketId === null) return null;

  const linha = getDb()
    .prepare(
      `SELECT u.id AS user_id, u.email, u.role, u.market_id,
              m.nome AS market_nome, m.endereco AS market_endereco,
              m.bairro AS market_bairro, m.cidade AS market_cidade,
              m.ativo AS market_ativo
         FROM user u
         JOIN market m ON m.id = u.market_id
        WHERE u.id = ?`,
    )
    .get(payload.userId) as LinhaSessao | undefined;

  if (!linha) return null;
  if (linha.role !== "lojista" || linha.market_id === null) return null;
  if (linha.market_id !== payload.marketId) return null;
  if (linha.market_ativo !== 1) return null;

  return {
    userId: linha.user_id,
    email: linha.email,
    role: "lojista",
    marketId: linha.market_id,
    marketNome: linha.market_nome,
    marketEndereco: linha.market_endereco,
    marketBairro: linha.market_bairro,
    marketCidade: linha.market_cidade,
  };
}

/* -------------------------------------------------------------------------- */
/* RN07 — lojista só escreve no próprio mercado                               */
/* -------------------------------------------------------------------------- */

export class MarketAccessError extends Error {
  constructor(mensagem = "Acesso negado ao mercado solicitado (RN07).") {
    super(mensagem);
    this.name = "MarketAccessError";
  }
}

/**
 * Guard SERVER-SIDE de RN07/RF10. Não basta esconder o campo no front.
 * Aceita apenas sessão de lojista cujo `marketId` seja exatamente o alvo.
 * Devolve o `marketId` validado ou lança `MarketAccessError`.
 */
export function assertMarketAccess(
  sessao: Pick<SessionInput, "role" | "marketId"> | null | undefined,
  marketIdAlvo: number,
): number {
  if (!sessao || sessao.role !== "lojista") {
    throw new MarketAccessError("Sessão de lojista obrigatória.");
  }
  if (sessao.marketId === null || !ehInteiroPositivo(sessao.marketId)) {
    throw new MarketAccessError("Usuário sem mercado vinculado.");
  }
  if (!ehInteiroPositivo(marketIdAlvo) || sessao.marketId !== marketIdAlvo) {
    throw new MarketAccessError();
  }
  return marketIdAlvo;
}

/* -------------------------------------------------------------------------- */
/* Valor monetário (RN09) — parsing por string, sem float                    */
/* -------------------------------------------------------------------------- */

function gruposDeMilhar(parte: string, separador: "." | ","): boolean {
  return separador === "."
    ? /^\d{1,3}(\.\d{3})*$/.test(parte)
    : /^\d{1,3}(,\d{3})*$/.test(parte);
}

/**
 * Converte texto digitado em reais para centavos inteiros (RN09).
 *
 * Aceita `28,90`, `28.90`, `1.234,56`, `R$ 28,90`, `1,234.56`.
 * Rejeita negativos, zero, texto solto e mais de 2 casas decimais.
 * O cálculo é feito sobre a string — nunca acumula erro de ponto flutuante.
 */
export function parseValorParaCentavos(texto: string): number | null {
  if (typeof texto !== "string") return null;

  const limpo = texto
    .replace(/\u00a0/g, " ")
    .trim()
    .replace(/^R\$\s*/i, "")
    .replace(/\s+/g, "");

  if (!limpo) return null;
  if (!/^[0-9.,]+$/.test(limpo)) return null;
  if (/^[.,]/.test(limpo) || /[.,]$/.test(limpo)) return null;

  const temVirgula = limpo.includes(",");
  const temPonto = limpo.includes(".");

  let inteiro: string;
  let fracao: string;

  if (temVirgula && temPonto) {
    const decimal = limpo.lastIndexOf(",") > limpo.lastIndexOf(".") ? "," : ".";
    const milhar = decimal === "," ? "." : ",";
    const partes = limpo.split(decimal);
    if (partes.length !== 2) return null;
    if (!gruposDeMilhar(partes[0], milhar)) return null;
    inteiro = partes[0].split(milhar).join("");
    fracao = partes[1];
  } else if (temVirgula) {
    const partes = limpo.split(",");
    if (partes.length !== 2) return null;
    inteiro = partes[0];
    fracao = partes[1];
  } else if (temPonto) {
    const partes = limpo.split(".");
    if (partes.length > 2) {
      // Vários pontos: só pode ser separador de milhar (`1.234.567`).
      if (!gruposDeMilhar(limpo, ".")) return null;
      inteiro = partes.join("");
      fracao = "0";
    } else {
      const [antes, depois] = partes;
      if (!/^\d+$/.test(antes)) return null;
      if (depois.length === 3 && antes.length <= 3) {
        // `1.234` no padrão brasileiro = mil duzentos e trinta e quatro.
        inteiro = antes + depois;
        fracao = "0";
      } else if (depois.length === 1 || depois.length === 2) {
        inteiro = antes;
        fracao = depois;
      } else {
        return null;
      }
    }
  } else {
    inteiro = limpo;
    fracao = "0";
  }

  if (!/^\d+$/.test(inteiro)) return null;
  if (!/^\d{1,2}$/.test(fracao)) return null;

  const inteiroNormalizado = inteiro.replace(/^0+(?=\d)/, "");
  if (inteiroNormalizado.length > 12) return null; // sanidade, evita overflow

  const centavos =
    Number(inteiroNormalizado) * 100 + Number(fracao.padEnd(2, "0"));

  if (!Number.isSafeInteger(centavos) || centavos <= 0) return null;
  return centavos;
}

/* -------------------------------------------------------------------------- */
/* Datas (RN05) — comparação por dia, sempre com `now` injetado              */
/* -------------------------------------------------------------------------- */

/** Data de hoje em UTC no formato `YYYY-MM-DD`. */
export function todayISO(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` válido no calendário (rejeita 2026-02-30, por exemplo). */
export function isValidISODate(valor: string): boolean {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return false;
  }
  const [ano, mes, dia] = valor.split("-").map(Number);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return false;
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return data.toISOString().slice(0, 10) === valor;
}

/** RN05 — `data_coleta` futura (comparada por dia, não por hora). */
export function isDataColetaFutura(dataISO: string, now: Date): boolean {
  if (!isValidISODate(dataISO)) return false;
  return dataISO > todayISO(now);
}
