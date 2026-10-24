"use client";

/**
 * Geração da API key da loja (RF09, RN08, RNF04).
 * A chave em texto puro aparece só no retorno da action, uma única vez:
 * recarregar a página não a exibe de novo.
 */
import { useActionState } from "react";

import {
  gerarApiKeyAction,
  type ApiKeyState,
} from "@/app/(merchant)/lojista/actions";

const ESTADO_INICIAL: ApiKeyState = { chave: null, erro: null };

export function ApiKeyPanel({ temChave }: { temChave: boolean }) {
  const [estado, acao, pendente] = useActionState(
    gerarApiKeyAction,
    ESTADO_INICIAL,
  );

  return (
    <section className="card" aria-label="API key da loja">
      <h2 style={{ marginTop: 0 }}>API key da loja</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Status:{" "}
        <strong>{temChave ? "chave ativa" : "nenhuma chave gerada"}</strong>
      </p>
      <p>
        A chave é guardada apenas como hash SHA-256. Ao gerar uma nova, a
        anterior deixa de funcionar imediatamente.
      </p>

      <form action={acao}>
        <button
          type="submit"
          disabled={pendente}
          style={{
            padding: "10px 14px",
            border: "1px solid var(--accent)",
            borderRadius: 8,
            background: "var(--surface)",
            color: "var(--accent)",
            fontWeight: 700,
            cursor: pendente ? "wait" : "pointer",
          }}
        >
          {pendente ? "Gerando…" : "Gerar nova API key"}
        </button>
      </form>

      {estado.erro ? (
        <p role="alert" style={{ marginTop: 12, color: "#8f1d16" }}>
          {estado.erro}
        </p>
      ) : null}

      {estado.chave ? (
        <div
          role="status"
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 8,
            background: "var(--warn-soft)",
            border: "1px solid #e5c07b",
          }}
        >
          <p style={{ margin: "0 0 8px", fontWeight: 700 }}>
            Copie agora — esta chave não será exibida novamente.
          </p>
          <code
            style={{
              display: "block",
              wordBreak: "break-all",
              background: "var(--surface)",
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              fontSize: "0.9rem",
            }}
          >
            {estado.chave}
          </code>
        </div>
      ) : null}
    </section>
  );
}
