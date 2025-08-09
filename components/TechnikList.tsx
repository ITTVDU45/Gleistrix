"use client";
import React, { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import type { Project } from '../types'
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from './ui/table'
import { Button } from './ui/button'
import { Pencil, Trash2 } from 'lucide-react'
import EditTechnikDialog from './EditTechnikDialog'
import { Dialog, DialogContent, DialogFooter, DialogTitle } from './ui/dialog'

interface TechnikListProps {
  project: Project
  onAdd: () => void
  onEdit: (date: string, technik: any) => void
  onRemove: (date: string, technikId: string) => void
  selectedDate: string
  onDateChange: (date: string) => void
}

export default function TechnikList({
  project,
  onAdd,
  onEdit,
  onRemove,
  selectedDate,
  onDateChange
}: TechnikListProps) {
  const [technikToDelete, setTechnikToDelete] = useState<{ date: string, technikId: string } | null>(null)
  const [editDialogOpen, setEditDialogOpen] = React.useState(false)
  const [technikToEdit, setTechnikToEdit] = useState<any | null>(null)
  const [technikEintraege, setTechnikEintraege] = React.useState<any[]>([])

  // Technik-Einträge neu berechnen, wenn sich project oder selectedDate ändert
  React.useEffect(() => {
    let entries: any[] = [];
    
    if (project.technik && typeof project.technik === 'object') {
      const dateValue = project.technik[selectedDate];
      entries = Array.isArray(dateValue) ? dateValue.filter(item => item && typeof item === 'object') : [];
    }
    
    setTechnikEintraege(entries);
    
    console.log('TechnikList Debug:', {
      projectId: project.id,
      selectedDate,
      technikType: typeof project.technik,
      technikEintraege: entries,
      technikKeys: project.technik ? Object.keys(project.technik) : []
    });
  }, [project, selectedDate]);

  // Löschfunktion
  const handleDelete = () => {
    if (technikToDelete) {
      onRemove(technikToDelete.date, technikToDelete.technikId);
      setTechnikToDelete(null);
    }
  };

  // Projekttage berechnen
  function getProjectDays(): string[] {
    const startDate = parseISO(project.datumBeginn)
    const endDate = parseISO(project.datumEnde)
    const days: string[] = []
    let currentDate = startDate
    while (currentDate <= endDate) {
      days.push(format(currentDate, 'yyyy-MM-dd'))
      currentDate.setDate(currentDate.getDate() + 1)
    }
    return days
  }

  const projectDays = getProjectDays()
  
  const atwsImEinsatz = technikEintraege.length > 0 ? 'Ja' : 'Nein';
  const anzahlAtws = technikEintraege.reduce((sum: number, t: any) => sum + (t.anzahl || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Technik</h3>
      </div>
      <div className="flex flex-wrap gap-2 project-technik-add">
        {projectDays.map((day, idx) => (
          <Button
            key={day}
            variant={selectedDate === day ? 'default' : 'outline'}
            size="sm"
            onClick={() => onDateChange(day)}
          >
            {format(parseISO(day), 'dd.MM.yyyy', { locale: de })}
          </Button>
        ))}
      </div>
      <div className="flex gap-8 items-center text-sm font-medium">
        <span>ATWs im Einsatz: <span className={atwsImEinsatz === 'Ja' ? 'text-green-700' : 'text-gray-500'}>{atwsImEinsatz}</span></span>
        <span>Anzahl ATWs: <span className="text-blue-700">{anzahlAtws}</span></span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead><b>Name</b></TableHead>
            <TableHead><b>Anzahl</b></TableHead>
            <TableHead><b>Meterlänge</b></TableHead>
            <TableHead><b>Aktionen</b></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {technikEintraege.length > 0 ? technikEintraege.map((technik: any) => (
            <TableRow key={technik.id}>
              <TableCell>{technik.name}</TableCell>
              <TableCell>{technik.anzahl}</TableCell>
              <TableCell>{technik.meterlaenge} m</TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" onClick={() => { setTechnikToEdit(technik); setEditDialogOpen(true); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setTechnikToDelete({ date: selectedDate, technikId: technik.id })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          )) : (
            <TableRow>
              <TableCell colSpan={4}>
                <div className="py-2 text-gray-500">
                  Keine Technik für diesen Tag zugewiesen
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <EditTechnikDialog
        open={editDialogOpen}
        onClose={() => { setEditDialogOpen(false); setTechnikToEdit(null); }}
        project={project}
        technik={technikToEdit}
        date={selectedDate}
        onSave={(date, technik) => {
          onEdit(date, technik);
          setEditDialogOpen(false);
          setTechnikToEdit(null);
        }}
      />
      
      {/* Lösch-Dialog */}
      {technikToDelete && (
        <Dialog open={!!technikToDelete} onOpenChange={() => setTechnikToDelete(null)}>
          <DialogContent className="sm:max-w-md rounded-2xl border-0 shadow-2xl bg-white">
            <DialogTitle className="flex items-center gap-3 text-xl font-semibold text-slate-900 pb-4 border-b border-slate-100">
              <div className="p-2 bg-red-100 rounded-xl">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              Technik löschen
            </DialogTitle>
            <div className="py-4">
              <p className="text-slate-700">
                Sind Sie sicher, dass Sie diese Technik löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
            </div>
            <DialogFooter className="flex gap-3 pt-4 border-t border-slate-100">
              <Button 
                variant="outline" 
                onClick={() => setTechnikToDelete(null)}
                className="rounded-xl h-12 px-6 border-slate-200 hover:bg-slate-50"
              >
                Abbrechen
              </Button>
              <Button 
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700 text-white rounded-xl h-12 px-6 shadow-lg hover:shadow-xl transition-all duration-200"
              >
                Löschen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
} 