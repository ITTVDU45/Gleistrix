import { graphGet, graphPost } from './graph-client'

interface Team {
  id: string
  displayName: string
  description?: string
}

interface Channel {
  id: string
  displayName: string
  description?: string
  membershipType?: string
}

interface ChatMessage {
  id?: string
  body: { contentType: string; content: string }
  createdDateTime?: string
}

interface ListResponse<T> {
  value: T[]
}

export async function listJoinedTeams(): Promise<Team[]> {
  const result = await graphGet<ListResponse<Team>>('/me/joinedTeams')
  return result.value || []
}

export async function listTeamChannels(teamId: string): Promise<Channel[]> {
  const result = await graphGet<ListResponse<Channel>>(`/teams/${teamId}/channels`)
  return result.value || []
}

export async function sendChannelMessage(
  teamId: string,
  channelId: string,
  content: string,
  contentType: 'text' | 'html' = 'html'
): Promise<ChatMessage> {
  return graphPost<ChatMessage>(
    `/teams/${teamId}/channels/${channelId}/messages`,
    {
      body: { contentType, content },
    }
  )
}

export async function sendProjectNotification(
  teamId: string,
  channelId: string,
  notification: {
    title: string
    project: string
    message: string
    link?: string
  }
): Promise<ChatMessage> {
  const linkHtml = notification.link
    ? `<br/><a href="${notification.link}">Details ansehen</a>`
    : ''

  const html = [
    `<b>${notification.title}</b>`,
    `<br/>Projekt: <b>${notification.project}</b>`,
    `<br/>${notification.message}`,
    linkHtml,
  ].join('')

  return sendChannelMessage(teamId, channelId, html, 'html')
}
