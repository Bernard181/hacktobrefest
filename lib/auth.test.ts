import { beforeEach, describe, expect, it, vi } from 'vitest'
import bcrypt from 'bcryptjs'
import { AuthError, getSessionUser, hashApiKey, hashPassword, registerMerchant, requireMerchant, signIn } from './auth'
import { parsePriceCents } from '../components/merchant/price-input'
import { getDb } from './db'

const sessionState = vi.hoisted(() => ({ value: undefined as string | undefined }))
vi.mock('next/headers', () => ({ cookies: async () => ({
  get: () => sessionState.value ? { value: sessionState.value } : undefined,
  set: (_name: string, value: string) => { sessionState.value = value },
}) }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`) } }))

process.env.DB_PATH = ':memory:'

beforeEach(() => {
  sessionState.value = undefined
  const db = getDb()
  db.prepare("DELETE FROM user WHERE email LIKE '%@example.test'").run()
  const insertMarket = db.prepare(`INSERT INTO market (id,name,city,state,active,demo) VALUES (?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,city=excluded.city,state=excluded.state,active=excluded.active,demo=excluded.demo`)
  insertMarket.run('market-ok', 'Mercado Disponível', 'Rio Branco', 'AC', 1, 0)
  insertMarket.run('market-demo', 'Mercado de Demonstração', 'Rio Branco', 'AC', 1, 1)
  insertMarket.run('market-off', 'Mercado Inativo', 'Rio Branco', 'AC', 0, 0)
})

describe('RF06/RN07 — cadastro e acesso de lojista', () => {
  it('cadastra e autentica conta com senha hash e vínculo ao mercado selecionado', async () => {
    const result = await registerMerchant('  Lojista@Example.test ', 'senha-segura-123', 'market-ok')
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const saved = getDb().prepare('SELECT email,password_hash,role,market_id FROM user WHERE id=?').get(result.user.id) as any
    expect(saved).toMatchObject({ email: 'lojista@example.test', role: 'merchant', market_id: 'market-ok' })
    expect(saved.password_hash).not.toBe('senha-segura-123')
    expect(await bcrypt.compare('senha-segura-123', saved.password_hash)).toBe(true)

    expect(await signIn('LOJISTA@example.test', 'senha-segura-123')).toMatchObject({ role: 'merchant', marketId: 'market-ok' })
    expect(await getSessionUser()).toMatchObject({ email: 'lojista@example.test', role: 'merchant', marketId: 'market-ok' })
    expect(await requireMerchant()).toMatchObject({ id: result.user.id, marketId: 'market-ok' })
  })

  it('rejeita e-mail duplicado, senha curta e mercado inválido, inativo ou de demonstração', async () => {
    expect((await registerMerchant('loja@example.test', 'senha-segura', 'market-ok')).ok).toBe(true)
    expect(await registerMerchant('LOJA@example.test', 'outra-senha', 'market-ok')).toEqual({ ok: false, reason: 'email_in_use' })
    expect(await registerMerchant('curta@example.test', '1234567', 'market-ok')).toEqual({ ok: false, reason: 'short_password' })
    expect(await registerMerchant('demo@example.test', 'senha-segura', 'market-demo')).toEqual({ ok: false, reason: 'market_unavailable' })
    expect(await registerMerchant('off@example.test', 'senha-segura', 'market-off')).toEqual({ ok: false, reason: 'market_unavailable' })
    expect(await registerMerchant('missing@example.test', 'senha-segura', 'missing-market')).toEqual({ ok: false, reason: 'market_unavailable' })
  })

  it('nega acesso à área de lojista para sessão ausente ou perfil consumidor', async () => {
    await expect(requireMerchant()).rejects.toMatchObject({ status: 401 })
    const db = getDb()
    db.prepare('INSERT INTO user (id,email,password_hash,role,market_id) VALUES (?,?,?,?,NULL)')
      .run('consumer-1', 'consumer@example.test', await hashPassword('senha-segura'), 'consumer')
    await signIn('consumer@example.test', 'senha-segura')
    await expect(requireMerchant()).rejects.toBeInstanceOf(AuthError)
    await expect(requireMerchant()).rejects.toMatchObject({ status: 403 })
  })
})

describe('RN09 — conversão de preço do lojista para centavos', () => {
  it('converte decimal com vírgula ou ponto sem arredondamento', () => {
    expect(parsePriceCents('27,99')).toBe(2799)
    expect(parsePriceCents('27.9')).toBe(2790)
    expect(parsePriceCents('27')).toBe(2700)
  })

  it('rejeita valores inválidos e mais de duas casas decimais', () => {
    expect(parsePriceCents('0,00')).toBeNull()
    expect(parsePriceCents('-1,00')).toBeNull()
    expect(parsePriceCents('27,999')).toBeNull()
    expect(parsePriceCents('1.234,50')).toBeNull()
  })
})

describe('UT-13 — hash de API key', () => {
  it('gera SHA-256 determinístico sem guardar a chave em texto puro', () => {
    const rawKey = 'demo-market-api-key-unique'
    const storedHash = hashApiKey(rawKey)
    expect(storedHash).toMatch(/^[a-f0-9]{64}$/)
    expect(storedHash).not.toBe(rawKey)
    expect(hashApiKey(rawKey)).toBe(storedHash)
  })
})

describe('UT-14 — hash de senha', () => {
  it('armazena hash bcrypt validável, nunca a senha em texto puro', async () => {
    const password = 'Senha segura 2026!'
    const storedHash = await hashPassword(password)
    expect(storedHash).not.toBe(password)
    expect(storedHash).toMatch(/^\$2[aby]\$/)
    expect(await bcrypt.compare(password, storedHash)).toBe(true)
    expect(await bcrypt.compare('senha incorreta', storedHash)).toBe(false)
  })
})
