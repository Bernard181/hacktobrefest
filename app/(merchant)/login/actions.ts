'use server'

import { redirect } from 'next/navigation'
import { signIn } from '../../../lib/auth'

export async function loginAction(formData: FormData) {
  const email = String(formData.get('email') || '')
  const password = String(formData.get('password') || '')
  const user = await signIn(email, password)
  if (!user || user.role !== 'merchant' || !user.marketId) redirect('/login?erro=credenciais')
  redirect('/dashboard')
}
