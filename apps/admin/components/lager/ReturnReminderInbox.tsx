'use client'

import React, { useEffect, useState } from 'react'
import { BellRing, Check, Mail, MailWarning } from 'lucide-react'
import { LagerApi } from '@/lib/api/lager'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

type Reminder = Awaited<ReturnType<typeof LagerApi.returnReminders.list>>['notifications'][number]

interface ReturnReminderInboxProps {
  onOpenAssignments?: () => void
  compact?: boolean
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(date))
}

export default function ReturnReminderInbox({ onOpenAssignments, compact = false }: ReturnReminderInboxProps) {
  const [notifications, setNotifications] = useState<Reminder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState('')

  useEffect(() => {
    let mounted = true
    LagerApi.returnReminders.list()
      .then((response) => {
        if (mounted && response.success) setNotifications(response.notifications ?? [])
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setIsLoading(false)
      })
    return () => { mounted = false }
  }, [])

  async function markRead(id: string) {
    setUpdatingId(id)
    try {
      const response = await LagerApi.returnReminders.markRead(id)
      if (response.success) {
        setNotifications((current) => current.map((notification) =>
          notification.id === id
            ? { ...notification, readAt: response.readAt ?? new Date().toISOString() }
            : notification
        ))
      }
    } finally {
      setUpdatingId('')
    }
  }

  if (isLoading || notifications.length === 0) return null

  const unreadCount = notifications.filter((notification) => !notification.readAt).length
  const visibleNotifications = compact ? notifications.slice(0, 5) : notifications.slice(0, 10)

  return (
    <Card className="rounded-2xl border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-100 p-2 dark:bg-amber-900/40">
              <BellRing className="h-5 w-5 text-amber-700 dark:text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-slate-900 dark:text-white">Anstehende Rückgaben</h2>
                {unreadCount > 0 && <Badge variant="destructive">{unreadCount} neu</Badge>}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">Erinnerungen zu Ihren gebuchten Ausgaben</p>
            </div>
          </div>
          {onOpenAssignments && (
            <Button type="button" variant="outline" size="sm" onClick={onOpenAssignments}>
              Offene Ausgaben
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {visibleNotifications.map((notification) => (
          <div
            key={notification.id}
            className={`rounded-xl border p-3 ${
              notification.readAt
                ? 'border-slate-200 bg-white/60 dark:border-slate-700 dark:bg-slate-900/30'
                : 'border-amber-300 bg-white dark:border-amber-700 dark:bg-slate-900'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-slate-900 dark:text-white">{notification.articleName}</p>
                  {notification.articleNumber && <Badge variant="outline">{notification.articleNumber}</Badge>}
                  {!notification.readAt && <span className="h-2 w-2 rounded-full bg-amber-500" aria-label="Ungelesen" />}
                </div>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{notification.message}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <span>Rückgabe: {formatDate(notification.dueDate)}</span>
                  <span>{notification.intervalLabel}</span>
                  <span className="inline-flex items-center gap-1">
                    {notification.emailStatus === 'sent'
                      ? <Mail className="h-3.5 w-3.5" />
                      : <MailWarning className="h-3.5 w-3.5 text-amber-600" />}
                    {notification.emailStatus === 'sent'
                      ? 'E-Mail versendet'
                      : notification.emailStatus === 'failed'
                        ? 'E-Mail fehlgeschlagen – erneuter Versuch folgt'
                        : 'E-Mail wird verarbeitet'}
                  </span>
                </div>
              </div>
              {!notification.readAt && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  disabled={updatingId === notification.id}
                  onClick={() => markRead(notification.id)}
                >
                  <Check className="mr-1 h-4 w-4" />
                  Gelesen
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
