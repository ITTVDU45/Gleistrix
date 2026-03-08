'use client'

import React, { useMemo, useState } from 'react'
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export type RecipientOption = {
  value: string
  name: string
  employeeId?: string
}

interface RecipientSelectProps {
  id?: string
  value: string
  onValueChange: (value: string) => void
  options: RecipientOption[]
  placeholder?: string
  emptyLabel?: string
  searchPlaceholder?: string
  triggerClassName?: string
  disabled?: boolean
}

export default function RecipientSelect({
  id,
  value,
  onValueChange,
  options,
  placeholder = 'Empfaenger waehlen',
  emptyLabel = 'Keine Empfaenger vorhanden',
  searchPlaceholder = 'Empfaenger suchen...',
  triggerClassName,
  disabled = false
}: RecipientSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value]
  )

  const filteredOptions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('de-DE')
    if (!query) return options
    return options.filter((option) =>
      option.name.toLocaleLowerCase('de-DE').includes(query)
    )
  }, [options, search])

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
          <span className="truncate text-slate-900 dark:text-slate-100">{selected?.name ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
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
            <p className="px-2 py-3 text-sm text-slate-500">{emptyLabel}</p>
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
                  <span className="truncate">{option.name}</span>
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}