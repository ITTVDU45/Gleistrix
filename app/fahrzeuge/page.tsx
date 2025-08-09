'use client';
import React, { useState, useEffect } from 'react';
import { VehiclesApi } from '@/lib/api/vehicles'
import { ProjectsApi } from '@/lib/api/projects'
import { Alert, AlertDescription } from '../../components/ui/alert';
import type { Vehicle, Project } from '../../types';
import AddVehicleDialog from '../../components/AddVehicleDialog';
import VehicleListWithFilter from '../../components/VehicleListWithFilter';

export default function FahrzeugePage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean, message: string, severity: 'success'|'error' }>({ open: false, message: '', severity: 'success' });

  // Keine Übersicht-Sperre mehr – Sperrlogik nur im Bearbeitungsdialog (pro Fahrzeug)

  // Übersicht ist frei; Sperren werden in VehicleActions pro Fahrzeug gehandhabt

  // Snackbar schließen
  const closeSnackbar = () => {
    setSnackbar({ open: false, message: '', severity: 'success' });
  };

  // Snackbar automatisch schließen
  useEffect(() => {
    if (snackbar.open) {
      const timer = setTimeout(() => {
        closeSnackbar();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [snackbar.open]);

  // Daten laden
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [vehiclesData, projectsData] = await Promise.all([
          VehiclesApi.list(),
          ProjectsApi.list()
        ]);

        if (vehiclesData && projectsData) {
          const normalizedVehicles = ((vehiclesData as any).vehicles || []).map((v: any) => ({
            ...v,
            id: v?.id || v?._id?.toString?.() || v?._id || undefined,
          }));
          setVehicles(normalizedVehicles);
          setProjects(((projectsData as any).projects) || []);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Keine globale Übersichtssperre */}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Fahrzeuge</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">Verwalten Sie Ihre Fahrzeugflotte</p>
        </div>
        <div className="flex items-center gap-3 vehicle-create-button">
          <AddVehicleDialog />
        </div>
      </div>

      {/* Fahrzeugliste mit Filter */}
      <div className="vehicles-table">
        <VehicleListWithFilter vehicles={vehicles} projects={projects} />
      </div>

      {/* Kein globaler Lock-Dialog hier; pro Fahrzeug in VehicleActions */}

      {/* Snackbar */}
      {snackbar.open && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
          snackbar.severity === 'success' 
            ? 'bg-green-500 text-white' 
            : 'bg-red-500 text-white'
        }`}>
          {snackbar.message}
          <button 
            onClick={closeSnackbar}
            className="ml-2 text-white hover:text-gray-200"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
} 