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
    
    cached.promise = mongoose.connect(MONGODB_URI as string, options)
      .then(m => {
        console.log('MongoDB-Verbindung erfolgreich hergestellt');
        if (mongoose.connection.db) {
          console.log('Verbundene Datenbank:', mongoose.connection.db.databaseName);
        }
        return m;
      })
      .catch(err => {
        console.error('MongoDB-Verbindungsfehler:', err);
        throw err;
      });
  }
  cached.conn = await cached.promise
  return cached.conn
}

export default dbConnect 