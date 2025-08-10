"use client";
import React, { useState, useEffect } from 'react';
import { AuthApi } from '@/lib/api/auth'
import { NotificationsApi } from '@/lib/api/notifications'
import { useRouter } from 'next/navigation';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Separator } from '../../components/ui/separator';
import { Badge } from '../../components/ui/badge';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Switch } from '../../components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { useThemeToggle } from '../../hooks/useTheme';
import UserManagement from '../../components/UserManagement';
import ActivityLogTable from '../../components/ActivityLogTable';
import { 
  User, 
  Mail, 
  Phone, 
  Building, 
  Shield, 
  Bell, 
  Palette,
  Save,
  CheckCircle,
  Sun,
  Moon,
  Monitor,
  Users,
  Activity,
  Info
} from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  lastLogin?: string;
}

export default function EinstellungenPage() {
  const { theme, setTheme, isDark } = useThemeToggle();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'profile' | 'users' | 'activity'>('profile');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: 'Mülheimer Wachdienst GmbH',
    notifications: true,
    language: 'de'
  });
  // Notification state
  const [notificationDefs, setNotificationDefs] = useState<any>({});
  const [enabledByKey, setEnabledByKey] = useState<Record<string, boolean>>({});
  const [configByKey, setConfigByKey] = useState<Record<string, any>>({});
  const [notificationLogs, setNotificationLogs] = useState<any[]>([]);

  const fetchNotifications = async () => {
    try {
      const data = await NotificationsApi.getSettings();
      setNotificationDefs(data.definitions || {});
      setEnabledByKey(data.enabledByKey || {});
      setConfigByKey(data.configByKey || {});
    } catch (e) {
      console.error('Fehler beim Laden der Benachrichtigungseinstellungen', e);
    }
  };

  const fetchNotificationLogs = async () => {
    try {
      const data = await NotificationsApi.listLogs();
      setNotificationLogs(data.logs || []);
    } catch (e) {
      console.error('Fehler beim Laden der Benachrichtigungs-Logs', e);
    }
  };

  // Benutzerdaten laden
  useEffect(() => {
    const fetchUserData = async () => {
    try {
      const data = await AuthApi.me();
      if (data?.user) {
        setUser(data.user as any);
          
          // Formulardaten mit echten Benutzerdaten füllen
          setFormData({
            name: data.user.name || '',
            email: data.user.email || '',
            phone: data.user.phone || '',
            company: 'Mülheimer Wachdienst GmbH',
            notifications: true,
            language: 'de'
          });
        } else {
          // Nicht angemeldet, zur Login-Seite weiterleiten
          router.push('/login');
        }
      } catch (error) {
        console.error('Fehler beim Laden der Benutzerdaten:', error);
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
    fetchNotifications();
    fetchNotificationLogs();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    setShowSuccess(false);
    
    const requestData = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone
    };

    console.log('=== PROFIL UPDATE SENDEN ===');
    console.log('Zu sendende Daten:', requestData);
    
    try {
      const data = await AuthApi.updateProfile(requestData)
      console.log('API Response:', data);

      if (!data?.error) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
        
        // Benutzerdaten aktualisieren
        if ((data as any).user) {
          setUser(prev => prev ? { ...prev, ...(data as any).user } : null);
        }
        
        console.log('Profil erfolgreich aktualisiert:', data);
      } else {
        setError((data as any).error || 'Fehler beim Speichern der Änderungen');
      }
    } catch (err) {
      console.error('Fehler beim Speichern:', err);
      setError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun className="h-4 w-4" />;
      case 'dark':
        return <Moon className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  const getThemeText = () => {
    switch (theme) {
      case 'light':
        return 'Hell';
      case 'dark':
        return 'Dunkel';
      default:
        return 'System';
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'superadmin':
        return 'Super Administrator';
      case 'admin':
        return 'Administrator';
      case 'user':
        return 'Benutzer';
      default:
        return role;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'superadmin':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case 'admin':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'user':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Lade Einstellungen...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6 px-3 md:px-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Einstellungen</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">Verwalten Sie Ihre Kontoeinstellungen</p>
        </div>
      </div>

      {showSuccess && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 rounded-xl">
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            Profil erfolgreich aktualisiert
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="rounded-xl">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Tab Navigation (mobil scrollbar) */}
      <div className="overflow-x-auto -mx-3 md:mx-0">
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-xl min-w-max px-2">
          <Button
            variant={activeTab === 'profile' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('profile')}
            className={`${activeTab === 'profile' ? 'bg-white dark:bg-slate-800 shadow-sm' : ''} h-10 px-3 text-sm whitespace-nowrap md:flex-1`}
          >
            <User className="h-4 w-4 mr-2" />
            Profil
          </Button>
          {(user.role === 'superadmin' || user.role === 'admin') && (
            <Button
              variant={activeTab === 'users' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('users')}
              className={`${activeTab === 'users' ? 'bg-white dark:bg-slate-800 shadow-sm' : ''} h-10 px-3 text-sm whitespace-nowrap md:flex-1`}
            >
              <Users className="h-4 w-4 mr-2" />
              Benutzerverwaltung
            </Button>
          )}
          {(user.role === 'superadmin' || user.role === 'admin') && (
            <Button
              variant={activeTab === 'activity' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('activity')}
              className={`${activeTab === 'activity' ? 'bg-white dark:bg-slate-800 shadow-sm' : ''} h-10 px-3 text-sm whitespace-nowrap md:flex-1`}
            >
              <Activity className="h-4 w-4 mr-2" />
              Aktivitäts-Log
            </Button>
          )}
        </div>
      </div>

      {/* Tab Content */}
          {activeTab === 'profile' && (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Profil-Einstellungen */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                    <User className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Profil</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Persönliche Informationen</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4 profile-form">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Name *
                      </Label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          className="pl-10 rounded-xl border-slate-200 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-500 dark:bg-slate-700 dark:text-white h-12"
                          placeholder="Ihr Name"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        E-Mail *
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          className="pl-10 rounded-xl border-slate-200 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-500 dark:bg-slate-700 dark:text-white h-12"
                          placeholder="ihre.email@beispiel.de"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Telefon
                      </Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                          className="pl-10 rounded-xl border-slate-200 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-500 dark:bg-slate-700 dark:text-white h-12"
                          placeholder="+49 123 456789"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="company" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Unternehmen
                      </Label>
                      <div className="relative">
                        <Building className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                        <Input
                          id="company"
                          value={formData.company}
                          onChange={(e) => handleInputChange('company', e.target.value)}
                          className="pl-10 rounded-xl border-slate-200 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-500 dark:bg-slate-700 dark:text-white h-12"
                          placeholder="Unternehmensname"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={isSaving}
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 py-2 h-12 transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      {isSaving ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Speichern...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Speichern
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Benachrichtigungs-Logs */}
            <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl notifications-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-slate-100 dark:bg-slate-700/50 rounded-xl">
                    <Bell className="h-6 w-6 text-slate-600 dark:text-slate-300" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Benachrichtigungsprotokoll</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Letzte versendete Benachrichtigungen</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto -mx-3 md:mx-0">
                  <table className="w-full text-sm min-w-[720px] md:min-w-0">
                    <thead>
                      <tr className="text-left border-b border-slate-200 dark:border-slate-700">
                        <th className="py-2 pr-4">Datum</th>
                        <th className="py-2 pr-4">Projekt</th>
                        <th className="py-2 pr-4">Benachrichtigung</th>
                        <th className="py-2 pr-4">An</th>
                        <th className="py-2 pr-4">Betreff</th>
                        <th className="py-2 pr-4">Anhänge</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">Fehlerdetails</th>
                        <th className="py-2 pr-4">Markiert von</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notificationLogs.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-3 text-slate-500">Keine Einträge</td>
                        </tr>
                      )}
                      {notificationLogs.map((log) => (
                        <tr key={log.id} className="border-b border-slate-100 dark:border-slate-700/50">
                          <td className="py-2 pr-4">{new Date(log.timestamp).toLocaleString('de-DE')}</td>
                          <td className="py-2 pr-4">{log.projectName || '-'}</td>
                          <td className="py-2 pr-4">{log.key}</td>
                          <td className="py-2 pr-4">{log.to}</td>
                          <td className="py-2 pr-4">{log.subject}</td>
                          <td className="py-2 pr-4">{log.attachmentsCount}</td>
                          <td className="py-2 pr-4">{log.success ? 'OK' : 'Fehler'}</td>
                          <td className="py-2 pr-4 text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap break-words max-w-sm">{log.errorMessage || '-'}</td>
                          <td className="py-2 pr-4">{(log as any).performedBy || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Profil-Übersicht */}
          <div className="space-y-6">
            <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                    <Info className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Profil-Übersicht</h2>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Status</span>
                    <Badge variant="secondary" className="rounded-xl px-3 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      Aktiv
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Rolle</span>
                    <Badge variant="secondary" className={`rounded-xl px-3 py-1 ${getRoleBadgeColor(user.role)}`}>
                      {getRoleDisplayName(user.role)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Mitglied seit</span>
                    <span className="text-sm font-medium dark:text-white">
                      {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }) : 'Unbekannt'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Erscheinungsbild */}
            <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                    <Palette className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Erscheinungsbild</h2>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Theme</span>
                    <div className="flex gap-2">
                      <Button
                        variant={theme === 'light' ? "default" : "outline"}
                        size="sm"
                        className={`rounded-xl h-10 px-4 transition-all duration-200 ${
                          theme === 'light'
                            ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-lg hover:shadow-xl' 
                            : 'border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'
                        }`}
                        onClick={() => setTheme('light')}
                      >
                        <Sun className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={theme === 'dark' ? "default" : "outline"}
                        size="sm"
                        className={`rounded-xl h-10 px-4 transition-all duration-200 ${
                          theme === 'dark'
                            ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-lg hover:shadow-xl' 
                            : 'border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'
                        }`}
                        onClick={() => setTheme('dark')}
                      >
                        <Moon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={theme === 'system' ? "default" : "outline"}
                        size="sm"
                        className={`rounded-xl h-10 px-4 transition-all duration-200 ${
                          theme === 'system'
                            ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-lg hover:shadow-xl' 
                            : 'border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'
                        }`}
                        onClick={() => setTheme('system')}
                      >
                        <Monitor className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Aktuelles Theme</span>
                    <Badge variant="outline" className="rounded-xl px-3 py-1 dark:border-slate-600 dark:text-slate-300">
                      {getThemeText()}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Sprache</span>
                    <Badge variant="outline" className="rounded-xl px-3 py-1 dark:border-slate-600 dark:text-slate-300">
                      Deutsch
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Benachrichtigungen */}
            <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
                    <Bell className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Benachrichtigungen</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Schalten Sie Benachrichtigungen ein oder aus</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.keys(notificationDefs).length === 0 ? (
                    <p className="text-sm text-slate-500">Lade Einstellungen...</p>
                  ) : (
                    Object.entries(notificationDefs).map(([key, def]: any) => (
                      <div key={key} className="flex flex-col gap-2 py-2">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{def.label}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{def.description}</p>
                          </div>
                          <Switch
                            checked={Boolean(enabledByKey[key])}
                            onCheckedChange={async (checked) => {
                              try {
                                const next = { ...enabledByKey, [key]: checked };
                                setEnabledByKey(next);
                                await NotificationsApi.updateSettings({ enabledByKey: next, configByKey })
                              } catch (e) {
                                console.error('Fehler beim Speichern der Benachrichtigungen', e);
                              }
                            }}
                          />
                        </div>
                        {/* Optionale Ziel-E-Mail konfigurieren */}
                        {(def?.defaultConfig?.to !== undefined || (configByKey?.[key] && configByKey[key].to !== undefined)) && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 pl-0">
                            <div className="w-full md:col-span-2">
                              <Label className="text-xs mb-1 block">Empfänger-E-Mail</Label>
                              <div className="relative">
                                <Mail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                <Input
                                  type="email"
                                  placeholder="empfaenger@beispiel.de"
                                  value={configByKey?.[key]?.to ?? def?.defaultConfig?.to ?? ''}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setConfigByKey(prev => ({ ...prev, [key]: { ...(prev?.[key] || {}), to: value } }));
                                  }}
                                  onBlur={async (e) => {
                                    const value = e.target.value.trim();
                                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                                    if (!emailRegex.test(value)) {
                                      console.warn('Ungültige E-Mail-Adresse für Benachrichtigung');
                                      return;
                                    }
                                    try {
                                      const nextConfig = { ...configByKey, [key]: { ...(configByKey?.[key] || {}), to: value } };
                                      setConfigByKey(nextConfig);
                                      await NotificationsApi.updateSettings({ enabledByKey, configByKey: nextConfig })
                                    } catch (err) {
                                      console.error('Fehler beim Speichern der Empfänger-E-Mail', err);
                                    }
                                  }}
                                  className="h-14 pl-14 pr-4 rounded-2xl w-full text-base border-slate-200 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="users-tab"><UserManagement /></div>
      )}

      {activeTab === 'activity' && (
        <div className="activity-tab"><ActivityLogTable /></div>
      )}
    </div>
  );
} 