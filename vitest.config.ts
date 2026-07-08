import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    root: '.',
    include: ['tests/**/*.test.{ts,tsx}'],
    pool: 'threads',
    testTimeout: 10000,
    poolOptions: { threads: { maxThreads: 4 } },
  },
})
