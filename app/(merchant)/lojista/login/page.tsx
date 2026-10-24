import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/merchant/LoginForm";
import { getSessionUser } from "@/lib/auth";

import { normalizeNextPath } from "../merchant";

/**
 * Login do lojista: "/lojista/login" (RF06).
 * DONO: agente Auth/Lojista.
 */
export const metadata: Metadata = { title: "Entrar — Área do lojista" };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function MerchantLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  if (await getSessionUser()) redirect("/lojista");

  const params = await searchParams;
  const nextBruto = Array.isArray(params.next) ? params.next[0] : params.next;
  const nextPath = normalizeNextPath(nextBruto);

  return (
    <>
      <h1>Entrar — Área do lojista</h1>
      <p className="muted">
        Acesso exclusivo para lojistas cadastrados. Cada conta gerencia somente
        o próprio mercado.
      </p>

      <LoginForm nextPath={nextPath} />

      <section
        className="card"
        aria-label="Acesso de demonstração"
        style={{ borderLeft: "3px solid var(--warn)" }}
      >
        <h2 style={{ marginTop: 0 }}>
          Acesso de demonstração{" "}
          <span className="badge badge--warn">dados fictícios</span>
        </h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Contas semeadas para a apresentação. Os preços são de demonstração.
        </p>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>
            <strong>Mercado Centro</strong> — <code>centro@demo.local</code>
          </li>
          <li>
            <strong>Mercado Bosque</strong> — <code>bosque@demo.local</code>
          </li>
          <li>
            Senha das duas contas: <code>demo1234</code>
          </li>
        </ul>
      </section>

      <p>
        <Link href="/">Voltar para a busca do consumidor</Link>
      </p>
    </>
  );
}
