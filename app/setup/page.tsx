"use client";
import React, { useState, useEffect } from 'react';
import { SetupApi } from '@/lib/api/setup'
import { useRouter } from 'next/navigation';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { User, Mail, Phone, MapPin, Lock, Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';

interface SetupFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  password: string;
  confirmPassword: string;
}

export default function SetupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<SetupFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSetupAvailable, setIsSetupAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    // Prüfen ob Setup bereits durchgeführt wurde
    const checkSetupStatus = async () => {
      try {
        const data = await SetupApi.status();
        
        if (!data.available) {
          setError('Setup wurde bereits durchgeführt. Superadmin existiert bereits.');
          setIsSetupAvailable(false);
        } else {
          setIsSetupAvailable(true);
        }
      } catch (err) {
        setError('Fehler beim Prüfen des Setup-Status');
        setIsSetupAvailable(false);
      }
    };

    checkSetupStatus();
  }, []);

  const handleInputChange = (field: keyof SetupFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.firstName.trim()) {
      setError('Vorname ist erforderlich');
      return false;
    }
    if (!formData.lastName.trim()) {
      setError('Nachname ist erforderlich');
      return false;
    }
    if (!formData.email.trim()) {
      setError('E-Mail ist erforderlich');
      return false;
    }
    if (!formData.phone.trim()) {
      setError('Telefonnummer ist erforderlich');
      return false;
    }
    if (!formData.address.trim()) {
      setError('Adresse ist erforderlich');
      return false;
    }
    if (!formData.password) {
      setError('Passwort ist erforderlich');
      return false;
    }
    if (formData.password.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen lang sein');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwörter stimmen nicht überein');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    if (!validateForm()) {
      setIsLoading(false);
      return;
    }

    try {
      const data = await SetupApi.createSuperadmin(formData);

      if (!data.error) {
        setSuccess('Superadmin erfolgreich erstellt! Sie werden zur Anmeldung weitergeleitet.');
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      } else {
        setError(data.error || 'Fehler beim Erstellen des Superadmins');
      }
    } catch (err) {
      setError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSetupAvailable === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="w-full max-w-md">
          <Card className="border-0 shadow-2xl bg-white rounded-2xl">
            <CardContent className="p-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-slate-600">Setup-Status wird geprüft...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isSetupAvailable === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="w-full max-w-md">
          <Card className="border-0 shadow-2xl bg-white rounded-2xl">
            <CardContent className="p-8">
              <div className="text-center">
                <Alert variant="destructive" className="rounded-lg mb-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
                <Button
                  onClick={() => router.push('/login')}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Zur Anmeldung
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-2xl">
        <Card className="border-0 shadow-2xl bg-white rounded-2xl">
          <CardHeader className="space-y-1 pb-8">
            <div className="text-center">
              {/* Logo */}
              <div className="flex justify-center mb-6">
                <Image 
                  src="/mwd-logo.png" 
                  alt="Mülheimer Wachdienst Logo" 
                  width={120} 
                  height={120} 
                  className="w-24 h-24 object-contain"
                  priority
                />
              </div>
              
              <h1 className="text-3xl font-bold text-slate-900">System-Setup</h1>
              <p className="text-slate-600 mt-2">
                Erstellen Sie den ersten Superadmin für MH-ZEITERFASSUNG
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-sm font-medium text-slate-700">
                    Vorname
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="firstName"
                      type="text"
                      placeholder="Vorname"
                      value={formData.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value)}
                      className="pl-10 h-11 rounded-lg border-slate-200"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-sm font-medium text-slate-700">
                    Nachname
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="lastName"
                      type="text"
                      placeholder="Nachname"
                      value={formData.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                      className="pl-10 h-11 rounded-lg border-slate-200"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                  E-Mail
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="ihre.email@beispiel.de"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="pl-10 h-11 rounded-lg border-slate-200"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium text-slate-700">
                  Telefonnummer
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+49 123 456789"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className="pl-10 h-11 rounded-lg border-slate-200"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address" className="text-sm font-medium text-slate-700">
                  Adresse
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="address"
                    type="text"
                    placeholder="Straße, Hausnummer, PLZ, Ort"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    className="pl-10 h-11 rounded-lg border-slate-200"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                    Passwort
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Mindestens 6 Zeichen"
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      className="pl-10 pr-10 h-11 rounded-lg border-slate-200"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">
                    Passwort bestätigen
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Passwort wiederholen"
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      className="pl-10 pr-10 h-11 rounded-lg border-slate-200"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {error && (
                <Alert variant="destructive" className="rounded-lg">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="rounded-lg bg-green-50 border-green-200">
                  <AlertDescription className="text-green-800">{success}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 rounded-lg"
                disabled={isLoading}
              >
                {isLoading ? 'Wird erstellt...' : 'Superadmin erstellen'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 