"use client";
import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Alert, AlertDescription } from './ui/alert';
import { Plus, Truck, CheckCircle, AlertCircle } from 'lucide-react';
import type { VehicleFormData } from '../types';
import { VehiclesApi } from '@/lib/api/vehicles'

export default function AddVehicleDialog() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');
  const [newVehicle, setNewVehicle] = useState<VehicleFormData>({
    type: '',
    licensePlate: '',
    fuelAmount: '',
    damages: '',
    kilometers: ''
  });

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const res: any = await VehiclesApi.create(newVehicle as any)
      if (res?.success !== false) {
        setNewVehicle({ type: '', licensePlate: '', fuelAmount: '', damages: '', kilometers: '' });
        setIsDialogOpen(false);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
        // Seite neu laden um die Änderung zu reflektieren
        window.location.reload();
      } else {
        setError(res?.message || res?.error || 'Fehler beim Hinzufügen des Fahrzeugs');
      }
    } catch (error) {
      setError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof VehicleFormData, value: string) => {
    setNewVehicle(prev => ({ ...prev, [field]: value }));
  };

  return (
    <>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200">
            <Plus className="h-4 w-4" />
            Fahrzeug hinzufügen
          </Button>
        </DialogTrigger>
      <DialogContent className="sm:max-w-lg rounded-2xl border-0 shadow-2xl bg-white dark:bg-slate-800 max-h-[85vh] overflow-y-auto">
          <DialogHeader className="pb-4 border-b border-slate-100 dark:border-slate-700">
            <DialogTitle className="flex items-center gap-3 text-xl font-semibold text-slate-900 dark:text-white">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                <Truck className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              Neues Fahrzeug hinzufügen
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddVehicle} className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="type" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Fahrzeugtyp / Modell *
                </Label>
                <Input
                  id="type"
                  value={newVehicle.type}
                  onChange={(e) => handleInputChange('type', e.target.value)}
                  placeholder="z.B. Mercedes Sprinter"
                  className="rounded-xl border-slate-200 dark:border-slate-600 focus:border-purple-500 focus:ring-purple-500 dark:bg-slate-700 dark:text-white h-12"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="licensePlate" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Kennzeichen *
                </Label>
                <Input
                  id="licensePlate"
                  value={newVehicle.licensePlate}
                  onChange={(e) => handleInputChange('licensePlate', e.target.value)}
                  placeholder="z.B. M-AB 1234"
                  className="rounded-xl border-slate-200 dark:border-slate-600 focus:border-purple-500 focus:ring-purple-500 dark:bg-slate-700 dark:text-white h-12"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fuelAmount" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Tankbetrag (falls Ja)
                </Label>
                <Input
                  id="fuelAmount"
                  value={newVehicle.fuelAmount}
                  onChange={(e) => handleInputChange('fuelAmount', e.target.value)}
                  placeholder="z.B. 50€"
                  className="rounded-xl border-slate-200 dark:border-slate-600 focus:border-purple-500 focus:ring-purple-500 dark:bg-slate-700 dark:text-white h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="damages" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Schäden / Auffälligkeiten
                </Label>
                <Input
                  id="damages"
                  value={newVehicle.damages}
                  onChange={(e) => handleInputChange('damages', e.target.value)}
                  placeholder="Beschreibung von Schäden"
                  className="rounded-xl border-slate-200 dark:border-slate-600 focus:border-purple-500 focus:ring-purple-500 dark:bg-slate-700 dark:text-white h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kilometers" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Gefahrene Projektkilometer
                </Label>
                <Input
                  id="kilometers"
                  value={newVehicle.kilometers}
                  onChange={(e) => handleInputChange('kilometers', e.target.value)}
                  placeholder="z.B. 1500 km"
                  className="rounded-xl border-slate-200 dark:border-slate-600 focus:border-purple-500 focus:ring-purple-500 dark:bg-slate-700 dark:text-white h-12"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-700">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="rounded-xl h-12 px-6 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-white"
              >
                Abbrechen
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting} 
                className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-12 px-6 shadow-lg hover:shadow-xl transition-all duration-200"
              >
                {isSubmitting ? 'Hinzufügen...' : 'Hinzufügen'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Erfolgs-Meldung */}
      {showSuccess && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 rounded-xl">
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            Fahrzeug erfolgreich hinzugefügt
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
    </>
  );
} 