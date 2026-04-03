'use client'
import React from 'react'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Trash2, Edit } from 'lucide-react'
import type { Subcompany } from '@/types/main'
import SubcompanyDialog from './SubcompanyDialog'

interface SubcompanyActionsProps {
  subcompany: Subcompany
  onUpdate: (
    id: string,
    payload: {
      name: string
      employeeCount: number
      address?: string
      phone?: string
      email?: string
      bankAccount?: string
    }
  ) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export default function SubcompanyActions({ subcompany, onUpdate, onDelete }: SubcompanyActionsProps) {
  const [editOpen, setEditOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await onDelete(subcompany.id)
      setDeleteOpen(false)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        variant="ghost"
        size="sm"
        className="rounded-lg hover:bg-blue-50 hover:text-blue-600"
        onClick={() => setEditOpen(true)}
      >
        <Edit className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50"
        onClick={() => setDeleteOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <SubcompanyDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Subunternehmen bearbeiten"
        submitLabel="Speichern"
        initial={{
          name: subcompany.name,
          employeeCount: subcompany.employeeCount,
          address: subcompany.address,
          phone: subcompany.phone,
          email: subcompany.email,
          bankAccount: subcompany.bankAccount,
        }}
        onSubmit={(payload) => onUpdate(subcompany.id, payload)}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md rounded-xl bg-white dark:bg-slate-800">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white">
              Subunternehmen loeschen
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-slate-600 dark:text-slate-400">
              Soll das Subunternehmen <strong>{subcompany.name}</strong> wirklich geloescht werden?
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setDeleteOpen(false)}
                className="rounded-lg"
                disabled={isDeleting}
              >
                Abbrechen
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700 text-white rounded-lg"
                disabled={isDeleting}
              >
                {isDeleting ? 'Loeschen...' : 'Loeschen'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
