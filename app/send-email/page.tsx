"use client";
import React, { useState } from 'react';
import { SetupApi } from '@/lib/api/setup'
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Mail, CheckCircle, XCircle } from 'lucide-react';
import Image from 'next/image';

export default function SendEmailPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [emailStatus, setEmailStatus] = useState<any>(null);

  const handleSendEmail = async () => {
    setIsLoading(true);
    setError('');
    setSuccess('');
    setEmailStatus(null);

    try {
      const data = await SetupApi.sendWelcomeEmail();

      if (!('error' in data) || !data.error) {
        setSuccess(data.message);
        setEmailStatus(data.user);
      } else {
        if ((data as any).status === 409) {
          // E-Mail bereits gesendet
          setError(data.error);
          setEmailStatus(data.user);
        } else {
          setError(data.error || 'Fehler beim Senden der E-Mail');
        }
      }
    } catch (err) {
      setError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
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
              
              <h1 className="text-2xl font-bold text-slate-900">E-Mail senden</h1>
              <p className="text-slate-600 mt-2">
                Willkommens-E-Mail an den Superadmin senden
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
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

            {emailStatus && (
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  {emailStatus.welcomeEmailSent ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  <span className="font-medium">E-Mail-Status</span>
                </div>
                <div className="text-sm space-y-1">
                  <p><strong>Empfänger:</strong> {emailStatus.email}</p>
                  <p><strong>Name:</strong> {emailStatus.name}</p>
                  <p><strong>Rolle:</strong> {emailStatus.role}</p>
                  {emailStatus.welcomeEmailSent && emailStatus.welcomeEmailSentAt && (
                    <p><strong>Gesendet am:</strong> {new Date(emailStatus.welcomeEmailSentAt).toLocaleString('de-DE')}</p>
                  )}
                </div>
              </div>
            )}

            <Button
              onClick={handleSendEmail}
              disabled={isLoading || (emailStatus?.welcomeEmailSent)}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 rounded-lg disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              <Mail className="h-4 w-4 mr-2" />
              {isLoading ? 'Wird gesendet...' : 
               emailStatus?.welcomeEmailSent ? 'E-Mail bereits gesendet' : 'E-Mail senden'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 