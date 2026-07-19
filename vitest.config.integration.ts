import { defineConfig } from 'vitest/config'
import path from 'path'

/**
 * Integrationstests gegen eine echte MongoDB (mongodb-memory-server bzw.
 * MONGODB_TEST_URI). Bewusst getrennt von den Unit-Tests, damit `pnpm test`
 * schnell bleibt: Ausführung über `pnpm test:integration`.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    // Eine gemeinsame Mongo-Instanz je Datei; Dateien seriell ausführen
    fileParallelism: false,
    hookTimeout: 120_000,
    testTimeout: 60_000,
  },
})
