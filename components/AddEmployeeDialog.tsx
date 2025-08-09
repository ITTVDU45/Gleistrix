"use client";
import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Alert, AlertDescription } from './ui/alert';
import { Plus, User, CheckCircle, AlertCircle } from 'lucide-react';
import type { EmployeeFormData } from '../types/main';
import { EmployeesApi } from '@/lib/api/employees'
import { Checkbox } from './ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import EmployeeStatusSelect from './EmployeeStatusSelect';

export default function AddEmployeeDialog() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');
  const [newEmployee, setNewEmployee] = useState<EmployeeFormData>({
    name: '',
    position: '',
    email: '',
    phone: '',
    elbaId: '',
    address: '',
    postalCode: '',
    city: ''
  });
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [status, setStatus] = useState<'aktiv' | 'nicht aktiv' | 'urlaub'>('aktiv');

  const positionOptions = [
    'Bahnerder',
    'BüP',
    'HFE',
    'HiBa',
    'Monteur/Bediener',
    'Sakra',
    'SAS',
    'SIPO'
  ];
  console.log('positionOptions:', positionOptions);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    const employeeToSave = {
      ...newEmployee,
      position: selectedPositions.join(', '),
      status
    };

    try {
      const data: any = await EmployeesApi.create(employeeToSave as any)
      if (data?.success !== false && (data?.data || data?.employee)) {
          setNewEmployee({ name: '', position: '', email: '', phone: '', elbaId: '', address: '', postalCode: '', city: '' });
          setSelectedPositions([]);
          setIsDialogOpen(false);
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 3000);
          // Trigger a custom event to notify other components
          window.dispatchEvent(new CustomEvent('employeeAdded', { detail: data.data || data.employee }));
        } else {
          setError(data.message || data.error || 'Fehler beim Hinzufügen des Mitarbeiters');
        }
      
    } catch (error) {
      setError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof EmployeeFormData, value: string) => {
    setNewEmployee(prev => ({ ...prev, [field]: value }));
  };

  const handlePositionToggle = (position: string) => {
    setSelectedPositions(prev =>
      prev.includes(position)
        ? prev.filter(p => p !== position)
        : [...prev, position]
    );
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (open) {
      console.log('Aktuelle positionOptions:', positionOptions);
    }
  };

  return (
    <>
      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogTrigger asChild>
          <Button className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200">
            <Plus className="h-4 w-4" />
            Mitarbeiter hinzufügen
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg rounded-2xl border-0 shadow-2xl bg-white dark:bg-slate-800 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-4 border-b border-slate-100 dark:border-slate-700">
            <DialogTitle className="flex items-center gap-3 text-xl font-semibold text-slate-900 dark:text-white">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-xl">
                <User className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              Neuen Mitarbeiter hinzufügen
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddEmployee} className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Name *
                </Label>
                <Input
                  id="name"
                  value={newEmployee.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Vor- und Nachname"
                  className="rounded-xl border-slate-200 dark:border-slate-600 focus:border-green-500 focus:ring-green-500 dark:bg-slate-700 dark:text-white h-12"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="position" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Position(en)
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-between rounded-xl min-h-[48px] border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white whitespace-normal break-words text-left"
                    >
                      <span className="block whitespace-normal break-words">
                        {selectedPositions.length > 0
                          ? selectedPositions.join(', ')
                          : 'Position(en) auswählen'}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="min-w-[320px] max-w-[400px] p-2 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600"
                    style={{ maxHeight: 500 }}
                  >
                    <div className="flex flex-col gap-2">
                      {positionOptions.map((option) => {
                        console.log('Render:', option);
                        return (
                          <label key={option} className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={selectedPositions.includes(option)}
                              onCheckedChange={() => handlePositionToggle(option)}
                              className="rounded"
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-200">{option}</span>
                          </label>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  E-Mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={newEmployee.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="email@beispiel.de"
                  className="rounded-xl border-slate-200 dark:border-slate-600 focus:border-green-500 focus:ring-green-500 dark:bg-slate-700 dark:text-white h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Telefon
                </Label>
                <Input
                  id="phone"
                  value={newEmployee.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="+49 123 456789"
                  className="rounded-xl border-slate-200 dark:border-slate-600 focus:border-green-500 focus:ring-green-500 dark:bg-slate-700 dark:text-white h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="elbaId" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  ElBa ID-Nr.
                </Label>
                <Input
                  id="elbaId"
                  value={newEmployee.elbaId}
                  onChange={(e) => handleInputChange('elbaId', e.target.value)}
                  placeholder="ElBa ID-Nummer"
                  className="rounded-xl border-slate-200 dark:border-slate-600 focus:border-green-500 focus:ring-green-500 dark:bg-slate-700 dark:text-white h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Anschrift
                </Label>
                <Input
                  id="address"
                  value={newEmployee.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  placeholder="Straße und Hausnummer"
                  className="rounded-xl border-slate-200 dark:border-slate-600 focus:border-green-500 focus:ring-green-500 dark:bg-slate-700 dark:text-white h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postalCode" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  PLZ
                </Label>
                <Input
                  id="postalCode"
                  value={newEmployee.postalCode}
                  onChange={(e) => handleInputChange('postalCode', e.target.value)}
                  placeholder="12345"
                  className="rounded-xl border-slate-200 dark:border-slate-600 focus:border-green-500 focus:ring-green-500 dark:bg-slate-700 dark:text-white h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Stadt
                </Label>
                <Input
                  id="city"
                  value={newEmployee.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  placeholder="Berlin"
                  className="rounded-xl border-slate-200 dark:border-slate-600 focus:border-green-500 focus:ring-green-500 dark:bg-slate-700 dark:text-white h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Status
                </Label>
                {/* Simple select fallback to avoid incompatible props */}
                <select
                  className="w-full rounded-xl min-h-[48px] border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                >
                  <option value="aktiv">Aktiv</option>
                  <option value="nicht aktiv">Nicht aktiv</option>
                  <option value="urlaub">Urlaub</option>
                </select>
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
                className="bg-green-600 hover:bg-green-700 text-white rounded-xl h-12 px-6 shadow-lg hover:shadow-xl transition-all duration-200"
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
            Mitarbeiter erfolgreich hinzugefügt
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