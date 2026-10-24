import { createHmac, createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDb } from './db'

export type SessionUser = { id: string; email: string; role: 'consumer' | 'merchant'; marketId: string | null }
export class AuthError extends Error {
  constructor(public readonly status: 401 | 403, message = status === 401 ? 'Autenticação necessária' : 'Acesso não permitido') {
    super(message)
    this.name = 'AuthError'
  }
}

const COOKIE_NAME = 'comprafacil_session'
const SESSION_SECONDS = 60 * 60 * 24 * 7
const secret = () => process.env.SESSION_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'comprafacil-development-session-secret')

function encode(value: string) { return Buffer.from(value).toString('base64url') }
function sign(value: string) {
  const key = secret()
  if (!key) throw new Error('SESSION_SECRET deve ser configurado em produção')
  return createHmac('sha256', key).update(value).digest('base64url')
}

function createToken(user: SessionUser) {
  const payload = encode(JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS }))
  return `${payload}.${sign(payload)}`
}

function readToken(token?: string): SessionUser | null {
  if (!token) return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null
  const expected = sign(payload)
  const providedBytes = Buffer.from(signature)
  const expectedBytes = Buffer.from(expected)
  if (providedBytes.length !== expectedBytes.length || !timingSafeEqual(providedBytes, expectedBytes)) return null
  try {
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessionUser & { exp: number }
    if (value.exp <= Math.floor(Date.now() / 1000) || !['merchant', 'consumer'].includes(value.role)) return null
    return { id: value.id, email: value.email, role: value.role, marketId: value.marketId ?? null }
  } catch { return null }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies()
  return readToken(jar.get(COOKIE_NAME)?.value)
}

export async function requireMerchant(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new AuthError(401)
  if (user.role !== 'merchant' || !user.marketId) throw new AuthError(403)
  return user
}

export async function signIn(email: string, password: string): Promise<SessionUser | null> {
  const row = getDb().prepare('SELECT id, email, password_hash, role, market_id FROM user WHERE email = ? COLLATE NOCASE').get(email.trim()) as
    | { id: string; email: string; password_hash: string; role: 'consumer' | 'merchant'; market_id: string | null }
    | undefined
  if (!row || !(await bcrypt.compare(password, row.password_hash))) return null
  const user: SessionUser = { id: row.id, email: row.email, role: row.role, marketId: row.market_id }
  const jar = await cookies()
  jar.set(COOKIE_NAME, createToken(user), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: SESSION_SECONDS })
  return user
}

export async function signOut(): Promise<void> {
  const jar = await cookies()
  jar.set(COOKIE_NAME, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 })
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export type MerchantRegistrationResult =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: 'invalid_email' | 'short_password' | 'password_too_long' | 'market_unavailable' | 'email_in_use' }

export async function registerMerchant(email: string, password: string, marketId: string): Promise<MerchantRegistrationResult> {
  const normalizedEmail = email.trim().toLocaleLowerCase('en-US')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return { ok: false, reason: 'invalid_email' }
  if (password.length < 8) return { ok: false, reason: 'short_password' }
  if (Buffer.byteLength(password, 'utf8') > 72) return { ok: false, reason: 'password_too_long' }

  const db = getDb()
  const market = db.prepare('SELECT id FROM market WHERE id = ? AND active = 1 AND demo = 0').get(marketId)
  if (!market) return { ok: false, reason: 'market_unavailable' }
  if (db.prepare('SELECT 1 FROM user WHERE email = ? COLLATE NOCASE').get(normalizedEmail)) return { ok: false, reason: 'email_in_use' }

  const passwordHash = await hashPassword(password)
  const user: SessionUser = { id: `merchant-${randomUUID()}`, email: normalizedEmail, role: 'merchant', marketId }
  try {
    db.prepare('INSERT INTO user (id, email, password_hash, role, market_id) VALUES (?, ?, ?, ?, ?)')
      .run(user.id, user.email, passwordHash, user.role, user.marketId)
    return { ok: true, user }
  } catch (error) {
    if ((error as { code?: string })?.code === 'SQLITE_CONSTRAINT_UNIQUE') return { ok: false, reason: 'email_in_use' }
    throw error
  }
}

/** Hashing primitive for API-key provisioning; the raw key must never be persisted. */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

export async function merchantOrRedirect() {
  try { return await requireMerchant() } catch (error) {
    if (error instanceof AuthError && error.status === 401) redirect('/login')
    redirect('/login')
  }
}
