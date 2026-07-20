import { defineConfig } from 'vitest/config'
import path from 'path'

const shared = path.resolve(__dirname, '../../packages/shared/src')

/** Aliase spiegeln die tsconfig-Paths (geteilte Module in packages/shared). */
const aliases = [
  { find: /^@\/lib\/(models|subunternehmen|timeEntry|storage|http|security|company)\/(.*)$/, replacement: `${shared}/$1/$2` },
  { find: /^@\/lib\/(mailer|dbConnect|logger|errors|featureFlags|notificationDefs|rateLimit|utils)$/, replacement: `${shared}/$1.ts` },
  { find: /^@\/components\/ui\/(.*)$/, replacement: `${shared}/components/ui/$1` },
  { find: /^@\/types\/(main|subunternehmen)$/, replacement: `${shared}/types/$1.ts` },
  { find: '@', replacement: path.resolve(__dirname, '.') },
]

/** Integrationstests der Portal-App gegen echte MongoDB. */
export default defineConfig({
  resolve: { alias: aliases },
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    fileParallelism: false,
    hookTimeout: 120_000,
    testTimeout: 60_000,
  },
})
