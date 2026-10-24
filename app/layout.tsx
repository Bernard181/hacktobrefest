import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Comparador de Preços — Rio Branco/AC",
  description:
    "Compare o preço de itens alimentícios nos supermercados de Rio Branco/AC.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <header className="site-header">
          <Link href="/" className="brand">
            Comparador<span>Rio Branco/AC</span>
          </Link>
          <nav aria-label="Navegação principal">
            <Link href="/">Buscar preços</Link>
            <Link href="/lojista">Área do lojista</Link>
          </nav>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <p>
            Projeto de demonstração — mercados reais com preços fictícios. Não
            use como referência de compra.
          </p>
        </footer>
      </body>
    </html>
  );
}
