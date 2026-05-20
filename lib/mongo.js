import { MongoClient } from 'mongodb'

const uri = process.env.MONGO_URL
const dbName = process.env.DB_NAME || 'seoforge'

let client
let dbPromise

async function getClient() {
  if (!client) {
    client = new MongoClient(uri, { maxPoolSize: 20 })
    await client.connect()
  }
  return client
}

export async function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const c = await getClient()
      const db = c.db(dbName)
      // Ensure indexes
      try {
        await db.collection('users').createIndex({ email: 1 }, { unique: true })
        await db.collection('articles').createIndex({ userId: 1, createdAt: -1 })
        await db.collection('articles').createIndex({ jobId: 1 })
        await db.collection('jobs').createIndex({ userId: 1, createdAt: -1 })
        await db.collection('jobs').createIndex({ status: 1, createdAt: 1 })
      } catch (e) { /* ignore */ }
      return db
    })()
  }
  return dbPromise
}

export function stripId(doc) {
  if (!doc) return doc
  const { _id, ...rest } = doc
  return rest
}
