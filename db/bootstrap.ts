import { getDb } from '../lib/db'

try {
  const db = getDb()
  const products = (db.prepare('SELECT COUNT(*) AS count FROM product').get() as { count: number }).count
  const prices = (db.prepare('SELECT COUNT(*) AS count FROM price').get() as { count: number }).count
  const demoUsers = (db.prepare("SELECT COUNT(*) AS count FROM user WHERE email='lojista@comprafacil.local'").get() as { count: number }).count
  console.log(`Bootstrap concluído: ${products} produtos, ${prices} preços-base, ${demoUsers} usuários demo.`)
} catch (error) {
  console.error('Falha no bootstrap do banco:', error)
  process.exitCode = 1
}
