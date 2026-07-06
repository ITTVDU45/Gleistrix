import { graphGet, graphPost, graphUpload, graphDelete } from './graph-client'

interface DriveItem {
  id: string
  name: string
  size?: number
  webUrl?: string
  folder?: { childCount: number }
  file?: { mimeType: string }
  createdDateTime?: string
  lastModifiedDateTime?: string
  '@microsoft.graph.downloadUrl'?: string
}

interface DriveItemListResponse {
  value: DriveItem[]
  '@odata.nextLink'?: string
}

export async function listRootChildren(): Promise<DriveItem[]> {
  const result = await graphGet<DriveItemListResponse>('/me/drive/root/children')
  return result.value || []
}

export async function listFolderChildren(folderId: string): Promise<DriveItem[]> {
  const result = await graphGet<DriveItemListResponse>(`/me/drive/items/${folderId}/children`)
  return result.value || []
}

export async function listFolderByPath(path: string): Promise<DriveItem[]> {
  const encodedPath = encodeURIComponent(path).replace(/%2F/g, '/')
  const result = await graphGet<DriveItemListResponse>(
    `/me/drive/root:/${encodedPath}:/children`
  )
  return result.value || []
}

export async function createFolder(parentPath: string, folderName: string): Promise<DriveItem> {
  const path = parentPath
    ? `/me/drive/root:/${encodeURIComponent(parentPath).replace(/%2F/g, '/')}:/children`
    : '/me/drive/root/children'

  return graphPost<DriveItem>(
    path,
    {
      name: folderName,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'fail',
    }
  )
}

export async function ensureFolder(fullPath: string): Promise<DriveItem> {
  const segments = fullPath.split('/').filter(Boolean)
  let currentPath = ''

  let lastItem: DriveItem | null = null

  for (const segment of segments) {
    const parentPath = currentPath || '/'
    currentPath = currentPath ? `${currentPath}/${segment}` : segment

    try {
      const encodedPath = encodeURIComponent(currentPath).replace(/%2F/g, '/')
      lastItem = await graphGet<DriveItem>(`/me/drive/root:/${encodedPath}`)
    } catch {
      lastItem = await createFolder(parentPath === '/' ? '' : parentPath, segment)
    }
  }

  if (!lastItem) {
    throw new Error(`Ordner konnte nicht erstellt werden: ${fullPath}`)
  }

  return lastItem
}

export async function uploadSmallFile(
  folderPath: string,
  fileName: string,
  content: Buffer | Uint8Array,
  contentType: string
): Promise<DriveItem> {
  const encodedPath = encodeURIComponent(`${folderPath}/${fileName}`).replace(/%2F/g, '/')

  return graphUpload(
    `/me/drive/root:/${encodedPath}:/content`,
    content,
    contentType
  ) as Promise<DriveItem>
}

export async function getFileByPath(filePath: string): Promise<DriveItem> {
  const encodedPath = encodeURIComponent(filePath).replace(/%2F/g, '/')
  return graphGet<DriveItem>(`/me/drive/root:/${encodedPath}`)
}

export async function deleteItem(itemId: string): Promise<void> {
  await graphDelete(`/me/drive/items/${itemId}`)
}

export async function getDownloadUrl(itemId: string): Promise<string> {
  const item = await graphGet<DriveItem>(`/me/drive/items/${itemId}`)
  return item['@microsoft.graph.downloadUrl'] || item.webUrl || ''
}
