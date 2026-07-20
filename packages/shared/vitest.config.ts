import { defineConfig } from 'vitest/config'
import path from 'path'

const src = path.resolve(__dirname, 'src')

/**
 * Interne Imports der Shared-Quellen nutzen die App-Aliase (@/lib, @/types,
 * @/components); hier zeigen sie auf das eigene src-Verzeichnis.
 */
export const sharedSelfAliases = [
  { find: /^@\/lib\/(.*)$/, replacement: `${src}/$1` },
  { find: /^@\/components\/(.*)$/, replacement: `${src}/components/$1` },
  { find: /^@\/types\/(.*)$/, replacement: `${src}/types/$1` },
]

export default defineConfig({
  resolve: { alias: sharedSelfAliases },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
