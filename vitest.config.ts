import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@shared': resolve(__dirname, 'shared')
    }
  },
  test: {
    environment: 'node',
    include: ['electron/**/*.test.ts', 'shared/**/*.test.ts', 'src/**/*.test.ts', 'art-src/**/*.test.ts'],
    testTimeout: 30_000
  }
})
