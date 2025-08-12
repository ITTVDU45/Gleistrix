"use client";
import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Alert, AlertDescription } from './ui/alert';
import { Edit, CheckCircle, AlertCircle } from 'lucide-react';
import { VehiclesApi } from '@/lib/api/vehicles'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import type { Vehicle, VehicleFormData } from '../types';

interface EditVehicleDialogProps {
  vehicle: Vehicle;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVehicleUpdated: () => void;
}

export default function EditVehicleDialog({ vehicle, open, onOpenChange, onVehicleUpdated }: EditVehicleDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');
  const [editedVehicle, setEditedVehicle] = useState<VehicleFormData & {
    manualStatus: 'verfügbar' | 'wartung' | 'nicht_verfügbar';
    statusNote: string;
  }>({
    type: '',
    licensePlate: '',
    fuelAmount: '',
    damages: '',
    kilometers: '',
    manualStatus: 'verfügbar',
    statusNote: ''
  });

  // Initialisiere die Formulardaten, wenn sich das Fahrzeug ändert
  useEffect(() => {
    if (vehicle) {
      setEditedVehicle({
        type: vehicle.type || '',
        licensePlate: vehicle.licensePlate || '',
        fuelAmount: vehicle.fuelAmount || '',
        damages: vehicle.damages || '',
        kilometers: vehicle.kilometers || '',
        manualStatus: vehicle.manualStatus || 'verfügbar',
        statusNote: vehicle.statusNote || ''
      });
    }
  }, [vehicle]);

  const handleEditVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const data = await VehiclesApi.update(vehicle.id, editedVehicle)
      if ((data as any).success !== false) {
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          onOpenChange(false);
          onVehicleUpdated();
        }, 1500);
      } else {
        setError(((data as any).message || (data as any).error) ?? 'Fehler beim Bearbeiten des Fahrzeugs');
      }
    } catch (error) {
      setError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof typeof editedVehicle, value: string) => {
    setEditedVehicle(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl border-0 shadow-2xl bg-white dark:bg-slate-800 max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pb-4 border-b border-slate-100 dark:border-slate-700">
          <DialogTitle className="flex items-center gap-3 text-xl font-semibold text-slate-900 dark:text-white">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
              <Edit className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            Fahrzeug bearbeiten
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleEditVehicle} className="space-y-6 py-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-type" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Fahrzeugtyp / Modell *
              </Label>
              <Input
                id="edit-type"
                value={editedVehicle.type}
                onChange={(e) => handleInputChange('type', e.target.value)}
                placeholder="z.B. Mercedes Sprinter"
                className="rounded-xl border-slate-200 dark:border-slate-600 focus:border-purple-500 focus:ring-purple-500 dark:bg-slate-700 dark:text-white h-12"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-licensePlate" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Kennzeichen *
              </Label>
              <Input
                id="edit-licensePlate"
                value={editedVehicle.licensePlate}
                onChange={(e) => handleInputChange('licensePlate', e.target.value)}
                placeholder="z.B. M-AB 1234"
                className="rounded-xl border-slate-200 dark:border-slate-600 focus:border-purple-500 focus:ring-purple-500 dark:bg-slate-700 dark:text-white h-12"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-fuelAmount" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Tankbetrag (falls Ja)
              </Label>
              <Input
                id="edit-fuelAmount"
                value={editedVehicle.fuelAmount}
                onChange={(e) => handleInputChange('fuelAmount', e.target.value)}
                placeholder="z.B. 50€"
                className="rounded-xl border-slate-200 dark:border-slate-600 focus:border-purple-500 focus:ring-purple-500 dark:bg-slate-700 dark:text-white h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-damages" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Schäden / Auffälligkeiten
              </Label>
              <Input
                id="edit-damages"
                value={editedVehicle.damages}
                onChange={(e) => handleInputChange('damages', e.target.value)}
                placeholder="Beschreibung von Schäden"
                className="rounded-xl border-slate-200 dark:border-slate-600 focus:border-purple-500 focus:ring-purple-500 dark:bg-slate-700 dark:text-white h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-kilometers" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Gefahrene Projektkilometer
              </Label>
              <Input
                id="edit-kilometers"
                value={editedVehicle.kilometers}
                onChange={(e) => handleInputChange('kilometers', e.target.value)}
                placeholder="z.B. 1500 km"
                className="rounded-xl border-slate-200 dark:border-slate-600 focus:border-purple-500 focus:ring-purple-500 dark:bg-slate-700 dark:text-white h-12"
              />
            </div>
            
            {/* Neue Status-Felder */}
            <div className="space-y-2">
              <Label htmlFor="edit-manualStatus" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Manueller Status
              </Label>
              <Select 
                value={editedVehicle.manualStatus} 
                onValueChange={(value: 'verfügbar' | 'wartung' | 'nicht_verfügbar') => 
                  handleInputChange('manualStatus', value)
                }
              >
                <SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-600 focus:border-purple-500 focus:ring-purple-500 dark:bg-slate-700 dark:text-white h-12">
                  <SelectValue placeholder="Status wählen" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="verfügbar">Verfügbar</SelectItem>
                  <SelectItem value="wartung">In Wartung</SelectItem>
                  <SelectItem value="nicht_verfügbar">Nicht verfügbar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-statusNote" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Status-Notiz
              </Label>
              <Input
                id="edit-statusNote"
                value={editedVehicle.statusNote}
                onChange={(e) => handleInputChange('statusNote', e.target.value)}
                placeholder="Zusätzliche Informationen zum Status"
                className="rounded-xl border-slate-200 dark:border-slate-600 focus:border-purple-500 focus:ring-purple-500 dark:bg-slate-700 dark:text-white h-12"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-700">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="rounded-xl h-12 px-6 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-white"
            >
              Abbrechen
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting} 
              className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-12 px-6 shadow-lg hover:shadow-xl transition-all duration-200"
            >
              {isSubmitting ? 'Speichern...' : 'Speichern'}
            </Button>
          </div>
        </form>

        {/* Erfolgs-Meldung */}
        {showSuccess && (
          <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 rounded-xl">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              Fahrzeug erfolgreich bearbeitet
            </AlertDescription>
          </Alert>
        )}

        {/* Fehler-Meldung */}
        {error && (
          <Alert variant="destructive" className="rounded-xl">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </DialogContent>
    </Dialog>
  );
} 