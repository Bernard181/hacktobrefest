"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { lerMensagemDeErro, mensagemDeFalha } from "./api";
import { ProductOffers } from "./product-offers";
import { buildProductsUrl, deriveCategories } from "./search-helpers";
import styles from "./consumer-search.module.css";
import type { Product } from "./types";

type Status = "carregando" | "pronto" | "erro";

interface ErroEstado {
  titulo: string;
  detalhe: string;
}

const FILTRO_VAZIO = { q: "", category: "" };

/**
 * Busca pública do consumidor (RF01–RF05): filtro por nome e categoria,
 * sem login. A ordem das ofertas e o selo de vencido vêm de /api/v1/prices
 * — este componente não recalcula ranking nem validade.
 */
export function ConsumerSearch() {
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [filtroAplicado, setFiltroAplicado] = useState(FILTRO_VAZIO);
  const [produtos, setProdutos] = useState<Product[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>("carregando");
  const [erro, setErro] = useState<ErroEstado | null>(null);

  const requisicaoRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const buscar = useCallback(
    async (filtro: { q: string; category: string }) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const id = ++requisicaoRef.current;

      setStatus("carregando");
      setErro(null);
      setFiltroAplicado(filtro);

      const semFiltro = filtro.q.trim() === "" && filtro.category.trim() === "";

      try {
        const resposta = await fetch(buildProductsUrl(filtro), {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!resposta.ok) {
          const detalheApi = await lerMensagemDeErro(resposta);
          if (id !== requisicaoRef.current) return;
          setProdutos([]);
          setStatus("erro");
          setErro({
            titulo: "Não foi possível carregar os produtos.",
            detalhe: mensagemDeFalha(resposta, detalheApi, "produtos"),
          });
          return;
        }

        const corpo = (await resposta.json()) as { data?: unknown };
        if (!Array.isArray(corpo.data)) {
          if (id !== requisicaoRef.current) return;
          setProdutos([]);
          setStatus("erro");
          setErro({
            titulo: "Não foi possível carregar os produtos.",
            detalhe: "Resposta inesperada da API de produtos.",
          });
          return;
        }

        if (id !== requisicaoRef.current) return;
        const lista = corpo.data as Product[];
        setProdutos(lista);
        setStatus("pronto");

        // Categorias do seletor saem do catálogo SEM filtro, nunca hardcoded.
        if (semFiltro) setCategorias(deriveCategories(lista));
      } catch {
        if (controller.signal.aborted) return;
        if (id !== requisicaoRef.current) return;
        setProdutos([]);
        setStatus("erro");
        setErro({
          titulo: "Não foi possível carregar os produtos.",
          detalhe:
            "Falha de rede ao falar com a API. Verifique a conexão e tente novamente.",
        });
      }
    },
    [],
  );

  useEffect(() => {
    void buscar(FILTRO_VAZIO);
    return () => abortRef.current?.abort();
  }, [buscar]);

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    void buscar({ q: nome, category: categoria });
  }

  function limparFiltros() {
    setNome("");
    setCategoria("");
    void buscar(FILTRO_VAZIO);
  }

  const totalTexto = `${produtos.length} ${
    produtos.length === 1 ? "produto encontrado" : "produtos encontrados"
  }`;

  return (
    <div className={styles.wrapper}>
      <p className={styles.demo} role="note">
        <strong>Demonstração:</strong> mercados reais com preços fictícios,
        coletados para este MVP. Não use como referência de compra.
      </p>

      <form
        className={`${styles.form} card`}
        role="search"
        aria-label="Buscar produtos"
        onSubmit={aoEnviar}
      >
        <div className={styles.field}>
          <label htmlFor="busca-nome">Nome do produto</label>
          <input
            id="busca-nome"
            name="q"
            type="search"
            value={nome}
            onChange={(evento) => setNome(evento.target.value)}
            placeholder="Ex.: arroz"
            autoComplete="off"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="busca-categoria">Categoria</label>
          <select
            id="busca-categoria"
            name="category"
            value={categoria}
            onChange={(evento) => setCategoria(evento.target.value)}
          >
            <option value="">Todas as categorias</option>
            {categorias.map((opcao) => (
              <option key={opcao} value={opcao}>
                {opcao}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.actions}>
          <button type="submit" className={styles.primary}>
            Buscar
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={limparFiltros}
          >
            Limpar filtros
          </button>
        </div>
      </form>

      <section className={styles.results} aria-labelledby="resultados-titulo">
        <div className={styles.resultsHeader}>
          <h2 id="resultados-titulo">Resultados</h2>
          <p className={styles.live} aria-live="polite">
            {status === "carregando"
              ? "Carregando resultados…"
              : status === "erro"
                ? "Falha ao carregar resultados."
                : totalTexto}
          </p>
        </div>

        {status === "carregando" && (
          <p className={styles.status} role="status">
            Carregando produtos…
          </p>
        )}

        {status === "erro" && erro && (
          <div
            className={`${styles.status} ${styles.statusErro}`}
            role="alert"
          >
            <p className={styles.statusTitulo}>{erro.titulo}</p>
            <p className="muted">{erro.detalhe}</p>
            <button
              type="button"
              className={styles.primary}
              onClick={() => void buscar(filtroAplicado)}
            >
              Tentar novamente
            </button>
          </div>
        )}

        {status === "pronto" && produtos.length === 0 && (
          <div className={styles.status}>
            <p className={styles.statusTitulo}>Nenhum produto encontrado</p>
            <p className="muted">
              Tente outro nome ou remova o filtro de categoria.
            </p>
            <button
              type="button"
              className={styles.secondary}
              onClick={limparFiltros}
            >
              Limpar filtros
            </button>
          </div>
        )}

        {status === "pronto" && produtos.length > 0 && (
          <>
            <p className={styles.unitNote}>
              Cada unidade é comparada separadamente: <strong>5 kg</strong> e{" "}
              <strong>1 kg</strong> são ofertas distintas.
            </p>
            <div className={styles.productList}>
              {produtos.map((produto) => (
                <ProductOffers key={produto.id} produto={produto} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
