import { merchantOrRedirect } from '../../../lib/auth'
import { getDb } from '../../../lib/db'
import MerchantDashboard from '../../../components/merchant/dashboard'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const user = await merchantOrRedirect()
  const market = getDb().prepare('SELECT name FROM market WHERE id = ? AND active = 1').get(user.marketId) as { name: string } | undefined
  if (!market) return <main><p role="alert">O mercado desta conta está indisponível.</p></main>
  return <main><MerchantDashboard marketName={market.name} /></main>
}
