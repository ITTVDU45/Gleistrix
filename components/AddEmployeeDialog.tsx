"use client";
import React, { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Alert, AlertDescription } from './ui/alert';
import { Plus, User, CheckCircle, AlertCircle, Users } from 'lucide-react';
import type { EmployeeFormData } from '../types/main';
import { EmployeesApi } from '@/lib/api/employees'
import { Checkbox } from './ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import EmployeeStatusSelect from './EmployeeStatusSelect';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useSubcompanies } from '../hooks/useSubcompanies';

type EmployeeDialogTab = 'internal' | 'external';

interface AddEmployeeDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultTab?: EmployeeDialogTab;
  showTrigger?: boolean;
}

export default function AddEmployeeDialog({
  open,
  onOpenChange,
  defaultTab = 'internal',
  showTrigger = true,
}: AddEmployeeDialogProps) {
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
  const [activeTab, setActiveTab] = useState<EmployeeDialogTab>(defaultTab);
  const [externalName, setExternalName] = useState('');
  const [externalCount, setExternalCount] = useState('1');
  const [externalEmail, setExternalEmail] = useState('');
  const [externalPhone, setExternalPhone] = useState('');
  const [externalAddress, setExternalAddress] = useState('');
  const [externalBankAccount, setExternalBankAccount] = useState('');
  const { addSubcompany } = useSubcompanies();

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

  const resolvedOpen = open ?? isDialogOpen;
  const resolvedDefaultTab = defaultTab ?? 'internal';

  useEffect(() => {
    if (resolvedOpen) {
      setActiveTab(resolvedDefaultTab);
    }
  }, [resolvedOpen, resolvedDefaultTab]);

  useEffect(() => {
    setError('');
  }, [activeTab]);

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
          if (onOpenChange) {
            onOpenChange(false);
          } else {
            setIsDialogOpen(false);
          }
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

  const handleAddExternal = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    const trimmedName = externalName.trim();
    const parsedCount = Number.parseInt(externalCount, 10);

    if (!trimmedName) {
      setError('Bitte den Namen des Subunternehmens angeben.');
      setIsSubmitting(false);
      return;
    }

    if (!Number.isFinite(parsedCount) || parsedCount < 1) {
      setError('Bitte eine gueltige Mitarbeiteranzahl angeben.');
      setIsSubmitting(false);
      return;
    }

    try {
      const created = await addSubcompany({
        name: trimmedName,
        employeeCount: parsedCount,
        email: externalEmail.trim(),
        phone: externalPhone.trim(),
        address: externalAddress.trim(),
        bankAccount: externalBankAccount.trim(),
      });
      setExternalName('');
      setExternalCount('1');
      setExternalEmail('');
      setExternalPhone('');
      setExternalAddress('');
      setExternalBankAccount('');
      if (onOpenChange) {
        onOpenChange(false);
      } else {
        setIsDialogOpen(false);
      }
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      window.dispatchEvent(new CustomEvent('subcompanyAdded', { detail: created }));
    } catch (err: any) {
      setError(err?.message || 'Fehler beim Hinzufuegen des Subunternehmens');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(nextOpen);
    } else {
      setIsDialogOpen(nextOpen);
    }
    if (nextOpen) {
      console.log('Aktuelle positionOptions:', positionOptions);
    }
  };

  return (
    <>
      <Dialog open={resolvedOpen} onOpenChange={handleDialogOpenChange}>
        {showTrigger && (
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200">
              <Plus className="h-4 w-4" />
              Mitarbeiter hinzufügen
            </Button>
          </DialogTrigger>
        )}
        <DialogContent className="sm:max-w-lg rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/70 ring-1 ring-white dark:border-slate-700 dark:bg-slate-800 dark:shadow-none dark:ring-0 max-h-[85vh] overflow-y-auto">
          <DialogHeader className="pb-4 border-b border-slate-100 dark:border-slate-700">
            <DialogTitle className="flex items-center gap-3 text-xl font-semibold text-slate-900 dark:text-white">
              <div className="rounded-2xl p-3 ring-1 ring-emerald-100 bg-emerald-50/80 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-900/60">
                {activeTab === 'external' ? (
                  <Users className="h-6 w-6 text-green-600 dark:text-green-400" />
                ) : (
                  <User className="h-6 w-6 text-green-600 dark:text-green-400" />
                )}
              </div>
              {activeTab === 'external' ? 'Externes Subunternehmen hinzufügen' : 'Neuen Mitarbeiter hinzufügen'}
            </DialogTitle>
          </DialogHeader>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as EmployeeDialogTab)} className="pt-4">
            <TabsList className="w-full rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-sm shadow-slate-200/70 ring-1 ring-white dark:border-slate-700 dark:bg-slate-800 dark:shadow-none dark:ring-0">
              <TabsTrigger
                value="internal"
                className="w-full rounded-xl text-sm font-semibold text-slate-600 transition data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm data-[state=active]:shadow-slate-200/70 dark:text-slate-200 dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:shadow-none"
              >
                Intern
              </TabsTrigger>
              <TabsTrigger
                value="external"
                className="w-full rounded-xl text-sm font-semibold text-slate-600 transition data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm data-[state=active]:shadow-slate-200/70 dark:text-slate-200 dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:shadow-none"
              >
                Extern
              </TabsTrigger>
            </TabsList>

            <TabsContent value="internal" className="pt-4">
              <form onSubmit={handleAddEmployee} className="space-y-6">
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
                      className="rounded-xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/70 ring-1 ring-white focus:border-emerald-500 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:shadow-none dark:ring-0 h-12"
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
                      className="rounded-xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/70 ring-1 ring-white focus:border-emerald-500 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:shadow-none dark:ring-0 h-12"
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
                      className="rounded-xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/70 ring-1 ring-white focus:border-emerald-500 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:shadow-none dark:ring-0 h-12"
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
                      className="rounded-xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/70 ring-1 ring-white focus:border-emerald-500 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:shadow-none dark:ring-0 h-12"
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
                      className="rounded-xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/70 ring-1 ring-white focus:border-emerald-500 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:shadow-none dark:ring-0 h-12"
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
                      className="rounded-xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/70 ring-1 ring-white focus:border-emerald-500 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:shadow-none dark:ring-0 h-12"
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
                      className="rounded-xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/70 ring-1 ring-white focus:border-emerald-500 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:shadow-none dark:ring-0 h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Status
                    </Label>
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
                    onClick={() => handleDialogOpenChange(false)}
                    className="rounded-xl h-12 px-6 border border-slate-200/80 bg-white shadow-sm shadow-slate-200/70 ring-1 ring-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:shadow-none dark:ring-0"
                  >
                    Abbrechen
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-xl h-12 px-6 bg-emerald-600 text-white shadow-sm shadow-emerald-200/70 ring-1 ring-emerald-500/30 transition hover:bg-emerald-700 hover:shadow-emerald-200/80 dark:shadow-none"
                  >
                    {isSubmitting ? 'Hinzufügen...' : 'Hinzufügen'}
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="external" className="pt-4">
              <form onSubmit={handleAddExternal} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="externalName" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Subunternehmen-Name *
                    </Label>
                    <Input
                      id="externalName"
                      value={externalName}
                      onChange={(e) => setExternalName(e.target.value)}
                      placeholder="Subunternehmen Name"
                      className="rounded-xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/70 ring-1 ring-white focus:border-emerald-500 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:shadow-none dark:ring-0 h-12"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="externalCount" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Mitarbeiteranzahl *
                    </Label>
                    <Input
                      id="externalCount"
                      type="number"
                      min={1}
                      value={externalCount}
                      onChange={(e) => setExternalCount(e.target.value)}
                      placeholder="z.B. 5"
                      className="rounded-xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/70 ring-1 ring-white focus:border-emerald-500 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:shadow-none dark:ring-0 h-12"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="externalEmail" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      E-Mail
                    </Label>
                    <Input
                      id="externalEmail"
                      type="email"
                      value={externalEmail}
                      onChange={(e) => setExternalEmail(e.target.value)}
                      placeholder="email@beispiel.de"
                      className="rounded-xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/70 ring-1 ring-white focus:border-emerald-500 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:shadow-none dark:ring-0 h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="externalPhone" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Telefon
                    </Label>
                    <Input
                      id="externalPhone"
                      value={externalPhone}
                      onChange={(e) => setExternalPhone(e.target.value)}
                      placeholder="+49 123 456789"
                      className="rounded-xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/70 ring-1 ring-white focus:border-emerald-500 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:shadow-none dark:ring-0 h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="externalAddress" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Adresse
                    </Label>
                    <Input
                      id="externalAddress"
                      value={externalAddress}
                      onChange={(e) => setExternalAddress(e.target.value)}
                      placeholder="Strasse, PLZ, Ort"
                      className="rounded-xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/70 ring-1 ring-white focus:border-emerald-500 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:shadow-none dark:ring-0 h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="externalBankAccount" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Bankkonto
                    </Label>
                    <Input
                      id="externalBankAccount"
                      value={externalBankAccount}
                      onChange={(e) => setExternalBankAccount(e.target.value)}
                      placeholder="IBAN / Bankverbindung"
                      className="rounded-xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/70 ring-1 ring-white focus:border-emerald-500 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:shadow-none dark:ring-0 h-12"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-700">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleDialogOpenChange(false)}
                    className="rounded-xl h-12 px-6 border border-slate-200/80 bg-white shadow-sm shadow-slate-200/70 ring-1 ring-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:shadow-none dark:ring-0"
                  >
                    Abbrechen
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-xl h-12 px-6 bg-emerald-600 text-white shadow-sm shadow-emerald-200/70 ring-1 ring-emerald-500/30 transition hover:bg-emerald-700 hover:shadow-emerald-200/80 dark:shadow-none"
                  >
                    {isSubmitting ? 'Hinzufügen...' : 'Hinzufügen'}
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Erfolgs-Meldung */}
      {showSuccess && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 rounded-xl">
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            {activeTab === 'external' ? 'Subunternehmen erfolgreich hinzugefügt' : 'Mitarbeiter erfolgreich hinzugefügt'}
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












