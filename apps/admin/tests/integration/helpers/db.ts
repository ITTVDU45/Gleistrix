import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

let server: MongoMemoryServer | null = null

/**
 * Verbindet Mongoose mit einer echten Test-Datenbank:
 * - MONGODB_TEST_URI, falls gesetzt (z. B. CI mit Mongo-Service),
 * - sonst mongodb-memory-server (lädt beim ersten Lauf das mongod-Binary).
 */
export async function connectTestDb(): Promise<void> {
  const externalUri = process.env.MONGODB_TEST_URI
  let uri = externalUri
  if (!uri) {
    server = await MongoMemoryServer.create()
    uri = server.getUri()
  }
  process.env.MONGODB_URI = uri
  await mongoose.connect(uri, { dbName: `gleistrix-test-${process.pid}` })
}

export async function disconnectTestDb(): Promise<void> {
  try {
    await mongoose.connection.dropDatabase()
  } catch {
    // Datenbank existiert ggf. nicht mehr
  }
  await mongoose.disconnect()
  if (server) {
    await server.stop()
    server = null
  }
}

/** Leert alle Collections zwischen Tests (Indizes bleiben erhalten). */
export async function clearCollections(): Promise<void> {
  const db = mongoose.connection.db
  if (!db) return
  const collections = await db.collections()
  await Promise.all(collections.map((c) => c.deleteMany({})))
}
