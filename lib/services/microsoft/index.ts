export { graphGet, graphPost, graphPatch, graphDelete, graphUpload } from './graph-client'

export {
  buildAuthorizationUrl,
  buildScopes,
  exchangeCodeForTokens,
  refreshAccessToken,
  validateToken,
} from './oauth'

export type { TokenSet } from './oauth'

export {
  listCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from './calendar-sync'

export type { CalendarEventInput } from './calendar-sync'

export {
  listInboxMessages,
  sendMail,
  getMailMessage,
  searchMail,
} from './outlook-sync'

export type { SendMailInput } from './outlook-sync'

export {
  listRootChildren,
  listFolderChildren,
  listFolderByPath,
  createFolder,
  ensureFolder,
  uploadSmallFile,
  getFileByPath,
  deleteItem,
  getDownloadUrl,
} from './onedrive-sync'

export {
  searchSites,
  getSiteByPath,
  getSiteDrives,
  listDriveItems,
  createSharePointFolder,
  uploadToSharePoint,
  ensureSharePointFolder,
} from './sharepoint-sync'

export {
  listJoinedTeams,
  listTeamChannels,
  sendChannelMessage,
  sendProjectNotification,
} from './teams-sync'
