import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'CompraFácil — comparação de preços',
  description: 'Compare preços de produtos nos mercados cadastrados no Acre/AC.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>
}
