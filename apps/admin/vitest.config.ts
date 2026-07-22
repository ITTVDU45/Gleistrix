import { defineConfig } from 'vitest/config'
import path from 'path'

const shared = path.resolve(__dirname, '../../packages/shared/src')

/** Aliase spiegeln die tsconfig-Paths: geteilte Module liegen in packages/shared. */
export const sharedAliases = [
  { find: /^@\/lib\/(models|subunternehmen|timeEntry|holidays|storage|http|security|company)\/(.*)$/, replacement: `${shared}/$1/$2` },
  { find: /^@\/lib\/timeEntry$/, replacement: `${shared}/timeEntry/index.ts` },
  { find: /^@\/lib\/holidays$/, replacement: `${shared}/holidays/index.ts` },
  { find: /^@\/lib\/(mailer|dbConnect|logger|errors|featureFlags|notificationDefs|rateLimit|utils)$/, replacement: `${shared}/$1.ts` },
  { find: /^@\/components\/ui\/(.*)$/, replacement: `${shared}/components/ui/$1` },
  { find: /^@\/types\/(main|subunternehmen)$/, replacement: `${shared}/types/$1.ts` },
]

export default defineConfig({
  resolve: {
    alias: [
      ...sharedAliases,
      { find: '@', replacement: path.resolve(__dirname, '.') },
    ],
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
})
