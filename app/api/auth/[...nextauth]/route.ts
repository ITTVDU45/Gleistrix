import NextAuth from "next-auth";
import type { AuthOptions, SessionStrategy } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import dbConnect from "../../../../lib/dbConnect";
import User from "../../../../lib/models/User";
import { compare } from "bcryptjs";
import mongoose from "mongoose";

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
          await dbConnect();
          console.log(`Suche Benutzer mit E-Mail: ${credentials.email}`);
          
          // Überprüfen der Verbindung und der Collection
          console.log("MongoDB-Verbindungsstatus:", mongoose.connection.readyState === 1 ? "Verbunden" : "Nicht verbunden");
          
          // Direkt mit der Collection arbeiten
          const db = mongoose.connection.db;
          if (!db) {
            throw new Error('Datenbankverbindung nicht verfügbar');
          }
          const usersCollection = db.collection('users');
          console.log("Collection 'users' gefunden:", usersCollection ? "Ja" : "Nein");
          
          // Benutzer direkt aus der Collection abfragen
          const userDoc = await usersCollection.findOne({ email: credentials.email });
          console.log("Benutzer direkt aus Collection gefunden:", userDoc ? "Ja" : "Nein");
          
          if (!userDoc) {
            console.log(`Benutzer mit E-Mail ${credentials.email} nicht gefunden`);
            throw new Error("E-Mail oder Passwort ist falsch");
          }
          
          console.log(`Benutzer gefunden: ${userDoc.name || userDoc.email}`);
          
          // Prüfen ob Account aktiv ist
          if (userDoc.isActive === false) {
            console.log(`Account ist deaktiviert: ${userDoc.email}`);
            throw new Error("Account ist deaktiviert");
          }

          console.log("Überprüfe Passwort...");
          const isValid = await compare(credentials.password, userDoc.password);
          
          if (!isValid) {
            console.log("Passwort ist falsch");
            throw new Error("E-Mail oder Passwort ist falsch");
          }

          // LastLogin aktualisieren
          await usersCollection.updateOne(
            { _id: userDoc._id },
            { $set: { lastLogin: new Date() } }
          );

          console.log('=== LOGIN ERFOLGREICH ===');
          console.log(`Benutzer: ${userDoc.name || 'N/A'} (${userDoc.email})`);
          console.log(`Rolle: ${userDoc.role || 'N/A'}`);
          console.log(`Zeit: ${new Date().toLocaleString('de-DE')}`);
          console.log('========================');

          return {
            id: userDoc._id.toString(),
            email: userDoc.email,
            name: userDoc.name || '',
            role: userDoc.role || 'user'
          };
        } catch (error) {
          console.error("Authentifizierungsfehler:", error);
          throw new Error(error instanceof Error ? error.message : "Ein Fehler ist aufgetreten");
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }: { token: any; user?: any }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      if (token) {
        session.user.id = token.id;
        session.user.role = token.role;
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
  secret: process.env.NEXTAUTH_SECRET || "ein-sicheres-geheimnis-für-entwicklung",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
