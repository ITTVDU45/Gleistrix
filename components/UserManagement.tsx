"use client";
import React, { useState, useEffect } from 'react';
import { UsersApi } from '@/lib/api/users'
import { InvitesApi } from '@/lib/api/invites'
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { 
  UserPlus, 
  Users, 
  Mail, 
  Phone, 
  User, 
  Shield, 
  CheckCircle,
  AlertCircle,
  Send,
  Trash2,
  Eye,
  EyeOff,
  MoreHorizontal,
  Search
} from 'lucide-react';

interface UserFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: 'admin' | 'user';
}

interface InviteToken {
  id: string;
  email: string;
  role: string;
  used: boolean;
  expiresAt: string;
  createdAt: string;
}

interface ExistingUser {
  id: string;
  email: string;
  name: string;
  role: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
}

interface InvitedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  used: boolean;
  expiresAt: string;
  createdAt: string;
  createdBy: string;
}

export default function UserManagement() {
  const [formData, setFormData] = useState<UserFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'user'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');
  const [inviteTokens, setInviteTokens] = useState<InviteToken[]>([]);
  const [existingUsers, setExistingUsers] = useState<ExistingUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [invitedUsers, setInvitedUsers] = useState<InvitedUser[]>([]);
  const [isLoadingInvites, setIsLoadingInvites] = useState(true);
  const [showInviteSuccess, setShowInviteSuccess] = useState(false);
  const [inviteSuccessMessage, setInviteSuccessMessage] = useState('');

  // Benutzer laden
  const fetchUsers = async () => {
    try {
      const data = await UsersApi.list()
      setExistingUsers(data.users)
    } catch (err) {
      console.error('Fehler beim Laden der Benutzer:', err);
      setError('Fehler beim Laden der Benutzer: Netzwerkfehler');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const fetchInvitedUsers = async () => {
    try {
      const data = await InvitesApi.list()
      setInvitedUsers(
        data.invites.map((i) => ({
          id: i.id,
          email: i.email,
          name: (i.name || `${i.firstName || ''} ${i.lastName || ''}`.trim() || i.email) as string,
          firstName: i.firstName,
          lastName: i.lastName,
          phone: i.phone,
          role: i.role,
          used: i.used,
          expiresAt: i.expiresAt,
          createdAt: i.createdAt,
          createdBy: i.createdBy,
        }))
      )
    } catch (err) {
      console.error('Fehler beim Laden der Einladungen:', err);
      setError('Fehler beim Laden der Einladungen: Netzwerkfehler');
    } finally {
      setIsLoadingInvites(false);
    }
  };

  useEffect(() => { 
    fetchUsers(); 
    fetchInvitedUsers();
  }, []);

  // Fehlermeldungen nach 5 Sekunden automatisch ausblenden
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleInputChange = (field: keyof UserFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDeleteExpiredInvite = async (email: string) => {
    try {
      const resp = await InvitesApi.deleteAllForEmail(email)
      if ((resp as any).error) {
        console.error('Fehler beim Löschen der Einladungen')
        return false
      }
      console.log(`Alle Einladungen für ${email} gelöscht`);
      return true;
    } catch (err) {
      console.error('Fehler beim Löschen der Einladungen:', err);
      return false;
    }
  };

  const handleDeleteInvite = async (inviteId: string, email: string, name: string) => {
    if (!confirm(`Möchten Sie die Einladung für "${name}" (${email}) wirklich löschen?`)) {
      return;
    }

    try {
      const resp = await InvitesApi.deleteAllForEmail(email)
      if ((resp as any).error) {
        console.error('Fehler beim Löschen der Einladung')
        setError('Fehler beim Löschen der Einladung')
      } else {
        console.log(`Einladung für ${email} gelöscht`)
        fetchInvitedUsers()
      }
    } catch (err) {
      console.error('Fehler beim Löschen der Einladung:', err);
      setError('Ein Fehler ist aufgetreten');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setShowSuccess(false);

    try {
      const response = await InvitesApi.createUser({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        role: formData.role,
      })
      if (!(response as any).error) {
        setShowSuccess(true);
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          role: 'user'
        });
        console.log('Einladung erfolgreich gesendet');
        // Einladungen neu laden
        fetchInvitedUsers();
      } else {
        const errorData = response as any
        
        // Wenn eine gültige Einladung existiert, versuche sie zu löschen und neu zu senden
        if (errorData.error && errorData.error.includes('gültige Einladung')) {
          const deleted = await handleDeleteExpiredInvite(formData.email);
          if (deleted) {
            // Kurze Pause, dann erneut versuchen
            setTimeout(async () => {
              try {
                const retryResponse = await InvitesApi.createUser({
                  firstName: formData.firstName,
                  lastName: formData.lastName,
                  email: formData.email,
                  phone: formData.phone,
                  role: formData.role as any,
                })

                if (!(retryResponse as any).error) {
                  setShowSuccess(true);
                  setFormData({
                    firstName: '',
                    lastName: '',
                    email: '',
                    phone: '',
                    role: 'user'
                  });
                  console.log('Einladung erfolgreich erneut gesendet');
                  // Einladungen neu laden
                  fetchInvitedUsers();
                } else {
                  const retryErrorData = retryResponse as any
                  setError(retryErrorData.message || retryErrorData.error || 'Fehler beim erneuten Senden der Einladung');
                }
              } catch (err) {
                console.error('Fehler beim erneuten Senden:', err);
                setError('Fehler beim erneuten Senden der Einladung');
              }
            }, 1000);
          } else {
            setError('Fehler beim Löschen der abgelaufenen Einladung. Bitte versuchen Sie es später erneut.');
          }
        } else {
          setError(errorData.message || errorData.error || 'Fehler beim Senden der Einladung');
        }
      }
    } catch (err) {
      console.error('Fehler beim Senden der Einladung:', err);
      setError('Ein Fehler ist aufgetreten');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const resp = await UsersApi.toggleStatus(userId, !currentStatus)
      if (!(resp as any).error) {
        // Benutzerliste aktualisieren
        fetchUsers();
        console.log(`Benutzer-Status geändert: ${currentStatus ? 'Deaktiviert' : 'Aktiviert'}`);
      } else {
        setError('Fehler beim Ändern des Benutzer-Status');
      }
    } catch (err) {
      console.error('Fehler beim Ändern des Benutzer-Status:', err);
      setError('Ein Fehler ist aufgetreten');
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Möchten Sie den Benutzer "${userName}" wirklich löschen?`)) {
      return;
    }

    try {
      const resp = await UsersApi.remove(userId)
      if (!(resp as any).error) {
        // Benutzerliste aktualisieren
        fetchUsers();
        console.log(`Benutzer gelöscht: ${userName}`);
      } else {
        setError('Fehler beim Löschen des Benutzers');
      }
    } catch (err) {
      console.error('Fehler beim Löschen des Benutzers:', err);
      setError('Ein Fehler ist aufgetreten');
    }
  };

  const handleResendInvite = async (inviteId: string, email: string, firstName: string, lastName: string, phone: string, role: string) => {
    try {
      // Zuerst alle Einladungen für diese E-Mail löschen
      const deleteResponse = await InvitesApi.deleteAllForEmail(email)
      if (!(deleteResponse as any).error) {
        const inviteResponse = await InvitesApi.createUser({ firstName, lastName, email, phone, role: role as any })
        if (!(inviteResponse as any).error) {
          console.log(`Einladung für ${email} erneut gesendet`);
          // Erfolgsbenachrichtigung anzeigen
          setInviteSuccessMessage(`Einladung für ${email} erfolgreich erneut gesendet`);
          setShowInviteSuccess(true);
          setTimeout(() => setShowInviteSuccess(false), 5000);
          // Einladungen neu laden
          fetchInvitedUsers();
        } else {
          const errorData = inviteResponse as any
          console.error('Fehler beim erneuten Senden der Einladung:', errorData.error);
          setError(errorData.message || errorData.error || 'Fehler beim erneuten Senden der Einladung');
        }
      } else {
        console.error('Fehler beim Löschen der alten Einladung');
        setError('Fehler beim Löschen der alten Einladung');
      }
    } catch (err) {
      console.error('Fehler beim erneuten Einladen:', err);
      setError('Ein Fehler ist aufgetreten');
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

  const filteredUsers = existingUsers.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
          <UserPlus className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Benutzerverwaltung</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">Neue Benutzer einladen und bestehende verwalten</p>
        </div>
      </div>

      {showSuccess && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 rounded-xl">
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            Einladung erfolgreich gesendet! Der Benutzer erhält eine E-Mail mit einem Verifizierungslink.
          </AlertDescription>
        </Alert>
      )}

      {showInviteSuccess && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 rounded-xl">
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            {inviteSuccessMessage}
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert className="border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 rounded-xl">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          <AlertDescription className="text-red-800 dark:text-red-200">
            {error}
            {error.includes('gültige Einladung') && (
              <div className="mt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={async () => {
                    const deleted = await handleDeleteExpiredInvite(formData.email);
                    if (deleted) {
                      setError('');
                      // Automatisch erneut senden
                      const form = document.querySelector('form');
                      if (form) {
                        form.dispatchEvent(new Event('submit', { bubbles: true }));
                      }
                    } else {
                      setError('Fehler beim Löschen der abgelaufenen Einladung');
                    }
                  }}
                  className="mt-2"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Erneut senden
                </Button>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Neuen Benutzer anlegen */}
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                <UserPlus className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Neuen Benutzer einladen</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Einladung per E-Mail senden</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Vorname *
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value)}
                      className="pl-10 rounded-xl border-slate-200 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-500 dark:bg-slate-700 dark:text-white h-12"
                      placeholder="Vorname"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Nachname *
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                      className="pl-10 rounded-xl border-slate-200 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-500 dark:bg-slate-700 dark:text-white h-12"
                      placeholder="Nachname"
                      required
                    />
                  </div>
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
                    placeholder="benutzer@beispiel.de"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Telefonnummer
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
                <Label htmlFor="role" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Rolle *
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant={formData.role === 'admin' ? "default" : "outline"}
                    className={`h-12 transition-all duration-200 ${
                      formData.role === 'admin'
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl' 
                        : 'border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'
                    }`}
                    onClick={() => handleInputChange('role', 'admin')}
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Administrator
                  </Button>
                  <Button
                    type="button"
                    variant={formData.role === 'user' ? "default" : "outline"}
                    className={`h-12 transition-all duration-200 ${
                      formData.role === 'user'
                        ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl' 
                        : 'border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'
                    }`}
                    onClick={() => handleInputChange('role', 'user')}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Benutzer
                  </Button>
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={isLoading} 
                className="w-full flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-12 px-6 shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <Send className="h-4 w-4" />
                {isLoading ? 'Einladung wird gesendet...' : 'Einladung senden'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Informationen */}
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Informationen</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Über den Einladungsprozess</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                <div>
                  <h4 className="font-medium text-slate-900 dark:text-white">E-Mail-Einladung</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Der Benutzer erhält eine E-Mail mit einem sicheren Verifizierungslink.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-green-600 rounded-full mt-2"></div>
                <div>
                  <h4 className="font-medium text-slate-900 dark:text-white">Passwort setzen</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Der Benutzer klickt auf den Link und legt sein eigenes Passwort fest.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-purple-600 rounded-full mt-2"></div>
                <div>
                  <h4 className="font-medium text-slate-900 dark:text-white">Sofort verfügbar</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Nach dem Setzen des Passworts kann sich der Benutzer sofort anmelden.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-600">
              <h4 className="font-medium text-slate-900 dark:text-white mb-2">Verfügbare Rollen:</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Administrator</span>
                  <Badge className={`rounded-xl px-3 py-1 ${getRoleBadgeColor('admin')}`}>
                    {getRoleDisplayName('admin')}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Benutzer</span>
                  <Badge className={`rounded-xl px-3 py-1 ${getRoleBadgeColor('user')}`}>
                    {getRoleDisplayName('user')}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bestehende Benutzer */}
      <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                <Users className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Bestehende Benutzer</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {filteredUsers.length} von {existingUsers.length} Benutzern
                </p>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Benutzer suchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingUsers ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>E-Mail</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Rolle</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Letzter Login</TableHead>
                    <TableHead>Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.phone || '-'}</TableCell>
                      <TableCell>
                        <Badge className={`rounded-xl px-3 py-1 ${getRoleBadgeColor(user.role)}`}>
                          {getRoleDisplayName(user.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={user.isActive ? "default" : "secondary"}
                          className={`rounded-xl px-3 py-1 ${
                            user.isActive 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          }`}
                        >
                          {user.isActive ? 'Aktiv' : 'Inaktiv'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.lastLogin 
                          ? new Date(user.lastLogin).toLocaleString('de-DE', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'Nie'
                        }
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {/* Status-Button nur für Nicht-Superadmins */}
                          {user.role !== 'superadmin' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleUserStatus(user.id, user.isActive)}
                              className="h-8 w-8 p-0"
                              title={user.isActive ? 'Deaktivieren' : 'Aktivieren'}
                            >
                              {user.isActive ? (
                                <EyeOff className="h-4 w-4 text-orange-600" />
                              ) : (
                                <Eye className="h-4 w-4 text-green-600" />
                              )}
                            </Button>
                          )}
                          
                          {/* Lösch-Button nur für Nicht-Superadmins */}
                          {user.role !== 'superadmin' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteUser(user.id, user.name)}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                              title="Löschen"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                          
                          {/* Info für Superadmins */}
                          {user.role === 'superadmin' && (
                            <span className="text-xs text-slate-500 italic">
                              Geschützt
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Eingeladene Benutzer */}
      <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                <Mail className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Eingeladene Benutzer</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {invitedUsers.length} Einladungen ausstehend
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingInvites ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : invitedUsers.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Mail className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p>Keine ausstehenden Einladungen</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>E-Mail</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Rolle</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Gültig bis</TableHead>
                    <TableHead>Eingeladen von</TableHead>
                    <TableHead>Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitedUsers.map((invite) => (
                    <TableRow key={invite.id}>
                      <TableCell className="font-medium">{invite.name}</TableCell>
                      <TableCell>{invite.email}</TableCell>
                      <TableCell>{invite.phone || '-'}</TableCell>
                      <TableCell>
                        <Badge className={`rounded-xl px-3 py-1 ${getRoleBadgeColor(invite.role)}`}>
                          {getRoleDisplayName(invite.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          className={`rounded-xl px-3 py-1 ${
                            invite.used 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : new Date(invite.expiresAt) < new Date()
                              ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                          }`}
                        >
                          {invite.used 
                            ? 'Verwendet' 
                            : new Date(invite.expiresAt) < new Date()
                            ? 'Abgelaufen'
                            : 'Ausstehend'
                          }
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(invite.expiresAt).toLocaleString('de-DE', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </TableCell>
                      <TableCell>{invite.createdBy}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {!invite.used && new Date(invite.expiresAt) > new Date() && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResendInvite(
                                invite.id,
                                invite.email,
                                invite.firstName || '',
                                invite.lastName || '',
                                invite.phone || '',
                                invite.role
                              )}
                              className="h-8 px-3 text-blue-600 hover:text-blue-700"
                              title="Erneut einladen"
                            >
                              <Send className="h-4 w-4 mr-1" />
                              Erneut
                            </Button>
                          )}
                          {(invite.used || new Date(invite.expiresAt) < new Date()) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResendInvite(
                                invite.id,
                                invite.email,
                                invite.firstName || '',
                                invite.lastName || '',
                                invite.phone || '',
                                invite.role
                              )}
                              className="h-8 px-3 text-green-600 hover:text-green-700"
                              title="Neue Einladung senden"
                            >
                              <Send className="h-4 w-4 mr-1" />
                              Neu senden
                            </Button>
                          )}
                          {/* Lösch-Button für Einladungen */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteInvite(invite.id, invite.email, invite.name)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                            title="Einladung löschen"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 