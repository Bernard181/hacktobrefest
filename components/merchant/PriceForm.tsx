"use client";

/**
 * Formulário "Atualizar preço" (RF08).
 * `market_id` não existe no formulário: a action usa o da sessão (RN07).
 */
import { useActionState } from "react";

import {
  atualizarPrecoAction,
  type PriceFormState,
} from "@/app/(merchant)/lojista/actions";
import type { ProdutoCatalogo } from "@/app/(merchant)/lojista/merchant";

const estiloCampo = {
  display: "block",
  width: "100%",
  marginTop: 4,
  padding: "10px 12px",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: "1rem",
} as const;

const estiloErro = {
  margin: "4px 0 0",
  color: "#8f1d16",
  fontSize: "0.85rem",
  fontWeight: 600,
} as const;

export function PriceForm({
  produtos,
  hoje,
}: {
  produtos: ProdutoCatalogo[];
  hoje: string;
}) {
  const inicial: PriceFormState = {
    ok: false,
    erros: [],
    valores: { productId: "", valor: "", dataColeta: hoje },
    mensagem: null,
  };

  const [estado, acao, pendente] = useActionState(atualizarPrecoAction, inicial);

  const erroDe = (campo: string) =>
    estado.erros.find((erro) => erro.campo === campo)?.mensagem;

  const chaveFormulario = [
    estado.ok,
    estado.mensagem ?? "",
    ...estado.erros.map((erro) => `${erro.campo}:${erro.mensagem}`),
    estado.valores.productId,
    estado.valores.valor,
    estado.valores.dataColeta,
  ].join("|");

  return (
    <form
      action={acao}
      key={chaveFormulario}
      className="card"
      aria-label="Atualizar preço"
    >
      <h2 style={{ marginTop: 0 }}>Atualizar preço</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        O registro anterior é mantido no histórico; a busca passa a usar o
        preço mais recente.
      </p>

      {estado.mensagem ? (
        <p
          role="status"
          style={{
            margin: "0 0 12px",
            padding: "10px 12px",
            borderRadius: 8,
            background: "var(--accent-soft)",
            color: "var(--accent)",
            fontWeight: 600,
          }}
        >
          {estado.mensagem}
        </p>
      ) : null}

      <div style={{ display: "grid", gap: 14 }}>
        <div>
          <label htmlFor="preco-produto" style={{ fontWeight: 600 }}>
            Produto
            <select
              id="preco-produto"
              name="product_id"
              required
              defaultValue={estado.valores.productId}
              disabled={pendente}
              aria-invalid={erroDe("product_id") ? true : undefined}
              aria-describedby={
                erroDe("product_id") ? "erro-preco-produto" : undefined
              }
              style={estiloCampo}
            >
              <option value="">Selecione um produto</option>
              {produtos.map((produto) => (
                <option key={produto.id} value={produto.id}>
                  {produto.nome} — {produto.unidade} ({produto.categoria})
                </option>
              ))}
            </select>
          </label>
          {erroDe("product_id") ? (
            <p id="erro-preco-produto" role="alert" style={estiloErro}>
              {erroDe("product_id")}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="preco-valor" style={{ fontWeight: 600 }}>
            Valor em reais
            <input
              id="preco-valor"
              name="valor"
              type="text"
              inputMode="decimal"
              placeholder="28,90"
              required
              defaultValue={estado.valores.valor}
              disabled={pendente}
              aria-invalid={erroDe("valor") ? true : undefined}
              aria-describedby={erroDe("valor") ? "erro-preco-valor" : undefined}
              style={estiloCampo}
            />
          </label>
          {erroDe("valor") ? (
            <p id="erro-preco-valor" role="alert" style={estiloErro}>
              {erroDe("valor")}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="preco-data" style={{ fontWeight: 600 }}>
            Data da coleta
            <input
              id="preco-data"
              name="data_coleta"
              type="date"
              required
              max={hoje}
              defaultValue={estado.valores.dataColeta || hoje}
              disabled={pendente}
              aria-invalid={erroDe("data_coleta") ? true : undefined}
              aria-describedby={
                erroDe("data_coleta") ? "erro-preco-data" : undefined
              }
              style={estiloCampo}
            />
          </label>
          {erroDe("data_coleta") ? (
            <p id="erro-preco-data" role="alert" style={estiloErro}>
              {erroDe("data_coleta")}
            </p>
          ) : null}
        </div>

        {erroDe("market_id") ? (
          <p role="alert" style={estiloErro}>
            {erroDe("market_id")}
          </p>
        ) : null}

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
          {pendente ? "Salvando…" : "Salvar novo preço"}
        </button>
      </div>
    </form>
  );
}
