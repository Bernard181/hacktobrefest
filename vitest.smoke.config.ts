import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, '.') } },
  test: {
    include: ['tests/smoke.test.ts'],
    environment: 'node',
    clearMocks: true,
    restoreMocks: true,
  },
})
