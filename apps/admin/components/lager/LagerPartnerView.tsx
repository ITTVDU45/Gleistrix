'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Edit, Plus, UserRound, Building2 } from 'lucide-react'
import { LagerApi } from '@/lib/api/lager'
import type { PartnerOption } from '@/components/lager/PartnerSelect'
import AddPartnerDialog from '@/components/lager/AddPartnerDialog'

type PartnerRow = {
  id: string
  type: 'employee' | 'external'
  label: string
  employeeId?: string
  employeeName?: string
  companyName?: string
  contactName?: string
  phone?: string
  email?: string
  active: boolean
}

interface LagerPartnerViewProps {
  onRefresh?: () => void
}

const MAX_SUPPLIERS = 5

export default function LagerPartnerView({ onRefresh }: LagerPartnerViewProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [employees, setEmployees] = useState<PartnerOption[]>([])
  const [partners, setPartners] = useState<PartnerRow[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPartner, setEditingPartner] = useState<PartnerRow | null>(null)
  const [activeTab, setActiveTab] = useState<'mitarbeiter' | 'fremdfirmen'>('mitarbeiter')

  async function loadPartners() {
    setLoading(true)
    setError('')
    try {
      const response = await LagerApi.partners.list()
      setEmployees(response.employees ?? [])
      setPartners(response.partners ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Partner konnten nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPartners()
  }, [])

  const employeeRows = useMemo<PartnerRow[]>(() => {
    return employees
      .filter((employee) => employee.employeeId)
      .map((employee) => ({
        id: `employee:${employee.employeeId}`,
        type: 'employee' as const,
        label: employee.label,
        employeeId: employee.employeeId,
        employeeName: employee.label,
        active: true
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'de', { sensitivity: 'base' }))
  }, [employees])

  const supplierRows = useMemo<PartnerRow[]>(() => {
    return partners
      .filter((partner) => partner.type === 'external')
      .sort((a, b) => a.label.localeCompare(b.label, 'de', { sensitivity: 'base' }))
  }, [partners])

  const rows = useMemo(
    () => (activeTab === 'mitarbeiter' ? employeeRows : supplierRows),
    [activeTab, employeeRows, supplierRows]
  )

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('de-DE')
    if (!normalized) return rows

    return rows.filter((partner) => {
      const haystack = [
        partner.label,
        partner.employeeName,
        partner.companyName,
        partner.contactName,
        partner.phone,
        partner.email,
        partner.type === 'employee' ? 'mitarbeiter' : 'lieferant'
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('de-DE')

      return haystack.includes(normalized)
    })
  }, [rows, query])

  async function toggleActive(partner: PartnerRow) {
    try {
      await LagerApi.partners.update(partner.id, { active: !partner.active })
      await loadPartners()
      onRefresh?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Partner konnte nicht aktualisiert werden')
    }
  }

  function openCreate() {
    if (supplierRows.length >= MAX_SUPPLIERS) return
    setEditingPartner(null)
    setDialogOpen(true)
  }

  function openEdit(partner: PartnerRow) {
    setEditingPartner(partner)
    setDialogOpen(true)
  }

  async function handleSaved() {
    await loadPartners()
    onRefresh?.()
  }

  const suppliersLimitReached = supplierRows.length >= MAX_SUPPLIERS

  return (
    <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Lieferanten / Kontakte</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Mitarbeiter werden automatisch aus der Mitarbeiterliste angezeigt
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Firmen-Lieferanten: {supplierRows.length}/{MAX_SUPPLIERS}
            </p>
          </div>
          <Button className="gap-2" onClick={openCreate} disabled={suppliersLimitReached}>
            <Plus className="h-4 w-4" />
            Neue Firma
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'mitarbeiter' | 'fremdfirmen')}>
          <TabsList className="grid h-10 w-full max-w-sm grid-cols-2 rounded-xl">
            <TabsTrigger value="mitarbeiter">Mitarbeiter</TabsTrigger>
            <TabsTrigger value="fremdfirmen">Fremdfirmen</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Kontakt suchen..."
          className="h-10 rounded-xl"
        />

        {suppliersLimitReached && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-sm p-3">
            Maximal 5 Firmen-Lieferanten koennen angelegt werden.
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm p-3">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">Lade Partner...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-slate-500">{activeTab === 'mitarbeiter' ? 'Keine Mitarbeiter vorhanden.' : 'Keine Fremdfirmen vorhanden.'}</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((partner) => (
              <div key={partner.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {partner.type === 'employee' ? <UserRound className="h-4 w-4 text-blue-600" /> : <Building2 className="h-4 w-4 text-blue-600" />}
                      <p className="truncate font-medium text-slate-900 dark:text-white">{partner.label}</p>
                      <Badge variant={partner.active ? 'default' : 'secondary'}>{partner.active ? 'Aktiv' : 'Inaktiv'}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                      {partner.type === 'employee' ? 'Mitarbeiter' : 'Lieferant/Firma'}
                      {partner.phone ? ` | Tel: ${partner.phone}` : ''}
                      {partner.email ? ` | E-Mail: ${partner.email}` : ''}
                    </p>
                  </div>

                  {partner.type === 'external' && (
                    <div className="flex items-center gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => openEdit(partner)}>
                        <Edit className="mr-1 h-4 w-4" />
                        Bearbeiten
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => toggleActive(partner)}>
                        {partner.active ? 'Deaktivieren' : 'Aktivieren'}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <AddPartnerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        partner={editingPartner}
        onSaved={handleSaved}
      />
    </Card>
  )
}



