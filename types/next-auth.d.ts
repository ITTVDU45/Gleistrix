import 'next-auth'
import 'next-auth/jwt'

/**
 * Modul-Augmentation: ergänzt die NextAuth-Typen um die eigenen Felder
 * (id, role, modules), damit die Callbacks in `[...nextauth]/route.ts` und
 * `getToken()`-Aufrufer typisiert statt `any` sind.
 */
declare module 'next-auth' {
  interface User {
    role?: string
    modules?: string[]
  }

  interface Session {
    user: {
      id?: string
      role?: string
      modules?: string[]
      email?: string | null
      name?: string | null
      image?: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    role?: string
    modules?: string[]
    email?: string | null
    name?: string | null
  }
}
