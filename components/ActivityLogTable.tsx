"use client";
import React, { useState, useEffect } from 'react';
import { ActivityLogApi } from '@/lib/api/activityLog'
import { Card, CardContent, CardHeader } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { 
  Activity, 
  Search, 
  Filter, 
  Download, 
  ChevronLeft, 
  ChevronRight,
  AlertCircle,
  Calendar,
  User,
  Settings,
  Car,
  Users,
  FileText,
  Clock,
  ChevronDown,
  X,
  Check
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import MultiSelectDropdown from './ui/MultiSelectDropdown';

interface ActivityLog {
  id: string;
  timestamp: string;
  actionType: string;
  module: string;
  performedBy: {
    userId: string;
    name: string;
    role: string;
  };
  details: {
    entityId?: string;
    description: string;
    before?: any;
    after?: any;
    context?: any;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const MODULE_OPTIONS = [
  { value: 'project', label: 'Projekte', icon: FileText },
  { value: 'employee', label: 'Mitarbeiter', icon: Users },
  { value: 'vehicle', label: 'Fahrzeuge', icon: Car },
  { value: 'settings', label: 'Einstellungen', icon: Settings },
  { value: 'system', label: 'System', icon: Activity },
  { value: 'time_tracking', label: 'Zeiterfassung', icon: Clock },
  { value: 'billing', label: 'Abrechnung', icon: FileText }
];

const ACTION_TYPE_OPTIONS = [
  // Projekt Aktionen
  { value: 'project_created', label: 'Projekt erstellt' },
  { value: 'project_updated', label: 'Projekt bearbeitet' },
  { value: 'project_deleted', label: 'Projekt gelöscht' },
  { value: 'project_status_changed', label: 'Projektstatus geändert' },
  { value: 'project_billed', label: 'Projekt abgerechnet' },
  { value: 'billing_partial', label: 'Teilweise abgerechnet' },
  { value: 'billing_full', label: 'Komplett abgerechnet' },
  { value: 'project_technology_added', label: 'Technik hinzugefügt' },
  { value: 'project_time_entry_added', label: 'Zeiteintrag hinzugefügt' },
  { value: 'project_vehicle_assigned', label: 'Fahrzeug zugewiesen' },
  { value: 'project_export_pdf', label: 'Projekt PDF Export' },
  { value: 'project_export_csv', label: 'Projekt CSV Export' },
  
  // Mitarbeiter Aktionen
  { value: 'employee_created', label: 'Mitarbeiter angelegt' },
  { value: 'employee_updated', label: 'Mitarbeiter bearbeitet' },
  { value: 'employee_deleted', label: 'Mitarbeiter gelöscht' },
  { value: 'employee_status_changed', label: 'Status geändert' },
  { value: 'employee_vacation_added', label: 'Urlaub hinzugefügt' },
  { value: 'employee_vacation_deleted', label: 'Urlaub gelöscht' },
  { value: 'employee_export_pdf', label: 'Mitarbeiter PDF Export' },
  
  // Fahrzeug Aktionen
  { value: 'vehicle_created', label: 'Fahrzeug hinzugefügt' },
  { value: 'vehicle_updated', label: 'Fahrzeug bearbeitet' },
  { value: 'vehicle_deleted', label: 'Fahrzeug gelöscht' },
  { value: 'vehicle_export_pdf', label: 'Fahrzeug PDF Export' },
  
  // Zeiterfassung Aktionen
  { value: 'time_tracking_export_pdf', label: 'Zeiterfassung PDF Export' },
  { value: 'time_tracking_export_csv', label: 'Zeiterfassung CSV Export' },
  
  // Einstellungen Aktionen
  { value: 'settings_updated', label: 'Einstellungen geändert' },
  { value: 'user_created', label: 'Benutzer angelegt' },
  { value: 'user_invited', label: 'Benutzer eingeladen' },
  { value: 'user_status_changed', label: 'Benutzerstatus geändert' },
  { value: 'user_role_changed', label: 'Benutzerrolle geändert' },
  { value: 'user_deleted', label: 'Benutzer gelöscht' },
  
  // System Aktionen
  { value: 'login', label: 'Anmeldung' },
  { value: 'logout', label: 'Abmeldung' },
  { value: 'password_changed', label: 'Passwort geändert' },
  { value: 'profile_updated', label: 'Profil aktualisiert' }
];

export default function ActivityLogTable() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });

  // Filter State
  const [filters, setFilters] = useState({
    search: '',
    modules: [] as string[],
    actionTypes: [] as string[],
    dateFrom: '',
    dateTo: ''
  });

  // Lade Activity Logs
  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      });

      if (filters.search) {
        params.append('search', filters.search);
      }

      if (filters.modules.length > 0) {
        params.append('module', filters.modules.join(','));
      }

      if (filters.actionTypes.length > 0) {
        params.append('actionType', filters.actionTypes.join(','));
      }

      if (filters.dateFrom) {
        params.append('dateFrom', filters.dateFrom);
      }

      if (filters.dateTo) {
        params.append('dateTo', filters.dateTo);
      }

      const data = await ActivityLogApi.list(params)
      
      if (data.success) {
        setLogs(data.logs);
        setPagination(data.pagination);
      } else {
        throw new Error((data as any).error || 'Unbekannter Fehler');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Lade Logs beim ersten Laden und bei Filter-Änderungen
  useEffect(() => {
    fetchLogs();
  }, [pagination.page, filters]);

  // Filter-Handler
  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 })); // Zurück zur ersten Seite
  };

  // Pagination-Handler
  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  // CSV Export
  const handleExportCSV = () => {
    if (typeof document === 'undefined' || !document.body) {
      console.warn('CSV Export abgebrochen: Dokument noch nicht bereit');
      return;
    }
    const headers = ['Datum', 'Modul', 'Aktion', 'Ausgeführt von', 'Details'];
    const csvContent = [
      headers.join(','),
      ...logs.map(log => [
        format(new Date(log.timestamp), 'dd.MM.yyyy HH:mm', { locale: de }),
        getModuleLabel(log.module),
        getActionTypeLabel(log.actionType),
        `${log.performedBy.name} (${log.performedBy.role})`,
        `"${log.details.description}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `activity-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  // Hilfsfunktion: Modul-Icon
  const getModuleIcon = (module: string) => {
    switch (module) {
      case 'project': return <FileText className="h-4 w-4" />;
      case 'employee': return <Users className="h-4 w-4" />;
      case 'vehicle': return <Car className="h-4 w-4" />;
      case 'settings': return <Settings className="h-4 w-4" />;
      case 'system': return <Activity className="h-4 w-4" />;
      case 'time_tracking': return <Clock className="h-4 w-4" />;
      case 'billing': return <FileText className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  // Hilfsfunktion: Modul-Badge-Farbe
  const getModuleBadgeColor = (module: string) => {
    switch (module) {
      case 'project': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'employee': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'vehicle': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      case 'settings': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case 'system': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
      case 'time_tracking': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400';
      case 'billing': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  // Hilfsfunktion: Label für Modul finden
  const getModuleLabel = (value: string) => {
    const option = MODULE_OPTIONS.find(opt => opt.value === value);
    return option ? option.label : value;
  };

  // Hilfsfunktion: Label für ActionType finden
  const getActionTypeLabel = (value: string) => {
    const option = ACTION_TYPE_OPTIONS.find(opt => opt.value === value);
    return option ? option.label : value;
  };

  const [isOpen, setIsOpen] = useState(false);
  const [isModuleOpen, setIsModuleOpen] = useState(false);
  const [isActionTypeOpen, setIsActionTypeOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
            <Activity className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Aktivitäts-Log</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Alle Aktivitäten im System nachverfolgen
            </p>
          </div>
        </div>
        <Button
          onClick={handleExportCSV}
          variant="outline"
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          CSV Export
        </Button>
      </div>

      {/* Filter */}
      <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Filter className="h-5 w-5 text-slate-600" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Filter</h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Suchfeld */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Suche
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Suchen..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Modul-Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Modul
              </label>
              <div className="relative">
                <div
                  className="w-full border border-slate-200 dark:border-slate-600 rounded-xl h-10 min-h-[40px] bg-white dark:bg-slate-800 flex items-center justify-between px-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700"
                  onClick={() => setIsModuleOpen(!isModuleOpen)}
                >
                  <div className="flex flex-wrap gap-1 flex-1">
                    {filters.modules.length === 0 ? (
                      <span className="text-slate-500">Module wählen</span>
                    ) : (
                      <span className="text-slate-700 dark:text-slate-300 text-sm">{filters.modules.length} ausgewählt</span>
                    )}
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform ${isModuleOpen ? 'rotate-180' : ''}`} />
                </div>

                {isModuleOpen && (
                  <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    <div className="p-2">
                      {filters.modules.length > 0 && (
                        <div className="mb-2">
                          <button
                            type="button"
                            onClick={() => handleFilterChange('modules', [])}
                            className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 px-2 py-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30"
                          >
                            Alle entfernen
                          </button>
                        </div>
                      )}
                      
                      {MODULE_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between ${
                            filters.modules.includes(option.value) ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : ''
                          }`}
                          onClick={() => {
                            if (filters.modules.includes(option.value)) {
                              handleFilterChange('modules', filters.modules.filter(item => item !== option.value));
                            } else {
                              handleFilterChange('modules', [...filters.modules, option.value]);
                            }
                          }}
                        >
                          <span className="truncate">{option.label}</span>
                          {filters.modules.includes(option.value) && (
                            <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Aktionstyp-Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Aktionstyp
              </label>
              <div className="relative">
                <div
                  className="w-full border border-slate-200 dark:border-slate-600 rounded-xl h-10 min-h-[40px] bg-white dark:bg-slate-800 flex items-center justify-between px-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700"
                  onClick={() => setIsActionTypeOpen(!isActionTypeOpen)}
                >
                  <div className="flex flex-wrap gap-1 flex-1">
                    {filters.actionTypes.length === 0 ? (
                      <span className="text-slate-500">Aktionen wählen</span>
                    ) : (
                      <span className="text-slate-700 dark:text-slate-300 text-sm">{filters.actionTypes.length} ausgewählt</span>
                    )}
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform ${isActionTypeOpen ? 'rotate-180' : ''}`} />
                </div>

                {isActionTypeOpen && (
                  <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    <div className="p-2">
                      {filters.actionTypes.length > 0 && (
                        <div className="mb-2">
                          <button
                            type="button"
                            onClick={() => handleFilterChange('actionTypes', [])}
                            className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 px-2 py-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30"
                          >
                            Alle entfernen
                          </button>
                        </div>
                      )}
                      
                      {ACTION_TYPE_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between ${
                            filters.actionTypes.includes(option.value) ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : ''
                          }`}
                          onClick={() => {
                            if (filters.actionTypes.includes(option.value)) {
                              handleFilterChange('actionTypes', filters.actionTypes.filter(item => item !== option.value));
                            } else {
                              handleFilterChange('actionTypes', [...filters.actionTypes, option.value]);
                            }
                          }}
                        >
                          <span className="truncate">{option.label}</span>
                          {filters.actionTypes.includes(option.value) && (
                            <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Datum-Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Datum von
              </label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Datum bis
              </label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fehlermeldung */}
      {error && (
        <Alert variant="destructive" className="rounded-xl">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Tabelle */}
      <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p className="text-slate-600 dark:text-slate-400">Keine Aktivitäten gefunden</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-700">
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Datum/Uhrzeit</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Modul</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Aktion</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Ausgeführt von</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                      <TableCell className="dark:text-slate-300">
                        {format(new Date(log.timestamp), 'dd.MM.yyyy HH:mm', { locale: de })}
                      </TableCell>
                      <TableCell>
                        <Badge className={`rounded-xl px-3 py-1 ${getModuleBadgeColor(log.module)}`}>
                          <div className="flex items-center gap-1">
                            {getModuleIcon(log.module)}
                            <span className="capitalize">{getModuleLabel(log.module)}</span>
                          </div>
                        </Badge>
                      </TableCell>
                      <TableCell className="dark:text-slate-300">
                        {ACTION_TYPE_OPTIONS.find(opt => opt.value === log.actionType)?.label || log.actionType}
                      </TableCell>
                      <TableCell className="dark:text-slate-300">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-slate-400" />
                          <div>
                            <div className="font-medium">{log.performedBy.name}</div>
                            <div className="text-xs text-slate-500 capitalize">{log.performedBy.role}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="dark:text-slate-300 align-top">
                        <div className="whitespace-pre-wrap break-words">
                          {log.details.description}
                        </div>
                        {(log.actionType === 'billing_partial' || log.actionType === 'billing_full' || log.actionType === 'project_billed') && Array.isArray((log as any).details?.context?.days) && (
                          <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                            <div className="font-medium">Tage:</div>
                            <div className="mt-1">
                              {((log as any).details.context.days as string[]).join(', ')}
                            </div>
                            {Array.isArray((log as any).details?.context?.copyDays) && (log as any).details.context.copyDays.length > 0 && (
                              <div className="mt-1">
                                <span className="font-medium">Kopie-Tage:</span> {((log as any).details.context.copyDays as string[]).join(', ')}
                              </div>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Zeige {((pagination.page - 1) * pagination.limit) + 1} bis {Math.min(pagination.page * pagination.limit, pagination.total)} von {pagination.total} Einträgen
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Zurück
            </Button>
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Seite {pagination.page} von {pagination.pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.pages}
            >
              Weiter
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
} 