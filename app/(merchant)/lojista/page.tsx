import Link from "next/link";
import { redirect } from "next/navigation";

import { ApiKeyPanel } from "@/components/merchant/ApiKeyPanel";
import { PriceForm } from "@/components/merchant/PriceForm";
import { getSessionUser, todayISO } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatBRL } from "@/lib/prices";

import { logoutAction } from "./actions";
import {
  listarProdutosAtivos,
  listarUltimaColetaPorProduto,
} from "./merchant";

/**
 * Painel do lojista: "/lojista" (RF07–RF09).
 * DONO: agente Auth/Lojista.
 *
 * A sessão é a única fonte de `market_id`: leitura e escrita usam
 * `sessao.marketId`, nunca um parâmetro de URL ou campo de formulário (RN07).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function MerchantHomePage() {
  const sessao = await getSessionUser();
  if (!sessao) redirect("/lojista/login?next=/lojista");

  const db = getDb();
  const coletas = listarUltimaColetaPorProduto(db, sessao.marketId);
  const produtos = listarProdutosAtivos(db);
  const agora = new Date();
  const hoje = todayISO(agora);

  const mercado = db
    .prepare(
      "SELECT api_key_hash IS NOT NULL AS tem_api_key FROM market WHERE id = ?",
    )
    .get(sessao.marketId) as { tem_api_key: number } | undefined;
  const temApiKey = mercado?.tem_api_key === 1;

  return (
    <>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h1 style={{ marginBottom: 4 }}>Painel do lojista</h1>
          <p className="muted" style={{ margin: 0 }}>
            <strong>{sessao.marketNome}</strong> · {sessao.marketEndereco} —{" "}
            {sessao.marketBairro}, {sessao.marketCidade}
          </p>
          <p style={{ margin: "6px 0 0" }}>
            <span className="badge badge--warn">demonstração</span>{" "}
            <span className="muted">Logado como {sessao.email}</span>
          </p>
        </div>

        <form action={logoutAction}>
          <button
            type="submit"
            style={{
              padding: "8px 12px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              background: "var(--surface)",
              color: "var(--text)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Sair
          </button>
        </form>
      </div>

      <section className="card" aria-label="Última coleta por produto">
        <h2 style={{ marginTop: 0 }}>Última coleta por produto</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Somente os preços do mercado vinculado a esta conta (RF07).
        </p>

        {coletas.length === 0 ? (
          <p>
            Nenhum preço registrado para este mercado ainda. Use o formulário
            abaixo para registrar a primeira coleta.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 520,
              }}
            >
              <caption className="muted" style={{ captionSide: "bottom" }}>
                {coletas.length} produto(s) com preço registrado
              </caption>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th scope="col" style={{ padding: "8px 6px" }}>
                    Produto
                  </th>
                  <th scope="col" style={{ padding: "8px 6px" }}>
                    Unidade
                  </th>
                  <th scope="col" style={{ padding: "8px 6px" }}>
                    Valor
                  </th>
                  <th scope="col" style={{ padding: "8px 6px" }}>
                    Coleta
                  </th>
                  <th scope="col" style={{ padding: "8px 6px" }}>
                    Origem
                  </th>
                </tr>
              </thead>
              <tbody>
                {coletas.map((coleta) => (
                  <tr
                    key={coleta.productId}
                    style={{ borderTop: "1px solid var(--border)" }}
                  >
                    <td style={{ padding: "8px 6px" }}>
                      {coleta.produto}
                      <span className="muted"> · {coleta.categoria}</span>
                    </td>
                    <td style={{ padding: "8px 6px" }}>{coleta.unidade}</td>
                    <td
                      style={{
                        padding: "8px 6px",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatBRL(coleta.valorCentavos)}
                    </td>
                    <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>
                      {coleta.dataColeta}
                    </td>
                    <td style={{ padding: "8px 6px" }}>{coleta.fonte}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <PriceForm produtos={produtos} hoje={hoje} />

      <ApiKeyPanel temChave={temApiKey} />

      <p>
        <Link href="/">Ver a busca do consumidor</Link>
      </p>
    </>
  );
}
