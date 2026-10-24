import Link from "next/link";

/**
 * Rota do consumidor: "/" (RF01–RF05).
 * DONO: agente Frontend. Este arquivo e o placeholder da fase 0.
 */
export default function ConsumerHomePage() {
  return (
    <>
      <h1>Onde está mais barato em Rio Branco?</h1>
      <p className="muted">
        Busque um item alimentício e compare o preço nos supermercados da
        cidade. Sem login, sem cadastro.
      </p>

      <section className="card pending" aria-label="Status do scaffold">
        <h2>Fase 0 — contrato congelado</h2>
        <p>
          O scaffold está no ar, mas a busca ainda não foi implementada. O
          fluxo do consumidor chega na issue{" "}
          <code>feat(busca): filtrar produtos por categoria e nome</code>.
        </p>
        <ul className="flow">
          <li>RF01 — busca por nome e categoria</li>
          <li>RF02 — ranking do menor para o maior preço</li>
          <li>RF03 — mercado, endereço, preço e data de coleta</li>
          <li>RF04 — selo de preço desatualizado (&gt; 30 dias)</li>
        </ul>
        <p>
          Contrato da API: <code>docs/api.md</code> · Regras:{" "}
          <code>lib/prices.ts</code>
        </p>
      </section>

      <p>
        É lojista? <Link href="/lojista">Atualize seus preços aqui</Link>.
      </p>
    </>
  );
}
