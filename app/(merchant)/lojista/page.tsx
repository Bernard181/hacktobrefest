import Link from "next/link";

/**
 * Área do lojista: "/lojista" (RF06–RF10).
 * DONO: agente Auth/Lojista. Este arquivo e o placeholder da fase 0.
 */
export default function MerchantHomePage() {
  return (
    <>
      <h1>Área do lojista</h1>
      <p className="muted">
        Aqui o mercado mantém os preços do próprio estabelecimento. Acesso
        restrito ao mercado vinculado ao usuário.
      </p>

      <section className="card pending" aria-label="Status do scaffold">
        <h2>Fase 0 — aguardando autenticação</h2>
        <p>
          Login e edição de preços entram na issue{" "}
          <code>feat(auth): login do lojista e edição de preço</code>. Nenhuma
          rota privada está liberada neste scaffold.
        </p>
        <ul className="flow">
          <li>RF06 — login com e-mail e senha</li>
          <li>RF07 — somente preços do próprio mercado (RN07)</li>
          <li>RF08 — novo preço com valor e data de coleta</li>
          <li>RF09 — API key exibida uma única vez (hash SHA-256)</li>
        </ul>
      </section>

      <p>
        <Link href="/">Voltar para a busca do consumidor</Link>
      </p>
    </>
  );
}
