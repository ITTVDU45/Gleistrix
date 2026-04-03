'use client';
import React from 'react';
import { Receipt, Clock3, CircleDashed, BadgeCheck } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';

type StatCard = {
  label: string
  value: string | number
  icon: typeof Receipt
  tone: string
  iconShell: string
  accent: string
}

interface DynamicBillingStatsProps {
  projects: any[];
}

function getEffectiveStatus(project: any): string {
  try {
    const billed = new Set<string>(Array.isArray(project?.abgerechneteTage) ? project.abgerechneteTage.map((d: any) => String(d)) : []);
    const daysWithEntries: Record<string, true> = {};

    Object.entries(project?.mitarbeiterZeiten || {}).forEach(([day, arr]: any) => {
      if (Array.isArray(arr) && arr.length > 0) daysWithEntries[day] = true;
      (Array.isArray(arr) ? arr : []).forEach((entry: any) => {
        const endStr = entry?.ende || entry?.end;
        if (typeof endStr === 'string' && endStr.includes('T')) {
          const endDay = endStr.slice(0, 10);
          if (endDay && endDay !== day) daysWithEntries[endDay] = true;
        }
      });
    });

    const bookedDays = Object.keys(daysWithEntries);
    if (bookedDays.length > 0 && bookedDays.every((day) => billed.has(day))) return 'geleistet';
    if (billed.size > 0) return 'teilweise_abgerechnet';
    return project?.status || 'kein Status';
  } catch {
    return project?.status || 'kein Status';
  }
}

function getTotalHours(project: any): number {
  try {
    return Object.values(project?.mitarbeiterZeiten || {}).reduce((sum: number, entries: any) => {
      const list = Array.isArray(entries) ? entries : [];
      return sum + list.reduce((entrySum: number, entry: any) => entrySum + (entry.stunden || 0), 0);
    }, 0);
  } catch {
    return 0;
  }
}

export default function DynamicBillingStats({ projects }: DynamicBillingStatsProps) {
  const stats = React.useMemo(() => {
    const total = projects.length;
    let open = 0;
    let partial = 0;
    let billed = 0;
    const totalHours = projects.reduce((sum, project) => sum + getTotalHours(project), 0);

    projects.forEach((project) => {
      const effectiveStatus = getEffectiveStatus(project);
      if (effectiveStatus === 'geleistet') billed += 1;
      else if (effectiveStatus === 'teilweise_abgerechnet') partial += 1;
      else open += 1;
    });

    return { total, open, partial, billed, totalHours };
  }, [projects]);

  const statCards: StatCard[] = [
    {
      label: 'Gesamt',
      value: stats.total,
      icon: Receipt,
      tone: 'text-blue-600',
      iconShell: 'bg-blue-50 ring-blue-100',
      accent: 'from-blue-500 via-sky-400 to-cyan-300',
    },
    {
      label: 'Offen',
      value: stats.open,
      icon: CircleDashed,
      tone: 'text-emerald-600',
      iconShell: 'bg-emerald-50 ring-emerald-100',
      accent: 'from-emerald-500 via-lime-400 to-green-300',
    },
    {
      label: 'Teilweise',
      value: stats.partial,
      icon: Clock3,
      tone: 'text-fuchsia-600',
      iconShell: 'bg-fuchsia-50 ring-fuchsia-100',
      accent: 'from-fuchsia-500 via-violet-400 to-purple-300',
    },
    {
      label: 'Abgerechnet',
      value: stats.billed,
      icon: BadgeCheck,
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
