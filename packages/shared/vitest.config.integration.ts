import { defineConfig } from 'vitest/config'
import { sharedSelfAliases } from './vitest.config'

/**
 * Integrationstests der geteilten Domänenlogik gegen echte MongoDB
 * (mongodb-memory-server bzw. MONGODB_TEST_URI).
 */
export default defineConfig({
  resolve: { alias: sharedSelfAliases },
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    // Eine gemeinsame Mongo-Instanz je Datei; Dateien seriell ausführen
    fileParallelism: false,
    hookTimeout: 120_000,
    testTimeout: 60_000,
  },
})
