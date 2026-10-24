import type { Metadata } from "next";
import Link from "next/link";
import { ConsumerSearch } from "@/components/consumer/consumer-search";

export const metadata: Metadata = {
  title: "Buscar preços — Comparador Rio Branco/AC",
  description:
    "Compare o preço de itens alimentícios nos supermercados de Rio Branco/AC. Sem login, sem cadastro.",
};

/**
 * Rota do consumidor: "/" (RF01–RF05).
 * DONO: agente Frontend consumidor.
 */
export default function ConsumerHomePage() {
  return (
    <>
      <h1>Onde está mais barato em Rio Branco?</h1>
      <p className="muted">
        Busque um item alimentício e compare o preço nos supermercados da
        cidade. Sem login, sem cadastro.
      </p>

      <ConsumerSearch />

      <p>
        É lojista? <Link href="/lojista">Atualize seus preços aqui</Link>.
      </p>
    </>
  );
}
