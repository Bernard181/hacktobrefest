import type { Metadata } from "next";
import Link from "next/link";

/**
 * Login do lojista: "/lojista/login" (RF06).
 * DONO: agente Auth/Lojista. Este arquivo e o placeholder da fase 0.
 */
export const metadata: Metadata = { title: "Entrar — Área do lojista" };

export default function MerchantLoginPage() {
  return (
    <>
      <h1>Entrar</h1>
      <p className="muted">Acesso exclusivo para lojistas cadastrados.</p>

      <section className="card pending">
        <h2>Formulário ainda não existe</h2>
        <p>
          O scaffold não inclui autenticação. O formulário de e-mail e senha
          entra na issue <code>feat(auth): login do lojista e sessão</code>,
          junto com <code>lib/auth.ts</code> e <code>middleware.ts</code>.
        </p>
        <p>
          <Link href="/lojista">Voltar</Link>
        </p>
      </section>
    </>
  );
}
