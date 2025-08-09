"use client";
import React, { useEffect, useState } from 'react';
import { AuthApi } from '@/lib/api/auth'
import { ProjectsApi } from '@/lib/api/projects'
import { EmployeesApi } from '@/lib/api/employees'
import { VehiclesApi } from '@/lib/api/vehicles'
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { User } from 'lucide-react';
import DynamicDashboard from '../../components/DynamicDashboard';
import ProjectStatistics from '../../components/ProjectStatistics';
import type { Project, Employee, Vehicle } from '../../types';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  firstName?: string;
  lastName?: string;
  lastLogin?: string;
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const checkAuth = async () => {
    try {
      // Zuerst NextAuth-Session überprüfen
      const sessionData = await AuthApi.session()
      
      console.log('NextAuth Session:', sessionData);
      
      if (!sessionData || !sessionData.user) {
        console.log('Keine gültige NextAuth-Session gefunden');
        router.push('/login');
        return;
      }
      
      // Dann detaillierte Benutzerdaten laden
      const data = await AuthApi.me()
      if (data?.user) {
        console.log('Benutzerdaten geladen:', data.user);
        setUser(data.user as any);
      } else {
        console.error('Fehler beim Laden der Benutzerdaten:', data?.error);
        router.push('/login');
      }
    } catch (err) {
      console.error('Auth check error:', err);
      router.push('/login');
    } finally {
      setIsLoading(false);
    }
  };

  const loadDashboardData = async () => {
    try {
      console.log('Dashboard - Starte Datenladung...');
      
      // Projekte laden
      const projectsData = await ProjectsApi.list()
      setProjects(projectsData.projects || [])

      // Mitarbeiter laden
      const employeesData = await EmployeesApi.list()
      setEmployees(employeesData.employees || [])

      // Fahrzeuge laden
      const vehiclesData = await VehiclesApi.list()
      setVehicles(vehiclesData.vehicles || [])
      
      console.log('Dashboard - Datenladung abgeschlossen');
    } catch (err) {
      console.error('Dashboard data loading error:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Lade Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <h1 className="text-xl font-bold text-red-600">Fehler</h1>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 mb-4">{error}</p>
            <Button onClick={() => router.push('/login')}>
              Zurück zum Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      <div className="w-full mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2">Willkommen bei MH-ZEITERFASSUNG</p>
          </div>
        </div>

        {user && (
          <Card className="mb-6 border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
            <CardHeader>
              <h2 className="text-xl font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                <User className="h-5 w-5" />
                Benutzer-Informationen
              </h2>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Name</p>
                  <p className="font-medium dark:text-white">{user.name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">E-Mail</p>
                  <p className="font-medium dark:text-white">{user.email}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Rolle</p>
                  <p className="font-medium capitalize dark:text-white">{user.role}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Status</p>
                  <p className="font-medium text-green-600 dark:text-green-400">Aktiv</p>
                </div>
                {user.lastLogin && (
                  <div className="md:col-span-2">
                    <p className="text-sm text-slate-500 dark:text-slate-400">Letzter Login</p>
                    <p className="font-medium dark:text-white">{new Date(user.lastLogin).toLocaleString('de-DE')}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* DynamicDashboard Komponente */}
        <div className="dashboard-cards">
        <DynamicDashboard 
          projects={projects}
          employees={employees}
          vehicles={vehicles}
        />
        </div>

        {/* ProjectStatistics Komponente */}
        <div className="mt-8">
          <div className="project-statistics">
          <ProjectStatistics 
            projects={projects}
            employees={employees}
            vehicles={vehicles}
          />
          </div>
        </div>
      </div>
    </div>
  );
}