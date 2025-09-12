import { Client } from 'minio';

// Parse MINIO_ENDPOINT to support full URLs like https://host:port or plain hostnames
const rawEndpoint = process.env.MINIO_ENDPOINT || '127.0.0.1';
let endPoint = rawEndpoint;
let port = Number(process.env.MINIO_PORT || 9000);
let useSSL = (process.env.MINIO_USE_SSL || 'false') === 'true';

try {
  // If rawEndpoint contains a protocol, parse it
  const u = new URL(rawEndpoint);
  endPoint = u.hostname;
  if (u.port) port = Number(u.port);
  useSSL = u.protocol === 'https:';
} catch (_) {
  // not a full URL, keep defaults but allow env overrides
  endPoint = rawEndpoint;
  port = Number(process.env.MINIO_PORT || port);
  useSSL = (process.env.MINIO_USE_SSL || String(useSSL)) === 'true';
}

const minioClient = new Client({
  endPoint,
  port,
  useSSL,
  accessKey: process.env.MINIO_ACCESS_KEY || '',
  secretKey: process.env.MINIO_SECRET_KEY || ''
});

export default minioClient;

export async function removeObject(bucket: string, key: string) {
  return new Promise<void>((resolve, reject) => {
    minioClient.removeObject(bucket, key, (err: any) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

// Promise-based helpers for commonly used MinIO operations
export function presignedPutObjectAsync(bucket: string, key: string, expiresSeconds: number) {
  return new Promise<string>((resolve, reject) => {
    // @ts-ignore - callback API
    minioClient.presignedPutObject(bucket, key, expiresSeconds, (err: any, presignedUrl: string) => {
      if (err) return reject(err);
      resolve(presignedUrl);
    });
  });
}

export function presignedGetObjectAsync(bucket: string, key: string, expiresSeconds: number) {
  return new Promise<string>((resolve, reject) => {
    // @ts-ignore - callback API
    minioClient.presignedGetObject(bucket, key, expiresSeconds, (err: any, presignedUrl: string) => {
      if (err) return reject(err);
      resolve(presignedUrl);
    });
  });
}

export function statObjectAsync(bucket: string, key: string) {
  return new Promise<any>((resolve, reject) => {
    // @ts-ignore - callback API vs options API type conflict
    minioClient.statObject(bucket, key, (err: any, stat: any) => {
      if (err) return reject(err);
      resolve(stat);
    });
  });
}

export function bucketExistsAsync(bucket: string) {
  return new Promise<boolean>((resolve, reject) => {
    minioClient.bucketExists(bucket, (err: any, exists: boolean) => {
      if (err) return reject(err);
      resolve(exists);
    });
  });
}

export function makeBucketAsync(bucket: string, region?: string) {
  return new Promise<void>((resolve, reject) => {
    minioClient.makeBucket(bucket, region || '', (err: any) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

export function getObjectBufferAsync(bucket: string, key: string) {
  return new Promise<Buffer>((resolve, reject) => {
    minioClient.getObject(bucket, key, (err: any, stream: any) => {
      if (err) return reject(err);
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', (e: any) => reject(e));
    });
  });
}

// Attach helpers to client for backwards-compatible usage in routes
(minioClient as any).presignedPutObjectAsync = presignedPutObjectAsync;
(minioClient as any).presignedGetObjectAsync = presignedGetObjectAsync;
(minioClient as any).statObjectAsync = statObjectAsync;
(minioClient as any).bucketExistsAsync = bucketExistsAsync;
(minioClient as any).makeBucketAsync = makeBucketAsync;

export function getProjectObjectKey(project: any, filename: string) {
  // Struktur: auftragsnummer/projektname/YYYY-MM-DD/filename
  const auftragsnummer = project?.auftragsnummer || project?.id || 'unknown-order';
  const safeProjectName = (project?.name || 'projekt').replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-');
  const date = new Date().toISOString().slice(0,10);
  return `${auftragsnummer}/${safeProjectName}/${date}/${filename}`;
}


