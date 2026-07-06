'use client'

import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GripVertical, Building2, User, Search, X } from 'lucide-react'
import type { Employee, Project } from '@/types/main'
import type { PlantafelView } from './types'

interface ProjektSidebarProps {
  employees: Employee[]
  projects: Project[]
  view: PlantafelView
  isOpen: boolean
  onClose: () => void
}

export default function ProjektSidebar({
  employees,
  projects,
  view,
  isOpen,
  onClose,
}: ProjektSidebarProps) {
  const [search, setSearch] = useState('')

  if (!isOpen) return null

  return (
    <div className="w-[85vw] sm:w-72 border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col h-full shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 dark:text-white">
          {view === 'team' ? 'Mitarbeiter' : 'Projekte'}
        </h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Suche */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-700">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {view === 'team' ? (
          <EmployeeList employees={employees} search={search} />
        ) : (
          <ProjectList projects={projects} search={search} />
        )}
      </div>
    </div>
  )
}

function EmployeeList({ employees, search }: { employees: Employee[]; search: string }) {
  const filtered = useMemo(() => {
    const active = employees.filter((e) => e.status === 'aktiv')
    if (!search) return active
    const lower = search.toLowerCase()
    return active.filter((e) => e.name.toLowerCase().includes(lower))
  }, [employees, search])

  if (filtered.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
        Keine Mitarbeiter gefunden
      </p>
    )
  }

  return (
    <>
      {filtered.map((employee) => (
        <div
          key={employee.id}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(
              'application/json',
              JSON.stringify({ type: 'employee', id: employee.id, name: employee.name })
            )
            e.dataTransfer.effectAllowed = 'copy'
          }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-grab active:cursor-grabbing transition-colors"
        >
          <GripVertical className="h-4 w-4 text-slate-400 shrink-0" />
          <User className="h-4 w-4 text-blue-500 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
              {employee.name}
            </p>
            {employee.position && (
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {employee.position}
              </p>
            )}
          </div>
        </div>
      ))}
    </>
  )
}

function ProjectList({ projects, search }: { projects: Project[]; search: string }) {
  const filtered = useMemo(() => {
    const active = projects.filter((p) => p.status === 'aktiv')
    if (!search) return active
    const lower = search.toLowerCase()
    return active.filter(
      (p) =>
        p.name.toLowerCase().includes(lower) ||
        p.auftraggeber?.toLowerCase().includes(lower) ||
        p.baustelle?.toLowerCase().includes(lower)
    )
  }, [projects, search])

  if (filtered.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
        Keine Projekte gefunden
      </p>
    )
  }

  return (
    <>
      {filtered.map((project) => (
        <div
          key={project.id}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(
              'application/json',
              JSON.stringify({ type: 'project', id: project.id, name: project.name })
            )
            e.dataTransfer.effectAllowed = 'copy'
          }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-grab active:cursor-grabbing transition-colors"
        >
          <GripVertical className="h-4 w-4 text-slate-400 shrink-0" />
          <Building2 className="h-4 w-4 text-green-500 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
              {project.name}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {project.auftraggeber}
            </p>
          </div>
          <Badge variant="secondary" className="text-[10px] shrink-0">
            {project.status}
          </Badge>
        </div>
      ))}
    </>
  )
}
