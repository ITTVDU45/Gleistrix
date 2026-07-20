import { defineConfig } from 'vitest/config'
import path from 'path'
import { sharedAliases } from './vitest.config'

/**
 * Integrationstests der Admin-App gegen echte MongoDB (mongodb-memory-server
 * bzw. MONGODB_TEST_URI). Ausführung über `pnpm test:integration`.
 */
export default defineConfig({
  resolve: {
    alias: [
      ...sharedAliases,
      { find: '@', replacement: path.resolve(__dirname, '.') },
    ],
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
