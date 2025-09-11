import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Bitte MONGODB_URI in .env.local setzen');
}

let cached = (global as any).mongoose || { conn: null, promise: null }

async function dbConnect() {
  if (cached.conn) return cached.conn
  if (!cached.promise) {
    console.log('Verbindung zur MongoDB herstellen...');
    console.log('URI:', MONGODB_URI?.substring(0, 20) + '...');
    
    // Explizit die Datenbank "MHZeiterfassung" angeben
    const options = { 
      bufferCommands: false,
      dbName: 'MHZeiterfassung'
    };
    // Retry logic for transient DNS/timeout errors (e.g. querySrv ETIMEOUT)
    const tryConnect = async (uri: string, opts: any, attempts = 3) => {
      let lastErr: any = null
      for (let i = 0; i < attempts; i++) {
        try {
          const m = await mongoose.connect(uri, opts)
          return m
        } catch (err: any) {
          lastErr = err
          console.error(`MongoDB connect attempt ${i + 1} failed:`, err && err.message ? err.message : err)
          // only wait/retry for transient network/DNS errors
          if (i < attempts - 1) {
            const delay = 500 * (i + 1)
            console.log(`Warte ${delay}ms vor erneutem Verbindungsversuch...`)
            await new Promise((r) => setTimeout(r, delay))
          }
        }
      }
      throw lastErr
    }

    cached.promise = tryConnect(MONGODB_URI as string, options, 4)
      .then(m => {
        console.log('MongoDB-Verbindung erfolgreich hergestellt');
        if (mongoose.connection.db) {
          console.log('Verbundene Datenbank:', mongoose.connection.db.databaseName);
        }
        return m;
      })
      .catch(err => {
        console.error('MongoDB-Verbindungsfehler nach mehreren Versuchen:', err);
        throw err;
      });
  }
  cached.conn = await cached.promise
  return cached.conn
}

export default dbConnect 