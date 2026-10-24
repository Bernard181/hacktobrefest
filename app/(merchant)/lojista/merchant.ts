/**
 * Operações de dados do painel do lojista (RF07–RF09, RN05–RN09).
 *
 * DONO: agente Auth/Lojista.
 *
 * Mantido separado das Server Actions (`actions.ts`) para ser testável sem
 * request/Next: todo acesso a banco recebe um `DB` e todo relógio é injetado.
 * `marketId` NUNCA vem do formulário: as actions passam o valor da sessão e
 * `registrarPreco`/`gerarApiKeyDaLoja` revalidam com `assertMarketAccess` (RN07).
 */
import type { DB } from "@/lib/db";
import {
  assertMarketAccess,
  generateApiKey,
  hashApiKey,
  isDataColetaFutura,
  isValidISODate,
  parseValorParaCentavos,
  verifyPassword,
  type SessionInput,
} from "@/lib/auth";
import { validatePriceInput } from "@/lib/prices";

export interface ErroCampo {
  campo: string;
  mensagem: string;
}

/* -------------------------------------------------------------------------- */
/* Login (RF06)                                                               */
/* -------------------------------------------------------------------------- */

interface LinhaLogin {
  id: number;
  email: string;
  senha_hash: string;
  role: string;
  market_id: number | null;
}

export interface ContaLojista {
  userId: number;
  email: string;
  marketId: number;
}

let hashFalsoParaTempo: string | null = null;

/**
 * Evita revelar por tempo de resposta se o e-mail existe: quando não há
 * usuário, ainda gastamos um scrypt antes de responder "inválido".
 */
function gastarTempoDeVerificacao(senha: string, db: DB): void {
  if (hashFalsoParaTempo === null) {
    const linha = db
      .prepare("SELECT senha_hash FROM user LIMIT 1")
      .get() as { senha_hash: string } | undefined;
    hashFalsoParaTempo = linha?.senha_hash ?? "";
  }
  if (hashFalsoParaTempo) verifyPassword(senha, hashFalsoParaTempo);
}

/**
 * Autentica somente perfil `lojista` com mercado ativo. Devolve `null` para
 * qualquer falha — a mensagem exibida é sempre genérica.
 */
export function autenticarLojista(
  db: DB,
  email: string,
  senha: string,
): ContaLojista | null {
  const emailNormalizado = email.trim().toLowerCase();
  if (!emailNormalizado || !senha) return null;

  const linha = db
    .prepare(
      `SELECT id, email, senha_hash, role, market_id
         FROM user
        WHERE lower(email) = ?`,
    )
    .get(emailNormalizado) as LinhaLogin | undefined;

  if (
    !linha ||
    linha.role !== "lojista" ||
    linha.market_id === null ||
    !verifyPassword(senha, linha.senha_hash)
  ) {
    gastarTempoDeVerificacao(senha, db);
    return null;
  }

  const mercado = db
    .prepare("SELECT id, ativo FROM market WHERE id = ?")
    .get(linha.market_id) as { id: number; ativo: number } | undefined;

  if (!mercado || mercado.ativo !== 1) return null;

  return {
    userId: linha.id,
    email: linha.email,
    marketId: linha.market_id,
  };
}

/* -------------------------------------------------------------------------- */
/* Leitura do painel (RF07)                                                   */
/* -------------------------------------------------------------------------- */

export interface ColetaDoMercado {
  productId: number;
  produto: string;
  categoria: string;
  unidade: string;
  valorCentavos: number;
  dataColeta: string;
  fonte: "painel" | "api";
}

interface LinhaColeta {
  product_id: number;
  produto: string;
  categoria: string;
  unidade: string;
  valor_centavos: number;
  data_coleta: string;
  fonte: "painel" | "api";
}

/**
 * Última coleta de cada produto **do mercado informado** (RF07).
 * O filtro por `market_id` é a barreira de leitura; a de escrita é
 * `assertMarketAccess`.
 */
export function listarUltimaColetaPorProduto(
  db: DB,
  marketId: number,
): ColetaDoMercado[] {
  const linhas = db
    .prepare(
      `SELECT p.id AS product_id, p.nome AS produto, p.categoria, p.unidade,
              pr.valor_centavos, pr.data_coleta, pr.fonte
         FROM product p
         JOIN price pr ON pr.id = (
           SELECT pr2.id
             FROM price pr2
            WHERE pr2.product_id = p.id AND pr2.market_id = ?
            ORDER BY pr2.data_coleta DESC, pr2.created_at DESC, pr2.id DESC
            LIMIT 1
         )
        WHERE p.ativo = 1
        ORDER BY p.nome COLLATE NOCASE ASC, p.unidade ASC`,
    )
    .all(marketId) as LinhaColeta[];

  return linhas.map((linha) => ({
    productId: linha.product_id,
    produto: linha.produto,
    categoria: linha.categoria,
    unidade: linha.unidade,
    valorCentavos: linha.valor_centavos,
    dataColeta: linha.data_coleta,
    fonte: linha.fonte,
  }));
}

export interface ProdutoCatalogo {
  id: number;
  nome: string;
  categoria: string;
  unidade: string;
}

/** Catálogo ativo para o select do formulário (RF08). */
export function listarProdutosAtivos(db: DB): ProdutoCatalogo[] {
  return db
    .prepare(
      `SELECT id, nome, categoria, unidade
         FROM product
        WHERE ativo = 1
        ORDER BY nome COLLATE NOCASE ASC, unidade ASC`,
    )
    .all() as ProdutoCatalogo[];
}

/* -------------------------------------------------------------------------- */
/* Escrita de preço (RF08, RN05, RN06, RN07, RN09)                            */
/* -------------------------------------------------------------------------- */

export interface ResultadoPreco {
  ok: boolean;
  erros: ErroCampo[];
  priceId?: number;
}

export interface EntradaPreco {
  /** Produto é catálogo global; o isolamento é pelo `marketId` da sessão. */
  productId: unknown;
  valorTexto: unknown;
  dataColeta: unknown;
}

interface LinhaProduto {
  id: number;
  ativo: number;
}

/**
 * Registra uma coleta de preço **append-only** (RN06): sempre INSERT, nunca
 * UPDATE. O `marketId` alvo é conferido contra a sessão por
 * `assertMarketAccess` (RN07) — mesmo que alguém adultere o formulário.
 */
export function registrarPreco(args: {
  db: DB;
  sessao: Pick<SessionInput, "role" | "marketId">;
  marketIdAlvo: number;
  entrada: EntradaPreco;
  now?: Date;
}): ResultadoPreco {
  const { db, sessao, marketIdAlvo, entrada } = args;
  const now = args.now ?? new Date();

  let marketId: number;
  try {
    marketId = assertMarketAccess(sessao, marketIdAlvo);
  } catch {
    return {
      ok: false,
      erros: [
        {
          campo: "market_id",
          mensagem: "Você só pode atualizar preços do seu próprio mercado.",
        },
      ],
    };
  }

  const erros: ErroCampo[] = [];

  const productId = Number(entrada.productId);
  const produto =
    Number.isInteger(productId) && productId > 0
      ? (db
          .prepare("SELECT id, ativo FROM product WHERE id = ?")
          .get(productId) as LinhaProduto | undefined)
      : undefined;

  if (!produto || produto.ativo !== 1) {
    erros.push({
      campo: "product_id",
      mensagem: "Selecione um produto válido do catálogo.",
    });
  }

  const valorTexto =
    typeof entrada.valorTexto === "string" ? entrada.valorTexto : "";
  const valorCentavos = parseValorParaCentavos(valorTexto);
  if (valorCentavos === null) {
    erros.push({
      campo: "valor",
      mensagem: "Informe um valor em reais maior que zero (ex.: 28,90).",
    });
  }

  const dataColeta =
    typeof entrada.dataColeta === "string" ? entrada.dataColeta.trim() : "";
  if (!isValidISODate(dataColeta)) {
    erros.push({
      campo: "data_coleta",
      mensagem: "Informe uma data de coleta válida.",
    });
  } else if (isDataColetaFutura(dataColeta, now)) {
    erros.push({
      campo: "data_coleta",
      mensagem: "A data de coleta não pode ser futura.",
    });
  }

  // Regra compartilhada do domínio (fonte única em lib/prices.ts).
  if (erros.length === 0) {
    const camposDoDominio: Record<string, string> = {
      valor_centavos: "valor",
    };
    const errosDominio = validatePriceInput(
      { valor_centavos: valorCentavos, data_coleta: dataColeta },
      now,
    );
    for (const erro of errosDominio) {
      const campo = camposDoDominio[erro.campo] ?? erro.campo;
      if (!erros.some((existente) => existente.campo === campo)) {
        erros.push({ campo, mensagem: erro.mensagem });
      }
    }
  }

  if (erros.length > 0 || valorCentavos === null) {
    return { ok: false, erros };
  }

  const createdAt = now.toISOString().replace(/\.\d{3}Z$/, "Z");
  const info = db
    .prepare(
      `INSERT INTO price
         (market_id, product_id, valor_centavos, data_coleta, fonte, created_at)
       VALUES (?, ?, ?, ?, 'painel', ?)`,
    )
    .run(marketId, productId, valorCentavos, dataColeta, createdAt);

  return { ok: true, erros: [], priceId: Number(info.lastInsertRowid) };
}

/* -------------------------------------------------------------------------- */
/* API key da loja (RF09, RN08)                                               */
/* -------------------------------------------------------------------------- */

/**
 * Gera uma nova chave, grava **apenas** o SHA-256 em `market.api_key_hash` e
 * devolve o texto puro para exibição única. A chave anterior deixa de valer.
 */
export function gerarApiKeyDaLoja(args: {
  db: DB;
  sessao: Pick<SessionInput, "role" | "marketId">;
  marketIdAlvo: number;
}): { chave: string; marketId: number } {
  const { db, sessao, marketIdAlvo } = args;
  const marketId = assertMarketAccess(sessao, marketIdAlvo);

  const chave = generateApiKey();
  const hash = hashApiKey(chave);

  const info = db
    .prepare("UPDATE market SET api_key_hash = ? WHERE id = ?")
    .run(hash, marketId);

  if (info.changes !== 1) {
    throw new Error("Mercado não encontrado ao gravar a API key.");
  }

  return { chave, marketId };
}

/* -------------------------------------------------------------------------- */
/* Redirecionamento seguro pós-login                                          */
/* -------------------------------------------------------------------------- */

const NEXT_PADRAO = "/lojista";

/** Aceita somente caminho interno; nunca URL absoluta nem `//host`. */
export function normalizeNextPath(bruto: unknown): string {
  if (typeof bruto !== "string") return NEXT_PADRAO;
  const valor = bruto.trim();
  if (!valor || valor.length > 512) return NEXT_PADRAO;
  if (!valor.startsWith("/")) return NEXT_PADRAO;
  if (valor.startsWith("//") || valor.startsWith("/\\")) return NEXT_PADRAO;
  if (valor.startsWith("/lojista/login")) return NEXT_PADRAO;
  if (/[\u0000-\u001f]/.test(valor)) return NEXT_PADRAO;
  return valor;
}
