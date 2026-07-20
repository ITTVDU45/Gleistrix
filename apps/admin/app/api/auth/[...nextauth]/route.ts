import NextAuth from "next-auth";
import type { AuthOptions, SessionStrategy, Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import dbConnect from "@/lib/dbConnect";
import { compare } from "bcryptjs";
import mongoose from "mongoose";
import {
  ENV_SUPERADMIN_JWT_ID,
  envSuperadminDisplayName,
  matchEnvSuperadminCredentials,
} from "../../../../lib/auth/envSuperadmin";
import { logger } from "@/lib/logger";

const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "E-Mail", type: "email" },
        password: { label: "Passwort", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("E-Mail und Passwort erforderlich");
        }

        try {
          const envSuperEmail = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase() ?? "";
          const envSuperPassSet = Boolean(process.env.SUPERADMIN_PASSWORD);
          if (envSuperEmail && envSuperPassSet && credentials.email.trim().toLowerCase() === envSuperEmail) {
            if (!matchEnvSuperadminCredentials(credentials.email, credentials.password)) {
              throw new Error("E-Mail oder Passwort ist falsch");
            }
            return {
              id: ENV_SUPERADMIN_JWT_ID,
              email: credentials.email.trim(),
              name: envSuperadminDisplayName(),
              role: "superadmin",
              modules: [],
            };
          }

          await dbConnect();

          const db = mongoose.connection.db;
          if (!db) {
            throw new Error('Datenbankverbindung nicht verfügbar');
          }
          const usersCollection = db.collection('users');

          const userDoc = await usersCollection.findOne({ email: credentials.email });
          if (!userDoc) {
            throw new Error("E-Mail oder Passwort ist falsch");
          }

          // Prüfen ob Account aktiv ist
          if (userDoc.isActive === false) {
            throw new Error("Account ist deaktiviert");
          }

          // Subunternehmen melden sich im separaten Portal an
          if (userDoc.role === 'subunternehmen') {
            throw new Error("Bitte melden Sie sich im Subunternehmen-Portal an.");
          }

          const isValid = await compare(credentials.password, userDoc.password);
          if (!isValid) {
            throw new Error("E-Mail oder Passwort ist falsch");
          }

          // LastLogin aktualisieren
          await usersCollection.updateOne(
            { _id: userDoc._id },
            { $set: { lastLogin: new Date() } }
          );

          return {
            id: userDoc._id.toString(),
            email: userDoc.email,
            name: userDoc.name || '',
            role: userDoc.role || 'user',
            modules: userDoc.modules ?? [],
          };
        } catch (error) {
          logger.error("Authentifizierungsfehler", error);
          throw new Error(error instanceof Error ? error.message : "Ein Fehler ist aufgetreten");
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: User }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.modules = user.modules ?? [];
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (token) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.modules = token.modules ?? [];
        if (token.email) session.user.email = token.email;
        if (token.name) session.user.name = token.name;
      }
      return session;
    }
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: "jwt" as SessionStrategy,
    maxAge: 60 * 60 * 24 * 7, // 7 Tage
  },
  debug: process.env.NODE_ENV === 'development',
  // Kein unsicherer Fallback: fehlt das Secret, soll NextAuth hart failen,
  // statt JWTs mit einem im Code stehenden (öffentlichen) String zu signieren.
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
