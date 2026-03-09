'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  QrCode,
  ArrowDownToLine,
  ArrowUpFromLine,
  FileText,
  FileDown,
  Package2,
  ChevronLeft,
  LogOut,
  LayoutGrid,
  History,
  Wrench,
  ClipboardCheck,
  FolderTree,
  Pencil,
  Trash2,
  Plus,
  Tag,
  X
} from 'lucide-react'
import { LagerApi } from '@/lib/api/lager'
import { ProjectsApi } from '@/lib/api/projects'
import type { Article, Category, Project, StockMovement } from '@/types/main'
import AddArticleDialog from '@/components/AddArticleDialog'
import EditArticleDialog from '@/components/EditArticleDialog'
import AddCategoryDialog from '@/components/AddCategoryDialog'
import EditCategoryDialog from '@/components/EditCategoryDialog'
import AddMaintenanceDialog from '@/components/lager/AddMaintenanceDialog'
import PerformMaintenanceDialog from '@/components/lager/PerformMaintenanceDialog'
import AddPartnerDialog from '@/components/lager/AddPartnerDialog'
import PartnerSelect, { type PartnerOption } from '@/components/lager/PartnerSelect'
import LagerPartnerView from '@/components/lager/LagerPartnerView'
import QrScannerSheet from './QrScannerSheet'
import { ArticleThumbnail } from '@/components/lager/ArticleThumbnail'
import ArticleDetailsDialog from '@/components/lager/ArticleDetailsDialog'
import ArticleSelect from '@/components/lager/ArticleSelect'

function getArticleId(article: Article): string {
  const raw = (article as { _id?: unknown })._id ?? article.id
  return raw != null ? String(raw) : ''
}

function getCategoryId(category: Category): string {
  const raw = (category as { _id?: unknown })._id ?? category.id
  return raw != null ? String(raw) : ''
}


function normalizeProjectStatus(status?: string): string {
  return String(status ?? '').trim().toLocaleLowerCase('de-DE')
}

type ProjectOption = { value: string; label: string }

function buildProjectOptions(projects: Project[]): ProjectOption[] {
  const byId = new Map<string, ProjectOption>()

  projects.forEach((project) => {
    const id = String((project as { _id?: unknown })._id ?? project.id ?? '').trim()
    if (!id) return
    if (normalizeProjectStatus(project.status) !== 'aktiv') return

    const name = String(project.name ?? '').trim()
    if (!name) return

    const auftragsnummer = String(project.auftragsnummer ?? '').trim()
    byId.set(id, {
      value: id,
      label: auftragsnummer ? `${name} (${auftragsnummer})` : name
    })
  })

  return Array.from(byId.values()).sort((a, b) => a.label.localeCompare(b.label, 'de', { sensitivity: 'base' }))
}

type MobileView =
  | 'home'
  | 'eingang'
  | 'ausgang'
  | 'lieferschein'
  | 'bestand'
  | 'bewegungen'
  | 'wartung'
  | 'inventur'
  | 'produkte'
  | 'lieferanten'

type MovementEntryMode = 'select' | 'qr' | 'manual'

type MaintenanceRow = {
  _id?: string
  artikelId?: { bezeichnung?: string; artikelnummer?: string } | string
  wartungsart?: string
  faelligkeitsdatum?: string
  status?: string
}

type InventoryPosition = {
  artikelId?: { _id?: string; bezeichnung?: string; artikelnummer?: string; barcode?: string } | string
  sollMenge?: number
  istMenge?: number
  differenz?: number
}

type InventoryScanEvent = {
  artikelId?: string
  code?: string
  scannedAt?: string
  sessionId?: string
}

type InventoryRow = {
  _id?: string
  name?: string
  beschreibung?: string
  typ?: string
  stichtag?: string
  zeitraumVon?: string | null
  zeitraumBis?: string | null
  status?: string
  kategorien?: string[]
  artikelIds?: string[]
  abgeschlossenAm?: string | null
  activeScanSessionId?: string | null
  lastScanAt?: string | null
  scanEvents?: InventoryScanEvent[]
  positionen?: InventoryPosition[]
}

type InventoryFocusType = 'alle' | 'kategorien' | 'artikel'

type InventoryFormState = {
  name: string
  beschreibung: string
  stichtag: string
  zeitraumVon: string
  zeitraumBis: string
  fokusTyp: InventoryFocusType
  kategorien: string[]
  artikelIds: string[]
}

type InventoryEditForm = InventoryFormState

type OpenOutgoingDeliveryNote = {
  _id: string
  nummer: string
  datum?: string
  empfaenger?: { name?: string }
}

type DeliveryNoteRow = {
  _id: string
  nummer: string
  typ: 'eingang' | 'ausgang'
  datum?: string
  status?: 'entwurf' | 'abgeschlossen'
  empfaenger?: { name?: string; adresse?: string }
}

type DeliveryNoteEditForm = {
  datum: string
  status: 'entwurf' | 'abgeschlossen'
  empfaengerName: string
  empfaengerAdresse: string
}

type IncomingItem = {
  id: string
  artikelId: string
  menge: number
}
type InventoryCreateForm = InventoryFormState

function createIncomingItem(): IncomingItem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    artikelId: '',
    menge: 1
  }
}

export default function LagerMobileApp() {
  const router = useRouter()
  const [view, setView] = useState<MobileView>('home')
  const currentViewTitle = ({
    home: 'Startseite',
    eingang: 'Wareneingang',
    ausgang: 'Warenausgang',
    lieferschein: 'Lieferscheine ansehen',
    bestand: 'Bestand',
    bewegungen: 'Bewegungen (Historie)',
    wartung: 'Wartung',
    inventur: 'Inventur',
    produkte: 'Kategorien und Artikel',
    lieferanten: 'Lieferanten/Kontakte'
  } as Record<MobileView, string>)[view]
  const [articles, setArticles] = useState<Article[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedArticleId, setSelectedArticleId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [maintenanceList, setMaintenanceList] = useState<MaintenanceRow[]>([])
  const [inventoryList, setInventoryList] = useState<InventoryRow[]>([])
  const [selectedInventoryId, setSelectedInventoryId] = useState('')
  const [inventoryDetail, setInventoryDetail] = useState<InventoryRow | null>(null)
  const [inventoryIstMengen, setInventoryIstMengen] = useState<Record<string, number>>({})
  const [inventoryCreateOpen, setInventoryCreateOpen] = useState(false)
  const [isInventoryEditOpen, setIsInventoryEditOpen] = useState(false)
  const [isInventoryResultOpen, setIsInventoryResultOpen] = useState(false)
  const [inventoryScanMode, setInventoryScanMode] = useState(false)
  const [inventoryCodeInput, setInventoryCodeInput] = useState('')
  const inventoryScanThrottleRef = useRef<{ code: string; at: number }>({ code: '', at: 0 })
  const createEmptyInventoryEditForm = (): InventoryEditForm => ({
    name: '',
    beschreibung: '',
    stichtag: new Date().toISOString().slice(0, 10),
    zeitraumVon: '',
    zeitraumBis: '',
    fokusTyp: 'alle',
    kategorien: [],
    artikelIds: []
  })
  const createEmptyInventoryCreateForm = (): InventoryCreateForm => createEmptyInventoryEditForm()
  const [inventoryForm, setInventoryForm] = useState<InventoryEditForm>(createEmptyInventoryEditForm)
  const [inventoryCreateForm, setInventoryCreateForm] = useState<InventoryCreateForm>(createEmptyInventoryCreateForm)
  const [isInventorySaving, setIsInventorySaving] = useState(false)
  const [isInventoryCompleting, setIsInventoryCompleting] = useState(false)
  const [inventoryCompleteConfirmOpen, setInventoryCompleteConfirmOpen] = useState(false)
  const [isDetailLoading, setIsDetailLoading] = useState(false)

  const [editArticleOpen, setEditArticleOpen] = useState(false)
  const [editingArticle, setEditingArticle] = useState<Article | null>(null)
  const [articleDetailsOpen, setArticleDetailsOpen] = useState(false)
  const [detailArticle, setDetailArticle] = useState<Article | null>(null)
  const [addMaintenanceOpen, setAddMaintenanceOpen] = useState(false)
  const [performMaintenanceId, setPerformMaintenanceId] = useState<string | null>(null)
  const [editCategoryOpen, setEditCategoryOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)

  const [menge, setMenge] = useState(1)
  const [incomingItems, setIncomingItems] = useState<IncomingItem[]>([createIncomingItem()])
  const [incomingEntryMode, setIncomingEntryMode] = useState<MovementEntryMode>('select')
  const [outgoingEntryMode, setOutgoingEntryMode] = useState<MovementEntryMode>('select')
  const [empfaenger, setEmpfaenger] = useState('')
  const [lieferant, setLieferant] = useState('')
  const [partnerEmployees, setPartnerEmployees] = useState<PartnerOption[]>([])
  const [partnerSuppliers, setPartnerSuppliers] = useState<PartnerOption[]>([])
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([])
  const [isProjectsLoading, setIsProjectsLoading] = useState(false)
  const [isAddPartnerDialogOpen, setIsAddPartnerDialogOpen] = useState(false)
  const [projekt, setProjekt] = useState('')
  const [notiz, setNotiz] = useState('')
  const [lieferscheinNummer, setLieferscheinNummer] = useState('')
  const [selectedIncomingDeliveryNoteId, setSelectedIncomingDeliveryNoteId] = useState('')
  const [incomingManualLieferscheinNummer, setIncomingManualLieferscheinNummer] = useState('')
  const [openOutgoingDeliveryNotes, setOpenOutgoingDeliveryNotes] = useState<OpenOutgoingDeliveryNote[]>([])
  const [isLoadingIncomingDeliveryNotes, setIsLoadingIncomingDeliveryNotes] = useState(false)
  const [lieferscheinDate, setLieferscheinDate] = useState(new Date().toISOString().slice(0, 10))
  const [deliveryFile, setDeliveryFile] = useState<File | null>(null)
  const [movementLieferscheinFilter, setMovementLieferscheinFilter] = useState('')
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNoteRow[]>([])
  const [isDeliveryNotesLoading, setIsDeliveryNotesLoading] = useState(false)
  const [deliveryNoteTypeFilter, setDeliveryNoteTypeFilter] = useState<'alle' | 'eingang' | 'ausgang'>('alle')
  const [deliveryNoteStatusFilter, setDeliveryNoteStatusFilter] = useState<'alle' | 'entwurf' | 'abgeschlossen'>('alle')
  const [deliveryNoteSearch, setDeliveryNoteSearch] = useState('')
  const [deliveryNoteDateFrom, setDeliveryNoteDateFrom] = useState('')
  const [deliveryNoteDateTo, setDeliveryNoteDateTo] = useState('')
  const [editingDeliveryNoteId, setEditingDeliveryNoteId] = useState('')
  const [deliveryNoteEditForm, setDeliveryNoteEditForm] = useState<DeliveryNoteEditForm>({
    datum: new Date().toISOString().slice(0, 10),
    status: 'abgeschlossen',
    empfaengerName: '',
    empfaengerAdresse: ''
  })

  const selectedArticle = useMemo(
    () => articles.find((a) => getArticleId(a) === selectedArticleId),
    [articles, selectedArticleId]
  )
  const activeArticles = useMemo(
    () => articles.filter((article) => (article.status ?? 'aktiv') === 'aktiv'),
    [articles]
  )

  const allPartnerOptions = useMemo(
    () => [...partnerEmployees, ...partnerSuppliers],
    [partnerEmployees, partnerSuppliers]
  )
  const selectedOutgoingPartner = useMemo(
    () => allPartnerOptions.find((option) => option.value === empfaenger) ?? null,
    [allPartnerOptions, empfaenger]
  )
  const selectedSupplierPartner = useMemo(
    () => allPartnerOptions.find((option) => option.value === lieferant) ?? null,
    [allPartnerOptions, lieferant]
  )
  const selectedProject = useMemo(
    () => projectOptions.find((option) => option.value === projekt) ?? null,
    [projectOptions, projekt]
  )
  const selectedIncomingDeliveryNote = useMemo(
    () => openOutgoingDeliveryNotes.find((note) => String(note._id) === selectedIncomingDeliveryNoteId) ?? null,
    [openOutgoingDeliveryNotes, selectedIncomingDeliveryNoteId]
  )

  async function loadArticles() {
    const response = await LagerApi.articles.list()
    if (!response?.success) throw new Error('Artikel konnten nicht geladen werden')
    setArticles(
      response.articles.map((article) => ({
        ...article,
        id: getArticleId(article)
      }))
    )

  }

  async function loadCategories() {
    const response = await LagerApi.categories.list()
    if (!response?.success) throw new Error('Kategorien konnten nicht geladen werden')
    setCategories(
      (response.categories ?? []).map((category) => ({
        ...category,
        id: getCategoryId(category)
      }))
    )
  }

  async function loadPartnerData() {
    const response = await LagerApi.partners.list()
    setPartnerEmployees(response.employees ?? [])
    setPartnerSuppliers(response.suppliers ?? [])
  }

  async function loadActiveProjects() {
    setIsProjectsLoading(true)
    try {
      const limit = 200
      let page = 0
      let total = Number.POSITIVE_INFINITY
      const allProjects: Project[] = []

      while (allProjects.length < total) {
        const response = await ProjectsApi.list(page, limit)
        if (!response?.success) {
          throw new Error('Projekte konnten nicht geladen werden')
        }

        const batch = response.projects ?? []
        allProjects.push(...batch)
        total = typeof response.meta?.total === 'number' ? response.meta.total : batch.length
        if (batch.length < limit) break
        page += 1
      }

      setProjectOptions(buildProjectOptions(allProjects))
    } finally {
      setIsProjectsLoading(false)
    }
  }

  async function refreshMasterData() {
    setIsLoading(true)
    setError('')
    try {
      await Promise.all([loadArticles(), loadCategories()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Daten')
    } finally {
      setIsLoading(false)
    }
  }

  async function loadMovements() {
    const response = await LagerApi.movements.list({
      lieferscheinId: movementLieferscheinFilter || undefined
    })
    if (!response?.success || !response.movements) throw new Error('Bewegungen konnten nicht geladen werden')
    const sorted = [...response.movements].sort(
      (a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime()
    )
    setMovements(sorted)
  }

  async function loadMaintenance() {
    const response = await LagerApi.maintenance.list()
    const rows = (response as { success?: boolean; maintenance?: MaintenanceRow[] })?.maintenance ?? []
    if (!(response as { success?: boolean })?.success) throw new Error('Wartungen konnten nicht geladen werden')
    setMaintenanceList(rows)
  }

  async function loadInventory() {
    const response = await LagerApi.inventory.list()
    const rows = (response as { success?: boolean; inventory?: InventoryRow[] })?.inventory ?? []
    if (!(response as { success?: boolean })?.success) throw new Error('Inventuren konnten nicht geladen werden')
    setInventoryList(rows)
  }

  async function loadDeliveryNotes() {
    setIsDeliveryNotesLoading(true)
    try {
      const response = await LagerApi.deliveryNotes.list({
        typ: deliveryNoteTypeFilter === 'alle' ? undefined : deliveryNoteTypeFilter,
        status: deliveryNoteStatusFilter === 'alle' ? undefined : deliveryNoteStatusFilter,
        search: deliveryNoteSearch.trim() || undefined,
        dateFrom: deliveryNoteDateFrom || undefined,
        dateTo: deliveryNoteDateTo || undefined,
        limit: 300
      })
      const rows = (response as { success?: boolean; deliveryNotes?: DeliveryNoteRow[] })?.deliveryNotes ?? []
      if (!(response as { success?: boolean })?.success) throw new Error('Lieferscheine konnten nicht geladen werden')
      const sorted = [...rows].sort((a, b) => new Date(b.datum ?? '').getTime() - new Date(a.datum ?? '').getTime())
      setDeliveryNotes(sorted)
    } finally {
      setIsDeliveryNotesLoading(false)
    }
  }

  function resolveInventoryArticleId(artikelId: InventoryPosition['artikelId']): string {
    if (!artikelId) return ''
    if (typeof artikelId === 'string') return artikelId
    return artikelId._id ? String(artikelId._id) : ''
  }

  function toInventoryArticle(artikelId: InventoryPosition['artikelId']) {
    if (!artikelId || typeof artikelId === 'string') return null
    return artikelId
  }

  function toDateInput(value?: string | null): string {
    if (!value) return ''
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    if (dateOnly) return value
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return ''
    const y = parsed.getUTCFullYear()
    const m = String(parsed.getUTCMonth() + 1).padStart(2, '0')
    const d = String(parsed.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  function formatInventoryRange(inv: InventoryRow) {
    if (!inv.zeitraumVon && !inv.zeitraumBis) return '-'
    if (inv.zeitraumVon && inv.zeitraumBis) return `${formatDate(inv.zeitraumVon)} - ${formatDate(inv.zeitraumBis)}`
    return formatDate(inv.zeitraumVon ?? inv.zeitraumBis)
  }

  function formatInventoryFocus(inv: InventoryRow): string {
    if (inv.typ !== 'teil') return 'Alle Produkte'
    const artikelCount = Number(inv.artikelIds?.length ?? 0)
    const kategorieCount = Number(inv.kategorien?.length ?? 0)
    if (artikelCount > 0 && kategorieCount > 0) return artikelCount + ' Produkte / ' + kategorieCount + ' Kategorien'
    if (artikelCount > 0) return artikelCount + ' Produkte'
    if (kategorieCount > 0) return kategorieCount + ' Kategorien'
    return 'Teilinventur'
  }

  function getInventoryFocusType(inv: InventoryRow): InventoryFocusType {
    if (inv.typ !== 'teil') return 'alle'
    return Number(inv.artikelIds?.length ?? 0) > 0 ? 'artikel' : 'kategorien'
  }

  function normalizeStringSelection(values?: string[] | null): string[] {
    if (!Array.isArray(values)) return []
    return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]))
  }

  function normalizeIdSelection(values?: string[] | null): string[] {
    if (!Array.isArray(values)) return []
    return Array.from(new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean)))
  }

  function toggleStringSelection(values: string[], value: string, checked: boolean): string[] {
    if (checked) {
      return values.includes(value) ? values : [...values, value]
    }
    return values.filter((entry) => entry !== value)
  }
  function hasInventoryScans(inv: InventoryRow): boolean {
    return Number((inv.scanEvents ?? []).length) > 0 || inv.status === 'in_bearbeitung'
  }
  function getInventoryDisplayName(inv: InventoryRow): string {
    const storedName = inv.name?.trim()
    if (storedName) return storedName
    return `Inventur ${formatDate(inv.stichtag)}`
  }

  function syncInventoryState(data: InventoryRow, inventoryId: string) {
    setSelectedInventoryId(inventoryId)
    setInventoryDetail(data)
    setInventoryForm({
      name: data.name?.trim() || getInventoryDisplayName(data),
      beschreibung: data.beschreibung?.trim() ?? '',
      stichtag: toDateInput(data.stichtag),
      zeitraumVon: toDateInput(data.zeitraumVon),
      zeitraumBis: toDateInput(data.zeitraumBis),
      fokusTyp: getInventoryFocusType(data),
      kategorien: normalizeStringSelection(data.kategorien),
      artikelIds: normalizeIdSelection(data.artikelIds)
    })

    const next: Record<string, number> = {}
    ;(data.positionen ?? []).forEach((pos) => {
      const id = resolveInventoryArticleId(pos.artikelId)
      if (id) next[id] = Number(pos.istMenge ?? 0)
    })
    setInventoryIstMengen(next)
  }
  async function openInventoryDetail(inventoryId: string) {
    const response = await LagerApi.inventory.get(inventoryId)
    const data = (response as { success?: boolean; data?: InventoryRow })?.data
    if (!(response as { success?: boolean })?.success || !data) {
      throw new Error('Inventur konnte nicht geladen werden')
    }
    syncInventoryState(data, inventoryId)
  }

  async function openInventoryForEdit(inventoryId: string) {
    try {
      await openInventoryDetail(inventoryId)
      setIsInventoryEditOpen(true)
      setInventoryScanMode(false)
      setIsInventoryResultOpen(false)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Inventur konnte nicht geoeffnet werden')
    }
  }

  async function openInventoryResults(inventoryId: string) {
    try {
      await openInventoryDetail(inventoryId)
      setIsInventoryEditOpen(false)
      setInventoryScanMode(false)
      setIsInventoryResultOpen(true)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Ergebnisse konnten nicht geoeffnet werden')
    }
  }

  function downloadInventoryResults(inventoryId?: string) {
    if (!inventoryId) return
    window.open(`/api/lager/inventory/${inventoryId}/pdf`, '_blank', 'noopener,noreferrer')
  }
  async function startOrContinueInventoryScan(inventoryId: string) {
    try {
      await openInventoryDetail(inventoryId)
      const response = await LagerApi.inventory.setScanSession(inventoryId, { action: 'start' })
      const data = (response as { success?: boolean; data?: InventoryRow })?.data
      if (data) syncInventoryState(data, inventoryId)
      setIsInventoryEditOpen(false)
      setInventoryScanMode(true)
      setIsInventoryResultOpen(false)
      setIsScannerOpen(true)
      setStatusMessage('Scanner geoeffnet. Einfach Produkte scannen.')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Scan konnte nicht gestartet werden')
    }
  }

  async function deleteInventory(inventoryId?: string) {
    if (!inventoryId) return
    if (!window.confirm('Inventur wirklich loeschen?')) return
    try {
      await LagerApi.inventory.delete(inventoryId)
      if (selectedInventoryId === inventoryId) {
        setSelectedInventoryId('')
        setInventoryDetail(null)
        setInventoryIstMengen({})
        setIsInventoryEditOpen(false)
        setInventoryScanMode(false)
        setIsInventoryResultOpen(false)
      }
      await loadInventory()
      setStatusMessage('Inventur geloescht')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Inventur konnte nicht geloescht werden')
    }
  }

  async function createInventory() {
    if (inventoryCreateForm.zeitraumVon && inventoryCreateForm.zeitraumBis && inventoryCreateForm.zeitraumBis < inventoryCreateForm.zeitraumVon) {
      return setErrorMessage('Zeitraum-Ende darf nicht vor Zeitraum-Beginn liegen')
    }

    const nameValue = inventoryCreateForm.name.trim()
    if (!nameValue) {
      return setErrorMessage('Inventurname ist erforderlich')
    }

    const fokusTyp = inventoryCreateForm.fokusTyp
    const selectedKategorien = Array.from(new Set(inventoryCreateForm.kategorien))
    const selectedArtikelIds = Array.from(new Set(inventoryCreateForm.artikelIds))

    if (fokusTyp === 'kategorien' && selectedKategorien.length === 0) {
      return setErrorMessage('Bitte mindestens eine Kategorie fuer den Fokus auswaehlen')
    }
    if (fokusTyp === 'artikel' && selectedArtikelIds.length === 0) {
      return setErrorMessage('Bitte mindestens ein Produkt fuer den Fokus auswaehlen')
    }

    const beschreibungValue = inventoryCreateForm.beschreibung.trim()

    setIsInventorySaving(true)
    try {
      const response = await LagerApi.inventory.create({
        name: nameValue,
        beschreibung: beschreibungValue || undefined,
        typ: fokusTyp === 'alle' ? 'voll' : 'teil',
        stichtag: inventoryCreateForm.stichtag,
        zeitraumVon: inventoryCreateForm.zeitraumVon || undefined,
        zeitraumBis: inventoryCreateForm.zeitraumBis || undefined,
        kategorien: fokusTyp === 'kategorien' ? selectedKategorien : undefined,
        artikelIds: fokusTyp === 'artikel' ? selectedArtikelIds : undefined
      })
      const created = (response as { success?: boolean; data?: InventoryRow })?.data
      if (!(response as { success?: boolean })?.success || !created?._id) {
        throw new Error('Inventur konnte nicht erstellt werden')
      }

      const createdId = String(created._id)
      await LagerApi.inventory.update(createdId, {
        name: nameValue,
        beschreibung: beschreibungValue,
        stichtag: inventoryCreateForm.stichtag,
        zeitraumVon: inventoryCreateForm.zeitraumVon || null,
        zeitraumBis: inventoryCreateForm.zeitraumBis || null
      })
      setInventoryList((prev) => [
        {
          ...created,
          _id: createdId,
          name: nameValue,
          beschreibung: beschreibungValue,
          typ: fokusTyp === 'alle' ? 'voll' : 'teil',
          kategorien: fokusTyp === 'kategorien' ? selectedKategorien : [],
          artikelIds: fokusTyp === 'artikel' ? selectedArtikelIds : []
        },
        ...prev.filter((inv) => String(inv._id ?? '') !== createdId)
      ])
      setStatusMessage('Inventur erstellt')
      setInventoryCreateOpen(false)
      setInventoryCreateForm(createEmptyInventoryCreateForm())
      setIsInventoryEditOpen(false)
      setInventoryScanMode(false)
      await loadInventory()
      await openInventoryDetail(String(created._id))
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Inventur konnte nicht erstellt werden')
    } finally {
      setIsInventorySaving(false)
    }
  }
  async function saveInventory() {
    if (!selectedInventoryId || !inventoryDetail) return
    if (inventoryForm.zeitraumVon && inventoryForm.zeitraumBis && inventoryForm.zeitraumBis < inventoryForm.zeitraumVon) {
      return setErrorMessage('Zeitraum-Ende darf nicht vor Zeitraum-Beginn liegen')
    }

    const editName = inventoryForm.name.trim()
    if (!editName) {
      return setErrorMessage('Inventurname ist erforderlich')
    }

    const fokusTyp = inventoryForm.fokusTyp
    const selectedKategorien = Array.from(new Set(inventoryForm.kategorien))
    const selectedArtikelIds = Array.from(new Set(inventoryForm.artikelIds))

    if (fokusTyp === 'kategorien' && selectedKategorien.length === 0) {
      return setErrorMessage('Bitte mindestens eine Kategorie fuer den Fokus auswaehlen')
    }
    if (fokusTyp === 'artikel' && selectedArtikelIds.length === 0) {
      return setErrorMessage('Bitte mindestens ein Produkt fuer den Fokus auswaehlen')
    }

    const positionen = (inventoryDetail.positionen ?? []).map((pos) => {
      const artikelId = resolveInventoryArticleId(pos.artikelId)
      return {
        artikelId,
        istMenge: inventoryIstMengen[artikelId] ?? Number(pos.istMenge ?? 0)
      }
    }).filter((pos) => pos.artikelId)

    setIsInventorySaving(true)
    try {
      await LagerApi.inventory.update(selectedInventoryId, {
        name: editName,
        beschreibung: inventoryForm.beschreibung.trim(),
        stichtag: inventoryForm.stichtag,
        zeitraumVon: inventoryForm.zeitraumVon || null,
        zeitraumBis: inventoryForm.zeitraumBis || null,
        typ: fokusTyp === 'alle' ? 'voll' : 'teil',
        kategorien: fokusTyp === 'kategorien' ? selectedKategorien : [],
        artikelIds: fokusTyp === 'artikel' ? selectedArtikelIds : [],
        positionen
      })
      await openInventoryDetail(selectedInventoryId)
      setInventoryList((prev) => prev.map((inv) => String(inv._id ?? '') === selectedInventoryId
        ? ({
            ...inv,
            name: editName,
            beschreibung: inventoryForm.beschreibung.trim(),
            stichtag: inventoryForm.stichtag,
            zeitraumVon: inventoryForm.zeitraumVon || null,
            zeitraumBis: inventoryForm.zeitraumBis || null,
            typ: fokusTyp === 'alle' ? 'voll' : 'teil',
            kategorien: fokusTyp === 'kategorien' ? selectedKategorien : [],
            artikelIds: fokusTyp === 'artikel' ? selectedArtikelIds : []
          })
        : inv))
      await loadInventory()
      await loadArticles()
      setStatusMessage('Inventur gespeichert')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Inventur konnte nicht gespeichert werden')
    } finally {
      setIsInventorySaving(false)
    }
  }
  async function completeInventory() {
    if (!selectedInventoryId) return
    setIsInventoryCompleting(true)
    setInventoryCompleteConfirmOpen(false)
    try {
      await LagerApi.inventory.complete(selectedInventoryId)
      setStatusMessage('Inventur abgeschlossen')
      setSelectedInventoryId('')
      setInventoryDetail(null)
      setIsInventoryResultOpen(false)
      setInventoryIstMengen({})
      setInventoryCodeInput('')
      await loadInventory()
      await loadArticles()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Inventur konnte nicht abgeschlossen werden')
    } finally {
      setIsInventoryCompleting(false)
    }
  }

  async function applyInventoryScan(rawCode: string) {
    if (!selectedInventoryId || !inventoryDetail?.positionen?.length) {
      return setErrorMessage('Bitte zuerst eine Inventur auswaehlen')
    }

    const normalized = rawCode.trim().toLowerCase()
    if (!normalized) return

    const scanNow = Date.now()
    if (inventoryScanThrottleRef.current.code === normalized && scanNow - inventoryScanThrottleRef.current.at < 1200) {
      return
    }
    inventoryScanThrottleRef.current = { code: normalized, at: scanNow }

    const found = inventoryDetail.positionen.find((pos) => {
      const article = toInventoryArticle(pos.artikelId)
      const barcode = article?.barcode?.trim().toLowerCase() ?? ''
      const artikelnummer = article?.artikelnummer?.trim().toLowerCase() ?? ''
      return (barcode.length > 0 && (barcode === normalized || normalized.endsWith(barcode)))
        || (artikelnummer.length > 0 && (artikelnummer === normalized || normalized.endsWith(artikelnummer)))
    })

    if (!found) {
      return setErrorMessage(`Kein Inventur-Artikel zu QR-Code "${rawCode}" gefunden`)
    }

    const artikelId = resolveInventoryArticleId(found.artikelId)
    const article = toInventoryArticle(found.artikelId)
    if (!artikelId) return

    setIsInventorySaving(true)
    try {
      const response = await LagerApi.inventory.recordScan(selectedInventoryId, {
        artikelId,
        code: rawCode,
        scannedAt: new Date().toISOString()
      })
      const data = (response as { success?: boolean; data?: InventoryRow })?.data
      if (!(response as { success?: boolean })?.success || !data) {
        throw new Error('Scan konnte nicht gespeichert werden')
      }
      syncInventoryState(data, selectedInventoryId)
      await loadInventory()
      setInventoryCodeInput('')
      setStatusMessage(`Scan gespeichert: ${article?.bezeichnung ?? article?.artikelnummer ?? artikelId}`)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Scan konnte nicht gespeichert werden')
    } finally {
      setIsInventorySaving(false)
    }
  }

  useEffect(() => {
    refreshMasterData()
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadViewData() {
      if (!['bewegungen', 'wartung', 'inventur', 'lieferschein'].includes(view)) return

      setIsDetailLoading(true)
      try {
        if (view === 'bewegungen') await loadMovements()
        if (view === 'wartung') await loadMaintenance()
        if (view === 'inventur') await loadInventory()
        if (view === 'lieferschein') await loadDeliveryNotes()
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Daten konnten nicht geladen werden'
          setErrorMessage(message)
        }
      } finally {
        if (!cancelled) setIsDetailLoading(false)
      }
    }

    loadViewData()
    return () => {
      cancelled = true
    }
  }, [view, movementLieferscheinFilter, deliveryNoteTypeFilter, deliveryNoteStatusFilter, deliveryNoteDateFrom, deliveryNoteDateTo, deliveryNoteSearch])

  useEffect(() => {
    let cancelled = false

    async function loadOutgoingReferenceData() {
      if (!['ausgang', 'eingang', 'lieferschein', 'lieferanten'].includes(view)) return
      try {
        if (view === 'ausgang') {
          await Promise.all([loadPartnerData(), loadActiveProjects()])
        } else {
          await loadPartnerData()
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Kontakte und Projekte konnten nicht geladen werden'
          setErrorMessage(message)
        }
      }
    }

    loadOutgoingReferenceData()
    return () => {
      cancelled = true
    }
  }, [view])

  useEffect(() => {
    if (empfaenger && !allPartnerOptions.some((option) => option.value === empfaenger)) {
      setEmpfaenger('')
    }
  }, [empfaenger, allPartnerOptions])

  useEffect(() => {
    if (projekt && !projectOptions.some((option) => option.value === projekt)) {
      setProjekt('')
    }
  }, [projekt, projectOptions])
  useEffect(() => {
    let cancelled = false

    async function loadIncomingDeliveryNotes() {
      if (view !== 'eingang' || !selectedSupplierPartner?.label) {
        setOpenOutgoingDeliveryNotes([])
        setSelectedIncomingDeliveryNoteId('')
        setIncomingManualLieferscheinNummer('')
        return
      }

      setIsLoadingIncomingDeliveryNotes(true)
      try {
        const response = await LagerApi.deliveryNotes.listOpenOutgoing(selectedSupplierPartner.label)
        if (cancelled) return
        const notes = ((response as { deliveryNotes?: OpenOutgoingDeliveryNote[] }).deliveryNotes ?? [])
        setOpenOutgoingDeliveryNotes(notes)
        if (!notes.some((note) => String(note._id) === selectedIncomingDeliveryNoteId)) {
          setSelectedIncomingDeliveryNoteId('')
        }
        if (notes.length > 0) {
          setIncomingManualLieferscheinNummer('')
        }
      } catch (err) {
        if (!cancelled) {
          setOpenOutgoingDeliveryNotes([])
          setSelectedIncomingDeliveryNoteId('')
          setIncomingManualLieferscheinNummer('')
          setErrorMessage(err instanceof Error ? err.message : 'Offene Lieferscheine konnten nicht geladen werden')
        }
      } finally {
        if (!cancelled) setIsLoadingIncomingDeliveryNotes(false)
      }
    }

    loadIncomingDeliveryNotes()
    return () => {
      cancelled = true
    }
  }, [view, selectedSupplierPartner?.label])

  function clearActionForm() {
    setMenge(1)
    setIncomingItems([createIncomingItem()])
    setEmpfaenger('')
    setLieferant('')
    setProjekt('')
    setNotiz('')
    setLieferscheinNummer('')
    setSelectedIncomingDeliveryNoteId('')
    setIncomingManualLieferscheinNummer('')
    setOpenOutgoingDeliveryNotes([])
    setDeliveryFile(null)
  }

  function setStatusMessage(message: string) {
    setSuccess(message)
    setError('')
  }

  function setErrorMessage(message: string) {
    setError(message)
    setSuccess('')
  }

  function resolveArticleByScan(code: string) {
    const normalized = code.trim().toLowerCase()
    const found = articles.find((article) => {
      const artikelnummer = article.artikelnummer?.trim().toLowerCase() ?? ''
      const barcode = article.barcode?.trim().toLowerCase() ?? ''
      return (barcode.length > 0 && (barcode === normalized || normalized.endsWith(barcode)))
        || (artikelnummer.length > 0 && (artikelnummer === normalized || normalized.endsWith(artikelnummer)))
    })
    if (!found) {
      setErrorMessage(`Kein Artikel zu QR-Code "${code}" gefunden`)
      return
    }

    const foundArticleId = getArticleId(found)
    if (view === 'eingang') {
      setIncomingEntryMode('qr')
      setIncomingItems((prev) => {
        const existingIndex = prev.findIndex((item) => item.artikelId === foundArticleId)
        if (existingIndex >= 0) {
          return prev.map((item, index) => (index === existingIndex ? { ...item, menge: item.menge + 1 } : item))
        }

        const firstEmptyIndex = prev.findIndex((item) => !item.artikelId)
        if (firstEmptyIndex >= 0) {
          return prev.map((item, index) => (index === firstEmptyIndex ? { ...item, artikelId: foundArticleId, menge: 1 } : item))
        }

        return [...prev, { id: createIncomingItem().id, artikelId: foundArticleId, menge: 1 }]
      })
      setStatusMessage(`Artikel hinzugefuegt: ${found.bezeichnung}`)
      return
    }
    if (view === 'ausgang') {
      setOutgoingEntryMode('qr')
    }

    setSelectedArticleId(foundArticleId)
    setStatusMessage(`Artikel erkannt: ${found.bezeichnung}`)
  }

  async function handlePartnerSaved() {
    await loadPartnerData()
    setStatusMessage('Partner gespeichert')
  }

  async function createMovement(bewegungstyp: 'eingang' | 'ausgang') {
    if (bewegungstyp === 'ausgang') {
      if (!selectedArticleId) return setErrorMessage('Bitte zuerst einen Artikel auswaehlen oder scannen')
      if (menge <= 0) return setErrorMessage('Menge muss groesser als 0 sein')
      if (selectedArticle && menge > (selectedArticle.bestand ?? 0)) {
        return setErrorMessage('Menge groesser als verfuegbarer Bestand')
      }
    }

    if (bewegungstyp === 'eingang') {
      if (!selectedSupplierPartner) {
        return setErrorMessage('Bitte Lieferant waehlen')
      }
      if (!incomingItems.length || incomingItems.some((item) => !item.artikelId || item.menge <= 0)) {
        return setErrorMessage('Bitte fuer jede Position Artikel und Menge > 0 angeben')
      }
    }

    const outgoingLabel = selectedOutgoingPartner?.label ?? ''
    const outgoingEmployeeId = selectedOutgoingPartner?.partnerType === 'employee' ? selectedOutgoingPartner.employeeId : undefined
    const supplierLabel = selectedSupplierPartner?.label ?? ''
    const selectedOrManualIncomingDelivery = selectedIncomingDeliveryNote?.nummer ?? incomingManualLieferscheinNummer.trim()

    const metaPieces = [
      selectedProject?.label ? `Projekt: ${selectedProject.label}` : '',
      outgoingLabel ? `Empfaenger: ${outgoingLabel}` : '',
      supplierLabel ? `Lieferant: ${supplierLabel}` : '',
      selectedOrManualIncomingDelivery ? `Lieferschein: ${selectedOrManualIncomingDelivery}` : '',
      notiz
    ].filter(Boolean)

    setIsSaving(true)
    setError('')
    try {
      if (bewegungstyp === 'eingang') {
        const mergedIncomingItems = Array.from(
          incomingItems.reduce((map, item) => {
            map.set(item.artikelId, (map.get(item.artikelId) ?? 0) + item.menge)
            return map
          }, new Map<string, number>())
        ).map(([artikelId, mergedMenge]) => ({ artikelId, menge: mergedMenge }))

        const deliveryResponse = await LagerApi.deliveryNotes.create({
          typ: 'eingang',
          datum: new Date().toISOString(),
          empfaenger: {
            name: selectedSupplierPartner?.label || 'Unbekannter Lieferant',
            adresse: ''
          },
          positionen: mergedIncomingItems.map((item) => ({
            artikelId: item.artikelId,
            bezeichnung: articles.find((article) => getArticleId(article) === item.artikelId)?.bezeichnung ?? 'Artikel',
            menge: item.menge
          }))
        })
        const rawId = (deliveryResponse as { data?: { _id?: unknown; id?: string } })?.data?._id
          ?? (deliveryResponse as { data?: { _id?: string; id?: string } })?.data?.id
        const generatedDeliveryId = rawId != null ? String(rawId) : undefined

        for (const item of mergedIncomingItems) {
          await LagerApi.movements.create({
            artikelId: item.artikelId,
            bewegungstyp,
            menge: item.menge,
            datum: new Date().toISOString(),
            lieferscheinId: generatedDeliveryId || selectedIncomingDeliveryNoteId || undefined,
            bemerkung: metaPieces.join(' | ')
          })
        }
      } else {
        const deliveryResponse = await LagerApi.deliveryNotes.create({
          typ: 'ausgang',
          datum: new Date().toISOString(),
          empfaenger: {
            name: outgoingLabel || 'Unbekannter Empfaenger',
            adresse: ''
          },
          positionen: [{
            artikelId: selectedArticleId,
            bezeichnung: selectedArticle?.bezeichnung ?? selectedArticle?.artikelnummer ?? 'Artikel',
            menge
          }]
        })
        const rawId = (deliveryResponse as { data?: { _id?: unknown; id?: string } })?.data?._id
          ?? (deliveryResponse as { data?: { _id?: string; id?: string } })?.data?.id
        const generatedDeliveryId = rawId != null ? String(rawId) : undefined

        await LagerApi.movements.create({
          artikelId: selectedArticleId,
          bewegungstyp,
          menge,
          datum: new Date().toISOString(),
          empfaenger: outgoingEmployeeId,
          lieferscheinId: generatedDeliveryId,
          bemerkung: metaPieces.join(' | ')
        })
      }

      setStatusMessage(bewegungstyp === 'eingang' ? 'Wareneingang gebucht' : 'Warenausgang gebucht')
      clearActionForm()
      await loadArticles()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Buchung fehlgeschlagen'
      setErrorMessage(message)
    } finally {
      setIsSaving(false)
    }
  }

  async function createDeliveryNote() {
    if (!selectedArticleId) return setErrorMessage('Bitte einen Artikel waehlen')
    if (menge <= 0) return setErrorMessage('Menge muss groesser als 0 sein')

    setIsSaving(true)
    setError('')
    try {
      const deliveryResponse = await LagerApi.deliveryNotes.create({
        typ: 'eingang',
        datum: new Date(lieferscheinDate).toISOString(),
        empfaenger: {
          name: selectedSupplierPartner?.label || 'Unbekannter Lieferant',
          adresse: ''
        },
        positionen: [{
          artikelId: selectedArticleId,
          bezeichnung: selectedArticle?.bezeichnung ?? 'Artikel',
          menge
        }]
      })

      const rawId = (deliveryResponse as { data?: { _id?: unknown; id?: string } })?.data?._id
        ?? (deliveryResponse as { data?: { _id?: string; id?: string } })?.data?.id
      const deliveryId = rawId != null ? String(rawId) : undefined

      if (deliveryFile && deliveryId) {
        await LagerApi.deliveryNotes.uploadAttachment(deliveryId, {
          file: deliveryFile,
          supplier: selectedSupplierPartner?.label ?? '',
          reference: lieferscheinNummer,
          noteDate: lieferscheinDate
        })
      }

      setStatusMessage('Lieferschein erfasst')
      clearActionForm()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lieferschein konnte nicht gespeichert werden'
      setErrorMessage(message)
    } finally {
      setIsSaving(false)
    }
  }

  function startEditDeliveryNote(note: DeliveryNoteRow) {
    setEditingDeliveryNoteId(note._id)
    setDeliveryNoteEditForm({
      datum: toDateInput(note.datum) || new Date().toISOString().slice(0, 10),
      status: note.status ?? 'abgeschlossen',
      empfaengerName: note.empfaenger?.name ?? '',
      empfaengerAdresse: note.empfaenger?.adresse ?? ''
    })
  }

  function cancelEditDeliveryNote() {
    setEditingDeliveryNoteId('')
  }

  function downloadDeliveryNotePdf(noteId: string) {
    window.open('/api/lager/delivery-notes/' + noteId + '/pdf', '_blank', 'noopener,noreferrer')
  }

  async function saveDeliveryNoteUpdate(noteId: string) {
    setIsSaving(true)
    setError('')
    try {
      await LagerApi.deliveryNotes.update(noteId, {
        datum: new Date(deliveryNoteEditForm.datum).toISOString(),
        status: deliveryNoteEditForm.status,
        empfaenger: {
          name: deliveryNoteEditForm.empfaengerName.trim(),
          adresse: deliveryNoteEditForm.empfaengerAdresse.trim()
        }
      })
      setStatusMessage('Lieferschein aktualisiert')
      setEditingDeliveryNoteId('')
      await loadDeliveryNotes()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Lieferschein konnte nicht aktualisiert werden')
    } finally {
      setIsSaving(false)
    }
  }

  async function deleteArticle(article: Article) {
    const id = getArticleId(article)
    if (!id) return
    if (!window.confirm(`Artikel "${article.bezeichnung}" wirklich loeschen?`)) return
    try {
      await LagerApi.articles.archive(id)
      setStatusMessage('Artikel geloescht')
      await refreshMasterData()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Artikel konnte nicht geloescht werden')
    }
  }

  async function deleteMaintenance(entryId?: string) {
    if (!entryId) return
    if (!window.confirm('Wartung wirklich loeschen?')) return
    try {
      await LagerApi.maintenance.delete(entryId)
      setStatusMessage('Wartung geloescht')
      await loadMaintenance()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Wartung konnte nicht geloescht werden')
    }
  }

  async function deleteCategory(category: Category) {
    const id = getCategoryId(category)
    if (!id) return
    if (!window.confirm(`Kategorie "${category.name}" wirklich loeschen?`)) return
    try {
      await LagerApi.categories.delete(id)
      setStatusMessage('Kategorie geloescht')
      await loadCategories()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Kategorie konnte nicht geloescht werden')
    }
  }

  function formatDate(value?: string | Date | null) {
    if (!value) return '-'
    if (typeof value === 'string') {
      const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
      if (dateOnly) {
        return `${dateOnly[3]}.${dateOnly[2]}.${dateOnly[1]}`
      }
    }
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return '-'
    const d = String(parsed.getUTCDate()).padStart(2, '0')
    const m = String(parsed.getUTCMonth() + 1).padStart(2, '0')
    const y = parsed.getUTCFullYear()
    return `${d}.${m}.${y}`
  }

  function formatDateTime(value?: string | Date | null) {
    if (!value) return '-'
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return '-'
    return parsed.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function BackButton() {
    return (
      <Button
        type="button"
        variant="ghost"
        className="h-12 px-2 text-slate-700 dark:text-slate-200"
        onClick={() => {
          clearActionForm()
          setSelectedArticleId('')
          setIncomingEntryMode('select')
          setOutgoingEntryMode('select')
          setView('home')
          setError('')
          setSuccess('')
          setIsInventoryEditOpen(false)
          setInventoryScanMode(false)
          setIsScannerOpen(false)
        }}
      >
        <ChevronLeft className="mr-1 h-5 w-5" />
        Zurueck
      </Button>
    )
  }

  function MovementModeCards() {
    const isIncoming = view === 'eingang'
    const title = isIncoming ? 'Wareneingang erfassen' : 'Warenausgang erfassen'

    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">{title}: Bitte zuerst Modus waehlen</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            className="h-16 justify-start gap-2 rounded-xl"
            onClick={() => {
              if (isIncoming) {
                setIncomingEntryMode('qr')
              } else {
                setOutgoingEntryMode('qr')
              }
              setIsScannerOpen(true)
            }}
          >
            <QrCode className="h-5 w-5" />
            QR-Code scannen
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="h-16 justify-start gap-2 rounded-xl"
            onClick={() => {
              if (isIncoming) {
                setIncomingEntryMode('manual')
              } else {
                setOutgoingEntryMode('manual')
              }
            }}
          >
            <Pencil className="h-5 w-5" />
            Manuell eintragen
          </Button>
        </div>
      </div>
    )
  }

  function ScanCard() {
    return (
      <Card className="rounded-xl border-dashed border-slate-300 dark:border-slate-600">
        <CardContent className="p-3">
          <Button type="button" variant="outline" className="h-12 w-full justify-start gap-2" onClick={() => setIsScannerOpen(true)}>
            <QrCode className="h-5 w-5" />
            QR-Code scannen
          </Button>
        </CardContent>
      </Card>
    )
  }

  function openIncomingView() {
    clearActionForm()
    setSelectedArticleId('')
    setIncomingEntryMode('select')
    setView('eingang')
  }

  function openOutgoingView() {
    clearActionForm()
    setSelectedArticleId('')
    setOutgoingEntryMode('select')
    setView('ausgang')
  }

  async function handleLogout() {
    await signOut({ redirect: false })
    router.push('/login')
    router.refresh()
  }

  const showMovementModeCards = (view === 'eingang' && incomingEntryMode === 'select') || (view === 'ausgang' && outgoingEntryMode === 'select')
  const showScanCard = (view === 'eingang' && incomingEntryMode === 'qr') || (view === 'ausgang' && outgoingEntryMode === 'qr')

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-1 pb-8 pt-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <h1 className="truncate text-2xl font-semibold text-slate-900 dark:text-white">Lager App</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">{currentViewTitle}</p>
        </div>
        <Button variant="ghost" size="sm" className="h-11 shrink-0 text-slate-600 dark:text-slate-400" onClick={handleLogout}>
          <LogOut className="mr-1 h-5 w-5" />
          Abmelden
        </Button>
      </div>

      {(error || success) && (
        <Card className={error ? 'border-red-200 dark:border-red-800' : 'border-emerald-200 dark:border-emerald-800'}>
          <CardContent className="py-3 text-sm">
            {error ? <p className="text-red-700 dark:text-red-300">{error}</p> : <p className="text-emerald-700 dark:text-emerald-300">{success}</p>}
          </CardContent>
        </Card>
      )}

      {selectedArticle && (
        <Card className="rounded-2xl">
          <CardContent className="space-y-2 py-4">
            <div className="flex items-center justify-between">
              <p className="font-medium text-slate-900 dark:text-white">{selectedArticle.bezeichnung}</p>
              <Badge variant="secondary">Bestand: {selectedArticle.bestand ?? 0}</Badge>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {selectedArticle.artikelnummer} {selectedArticle.lagerort ? `- ${selectedArticle.lagerort}` : ''}
            </p>
          </CardContent>
        </Card>
      )}

      {view === 'home' && (
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">Aktion waehlen</p>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Button className="h-28 w-full justify-start gap-3 whitespace-normal rounded-xl p-4 text-left text-base" onClick={() => setIsScannerOpen(true)}>
              <QrCode className="h-5 w-5" />
              QR-Code scannen
            </Button>
            <Button variant="secondary" className="h-28 w-full justify-start gap-3 whitespace-normal rounded-xl p-4 text-left text-base" onClick={openIncomingView}>
              <ArrowDownToLine className="h-5 w-5" />
              Wareneingang
            </Button>
            <Button variant="secondary" className="h-28 w-full justify-start gap-3 whitespace-normal rounded-xl p-4 text-left text-base" onClick={openOutgoingView}>
              <ArrowUpFromLine className="h-5 w-5" />
              Warenausgang
            </Button>
            <Button variant="outline" className="h-28 w-full justify-start gap-3 whitespace-normal rounded-xl p-4 text-left text-base" onClick={() => setView('lieferschein')}>
              <FileText className="h-5 w-5" />
              Lieferscheine ansehen
            </Button>
            <Button variant="outline" className="h-28 w-full justify-start gap-3 whitespace-normal rounded-xl p-4 text-left text-base" onClick={() => setView('bestand')}>
              <LayoutGrid className="h-5 w-5" />
              Bestand
            </Button>
            <Button variant="outline" className="h-28 w-full justify-start gap-3 whitespace-normal rounded-xl p-4 text-left text-base" onClick={() => setView('bewegungen')}>
              <History className="h-5 w-5" />
              Bewegungen (Historie)
            </Button>
            <Button variant="outline" className="h-28 w-full justify-start gap-3 whitespace-normal rounded-xl p-4 text-left text-base" onClick={() => setView('wartung')}>
              <Wrench className="h-5 w-5" />
              Wartung
            </Button>
            <Button variant="outline" className="h-28 w-full justify-start gap-3 whitespace-normal rounded-xl p-4 text-left text-base" onClick={() => setView('inventur')}>
              <ClipboardCheck className="h-5 w-5" />
              Inventur
            </Button>
            <Button variant="outline" className="h-28 w-full justify-start gap-3 whitespace-normal rounded-xl p-4 text-left text-base" onClick={() => setView('produkte')}>
              <FolderTree className="h-5 w-5" />
              Produkte (Kategorien und Artikel)
            </Button>
            <Button variant="outline" className="h-28 w-full justify-start gap-3 whitespace-normal rounded-xl p-4 text-left text-base" onClick={() => setView('lieferanten')}>
              <Plus className="h-5 w-5" />
              Lieferanten/Kontakte
            </Button>
          </CardContent>
        </Card>
      )}

      {(view === 'eingang' || view === 'ausgang') && (
        <Card className="rounded-2xl">
          <CardContent className="space-y-4 pt-4">
            <BackButton />
            {showMovementModeCards ? (
              <MovementModeCards />
            ) : (
              <>
                {showScanCard && <ScanCard />}

            {view === 'eingang' ? (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Positionen *</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => setIncomingItems((prev) => [...prev, createIncomingItem()])}
                      disabled={isSaving || isLoading}
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Position
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {incomingItems.map((item, index) => (
                      <div key={item.id} className="grid grid-cols-[1fr_84px_44px] gap-2">
                        <ArticleSelect
                          id={`eingang-artikel-${index + 1}`}
                          value={item.artikelId}
                          onValueChange={(value) => {
                            setIncomingItems((prev) =>
                              prev.map((entry) => (entry.id === item.id ? { ...entry, artikelId: value } : entry))
                            )
                          }}
                          articles={articles}
                          placeholder={`Artikel ${index + 1} waehlen`}
                          searchPlaceholder="Artikel suchen..."
                          triggerClassName="h-12 rounded-xl text-base"
                          disabled={isSaving || isLoading}
                        />
                        <Input
                          type="number"
                          min={1}
                          className="h-12 rounded-xl text-base"
                          value={item.menge}
                          onChange={(event) => {
                            const nextMenge = parseInt(event.target.value, 10) || 1
                            setIncomingItems((prev) =>
                              prev.map((entry) => (entry.id === item.id ? { ...entry, menge: nextMenge } : entry))
                            )
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-12 w-12 rounded-xl"
                          disabled={incomingItems.length <= 1 || isSaving || isLoading}
                          onClick={() => setIncomingItems((prev) => prev.filter((entry) => entry.id !== item.id))}
                          aria-label={`Position ${index + 1} entfernen`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lieferant">Lieferant *</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <PartnerSelect
                        id="lieferant"
                        value={lieferant}
                        onValueChange={setLieferant}
                        employees={partnerEmployees}
                        suppliers={partnerSuppliers}
                        triggerClassName="h-12 rounded-xl text-base"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-12 w-12 rounded-xl"
                      onClick={() => setIsAddPartnerDialogOpen(true)}
                      disabled={isSaving || isLoading}
                      aria-label="Lieferant hinzufuegen"
                    >
                      <Plus className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lieferscheinNummer">Lieferscheinnummer (optional)</Label>
                  <Select
                    value={selectedIncomingDeliveryNoteId || '__none'}
                    onValueChange={(value) => setSelectedIncomingDeliveryNoteId(value === '__none' ? '' : value)}
                    disabled={!selectedSupplierPartner || isLoadingIncomingDeliveryNotes}
                  >
                    <SelectTrigger id="lieferscheinNummer" className="h-12 rounded-xl text-base">
                      <SelectValue
                        placeholder={
                          !selectedSupplierPartner
                            ? 'Zuerst Lieferant/Mitarbeiter waehlen'
                            : isLoadingIncomingDeliveryNotes
                              ? 'Lade offene Lieferscheine...'
                              : 'Offenen Lieferschein auswaehlen'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Kein Lieferschein</SelectItem>
                      {openOutgoingDeliveryNotes.map((note) => (
                        <SelectItem key={String(note._id)} value={String(note._id)}>
                          {note.nummer} - {formatDate(note.datum)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedSupplierPartner && !isLoadingIncomingDeliveryNotes && openOutgoingDeliveryNotes.length === 0 && (
                    <Input
                      className="mt-2 h-12 rounded-xl text-base"
                      value={incomingManualLieferscheinNummer}
                      onChange={(event) => setIncomingManualLieferscheinNummer(event.target.value)}
                      placeholder="Manuelle Lieferscheinnummer eingeben"
                    />
                  )}
                </div>
                <Button className="h-14 w-full text-base" disabled={isSaving || isLoading} onClick={() => createMovement('eingang')}>
                  <Package2 className="mr-2 h-5 w-5" />
                  {isSaving ? 'Buche...' : 'Wareneingang buchen'}
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Artikel</Label>
                  <ArticleSelect
                    id="bewegung-artikel"
                    value={selectedArticleId}
                    onValueChange={setSelectedArticleId}
                    articles={articles}
                    placeholder="Artikel waehlen"
                    searchPlaceholder="Artikel suchen..."
                    triggerClassName="h-12 rounded-xl text-base"
                    disabled={isSaving || isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="menge">Menge</Label>
                  <Input id="menge" type="number" min={1} className="h-12 rounded-xl text-base" value={menge} onChange={(event) => setMenge(parseInt(event.target.value, 10) || 1)} />
                </div>
              </>
            )}
            {view === 'ausgang' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="empfaenger">Empfaenger (optional)</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <PartnerSelect
                        id="empfaenger"
                        value={empfaenger}
                        onValueChange={setEmpfaenger}
                        employees={partnerEmployees}
                        suppliers={partnerSuppliers}
                        triggerClassName="h-12 rounded-xl text-base"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-12 w-12 rounded-xl"
                      onClick={() => setIsAddPartnerDialogOpen(true)}
                      disabled={isSaving || isLoading}
                      aria-label="Empfaenger hinzufuegen"
                    >
                      <Plus className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="projekt">Projekt/Baustelle (optional)</Label>
                  <Select value={projekt} onValueChange={setProjekt} disabled={isSaving || isProjectsLoading}>
                    <SelectTrigger className="h-12 rounded-xl text-base">
                      <SelectValue placeholder="Projekt/Baustelle waehlen" />
                    </SelectTrigger>
                    <SelectContent>
                      {projectOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="h-14 w-full text-base" disabled={isSaving || isLoading} onClick={() => createMovement('ausgang')}>
                  <Package2 className="mr-2 h-5 w-5" />
                  {isSaving ? 'Buche...' : 'Warenausgang buchen'}
                </Button>
              </>
            )}

              </>
            )}
          </CardContent>
        </Card>
      )}

      {view === 'lieferschein' && (
        <Card className="rounded-2xl">
          <CardContent className="space-y-4 pt-4">
            <BackButton />
            <div className="space-y-2">
              <Label>Lieferscheine ansehen</Label>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
                <Input className="h-10 rounded-xl" value={deliveryNoteSearch} onChange={(event) => setDeliveryNoteSearch(event.target.value)} placeholder="Suche: Nummer oder Empfaenger" />
                <Select value={deliveryNoteTypeFilter} onValueChange={(value) => setDeliveryNoteTypeFilter(value as 'alle' | 'eingang' | 'ausgang')}>
                  <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Typ" /></SelectTrigger>
                  <SelectContent><SelectItem value="alle">Alle Typen</SelectItem><SelectItem value="eingang">Eingang</SelectItem><SelectItem value="ausgang">Ausgang</SelectItem></SelectContent>
                </Select>
                <Select value={deliveryNoteStatusFilter} onValueChange={(value) => setDeliveryNoteStatusFilter(value as 'alle' | 'entwurf' | 'abgeschlossen')}>
                  <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent><SelectItem value="alle">Alle Status</SelectItem><SelectItem value="entwurf">Entwurf</SelectItem><SelectItem value="abgeschlossen">Abgeschlossen</SelectItem></SelectContent>
                </Select>
                <Input type="date" className="h-10 rounded-xl" value={deliveryNoteDateFrom} onChange={(event) => setDeliveryNoteDateFrom(event.target.value)} />
                <Input type="date" className="h-10 rounded-xl" value={deliveryNoteDateTo} onChange={(event) => setDeliveryNoteDateTo(event.target.value)} />
              </div>
              {isDeliveryNotesLoading ? (
                <p className="text-sm text-slate-500">Lade Lieferscheine...</p>
              ) : deliveryNotes.length === 0 ? (
                <p className="text-sm text-slate-500">Keine Lieferscheine vorhanden.</p>
              ) : (
                <div className="space-y-2">
                  {deliveryNotes.map((note) => (
                    <div key={note._id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{note.nummer}</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">{formatDate(note.datum)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={note.typ === 'ausgang' ? 'default' : 'secondary'}>{note.typ === 'ausgang' ? 'Ausgang' : 'Eingang'}</Badge>
                          <Button type="button" size="sm" variant="outline" onClick={() => downloadDeliveryNotePdf(note._id)}>
                            <FileDown className="mr-1 h-4 w-4" />PDF
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => startEditDeliveryNote(note)}>
                            Details
                          </Button>
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">Empfaenger: {note.empfaenger?.name || '-'}</p>

                      {editingDeliveryNoteId === note._id && (
                        <div className="mt-3 space-y-2 border-t border-slate-200 pt-3 dark:border-slate-700">
                          <p className="text-sm"><strong>Status:</strong> {note.status ?? '-'}</p>
                          <p className="text-sm"><strong>Empfaenger:</strong> {note.empfaenger?.name ?? '-'}</p>
                          <p className="text-sm"><strong>Adresse:</strong> {note.empfaenger?.adresse ?? '-'}</p>
                          <div className="flex gap-2">
                            <Button type="button" className="h-10" onClick={() => { setMovementLieferscheinFilter(note._id); setView('bewegungen') }}>
                              In Bewegungshistorie oeffnen
                            </Button>
                            <Button type="button" variant="outline" className="h-10" onClick={cancelEditDeliveryNote}>
                              Schliessen
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {view === 'bestand' && (
        <Card className="rounded-2xl">
          <CardContent className="space-y-4 pt-4">
            <div className="flex items-center justify-between gap-2">
              <BackButton />
              <AddArticleDialog categories={categories} onSuccess={refreshMasterData} />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Bestand</h2>
            {articles.length === 0 ? (
              <p className="text-sm text-slate-500">Keine Artikel vorhanden.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                {articles
                  .slice()
                  .sort((a, b) => (a.bezeichnung || '').localeCompare(b.bezeichnung || '', 'de'))
                  .map((article) => (
                    <div key={getArticleId(article)} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-slate-900 dark:text-white">{article.bezeichnung}</p>
                        <Badge variant="secondary">{article.bestand ?? 0}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{article.artikelnummer} {article.lagerort ? `- ${article.lagerort}` : ''}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => { setDetailArticle(article); setArticleDetailsOpen(true) }}>
                            <QrCode className="mr-1 h-4 w-4" />Details / QR
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setEditingArticle(article); setEditArticleOpen(true) }}>
                            <Pencil className="mr-1 h-4 w-4" />Bearbeiten
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => deleteArticle(article)}>
                            <Trash2 className="mr-1 h-4 w-4" />Loeschen
                          </Button>
                        </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {view === 'bewegungen' && (
        <Card className="rounded-2xl">
          <CardContent className="space-y-4 pt-4">
            <BackButton />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Bewegungen (Historie)</h2>
            {movementLieferscheinFilter && (
              <Button type="button" variant="outline" size="sm" onClick={() => setMovementLieferscheinFilter('')}>
                Lieferschein-Filter aktiv (x)
              </Button>
            )}
            {isDetailLoading ? (
              <p className="text-sm text-slate-500">Lade Bewegungen...</p>
            ) : movements.length === 0 ? (
              <p className="text-sm text-slate-500">Keine Bewegungen vorhanden.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                {movements.slice(0, 100).map((movement) => (
                  <div key={String(movement._id ?? movement.id ?? `${movement.artikelId}-${movement.datum}`)} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-slate-900 dark:text-white">{(movement as { artikelId_populated?: { bezeichnung?: string } }).artikelId_populated?.bezeichnung ?? 'Artikel'}</p>
                      <Badge variant={movement.bewegungstyp === 'eingang' ? 'default' : 'secondary'}>{movement.bewegungstyp} {movement.menge}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{formatDate(movement.datum)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {view === 'wartung' && (
        <Card className="rounded-2xl">
          <CardContent className="space-y-4 pt-4">
            <div className="flex items-center justify-between gap-2">
              <BackButton />
              <Button size="sm" onClick={() => setAddMaintenanceOpen(true)}>
                <Plus className="mr-1 h-4 w-4" />Neu
              </Button>
            </div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Wartung</h2>
            {isDetailLoading ? (
              <p className="text-sm text-slate-500">Lade Wartungen...</p>
            ) : maintenanceList.length === 0 ? (
              <p className="text-sm text-slate-500">Keine Wartungseintraege vorhanden.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                {maintenanceList.slice(0, 100).map((entry, idx) => (
                  <div key={entry._id ?? `${entry.wartungsart}-${idx}`} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-slate-900 dark:text-white">{entry.wartungsart ?? 'Wartung'}</p>
                      <Badge variant="secondary">{entry.status ?? 'offen'}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{typeof entry.artikelId === 'object' ? `${entry.artikelId.artikelnummer ?? ''} ${entry.artikelId.bezeichnung ?? ''}`.trim() : String(entry.artikelId ?? '-')}</p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Faellig: {formatDate(entry.faelligkeitsdatum)}</p>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setPerformMaintenanceId(entry._id ?? null)}>
                        <Pencil className="mr-1 h-4 w-4" />Bearbeiten
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => deleteMaintenance(entry._id)}>
                        <Trash2 className="mr-1 h-4 w-4" />Loeschen
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {view === 'inventur' && (
        <Card className="rounded-2xl">
          <CardContent className="space-y-4 pt-4">
            <div className="flex items-center justify-between gap-2">
              <BackButton />
              <Button size="sm" onClick={() => { setInventoryCreateForm(createEmptyInventoryCreateForm()); setInventoryCreateOpen(true) }}>
                <Plus className="mr-1 h-4 w-4" />Inventur starten
              </Button>
            </div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Inventur</h2>

            {isDetailLoading ? (
              <p className="text-sm text-slate-500">Lade Inventuren...</p>
            ) : inventoryList.length === 0 ? (
              <p className="text-sm text-slate-500">Keine Inventuren vorhanden.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                {inventoryList.slice(0, 100).map((entry, idx) => (
                  <div key={entry._id ?? `${entry.stichtag}-${idx}`} className={`rounded-xl border p-3 dark:border-slate-700 ${selectedInventoryId === String(entry._id ?? '') ? 'border-blue-500' : 'border-slate-200'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-slate-900 dark:text-white">{getInventoryDisplayName(entry)}</p>
                      <Badge variant={entry.status === 'abgeschlossen' ? 'secondary' : 'default'}>{entry.status ?? '-'}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Stichtag: {formatDate(entry.stichtag)}</p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Zeitraum: {formatInventoryRange(entry)}</p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Fokus: {formatInventoryFocus(entry)}</p>
                    {entry.beschreibung?.trim() && (
                      <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">{entry.beschreibung.trim()}</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {entry.status === 'abgeschlossen' ? (
                        <>
                          <Button size="sm" variant="outline" onClick={() => entry._id && openInventoryResults(String(entry._id))}>
                            Ergebnisse einsehen
                          </Button>
                          <Button size="sm" onClick={() => downloadInventoryResults(entry._id)}>
                            Ergebnisse downloaden
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" onClick={() => entry._id && openInventoryForEdit(String(entry._id))}>
                            Bearbeiten
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => entry._id && startOrContinueInventoryScan(String(entry._id))}
                            disabled={isInventorySaving}
                          >
                            {hasInventoryScans(entry) ? 'Weiterfuehren' : 'Starten'}
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="destructive" onClick={() => deleteInventory(entry._id)}>
                        Loeschen
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {inventoryDetail && selectedInventoryId && isInventoryEditOpen && (
              <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex items-center justify-between gap-2"><p className="font-medium text-slate-900 dark:text-white">Inventur bearbeiten</p><Button size="sm" variant="ghost" onClick={() => setIsInventoryEditOpen(false)}>Schliessen</Button></div>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input className="h-11 rounded-xl" disabled={inventoryDetail.status === 'abgeschlossen'} value={inventoryForm.name} onChange={(event) => setInventoryForm((prev) => ({ ...prev, name: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Beschreibung</Label>
                  <Textarea className="rounded-xl" rows={3} disabled={inventoryDetail.status === 'abgeschlossen'} value={inventoryForm.beschreibung} onChange={(event) => setInventoryForm((prev) => ({ ...prev, beschreibung: event.target.value }))} placeholder="Optional: Zweck oder Hinweise zur Inventur" />
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Stichtag</Label>
                    <Input type="date" className="h-11 rounded-xl" disabled={inventoryDetail.status === 'abgeschlossen'} value={inventoryForm.stichtag} onChange={(event) => setInventoryForm((prev) => ({ ...prev, stichtag: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Von</Label>
                    <Input type="date" className="h-11 rounded-xl" disabled={inventoryDetail.status === 'abgeschlossen'} value={inventoryForm.zeitraumVon} onChange={(event) => setInventoryForm((prev) => ({ ...prev, zeitraumVon: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Bis</Label>
                    <Input type="date" className="h-11 rounded-xl" disabled={inventoryDetail.status === 'abgeschlossen'} value={inventoryForm.zeitraumBis} onChange={(event) => setInventoryForm((prev) => ({ ...prev, zeitraumBis: event.target.value }))} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Inventur-Fokus</Label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <Button
                      type="button"
                      variant={inventoryForm.fokusTyp === 'alle' ? 'default' : 'outline'}
                      disabled={inventoryDetail.status === 'abgeschlossen'}
                      onClick={() => setInventoryForm((prev) => ({ ...prev, fokusTyp: 'alle', kategorien: [], artikelIds: [] }))}
                    >
                      Alle Produkte
                    </Button>
                    <Button
                      type="button"
                      variant={inventoryForm.fokusTyp === 'kategorien' ? 'default' : 'outline'}
                      disabled={inventoryDetail.status === 'abgeschlossen'}
                      onClick={() => setInventoryForm((prev) => ({ ...prev, fokusTyp: 'kategorien', artikelIds: [] }))}
                    >
                      Kategorien
                    </Button>
                    <Button
                      type="button"
                      variant={inventoryForm.fokusTyp === 'artikel' ? 'default' : 'outline'}
                      disabled={inventoryDetail.status === 'abgeschlossen'}
                      onClick={() => setInventoryForm((prev) => ({ ...prev, fokusTyp: 'artikel', kategorien: [] }))}
                    >
                      Einzelprodukte
                    </Button>
                  </div>
                </div>

                {inventoryForm.fokusTyp === 'kategorien' && (
                  <div className="space-y-2">
                    <Label>Kategorien (Mehrfachauswahl)</Label>
                    <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                      {categories.length === 0 ? (
                        <p className="text-xs text-slate-500">Keine Kategorien vorhanden.</p>
                      ) : (
                        categories.map((category) => {
                          const categoryKey = getCategoryId(category)
                          const categoryName = category.name?.trim() ?? ''
                          if (!categoryName) return null
                          const isChecked = inventoryForm.kategorien.includes(categoryName)
                          return (
                            <label key={categoryKey || categoryName} className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm">
                              <Checkbox
                                disabled={inventoryDetail.status === 'abgeschlossen'}
                                checked={isChecked}
                                onCheckedChange={(checked) => setInventoryForm((prev) => ({
                                  ...prev,
                                  kategorien: toggleStringSelection(prev.kategorien, categoryName, checked === true)
                                }))}
                              />
                              <span>{categoryName}</span>
                            </label>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}

                {inventoryForm.fokusTyp === 'artikel' && (
                  <div className="space-y-2">
                    <Label>Produkte (Mehrfachauswahl)</Label>
                    <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                      {activeArticles.length === 0 ? (
                        <p className="text-xs text-slate-500">Keine Produkte vorhanden.</p>
                      ) : (
                        activeArticles
                          .slice()
                          .sort((a, b) => (a.bezeichnung || '').localeCompare(b.bezeichnung || '', 'de'))
                          .map((article) => {
                            const articleId = getArticleId(article)
                            if (!articleId) return null
                            const isChecked = inventoryForm.artikelIds.includes(articleId)
                            return (
                              <label key={articleId} className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1 text-sm">
                                <Checkbox
                                  disabled={inventoryDetail.status === 'abgeschlossen'}
                                  checked={isChecked}
                                  onCheckedChange={(checked) => setInventoryForm((prev) => ({
                                    ...prev,
                                    artikelIds: toggleStringSelection(prev.artikelIds, articleId, checked === true)
                                  }))}
                                />
                                <span className="leading-tight">
                                  <span className="font-medium text-slate-900 dark:text-white">{article.bezeichnung}</span>
                                  <span className="block text-xs text-slate-500">{article.artikelnummer}</span>
                                </span>
                              </label>
                            )
                          })
                      )}
                    </div>
                  </div>
                )}
                <div className="rounded-lg bg-slate-100 p-2 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <p>Scan-Session: {inventoryDetail.activeScanSessionId ? 'aktiv' : 'nicht aktiv'}</p>
                  <p>Letzter Scan: {inventoryDetail.lastScanAt ? formatDateTime(inventoryDetail.lastScanAt) : '-'}</p>
                  <p>Gesamt-Scans: {(inventoryDetail.scanEvents ?? []).length}</p>
                </div>

                {inventoryDetail.status !== 'abgeschlossen' && (
                  <>
                    <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                      {(inventoryDetail.positionen ?? []).map((pos, idx) => {
                        const article = toInventoryArticle(pos.artikelId)
                        const artikelId = resolveInventoryArticleId(pos.artikelId)
                        const soll = Number(pos.sollMenge ?? 0)
                        const ist = inventoryIstMengen[artikelId] ?? Number(pos.istMenge ?? 0)
                        const diff = ist - soll
                        return (
                          <div key={artikelId || idx} className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-slate-900 dark:text-white">{article?.bezeichnung ?? article?.artikelnummer ?? 'Artikel'}</p>
                              <p className="text-xs text-slate-600 dark:text-slate-400">Soll {soll} | Diff {diff > 0 ? `+${diff}` : diff}</p>
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <Label className="text-xs">Ist</Label>
                              <Input type="number" min={0} className="h-10 w-28" value={ist} onChange={(event) => setInventoryIstMengen((prev) => ({ ...prev, [artikelId]: parseInt(event.target.value, 10) || 0 }))} />
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button className="h-11" disabled={isInventorySaving} onClick={saveInventory}>
                        {isInventorySaving ? 'Speichere...' : 'Speichern'}
                      </Button>
                      <Button className="h-11" variant="destructive" disabled={isInventoryCompleting} onClick={() => setInventoryCompleteConfirmOpen(true)}>
                        {isInventoryCompleting ? 'Schliesse ab...' : 'Inventur abschliessen'}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {inventoryDetail && selectedInventoryId && isInventoryResultOpen && (
        <Card className="rounded-2xl border-slate-200 dark:border-slate-700">
          <CardContent className="space-y-4 pt-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Inventur-Ergebnisse</h3>
              <Button size="sm" variant="ghost" onClick={() => setIsInventoryResultOpen(false)}>Schliessen</Button>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <p className="text-sm text-slate-700 dark:text-slate-300"><span className="font-medium">Name:</span> {getInventoryDisplayName(inventoryDetail)}</p>
              <p className="text-sm text-slate-700 dark:text-slate-300"><span className="font-medium">Status:</span> {inventoryDetail.status ?? '-'}</p>
              <p className="text-sm text-slate-700 dark:text-slate-300"><span className="font-medium">Stichtag:</span> {formatDate(inventoryDetail.stichtag)}</p>
              <p className="text-sm text-slate-700 dark:text-slate-300"><span className="font-medium">Zeitraum:</span> {formatInventoryRange(inventoryDetail)}</p>
              <p className="text-sm text-slate-700 dark:text-slate-300"><span className="font-medium">Fokus:</span> {formatInventoryFocus(inventoryDetail)}</p>
              <p className="text-sm text-slate-700 dark:text-slate-300"><span className="font-medium">Beschreibung:</span> {inventoryDetail.beschreibung?.trim() || '-'}</p>
              <p className="text-sm text-slate-700 dark:text-slate-300"><span className="font-medium">Abgeschlossen am:</span> {inventoryDetail.abgeschlossenAm ? formatDateTime(inventoryDetail.abgeschlossenAm) : '-'}</p>
            </div>

            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {(inventoryDetail.positionen ?? []).map((pos, idx) => {
                const article = toInventoryArticle(pos.artikelId)
                const artikelId = resolveInventoryArticleId(pos.artikelId)
                const soll = Number(pos.sollMenge ?? 0)
                const ist = inventoryIstMengen[artikelId] ?? Number(pos.istMenge ?? 0)
                const diff = ist - soll
                return (
                  <div key={artikelId || idx} className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{article?.bezeichnung ?? article?.artikelnummer ?? 'Artikel'}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">Soll {soll} | Ist {ist} | Diff {diff > 0 ? `+${diff}` : diff}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-100 p-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <p>Positionen: {(inventoryDetail.positionen ?? []).length}</p>
              <p>Gesamt Soll: {(inventoryDetail.positionen ?? []).reduce((sum, pos) => sum + Number(pos.sollMenge ?? 0), 0)}</p>
              <p>Gesamt Ist: {(inventoryDetail.positionen ?? []).reduce((sum, pos) => {
                const artikelId = resolveInventoryArticleId(pos.artikelId)
                return sum + (inventoryIstMengen[artikelId] ?? Number(pos.istMenge ?? 0))
              }, 0)}</p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsInventoryResultOpen(false)}>Schliessen</Button>
              <Button onClick={() => downloadInventoryResults(selectedInventoryId)}>Ergebnisse downloaden</Button>
            </div>
          </CardContent>
        </Card>
      )}
      {view === 'produkte' && (
        <Card className="rounded-2xl">
          <CardContent className="space-y-6 pt-4">
            <div className="flex items-center justify-between gap-2">
              <BackButton />
              <div className="flex flex-wrap gap-2">
                <AddCategoryDialog onSuccess={loadCategories} />
                <AddArticleDialog categories={categories} onSuccess={refreshMasterData} />
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Kategorien</h2>
              {categories.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">Keine Kategorien vorhanden.</p>
              ) : (
                <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-2">
                  {categories.map((category) => (
                    <div key={getCategoryId(category)} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-slate-900 dark:text-white">{category.name}</p>
                        <Tag className="h-4 w-4 text-slate-500" />
                      </div>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{category.beschreibung || 'Keine Beschreibung'}</p>
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => { setEditingCategory(category); setEditCategoryOpen(true) }}>
                          <Pencil className="mr-1 h-4 w-4" />Bearbeiten
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => deleteCategory(category)}>
                          <Trash2 className="mr-1 h-4 w-4" />Loeschen
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Produkte</h2>
              {articles.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">Keine Produkte vorhanden.</p>
              ) : (
                <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-2">
                  {articles
                    .slice()
                    .sort((a, b) => (a.kategorie || '').localeCompare(b.kategorie || '', 'de') || (a.bezeichnung || '').localeCompare(b.bezeichnung || '', 'de'))
                    .map((article) => (
                      <div key={getArticleId(article)} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <ArticleThumbnail
                              articleId={getArticleId(article)}
                              images={article.images}
                              className="h-12 w-12"
                            />
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 dark:text-white">{article.bezeichnung}</p>
                              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{article.artikelnummer}</p>
                            </div>
                          </div>
                          <Badge variant="outline">{article.kategorie || 'Ohne Kategorie'}</Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => { setDetailArticle(article); setArticleDetailsOpen(true) }}>
                            <QrCode className="mr-1 h-4 w-4" />Details / QR
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setEditingArticle(article); setEditArticleOpen(true) }}>
                            <Pencil className="mr-1 h-4 w-4" />Bearbeiten
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => deleteArticle(article)}>
                            <Trash2 className="mr-1 h-4 w-4" />Loeschen
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {view === 'lieferanten' && (
        <Card className="rounded-2xl">
          <CardContent className="space-y-4 pt-4">
            <BackButton />
            <LagerPartnerView onRefresh={loadPartnerData} />
          </CardContent>
        </Card>
      )}
      {editingArticle && (
        <EditArticleDialog
          article={editingArticle}
          categories={categories}
          open={editArticleOpen}
          onOpenChange={(open) => { setEditArticleOpen(open); if (!open) setEditingArticle(null) }}
          onSuccess={() => { setStatusMessage('Artikel aktualisiert'); refreshMasterData() }}
        />
      )}

      <ArticleDetailsDialog
        open={articleDetailsOpen}
        onOpenChange={(open) => {
          setArticleDetailsOpen(open)
          if (!open) setDetailArticle(null)
        }}
        article={detailArticle}
      />
      <AddMaintenanceDialog open={addMaintenanceOpen} onOpenChange={setAddMaintenanceOpen} articles={articles} categories={categories} onSuccess={() => { setStatusMessage('Wartung angelegt'); loadMaintenance() }} />

      <PerformMaintenanceDialog
        open={performMaintenanceId !== null}
        onOpenChange={(open) => !open && setPerformMaintenanceId(null)}
        maintenanceId={performMaintenanceId}
        onSuccess={() => { setStatusMessage('Wartung aktualisiert'); loadMaintenance() }}
      />

      <EditCategoryDialog
        open={editCategoryOpen}
        onOpenChange={(open) => { setEditCategoryOpen(open); if (!open) setEditingCategory(null) }}
        category={editingCategory}
        onSuccess={() => { setStatusMessage('Kategorie aktualisiert'); loadCategories() }}
      />

      {inventoryCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white p-4 shadow-xl dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Neue Inventur</h3>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => { setInventoryCreateOpen(false); setInventoryCreateForm(createEmptyInventoryCreateForm()) }}
                aria-label="Inventur-Dialog schliessen"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-3 flex-1 space-y-3 overflow-y-auto pr-1">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input className="h-11 rounded-xl" value={inventoryCreateForm.name} onChange={(event) => setInventoryCreateForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="z. B. Q2 Hauptlager" />
              </div>
              <div className="space-y-2">
                <Label>Beschreibung</Label>
                <Textarea className="rounded-xl" rows={3} value={inventoryCreateForm.beschreibung} onChange={(event) => setInventoryCreateForm((prev) => ({ ...prev, beschreibung: event.target.value }))} placeholder="Optional: Zweck oder Hinweise zur Inventur" />
              </div>
              <div className="space-y-2">
                <Label>Stichtag</Label>
                <Input type="date" className="h-11 rounded-xl" value={inventoryCreateForm.stichtag} onChange={(event) => setInventoryCreateForm((prev) => ({ ...prev, stichtag: event.target.value }))} />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Zeitraum von</Label>
                  <Input type="date" className="h-11 rounded-xl" value={inventoryCreateForm.zeitraumVon} onChange={(event) => setInventoryCreateForm((prev) => ({ ...prev, zeitraumVon: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Zeitraum bis</Label>
                  <Input type="date" className="h-11 rounded-xl" value={inventoryCreateForm.zeitraumBis} onChange={(event) => setInventoryCreateForm((prev) => ({ ...prev, zeitraumBis: event.target.value }))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Inventur-Fokus</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Button
                    type="button"
                    variant={inventoryCreateForm.fokusTyp === 'alle' ? 'default' : 'outline'}
                    onClick={() => setInventoryCreateForm((prev) => ({ ...prev, fokusTyp: 'alle', kategorien: [], artikelIds: [] }))}
                  >
                    Alle Produkte
                  </Button>
                  <Button
                    type="button"
                    variant={inventoryCreateForm.fokusTyp === 'kategorien' ? 'default' : 'outline'}
                    onClick={() => setInventoryCreateForm((prev) => ({ ...prev, fokusTyp: 'kategorien', artikelIds: [] }))}
                  >
                    Kategorien
                  </Button>
                  <Button
                    type="button"
                    variant={inventoryCreateForm.fokusTyp === 'artikel' ? 'default' : 'outline'}
                    onClick={() => setInventoryCreateForm((prev) => ({ ...prev, fokusTyp: 'artikel', kategorien: [] }))}
                  >
                    Einzelprodukte
                  </Button>
                </div>
              </div>

              {inventoryCreateForm.fokusTyp === 'kategorien' && (
                <div className="space-y-2">
                  <Label>Kategorien (Mehrfachauswahl)</Label>
                  <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                    {categories.length === 0 ? (
                      <p className="text-xs text-slate-500">Keine Kategorien vorhanden.</p>
                    ) : (
                      categories.map((category) => {
                        const categoryKey = getCategoryId(category)
                        const categoryName = category.name?.trim() ?? ''
                        if (!categoryName) return null
                        const isChecked = inventoryCreateForm.kategorien.includes(categoryName)
                        return (
                          <label key={categoryKey || categoryName} className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm">
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={(checked) => setInventoryCreateForm((prev) => ({
                                ...prev,
                                kategorien: toggleStringSelection(prev.kategorien, categoryName, checked === true)
                              }))}
                            />
                            <span>{categoryName}</span>
                          </label>
                        )
                      })
                    )}
                  </div>
                </div>
              )}

              {inventoryCreateForm.fokusTyp === 'artikel' && (
                <div className="space-y-2">
                  <Label>Produkte (Mehrfachauswahl)</Label>
                  <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                    {activeArticles.length === 0 ? (
                      <p className="text-xs text-slate-500">Keine Produkte vorhanden.</p>
                    ) : (
                      activeArticles
                        .slice()
                        .sort((a, b) => (a.bezeichnung || '').localeCompare(b.bezeichnung || '', 'de'))
                        .map((article) => {
                          const articleId = getArticleId(article)
                          if (!articleId) return null
                          const isChecked = inventoryCreateForm.artikelIds.includes(articleId)
                          return (
                            <label key={articleId} className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1 text-sm">
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={(checked) => setInventoryCreateForm((prev) => ({
                                  ...prev,
                                  artikelIds: toggleStringSelection(prev.artikelIds, articleId, checked === true)
                                }))}
                              />
                              <span className="leading-tight">
                                <span className="font-medium text-slate-900 dark:text-white">{article.bezeichnung}</span>
                                <span className="block text-xs text-slate-500">{article.artikelnummer}</span>
                              </span>
                            </label>
                          )
                        })
                    )}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setInventoryCreateOpen(false); setInventoryCreateForm(createEmptyInventoryCreateForm()) }}>Abbrechen</Button>
                <Button className="h-11" disabled={isInventorySaving} onClick={createInventory}>
                  {isInventorySaving ? 'Speichere...' : 'Inventur starten'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {inventoryCompleteConfirmOpen && inventoryDetail && selectedInventoryId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-4 shadow-xl dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Inventur wirklich abschliessen?</h3>
              <Button variant="ghost" size="sm" onClick={() => setInventoryCompleteConfirmOpen(false)} disabled={isInventoryCompleting}>Schliessen</Button>
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Sind Sie sicher? Nach dem Abschluss ist die Inventur gesperrt.</p>

            <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {(inventoryDetail.positionen ?? []).map((pos, idx) => {
                const article = toInventoryArticle(pos.artikelId)
                const artikelId = resolveInventoryArticleId(pos.artikelId)
                const soll = Number(pos.sollMenge ?? 0)
                const ist = inventoryIstMengen[artikelId] ?? Number(pos.istMenge ?? 0)
                const diff = ist - soll
                return (
                  <div key={artikelId || idx} className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{article?.bezeichnung ?? article?.artikelnummer ?? 'Artikel'}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">Soll {soll} | Ist {ist} | Diff {diff > 0 ? `+${diff}` : diff}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setInventoryCompleteConfirmOpen(false)} disabled={isInventoryCompleting}>Abbrechen</Button>
              <Button variant="destructive" onClick={completeInventory} disabled={isInventoryCompleting}>
                {isInventoryCompleting ? 'Schliesse ab...' : 'Ja, Inventur abschliessen'}
              </Button>
            </div>
          </div>
        </div>
      )}
      <AddPartnerDialog
        open={isAddPartnerDialogOpen}
        onOpenChange={setIsAddPartnerDialogOpen}        onSaved={handlePartnerSaved}
      />

      <QrScannerSheet
        open={isScannerOpen}
        closeOnScan={!inventoryScanMode}
        onOpenChange={(open) => {
          setIsScannerOpen(open)
          if (!open) setInventoryScanMode(false)
        }}
        onScanSuccess={(code) => {
          if (view === 'inventur' && selectedInventoryId && inventoryDetail?.status !== 'abgeschlossen' && inventoryScanMode) {
            applyInventoryScan(code)
            return
          }
          resolveArticleByScan(code)
        }}
      />
    </div>
  )
}











































