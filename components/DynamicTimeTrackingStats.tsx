'use client';
import React from 'react';
import { FileText, Clock, Car, Building2 } from 'lucide-react';
import { Card, CardContent } from './ui/card';

interface DynamicTimeTrackingStatsProps {
  timeEntries: any[];
}

type StatCard = {
  label: string
  value: string | number
  icon: typeof FileText
  tone: string
  iconShell: string
  accent: string
}

export default function DynamicTimeTrackingStats({ timeEntries }: DynamicTimeTrackingStatsProps) {
  const formatHours = (hours: number): string => {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return `${wholeHours}:${minutes.toString().padStart(2, '0')}`;
  };

  const statsData = React.useMemo(() => {
    const totalEntries = timeEntries.length;
    const totalWorkHours = timeEntries.reduce((sum, entry) => {
      const stunden = typeof entry.stunden === 'number' ? entry.stunden : parseFloat(String(entry.stunden || 0)) || 0;
      const multiplier = entry?.isExternal
        ? (() => {
            const count = typeof entry.externalCount === 'number' ? entry.externalCount : parseFloat(String(entry.externalCount || 1));
            return Number.isFinite(count) && count > 0 ? count : 1;
          })()
        : 1;
      return sum + stunden * multiplier;
    }, 0);
    const totalTravelHours = timeEntries.reduce((sum, entry) => {
      const fahrtstunden = typeof entry.fahrtstunden === 'number'
        ? entry.fahrtstunden
        : parseFloat(String(entry.fahrtstunden || entry.fahrt || 0)) || 0;
      const multiplier = entry?.isExternal
        ? (() => {
            const count = typeof entry.externalCount === 'number' ? entry.externalCount : parseFloat(String(entry.externalCount || 1));
            return Number.isFinite(count) && count > 0 ? count : 1;
          })()
        : 1;
      return sum + fahrtstunden * multiplier;
    }, 0);
    const uniqueProjects = new Set(
      timeEntries
        .map((entry) => String(entry.projectName || '').trim())
        .filter(Boolean)
    ).size;

    return {
      totalEntries,
      totalWorkHours,
      totalTravelHours,
      uniqueProjects,
    };
  }, [timeEntries]);

  const statCards: StatCard[] = [
    {
      label: 'Eintraege',
      value: statsData.totalEntries,
      icon: FileText,
      tone: 'text-blue-600',
      iconShell: 'bg-blue-50 ring-blue-100',
      accent: 'from-blue-500 via-sky-400 to-cyan-300',
    },
    {
      label: 'Arbeitsstunden',
      value: formatHours(statsData.totalWorkHours),
      icon: Clock,
      tone: 'text-emerald-600',
      iconShell: 'bg-emerald-50 ring-emerald-100',
      accent: 'from-emerald-500 via-lime-400 to-green-300',
    },
    {
      label: 'Fahrtstunden',
      value: formatHours(statsData.totalTravelHours),
      icon: Car,
      tone: 'text-fuchsia-600',
      iconShell: 'bg-fuchsia-50 ring-fuchsia-100',
      accent: 'from-fuchsia-500 via-violet-400 to-purple-300',
    },
    {
      label: 'Projekte',
      value: statsData.uniqueProjects,
      icon: Building2,
      tone: 'text-amber-600',
      iconShell: 'bg-amber-50 ring-amber-100',
      accent: 'from-amber-500 via-orange-400 to-yellow-300',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {statCards.map((card) => {
        const Icon = card.icon;
        return (
          <Card
            key={card.label}
            className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/70 ring-1 ring-white"
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${card.tone}`}>{card.label}</p>
                  <p className="mt-3 text-3xl font-semibold text-slate-900">{card.value}</p>
                </div>
                <div className={`rounded-2xl p-3 ring-1 ${card.iconShell}`}>
                  <Icon className={`h-5 w-5 ${card.tone}`} />
                </div>
              </div>
              <div className={`mt-5 h-1.5 rounded-full bg-gradient-to-r ${card.accent}`} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
