"use client";
import React, { useEffect, useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Alert, AlertDescription } from './ui/alert'
import { Edit, CheckCircle, AlertCircle } from 'lucide-react'
import type { Employee, EmployeeStatus } from '../types/main'
import { EmployeesApi } from '@/lib/api/employees'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Checkbox } from './ui/checkbox'

interface EditEmployeeDialogProps {
  employee: Employee;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEmployeeUpdated?: () => Promise<void> | void;
}

export default function EditEmployeeDialog({ employee, open, onOpenChange, onEmployeeUpdated }: EditEmployeeDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [error, setError] = useState('')

  const [editedEmployee, setEditedEmployee] = useState<{ 
    name: string; position: string; email: string; phone: string; status: EmployeeStatus; elbaId: string; address: string; postalCode: string; city: string; 
  }>({
    name: '',
    position: '',
    email: '',
    phone: '',
    status: 'aktiv',
    elbaId: '',
    address: '',
    postalCode: '',
    city: ''
  })
  const [selectedPositions, setSelectedPositions] = useState<string[]>([])

  const positionOptions = [
    'Bahnerder',
    'BüP',
    'HFE',
    'HiBa',
    'Monteur/Bediener',
    'Sakra',
    'SAS',
    'SIPO'
  ]

  useEffect(() => {
    if (employee && open) {
      setEditedEmployee({
        name: employee.name || '',
        position: employee.position || '',
        email: (employee as any).email || '',
        phone: (employee as any).phone || '',
        status: (employee.status as EmployeeStatus) || 'aktiv',
        elbaId: (employee as any).elbaId || '',
        address: (employee as any).address || '',
        postalCode: (employee as any).postalCode || '',
        city: (employee as any).city || ''
      })
      setSelectedPositions(employee.position ? employee.position.split(',').map(p => p.trim()).filter(Boolean) : [])
      setError('')
      setShowSuccess(false)
      setIsSubmitting(false)
    }
  }, [employee, open])

  const handlePositionToggle = (position: string) => {
    setSelectedPositions(prev => prev.includes(position) ? prev.filter(p => p !== position) : [...prev, position])
  }

  const handleInputChange = (field: keyof typeof editedEmployee, value: string) => {
    setEditedEmployee(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')
    try {
      const payload: Partial<Employee> = {
        name: editedEmployee.name,
        position: selectedPositions.join(', '),
        email: editedEmployee.email,
        phone: editedEmployee.phone,
        status: editedEmployee.status,
        elbaId: editedEmployee.elbaId,
        address: editedEmployee.address,
        postalCode: editedEmployee.postalCode,
        city: editedEmployee.city,
      } as any

      const id = (employee as any).id || (employee as any)._id
      const data: any = await EmployeesApi.update(id, payload)
      if (data?.success === false) {
        throw new Error(data?.message || data?.error || 'Fehler beim Bearbeiten des Mitarbeiters')
      }
      if (onEmployeeUpdated) await onEmployeeUpdated()
      setShowSuccess(true)
      setTimeout(() => {
        setShowSuccess(false)
        onOpenChange(false)
      }, 1200)
    } catch (err: any) {
      setError(err?.message || 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl border-0 shadow-2xl bg-white dark:bg-slate-800 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4 border-b border-slate-100 dark:border-slate-700">
          <DialogTitle className="flex items-center gap-3 text-xl font-semibold text-slate-900 dark:text-white">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-xl">
              <Edit className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            Mitarbeiter bearbeiten
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-6 py-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="emp-name" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Name *</Label>
              <Input id="emp-name" value={editedEmployee.name} onChange={e => handleInputChange('name', e.target.value)} placeholder="Vor- und Nachname" className="rounded-xl border-slate-200 dark:border-slate-600 focus:border-green-500 focus:ring-green-500 dark:bg-slate-700 dark:text-white h-12" required />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Position(en)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-between rounded-xl min-h-[48px] border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white whitespace-normal break-words text-left">
                    <span className="block whitespace-normal break-words">{selectedPositions.length > 0 ? selectedPositions.join(', ') : 'Position(en) auswählen'}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="min-w-[320px] max-w-[400px] p-2 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600" style={{ maxHeight: 500 }}>
                  <div className="flex flex-col gap-2">
                    {positionOptions.map((option) => (
                      <label key={option} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox checked={selectedPositions.includes(option)} onCheckedChange={() => handlePositionToggle(option)} className="rounded" />
                        <span className="text-sm text-slate-700 dark:text-slate-200">{option}</span>
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="emp-email" className="text-sm font-semibold text-slate-700 dark:text-slate-300">E-Mail</Label>
              <Input id="emp-email" type="email" value={editedEmployee.email} onChange={e => handleInputChange('email', e.target.value)} placeholder="email@beispiel.de" className="rounded-xl border-slate-200 dark:border-slate-600 focus:border-green-500 focus:ring-green-500 dark:bg-slate-700 dark:text-white h-12" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="emp-phone" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Telefon</Label>
              <Input id="emp-phone" value={editedEmployee.phone} onChange={e => handleInputChange('phone', e.target.value)} placeholder="+49 123 456789" className="rounded-xl border-slate-200 dark:border-slate-600 focus:border-green-500 focus:ring-green-500 dark:bg-slate-700 dark:text-white h-12" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="emp-status" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Status</Label>
              <select id="emp-status" className="w-full rounded-xl min-h-[48px] border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white" value={editedEmployee.status} onChange={(e) => handleInputChange('status', e.target.value as EmployeeStatus)}>
                <option value="aktiv">Aktiv</option>
                <option value="nicht aktiv">Nicht aktiv</option>
                <option value="urlaub">Urlaub</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="emp-elba" className="text-sm font-semibold text-slate-700 dark:text-slate-300">ElBa ID-Nr.</Label>
              <Input id="emp-elba" value={editedEmployee.elbaId} onChange={e => handleInputChange('elbaId', e.target.value)} placeholder="ElBa ID-Nummer" className="rounded-xl border-slate-200 dark:border-slate-600 focus:border-green-500 focus:ring-green-500 dark:bg-slate-700 dark:text-white h-12" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="emp-address" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Anschrift</Label>
              <Input id="emp-address" value={editedEmployee.address} onChange={e => handleInputChange('address', e.target.value)} placeholder="Straße und Hausnummer" className="rounded-xl border-slate-200 dark:border-slate-600 focus:border-green-500 focus:ring-green-500 dark:bg-slate-700 dark:text-white h-12" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="emp-postal" className="text-sm font-semibold text-slate-700 dark:text-slate-300">PLZ</Label>
              <Input id="emp-postal" value={editedEmployee.postalCode} onChange={e => handleInputChange('postalCode', e.target.value)} placeholder="12345" className="rounded-xl border-slate-200 dark:border-slate-600 focus:border-green-500 focus:ring-green-500 dark:bg-slate-700 dark:text-white h-12" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="emp-city" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Stadt</Label>
              <Input id="emp-city" value={editedEmployee.city} onChange={e => handleInputChange('city', e.target.value)} placeholder="Beispielstadt" className="rounded-xl border-slate-200 dark:border-slate-600 focus:border-green-500 focus:ring-green-500 dark:bg-slate-700 dark:text-white h-12" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-700">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting} className="rounded-xl h-12 px-6 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-white">Abbrechen</Button>
            <Button type="submit" disabled={isSubmitting} className="bg-green-600 hover:bg-green-700 text-white rounded-xl h-12 px-6 shadow-lg hover:shadow-xl transition-all duration-200">{isSubmitting ? 'Speichern...' : 'Speichern'}</Button>
          </div>
        </form>

        {/* Erfolgs-Meldung */}
        {showSuccess && (
          <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 rounded-xl mt-2">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-200">Mitarbeiter erfolgreich bearbeitet</AlertDescription>
          </Alert>
        )}

        {/* Fehler-Meldung */}
        {error && (
          <Alert variant="destructive" className="rounded-xl mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </DialogContent>
    </Dialog>
  )
}


