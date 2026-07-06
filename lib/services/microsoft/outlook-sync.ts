import { graphGet, graphPost } from './graph-client'

interface GraphMailMessage {
  id?: string
  subject: string
  body: { contentType: string; content: string }
  toRecipients: Array<{ emailAddress: { address: string; name?: string } }>
  ccRecipients?: Array<{ emailAddress: { address: string; name?: string } }>
  from?: { emailAddress: { address: string; name: string } }
  receivedDateTime?: string
  isRead?: boolean
  hasAttachments?: boolean
}

interface GraphMailListResponse {
  value: GraphMailMessage[]
  '@odata.nextLink'?: string
}

export interface SendMailInput {
  subject: string
  body: string
  bodyType?: 'text' | 'html'
  to: Array<{ address: string; name?: string }>
  cc?: Array<{ address: string; name?: string }>
}

export async function listInboxMessages(top = 25, skip = 0): Promise<GraphMailMessage[]> {
  const params = new URLSearchParams({
    $top: String(top),
    $skip: String(skip),
    $orderby: 'receivedDateTime desc',
    $select: 'id,subject,from,receivedDateTime,isRead,hasAttachments',
  })

  const result = await graphGet<GraphMailListResponse>(`/me/messages?${params.toString()}`)
  return result.value || []
}

export async function sendMail(input: SendMailInput): Promise<void> {
  const message: GraphMailMessage = {
    subject: input.subject,
    body: {
      contentType: input.bodyType === 'html' ? 'HTML' : 'Text',
      content: input.body,
    },
    toRecipients: input.to.map((r) => ({
      emailAddress: { address: r.address, name: r.name },
    })),
  }

  if (input.cc?.length) {
    message.ccRecipients = input.cc.map((r) => ({
      emailAddress: { address: r.address, name: r.name },
    }))
  }

  await graphPost('/me/sendMail', { message, saveToSentItems: true })
}

export async function getMailMessage(messageId: string): Promise<GraphMailMessage> {
  return graphGet<GraphMailMessage>(`/me/messages/${messageId}`)
}

export async function searchMail(query: string, top = 25): Promise<GraphMailMessage[]> {
  const params = new URLSearchParams({
    $search: `"${query}"`,
    $top: String(top),
    $select: 'id,subject,from,receivedDateTime,isRead,hasAttachments',
  })

  const result = await graphGet<GraphMailListResponse>(`/me/messages?${params.toString()}`)
  return result.value || []
}
