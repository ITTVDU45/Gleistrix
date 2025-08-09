'use client';
import React from 'react';
import { Building2, Clock, CheckCircle, User } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import type { Project } from '../types';

interface DynamicProjectStatsProps {
  projects: Project[];
}

export default function DynamicProjectStats({ projects }: DynamicProjectStatsProps) {
  // Dynamische Berechnungen basierend auf gefilterten Projekten
  const statsData = React.useMemo(() => {
    // Gesamtprojekte
    const totalProjects = projects.length;

    // Aktive Projekte (Status: aktiv)
    const activeProjects = projects.filter(project => project.status === 'aktiv').length;

    // Abgeschlossene Projekte (Status: abgeschlossen, fertiggestellt, geleistet)
    const completedProjects = projects.filter(project => 
      ['abgeschlossen', 'fertiggestellt', 'geleistet'].includes(project.status)
    ).length;

    // Gesamtstunden aller gefilterten Projekte
    const totalHours = projects.reduce((sum, project) => {
      return sum + Object.values(project.mitarbeiterZeiten || {}).reduce((projectSum, entries) => {
        return projectSum + entries.reduce((entrySum, entry) => entrySum + entry.stunden, 0);
      }, 0);
    }, 0);

    return {
      totalProjects,
      activeProjects,
      completedProjects,
      totalHours
    };
  }, [projects]);

  return (
    <>
      {/* Statistik-Karten */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Gesamt</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{statsData.totalProjects}</p>
              </div>
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600 dark:text-green-400">Aktiv</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">{statsData.activeProjects}</p>
              </div>
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-xl">
                <Clock className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Abgeschlossen</p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{statsData.completedProjects}</p>
              </div>
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                <CheckCircle className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600 dark:text-orange-400">Gesamtstunden</p>
                <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">{statsData.totalHours.toFixed(1)}h</p>
              </div>
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                <User className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
} 