"use client";

import { Fragment, useEffect, useState } from "react";
import { lerMensagemDeErro, mensagemDeFalha } from "./api";
import {
  buildPricesUrl,
  descreverSelo,
  formatarDataColeta,
  formatarPreco,
} from "./search-helpers";
import styles from "./consumer-search.module.css";
import type { PricesPayload, Product } from "./types";

type Status = "carregando" | "pronto" | "erro";

/**
 * Ofertas de UM produto (RF02–RF04). A ordem vem pronta de
 * GET /api/v1/prices — não reordenamos nem recalculamos validade/posição.
 */
export function ProductOffers({ produto }: { produto: Product }) {
  const [payload, setPayload] = useState<PricesPayload | null>(null);
  const [status, setStatus] = useState<Status>("carregando");
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let ativo = true;
    const controller = new AbortController();

    setStatus("carregando");
    setErro(null);

    void (async () => {
      try {
        const resposta = await fetch(buildPricesUrl(produto.id), {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!resposta.ok) {
          const detalheApi = await lerMensagemDeErro(resposta);
          if (!ativo) return;
          setStatus("erro");
          setErro(mensagemDeFalha(resposta, detalheApi, "precos"));
          return;
        }

        const corpo = (await resposta.json()) as { data?: unknown };
        const dados = corpo.data as PricesPayload | undefined;

        if (!dados || !Array.isArray(dados.ofertas)) {
          if (!ativo) return;
          setStatus("erro");
          setErro("Resposta inesperada da API de preços.");
          return;
        }

        if (!ativo) return;
        setPayload(dados);
        setStatus("pronto");
      } catch {
        if (!ativo || controller.signal.aborted) return;
        setStatus("erro");
        setErro(
          "Falha de rede ao carregar os preços. Verifique a conexão e tente novamente.",
        );
      }
    })();

    return () => {
      ativo = false;
      controller.abort();
    };
  }, [produto.id, tentativa]);

  const ofertas = payload?.ofertas ?? [];
  const resumo = payload?.resumo;
  const primeiroVencido = ofertas.findIndex((oferta) => oferta.valido === false);

  return (
    <article
      className={styles.product}
      aria-labelledby={`produto-${produto.id}`}
    >
      <header className={styles.productHeader}>
        <div className={styles.productTitle}>
          <h3 id={`produto-${produto.id}`}>{produto.nome}</h3>
          <p className={styles.productMeta}>
            <span className={styles.unit}>Unidade: {produto.unidade}</span>
            <span className="badge">{produto.categoria}</span>
          </p>
        </div>

        {resumo && (
          <p className={styles.summary}>
            {resumo.total_validas}{" "}
            {resumo.total_validas === 1 ? "oferta válida" : "ofertas válidas"}
            {resumo.total_vencidas > 0 &&
              ` · ${resumo.total_vencidas} ${
                resumo.total_vencidas === 1
                  ? "desatualizada"
                  : "desatualizadas"
              }`}
          </p>
        )}
      </header>

      {status === "carregando" && (
        <p className={styles.inlineStatus} role="status">
          Carregando preços…
        </p>
      )}

      {status === "erro" && (
        <div className={styles.inlineError} role="alert">
          <p>{erro}</p>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => setTentativa((valor) => valor + 1)}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {status === "pronto" && ofertas.length === 0 && (
        <p className={styles.inlineStatus}>
          Nenhuma oferta registrada para este produto ainda.
        </p>
      )}

      {status === "pronto" && ofertas.length > 0 && (
        <ul className={styles.offers}>
          {ofertas.map((oferta, indice) => {
            const estado = descreverSelo(oferta);

            return (
              <Fragment key={oferta.price_id}>
                {indice === primeiroVencido && (
                  <li className={styles.expiredSeparator}>
                    Preços desatualizados — fora do ranking
                  </li>
                )}

                <li
                  className={`${styles.offer} ${
                    estado.desatualizado ? styles.offerExpired : ""
                  }`}
                >
                  <div className={styles.offerInfo}>
                    <p className={styles.marketName}>
                      {oferta.market.nome}
                      {oferta.posicao !== null && oferta.posicao > 1 && (
                        <span className={styles.position}>
                          {" "}
                          · {oferta.posicao}ª oferta mais barata
                        </span>
                      )}
                    </p>
                    <p className={styles.address}>
                      {oferta.market.endereco} — {oferta.market.bairro}
                    </p>
                    <p className={styles.collected}>
                      Coleta:{" "}
                      <time dateTime={oferta.data_coleta}>
                        {formatarDataColeta(oferta.data_coleta)}
                      </time>
                    </p>
                  </div>

                  <div className={styles.offerValue}>
                    <p
                      className={`${styles.price} ${
                        estado.desatualizado ? styles.priceExpired : ""
                      }`}
                    >
                      {formatarPreco(oferta.valor_centavos)}
                    </p>

                    <div className={styles.badges}>
                      {estado.selo && (
                        <span
                          className={`badge ${
                            estado.selo === "Desatualizado"
                              ? "badge--warn"
                              : ""
                          }`}
                        >
                          {estado.selo}
                          {estado.textoAcessivel && (
                            <span className={styles.srOnly}>
                              {" "}
                              — {estado.textoAcessivel}
                            </span>
                          )}
                        </span>
                      )}
                      {estado.foraDoRanking && (
                        <span className={styles.rankNote}>
                          Fora do ranking
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              </Fragment>
            );
          })}
        </ul>
      )}
    </article>
  );
}
