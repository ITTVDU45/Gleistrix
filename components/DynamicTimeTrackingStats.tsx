'use client';
import React from 'react';
import { FileText, Clock, User, Building2 } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import type { TimeEntry } from '../types';

interface DynamicTimeTrackingStatsProps {
  timeEntries: TimeEntry[];
}

export default function DynamicTimeTrackingStats({ timeEntries }: DynamicTimeTrackingStatsProps) {
  // Hilfsfunktion zur Formatierung von Stunden in HH:MM Format
  const formatHours = (hours: number): string => {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return `${wholeHours}:${minutes.toString().padStart(2, '0')}`;
  };

  // Dynamische Berechnungen basierend auf gefilterten Zeiteinträgen
  const statsData = React.useMemo(() => {
    // Gesamteinträge
    const totalEntries = timeEntries.length;

    // Arbeitsstunden
    const totalWorkHours = timeEntries.reduce((sum, entry) => sum + entry.stunden, 0);

    // Fahrtstunden
    const totalTravelHours = timeEntries.reduce((sum, entry) => sum + (entry.fahrtstunden || 0), 0);

    // Eindeutige Projekte
    const uniqueProjects = new Set(timeEntries.map(entry => entry.projectName)).size;

    return {
      totalEntries,
      totalWorkHours,
      totalTravelHours,
      uniqueProjects
    };
  }, [timeEntries]);

  return (
    <>
      {/* Statistik-Karten */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Einträge</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{statsData.totalEntries}</p>
              </div>
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600 dark:text-green-400">Arbeitsstunden</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">{formatHours(statsData.totalWorkHours)}</p>
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
                <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Fahrtstunden</p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{formatHours(statsData.totalTravelHours)}</p>
              </div>
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                <User className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600 dark:text-orange-400">Projekte</p>
                <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">{statsData.uniqueProjects}</p>
              </div>
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                <Building2 className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
} 