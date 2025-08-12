"use client";
import React, { useState } from 'react'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogTitle } from './ui/dialog'
import TechnikAssignmentForm from './TechnikAssignmentForm';
import type { Project } from '../types';

interface EditTechnikDialogProps {
  open: boolean;
  onClose: () => void;
  project: Project;
  technik: any;
  date: string;
  onSave: (date: string, technik: any) => void;
}

export default function EditTechnikDialog({ open, onClose, project, technik, date, onSave }: EditTechnikDialogProps) {
  if (!technik) return null;
  
  const handleSave = async (dateOrDates: string | string[], technikData: any) => {
    const date = Array.isArray(dateOrDates) ? (dateOrDates[0] ?? dateOrDates[0]) : dateOrDates;
    if (technikData.selectedDays) {
      // Wenn selectedDays vorhanden sind, sende alle Daten in einem Request
      const updatedTechnik = {
        ...technik,
        name: technikData.name,
        anzahl: technikData.anzahl,
        meterlaenge: technikData.meterlaenge,
        id: technik.id,
        selectedDays: technikData.selectedDays
      };
      
      // Verwende das ursprüngliche Datum als Fallback, nicht einen leeren String
      const requestDate = date || date;
      await onSave(requestDate, updatedTechnik);
    } else {
      // Fallback: Aktualisiere nur für den ursprünglichen Tag
      await onSave(date, {
        ...technik,
        name: technikData.name,
        anzahl: technikData.anzahl,
        meterlaenge: technikData.meterlaenge,
        id: technik.id
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg rounded-2xl border-0 shadow-2xl bg-white">
        <DialogTitle className="flex items-center gap-3 text-xl font-semibold text-slate-900 pb-4 border-b border-slate-100">
          <div className="p-2 bg-green-100 rounded-xl">
            <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          Technik bearbeiten
        </DialogTitle>
        <div className="py-4">
          <TechnikAssignmentForm
            project={project}
            onAssign={handleSave}
            onClose={onClose}
            editMode
            initialValues={{
              selectedTechnik: technik.name,
              anzahl: technik.anzahl,
              meterlaenge: technik.meterlaenge,
              selectedDays: [date],
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
} 