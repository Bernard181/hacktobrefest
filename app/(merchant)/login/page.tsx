import Link from 'next/link'
import { loginAction } from './actions'
import styles from '../../../components/merchant/merchant.module.css'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string; cadastro?: string }> }) {
  const { erro, cadastro } = await searchParams
  return <main className={styles.shell}>
    <section className={`${styles.card} ${styles.login}`}>
      <Link href="/" className={styles.back}>← Voltar à comparação</Link>
      <p className={styles.eyebrow}>Área do lojista</p>
      <h1 className={styles.title}>Entre na sua conta</h1>
      <p className={styles.muted}>Acesse as ofertas vinculadas ao seu mercado e atualize os preços.</p>
      {cadastro === 'sucesso' && <p role="status" className={styles.success}>Cadastro concluído. Entre com seu e-mail e senha para acessar o painel.</p>}
      {erro && <p role="alert" className={styles.error}>E-mail ou senha inválidos, ou conta sem perfil de lojista.</p>}
      <form action={loginAction} className={styles.form}>
        <label>E-mail<input name="email" type="email" autoComplete="username" required /></label>
        <label>Senha<input name="password" type="password" autoComplete="current-password" required /></label>
        <button type="submit">Entrar</button>
      </form>
      <p className={styles.registerLink}>Ainda não tem conta? <Link href="/cadastro/lojista">Cadastre seu mercado</Link>.</p>
    </section>
  </main>
}
