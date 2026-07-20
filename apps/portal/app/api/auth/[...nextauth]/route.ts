import NextAuth from 'next-auth'
import type { AuthOptions, SessionStrategy, Session, User } from 'next-auth'
import type { JWT } from 'next-auth/jwt'
import CredentialsProvider from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import mongoose from 'mongoose'
import dbConnect from '@/lib/dbConnect'
import { logger } from '@/lib/logger'

/**
 * Auth des Subunternehmen-Portals: ausschließlich Konten mit Rolle
 * 'subunternehmen'. Interne Rollen (admin, user, lager, superadmin) melden
 * sich in der Admin-App an – hier werden sie mit klarer Meldung abgewiesen.
 */
const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'E-Mail', type: 'email' },
        password: { label: 'Passwort', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('E-Mail und Passwort erforderlich')
        }

        try {
          await dbConnect()
          const db = mongoose.connection.db
          if (!db) {
            throw new Error('Datenbankverbindung nicht verfügbar')
          }

          const userDoc = await db.collection('users').findOne({ email: credentials.email })
          if (!userDoc) {
            throw new Error('E-Mail oder Passwort ist falsch')
          }
          if (userDoc.isActive === false) {
            throw new Error('Account ist deaktiviert')
          }
          if (userDoc.role !== 'subunternehmen') {
            throw new Error('Dieses Portal ist Subunternehmen vorbehalten. Bitte nutzen Sie die interne Anmeldung.')
          }

          const isValid = await compare(credentials.password, userDoc.password)
          if (!isValid) {
            throw new Error('E-Mail oder Passwort ist falsch')
          }

          await db.collection('users').updateOne(
            { _id: userDoc._id },
            { $set: { lastLogin: new Date() } }
          )

          return {
            id: userDoc._id.toString(),
            email: userDoc.email,
            name: userDoc.name || '',
            role: 'subunternehmen',
            modules: [],
          }
        } catch (error) {
          logger.error('Portal-Authentifizierungsfehler', error)
          throw new Error(error instanceof Error ? error.message : 'Ein Fehler ist aufgetreten')
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: User }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.email = user.email
        token.name = user.name
      }
      return token
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (token) {
        session.user.id = token.id
        session.user.role = token.role
        if (token.email) session.user.email = token.email
        if (token.name) session.user.name = token.name
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt' as SessionStrategy,
    maxAge: 60 * 60 * 24 * 7, // 7 Tage
  },
  secret: process.env.NEXTAUTH_SECRET,
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
