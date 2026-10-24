"use server";

/**
 * Server Actions da área do lojista (RF06–RF09).
 *
 * DONO: agente Auth/Lojista.
 *
 * Toda action relê a sessão no servidor e é ela que define o `market_id`
 * usado na escrita (RN07). Nenhum `market_id` de formulário é confiável.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  clearSessionCookie,
  getSessionUser,
  setSessionCookie,
} from "@/lib/auth";
import { getDb } from "@/lib/db";

import {
  autenticarLojista,
  gerarApiKeyDaLoja,
  normalizeNextPath,
  registrarPreco,
  type ErroCampo,
} from "./merchant";

export interface LoginState {
  erro: string | null;
  email: string;
}

export interface PriceFormState {
  ok: boolean;
  erros: ErroCampo[];
  valores: {
    productId: string;
    valor: string;
    dataColeta: string;
  };
  mensagem: string | null;
}

export interface ApiKeyState {
  chave: string | null;
  erro: string | null;
}

const ERRO_LOGIN_GENERICO = "E-mail ou senha inválidos.";

export async function loginAction(
  _estadoAnterior: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");
  const nextPath = normalizeNextPath(formData.get("next"));

  if (!email || !senha) {
    return { erro: ERRO_LOGIN_GENERICO, email };
  }

  const conta = autenticarLojista(getDb(), email, senha);
  if (!conta) {
    // Mensagem genérica: nunca revela se o e-mail existe.
    return { erro: ERRO_LOGIN_GENERICO, email };
  }

  await setSessionCookie({
    userId: conta.userId,
    marketId: conta.marketId,
    role: "lojista",
  });

  redirect(nextPath);
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/lojista/login");
}

export async function atualizarPrecoAction(
  _estadoAnterior: PriceFormState,
  formData: FormData,
): Promise<PriceFormState> {
  const sessao = await getSessionUser();
  if (!sessao) redirect("/lojista/login?next=/lojista");

  const valores = {
    productId: String(formData.get("product_id") ?? ""),
    valor: String(formData.get("valor") ?? ""),
    dataColeta: String(formData.get("data_coleta") ?? ""),
  };

  // marketIdAlvo vem da SESSÃO, jamais de um campo oculto do formulário.
  const resultado = registrarPreco({
    db: getDb(),
    sessao,
    marketIdAlvo: sessao.marketId,
    entrada: {
      productId: valores.productId,
      valorTexto: valores.valor,
      dataColeta: valores.dataColeta,
    },
    now: new Date(),
  });

  if (!resultado.ok) {
    return { ok: false, erros: resultado.erros, valores, mensagem: null };
  }

  revalidatePath("/lojista");

  return {
    ok: true,
    erros: [],
    valores: { productId: "", valor: "", dataColeta: "" },
    mensagem:
      "Preço registrado. O histórico anterior foi preservado e a busca do consumidor já reflete o novo valor.",
  };
}

export async function gerarApiKeyAction(
  _estadoAnterior: ApiKeyState,
  _formData: FormData,
): Promise<ApiKeyState> {
  const sessao = await getSessionUser();
  if (!sessao) redirect("/lojista/login?next=/lojista");

  try {
    const { chave } = gerarApiKeyDaLoja({
      db: getDb(),
      sessao,
      marketIdAlvo: sessao.marketId,
    });

    revalidatePath("/lojista");

    // A chave em texto puro só existe neste retorno. Não é logada, não é
    // persistida e não é relida do banco em reload (RNF04).
    return { chave, erro: null };
  } catch {
    return {
      chave: null,
      erro: "Não foi possível gerar a API key. Tente novamente.",
    };
  }
}
