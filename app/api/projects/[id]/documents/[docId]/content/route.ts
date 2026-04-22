import { NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { Project } from '@/lib/models/Project'
import { requireAuth } from '@/lib/security/requireAuth'
import { getObjectBufferAsync } from '@/lib/storage/minioClient'

function guessContentTypeFromName(name: string): string {
  const lower = String(name || '').toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.doc')) return 'application/msword'
  if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (lower.endsWith('.zip')) return 'application/zip'
  return 'application/octet-stream'
}

function sanitizeFilename(name: string): string {
  return String(name || 'document')
    .replace(/[\r\n"]/g, '')
    .trim() || 'document'
}

export async function GET(request: Request) {
  try {
    await dbConnect()
    const auth = await requireAuth(request as any, ['user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ message: auth.error }, { status: auth.status })

    const url = new URL(request.url)
    const parts = url.pathname.split('/').filter(Boolean)
    const projectIndex = parts.indexOf('projects')
    const documentsIndex = parts.indexOf('documents')
    const id = projectIndex >= 0 && parts.length > projectIndex + 1 ? parts[projectIndex + 1] : undefined
    const docId = documentsIndex >= 0 && parts.length > documentsIndex + 1 ? parts[documentsIndex + 1] : undefined
    const disposition = (url.searchParams.get('disposition') || 'inline').toLowerCase() === 'attachment' ? 'attachment' : 'inline'

    if (!id || !docId) {
      return NextResponse.json({ message: 'Pfad-Parameter fehlen' }, { status: 400 })
    }

    const project = await Project.findById(id).lean()
    if (!project) return NextResponse.json({ message: 'Projekt nicht gefunden' }, { status: 404 })

    const allDocs = ((project as any)?.dokumente?.all || []) as any[]
    const doc = allDocs.find((d) => String(d?.id) === String(docId))
    if (!doc) return NextResponse.json({ message: 'Dokument nicht gefunden' }, { status: 404 })

    const bucketName = process.env.MINIO_BUCKET || 'project-documents'
    const rawUrl = String(doc?.url || '')

    if (!rawUrl.startsWith('minio://')) {
      return NextResponse.json({ message: 'Dokumentquelle nicht unterstuetzt' }, { status: 400 })
    }

    // Expected storage format: minio://{bucket}/{key}
    // Keep compatibility with older values where bucket may differ.
    const withoutPrefix = rawUrl.replace('minio://', '')
    const firstSlash = withoutPrefix.indexOf('/')
    if (firstSlash < 0) {
      return NextResponse.json({ message: 'Objekt-Pfad ungueltig' }, { status: 400 })
    }
    const sourceBucket = withoutPrefix.slice(0, firstSlash) || bucketName
    const key = withoutPrefix.slice(firstSlash + 1)
    if (!key) return NextResponse.json({ message: 'Objekt-Pfad ungueltig' }, { status: 400 })

    const data = await getObjectBufferAsync(sourceBucket, key)
    const filename = sanitizeFilename(String(doc?.name || 'document'))
    const contentType = guessContentTypeFromName(filename)

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(data.length),
        'Content-Disposition': `${disposition}; filename="${filename}"`,
        'Cache-Control': 'private, no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    })
  } catch (error) {
    console.error('Document content proxy failed:', error)
    return NextResponse.json({ message: 'Dokument kann nicht angezeigt werden' }, { status: 500 })
  }
}

