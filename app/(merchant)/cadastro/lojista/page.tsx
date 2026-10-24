import Link from 'next/link'
import { getDb } from '../../../../lib/db'
import RegisterForm from '../../../../components/merchant/register-form'
import styles from '../../../../components/merchant/merchant.module.css'

export const dynamic = 'force-dynamic'

type MarketOption = { id: string; name: string; address: string | null; city: string; state: string }

export default async function MerchantRegistrationPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams
  const markets = getDb().prepare('SELECT id, name, address, city, state FROM market WHERE active = 1 AND demo = 0 ORDER BY name').all() as MarketOption[]
  return <main className={styles.shell}>
    <section className={`${styles.card} ${styles.login}`}>
      <Link href="/login" className={styles.back}>← Voltar ao login</Link>
      <p className={styles.eyebrow}>Cadastro de lojista</p>
      <h1 className={styles.title}>Cadastre seu mercado</h1>
      <p className={styles.muted}>Crie uma conta para administrar as ofertas do mercado selecionado.</p>
      {erro && <p role="alert" className={styles.error}>{erro}</p>}
      {markets.length === 0
        ? <p role="status" className={styles.muted}>Não há mercados disponíveis para cadastro no momento.</p>
        : <RegisterForm markets={markets} />}
    </section>
  </main>
}
