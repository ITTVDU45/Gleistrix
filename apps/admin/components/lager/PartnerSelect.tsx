'use client'

import React, { useMemo, useState } from 'react'
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export type PartnerOption = {
  value: string
  label: string
  partnerType: 'employee' | 'external'
  employeeId?: string
  partnerId?: string
}

interface PartnerSelectProps {
  id?: string
  value: string
  onValueChange: (value: string) => void
  employees: PartnerOption[]
  suppliers: PartnerOption[]
  placeholder?: string
  emptyLabelEmployees?: string
  emptyLabelSuppliers?: string
  searchPlaceholder?: string
  triggerClassName?: string
  disabled?: boolean
  defaultTab?: 'employees' | 'suppliers'
}

export default function PartnerSelect({
  id,
  value,
  onValueChange,
  employees,
  suppliers,
  placeholder = 'Kontakt waehlen',
  emptyLabelEmployees = 'Keine Mitarbeiter vorhanden',
  emptyLabelSuppliers = 'Keine Lieferanten vorhanden',
  searchPlaceholder = 'Suchen...',
  triggerClassName,
  disabled = false,
  defaultTab = 'employees'
}: PartnerSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'employees' | 'suppliers'>(defaultTab)

  const allOptions = useMemo(() => [...employees, ...suppliers], [employees, suppliers])
  const selected = useMemo(() => allOptions.find((option) => option.value === value) ?? null, [allOptions, value])

  const activeOptions = tab === 'employees' ? employees : suppliers
  const filteredOptions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('de-DE')
    if (!query) return activeOptions
    return activeOptions.filter((option) => option.label.toLocaleLowerCase('de-DE').includes(query))
  }, [activeOptions, search])

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setSearch('')
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between rounded-xl font-normal', triggerClassName)}
        >
          <span className="truncate text-slate-900 dark:text-slate-100">{selected?.label ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="border-b px-2 py-2">
          <Tabs value={tab} onValueChange={(next) => setTab(next as 'employees' | 'suppliers')}>
            <TabsList className="grid h-9 w-full grid-cols-2 rounded-lg">
              <TabsTrigger value="employees" className="text-xs">Mitarbeiter</TabsTrigger>
              <TabsTrigger value="suppliers" className="text-xs">Lieferanten/Firmen</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="border-b px-3 py-2">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-500" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 border-0 px-0 shadow-none focus-visible:ring-0"
            />
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto p-1">
          {filteredOptions.length === 0 ? (
            <p className="px-2 py-3 text-sm text-slate-500">
              {tab === 'employees' ? emptyLabelEmployees : emptyLabelSuppliers}
            </p>
          ) : (
            filteredOptions.map((option) => {
              const isActive = option.value === value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onValueChange(option.value)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center rounded-md px-2 py-2 text-left text-sm text-slate-900 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800',
                    isActive && 'bg-slate-100 dark:bg-slate-800'
                  )}
                >
                  <Check className={cn('mr-2 h-4 w-4', isActive ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">{option.label}</span>
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
