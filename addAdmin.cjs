const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// .env.local bevorzugt laden, sonst .env
try {
  const envLocalPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envLocalPath)) {
    require('dotenv').config({ path: envLocalPath });
  } else {
    require('dotenv').config();
  }
} catch (_) {}

const mongoUri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || 'MHZeiterfassung';

async function main() {
  if (!mongoUri) {
    console.error('Fehler: MONGODB_URI ist nicht gesetzt. Bitte lege sie in .env.local oder als Umgebungsvariable fest.');
    process.exit(1);
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.error('Fehler: ADMIN_EMAIL und ADMIN_PASSWORD müssen gesetzt sein.');
    process.exit(1);
  }

  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db(dbName);

  const admin = {
    name: process.env.ADMIN_NAME || 'Admin',
    email: adminEmail,
    password: await bcrypt.hash(adminPassword, 12),
    phoneNumber: process.env.ADMIN_PHONE || '',
    role: process.env.ADMIN_ROLE || 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.collection('users').insertOne(admin);
  console.log('Admin erfolgreich angelegt!');
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});