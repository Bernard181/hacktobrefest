"use client";

/**
 * Formulário de login do lojista (RF06).
 * Erro sempre genérico — não revela se o e-mail existe.
 */
import { useActionState } from "react";

import { loginAction, type LoginState } from "@/app/(merchant)/lojista/actions";

const ESTADO_INICIAL: LoginState = { erro: null, email: "" };

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [estado, acao, pendente] = useActionState(loginAction, ESTADO_INICIAL);

  return (
    <form action={acao} className="card" aria-label="Entrar na área do lojista">
      <input type="hidden" name="next" value={nextPath} />

      {estado.erro ? (
        <p
          role="alert"
          style={{
            margin: "0 0 12px",
            padding: "10px 12px",
            borderRadius: 8,
            background: "#fdecea",
            color: "#8f1d16",
            fontWeight: 600,
          }}
        >
          {estado.erro}
        </p>
      ) : null}

      <div style={{ display: "grid", gap: 12 }}>
        <label htmlFor="login-email" style={{ fontWeight: 600 }}>
          E-mail
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="username"
            required
            defaultValue={estado.email}
            disabled={pendente}
            style={{
              display: "block",
              width: "100%",
              marginTop: 4,
              padding: "10px 12px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: "1rem",
            }}
          />
        </label>

        <label htmlFor="login-senha" style={{ fontWeight: 600 }}>
          Senha
          <input
            id="login-senha"
            name="senha"
            type="password"
            autoComplete="current-password"
            required
            disabled={pendente}
            style={{
              display: "block",
              width: "100%",
              marginTop: 4,
              padding: "10px 12px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: "1rem",
            }}
          />
        </label>

        <button
          type="submit"
          disabled={pendente}
          style={{
            padding: "12px 16px",
            border: "1px solid var(--accent)",
            borderRadius: 8,
            background: "var(--accent)",
            color: "#fff",
            fontWeight: 700,
            fontSize: "1rem",
            cursor: pendente ? "wait" : "pointer",
          }}
        >
          {pendente ? "Entrando…" : "Entrar"}
        </button>
      </div>
    </form>
  );
}
