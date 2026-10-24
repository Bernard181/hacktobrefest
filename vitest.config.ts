import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, '.') } },
  test: {
    include: ['lib/**/*.test.ts', 'tests/api.test.ts'],
    environment: 'node',
    clearMocks: true,
    restoreMocks: true,
  },
})
