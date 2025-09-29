require('dotenv').config({ path: '.env.local' });
(async () => {
  try {
    const { Client } = require('minio');
    const raw = process.env.MINIO_ENDPOINT || '127.0.0.1';
    let endPoint = raw;
    let port = process.env.MINIO_PORT ? Number(process.env.MINIO_PORT) : 9000;
    let useSSL = (process.env.MINIO_USE_SSL || 'false') === 'true';
    try {
      const u = new URL(raw);
      endPoint = u.hostname;
      if (u.port) port = Number(u.port);
      useSSL = u.protocol === 'https:';
    } catch (e) {
      // ignore
    }
    const client = new Client({ endPoint, port, useSSL, accessKey: process.env.MINIO_ACCESS_KEY, secretKey: process.env.MINIO_SECRET_KEY });
    const bucket = process.env.MINIO_BUCKET || 'project-documents';
    console.log('Test putObject to bucket', bucket, 'at', endPoint + ':' + port, 'useSSL=', useSSL);
    const key = 'test-put-' + Date.now() + '.txt';
    const data = Buffer.from('hello world');
    try {
      await client.putObject(bucket, key, data);
      console.log('putObject succeeded ->', `minio://${bucket}/${key}`);
    } catch (err) {
      console.error('putObject error', err);
    }
  } catch (e) {
    console.error('MinIO test failed', e);
  }
})();


