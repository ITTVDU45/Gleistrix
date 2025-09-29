#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });
const { spawnSync } = require('child_process');
const path = require('path');

const mcPath = path.join(__dirname, 'mc');
const endpoint = process.env.MINIO_ENDPOINT || '';
const access = process.env.MINIO_ACCESS_KEY || '';
const secret = process.env.MINIO_SECRET_KEY || '';
const bucket = process.env.MINIO_BUCKET || 'project-documents';

console.log('mc path:', mcPath);
console.log('Using endpoint=', endpoint, 'bucket=', bucket);

if (!endpoint || !access || !secret) {
  console.error('Missing MINIO_ENDPOINT or MINIO_ACCESS_KEY or MINIO_SECRET_KEY in .env.local');
  process.exit(1);
}

// alias set
let r = spawnSync(mcPath, ['alias', 'set', 'testminio', endpoint, access, secret], { stdio: 'inherit' });
if (r.error) {
  console.error('mc alias set failed', r.error);
  process.exit(1);
}

// ls bucket
r = spawnSync(mcPath, ['ls', 'testminio/' + bucket], { stdio: 'inherit' });
if (r.error) {
  console.error('mc ls failed', r.error);
  process.exit(1);
}

console.log('mc-test done');


