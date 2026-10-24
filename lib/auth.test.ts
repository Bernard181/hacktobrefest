import { describe, expect, it } from 'vitest'
import bcrypt from 'bcryptjs'
import { hashApiKey, hashPassword } from './auth'
import { parsePriceCents } from '../components/merchant/price-input'

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
