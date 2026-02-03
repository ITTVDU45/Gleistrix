'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileDown } from 'lucide-react'
import { LagerApi } from '@/lib/api/lager'

interface DeliveryNoteRow {
  _id: string
  nummer: string
  datum: string
  typ: string
  empfaenger?: { name?: string; adresse?: string }
}

interface LagerLieferscheineViewProps {
  onRefresh: () => void
}

export default function LagerLieferscheineView({ onRefresh }: LagerLieferscheineViewProps) {
  const [list, setList] = useState<DeliveryNoteRow[]>([])
  const [loading, setLoading] = useState(true)

  const loadList = async () => {
    setLoading(true)
    try {
      const res = await LagerApi.deliveryNotes.list()
      if (res?.success && (res as { deliveryNotes?: DeliveryNoteRow[] }).deliveryNotes) {
        setList((res as { deliveryNotes: DeliveryNoteRow[] }).deliveryNotes)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadList()
  }, [onRefresh])

  const formatDatum = (d: string | undefined) => {
    if (!d) return '–'
    return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const downloadPdf = (id: string) => {
    const url = `/api/lager/delivery-notes/${id}/pdf`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
      <CardHeader>
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Lieferscheine</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Lieferscheine einsehen und als PDF herunterladen
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-slate-500 py-4">Lade Lieferscheine…</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">Keine Lieferscheine vorhanden.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nummer</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Empfänger</TableHead>
                <TableHead className="w-[120px]">Aktion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((row) => (
                <TableRow key={row._id}>
                  <TableCell className="font-medium">{row.nummer}</TableCell>
                  <TableCell>{formatDatum(row.datum)}</TableCell>
                  <TableCell>
                    <Badge variant={row.typ === 'ausgang' ? 'default' : 'secondary'}>
                      {row.typ === 'ausgang' ? 'Ausgang' : 'Eingang'}
                    </Badge>
                  </TableCell>
                  <TableCell>{row.empfaenger?.name ?? '–'}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => downloadPdf(row._id)}
                    >
                      <FileDown className="h-3 w-3" />
                      PDF
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
