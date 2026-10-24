'use server'

import { redirect } from 'next/navigation'
import { registerMerchant } from '../../../../lib/auth'

const messages = {
  invalid_email: 'Informe um e-mail válido.',
  short_password: 'A senha deve ter pelo menos 8 caracteres.',
  password_too_long: 'A senha deve ter no máximo 72 bytes.',
  market_unavailable: 'Selecione um mercado ativo disponível para cadastro.',
  email_in_use: 'Este e-mail já possui uma conta. Entre ou use outro e-mail.',
} as const

export async function registerMerchantAction(formData: FormData) {
  const email = String(formData.get('email') || '')
  const password = String(formData.get('password') || '')
  const marketId = String(formData.get('market_id') || '')
  const result = await registerMerchant(email, password, marketId)
  if (!result.ok) redirect(`/cadastro/lojista?erro=${encodeURIComponent(messages[result.reason])}`)
  redirect('/login?cadastro=sucesso')
}
