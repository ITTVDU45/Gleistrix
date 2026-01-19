import mongoose from 'mongoose'

/**
 * Serverless-optimiertes MongoDB Singleton Pattern
 * 
 * Wichtige Optimierungen für Vercel + MongoDB Atlas M0:
 * - maxPoolSize: 5 (M0 hat max ~100 Connections, Serverless skaliert aggressiv)
 * - minPoolSize: 0 (keine Idle-Verbindungen halten)
 * - Korrektes globalThis-Caching verhindert neue Connections pro Request
 */

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  throw new Error('Bitte MONGODB_URI in .env.local setzen')
}

// TypeScript-typisierter globaler Cache für Mongoose-Verbindung
declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null }
}

// Globalen Cache initialisieren falls nicht vorhanden
if (!global.mongooseCache) {
  global.mongooseCache = { conn: null, promise: null }
}

const cached = global.mongooseCache

async function dbConnect(): Promise<typeof mongoose> {
  // Bestehende Verbindung wiederverwenden
  if (cached.conn) {
    return cached.conn
  }

  // Verbindungspromise wiederverwenden falls vorhanden
  if (!cached.promise) {
    console.log('Verbindung zur MongoDB herstellen...')
    console.log('URI:', MONGODB_URI?.substring(0, 20) + '...')

    // Serverless-optimierte MongoDB-Optionen
    // maxPoolSize: 5 verhindert Connection-Limit bei M0 Atlas Cluster
    const options: mongoose.ConnectOptions = {
      bufferCommands: false,
      dbName: 'MHZeiterfassung',
      maxPoolSize: 5,                    // M0-Cluster kompatibel
      minPoolSize: 0,                    // Keine Idle-Connections in Serverless
      serverSelectionTimeoutMS: 5000,    // Schnelleres Timeout bei Problemen
      socketTimeoutMS: 45000,            // Socket-Timeout
    }

    // Retry logic for transient DNS/timeout errors (e.g. querySrv ETIMEOUT)
    const tryConnect = async (uri: string, opts: mongoose.ConnectOptions, attempts = 4): Promise<typeof mongoose> => {
      let lastErr: Error | null = null
      for (let i = 0; i < attempts; i++) {
        try {
          const m = await mongoose.connect(uri, opts)
          return m
        } catch (err: unknown) {
          lastErr = err instanceof Error ? err : new Error(String(err))
          console.error(`MongoDB connect attempt ${i + 1} failed:`, lastErr.message)
          // Nur bei transienten Netzwerk/DNS-Fehlern warten und erneut versuchen
          if (i < attempts - 1) {
            const delay = 500 * (i + 1)
            console.log(`Warte ${delay}ms vor erneutem Verbindungsversuch...`)
            await new Promise((r) => setTimeout(r, delay))
          }
        }
      }
      throw lastErr
    }

    cached.promise = tryConnect(MONGODB_URI as string, options)
      .then((m) => {
        console.log('MongoDB-Verbindung erfolgreich hergestellt')
        if (mongoose.connection.db) {
          console.log('Verbundene Datenbank:', mongoose.connection.db.databaseName)
        }
        console.log(`Connection Pool: maxPoolSize=${options.maxPoolSize}`)
        return m
      })
      .catch((err) => {
        // Promise zurücksetzen damit ein neuer Versuch möglich ist
        cached.promise = null
        console.error('MongoDB-Verbindungsfehler nach mehreren Versuchen:', err)
        throw err
      })
  }

  cached.conn = await cached.promise
  return cached.conn
}

export default dbConnect
