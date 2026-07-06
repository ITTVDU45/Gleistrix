import { graphGet, graphPost, graphUpload } from './graph-client'

interface SharePointSite {
  id: string
  displayName: string
  webUrl: string
  name: string
}

interface SharePointDrive {
  id: string
  name: string
  driveType: string
  webUrl: string
}

interface DriveItem {
  id: string
  name: string
  size?: number
  webUrl?: string
  folder?: { childCount: number }
  file?: { mimeType: string }
}

interface ListResponse<T> {
  value: T[]
}

export async function searchSites(query: string): Promise<SharePointSite[]> {
  const result = await graphGet<ListResponse<SharePointSite>>(
    `/sites?search=${encodeURIComponent(query)}`
  )
  return result.value || []
}

export async function getSiteByPath(hostname: string, sitePath: string): Promise<SharePointSite> {
  return graphGet<SharePointSite>(`/sites/${hostname}:/${sitePath}`)
}

export async function getSiteDrives(siteId: string): Promise<SharePointDrive[]> {
  const result = await graphGet<ListResponse<SharePointDrive>>(`/sites/${siteId}/drives`)
  return result.value || []
}

export async function listDriveItems(driveId: string, folderId?: string): Promise<DriveItem[]> {
  const path = folderId
    ? `/drives/${driveId}/items/${folderId}/children`
    : `/drives/${driveId}/root/children`
  const result = await graphGet<ListResponse<DriveItem>>(path)
  return result.value || []
}

export async function createSharePointFolder(
  driveId: string,
  parentItemId: string,
  folderName: string
): Promise<DriveItem> {
  return graphPost<DriveItem>(
    `/drives/${driveId}/items/${parentItemId}/children`,
    {
      name: folderName,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'fail',
    }
  )
}

export async function uploadToSharePoint(
  driveId: string,
  parentPath: string,
  fileName: string,
  content: Buffer | Uint8Array,
  contentType: string
): Promise<DriveItem> {
  const encodedPath = encodeURIComponent(`${parentPath}/${fileName}`).replace(/%2F/g, '/')

  return graphUpload(
    `/drives/${driveId}/root:/${encodedPath}:/content`,
    content,
    contentType
  ) as Promise<DriveItem>
}

export async function ensureSharePointFolder(
  driveId: string,
  fullPath: string
): Promise<DriveItem> {
  const segments = fullPath.split('/').filter(Boolean)
  let currentPath = ''

  let lastItem: DriveItem | null = null

  for (const segment of segments) {
    currentPath = currentPath ? `${currentPath}/${segment}` : segment

    try {
      const encodedPath = encodeURIComponent(currentPath).replace(/%2F/g, '/')
      lastItem = await graphGet<DriveItem>(`/drives/${driveId}/root:/${encodedPath}`)
    } catch {
      const parentId = lastItem?.id || 'root'
      lastItem = await createSharePointFolder(driveId, parentId, segment)
    }
  }

  if (!lastItem) {
    throw new Error(`SharePoint-Ordner konnte nicht erstellt werden: ${fullPath}`)
  }

  return lastItem
}
