/**
 * Proteção de borda da área do lojista (RF06, RF10).
 *
 * DONO: agente Auth/Lojista.
 *
 * Roda em Edge Runtime: NÃO importa better-sqlite3, `lib/db` nem `lib/auth`.
 * Aqui só verificamos presença + assinatura HMAC + expiração do cookie, usando
 * Web Crypto. A checagem definitiva (usuário/role/market_id no banco) fica nas
 * páginas e Server Actions, que rodam em Node.
 */
import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "sessao_lojista";

/** Precisa ser idêntico ao fallback de `lib/auth.ts` (apenas dev/test). */
const DEV_SESSION_SECRET = "comparador-dev-session-secret-nao-use-em-producao";

function sessionSecret(): string | null {
  const doAmbiente = process.env.SESSION_SECRET;
  if (doAmbiente && doAmbiente.length > 0) return doAmbiente;
  if (process.env.NODE_ENV !== "production") return DEV_SESSION_SECRET;
  return null;
}

function base64urlParaBytes(valor: string): Uint8Array | null {
  try {
    const normalizado = valor.replace(/-/g, "+").replace(/_/g, "/");
    const comPadding =
      normalizado + "=".repeat((4 - (normalizado.length % 4)) % 4);
    const binario = atob(comPadding);
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i += 1) {
      bytes[i] = binario.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

async function tokenValido(token: string | undefined): Promise<boolean> {
  if (!token) return false;

  const partes = token.split(".");
  if (partes.length !== 2) return false;

  const [payloadB64, assinaturaB64] = partes;
  if (!payloadB64 || !assinaturaB64) return false;

  const secret = sessionSecret();
  if (!secret) return false;

  const assinaturaBytes = base64urlParaBytes(assinaturaB64);
  const payloadBytes = base64urlParaBytes(payloadB64);
  if (!assinaturaBytes || !payloadBytes) return false;

  try {
    const chave = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const assinaturaOk = await crypto.subtle.verify(
      "HMAC",
      chave,
      assinaturaBytes,
      new TextEncoder().encode(payloadB64),
    );
    if (!assinaturaOk) return false;

    const payload = JSON.parse(
      new TextDecoder().decode(payloadBytes),
    ) as { exp?: unknown };

    if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
      return false;
    }

    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;

  // A tela de login é pública.
  if (pathname === "/lojista/login" || pathname.startsWith("/lojista/login/")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (await tokenValido(token)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/lojista/login";
  url.search = "";
  url.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/lojista/:path*"],
};
