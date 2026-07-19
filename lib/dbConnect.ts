import mongoose from 'mongoose'
import { logger } from './logger'

/**
 * Serverless-optimiertes MongoDB Singleton Pattern
 * 
 * Wichtige Optimierungen für Vercel + MongoDB Atlas M0:
 * - maxPoolSize: 5 (M0 hat max ~100 Connections, Serverless skaliert aggressiv)
 * - minPoolSize: 0 (keine Idle-Verbindungen halten)
 * - Korrektes globalThis-Caching verhindert neue Connections pro Request
 */

function getMongoUri(): string {
  const mongoUri = process.env.MONGODB_URI
  if (!mongoUri) throw new Error('Bitte MONGODB_URI in .env.local setzen')
  return mongoUri
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
    const mongoUri = getMongoUri()
    logger.debug('Verbindung zur MongoDB herstellen...')

    // Halte den Pool fuer M0 bewusst klein, damit mehrere Serverless-Instanzen
    // das Cluster nicht gemeinsam an die Verbindungsgrenze fahren.
    const options: mongoose.ConnectOptions = {
      bufferCommands: false,
      dbName: 'MHZeiterfassung',
      maxPoolSize: 1,
      minPoolSize: 0,                    // Keine Idle-Connections in Serverless
      maxIdleTimeMS: 10000,              // Idle-Connections schnell abbauen
      serverSelectionTimeoutMS: 5000,    // Schnelleres Timeout bei Problemen
      socketTimeoutMS: 45000,            // Socket-Timeout
      waitQueueTimeoutMS: 10000,         // Requests nicht endlos auf freie Sockets warten lassen
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
          logger.warn(`MongoDB connect attempt ${i + 1} failed`, { message: lastErr.message })
          // Nur bei transienten Netzwerk/DNS-Fehlern warten und erneut versuchen
          if (i < attempts - 1) {
            const delay = 500 * (i + 1)
            logger.debug(`Warte ${delay}ms vor erneutem Verbindungsversuch...`)
            await new Promise((r) => setTimeout(r, delay))
          }
        }
      }
      throw lastErr
    }

    cached.promise = tryConnect(mongoUri, options)
      .then((m) => {
        logger.info('MongoDB-Verbindung hergestellt', {
          database: mongoose.connection.db?.databaseName,
          maxPoolSize: options.maxPoolSize,
        })
        return m
      })
      .catch((err) => {
        // Promise zurücksetzen damit ein neuer Versuch möglich ist
        cached.promise = null
        logger.error('MongoDB-Verbindungsfehler nach mehreren Versuchen', err)
        throw err
      })
  }

  cached.conn = await cached.promise
  return cached.conn
}

export default dbConnect
