'use client';
import React from 'react';
import { Building2, Clock, CheckCircle, User } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import type { Project } from '../types';
import { getProjectTotalHours } from '@/lib/timeEntry/projectHours'

interface DynamicProjectStatsProps {
  projects: Project[];
}

type StatCard = {
  label: string
  value: string | number
  icon: typeof Building2
  tone: string
  iconShell: string
  accent: string
}

export default function DynamicProjectStats({ projects }: DynamicProjectStatsProps) {
  const statsData = React.useMemo(() => {
    const totalProjects = projects.length;
    const activeProjects = projects.filter(project => project.status === 'aktiv').length;
    const completedProjects = projects.filter(project =>
      ['abgeschlossen', 'fertiggestellt', 'geleistet'].includes(project.status)
    ).length;
    const totalHours = projects.reduce((sum, project) => {
      return sum + getProjectTotalHours(project)
    }, 0);

    return {
      totalProjects,
      activeProjects,
      completedProjects,
      totalHours
    };
  }, [projects]);

  const statCards: StatCard[] = [
    {
      label: 'Gesamt',
      value: statsData.totalProjects,
      icon: Building2,
      tone: 'text-blue-600',
      iconShell: 'bg-blue-50 ring-blue-100',
      accent: 'from-blue-500 via-sky-400 to-cyan-300',
    },
    {
      label: 'Aktiv',
      value: statsData.activeProjects,
      icon: Clock,
      tone: 'text-emerald-600',
      iconShell: 'bg-emerald-50 ring-emerald-100',
      accent: 'from-emerald-500 via-lime-400 to-green-300',
    },
    {
      label: 'Abgeschlossen',
      value: statsData.completedProjects,
      icon: CheckCircle,
      tone: 'text-fuchsia-600',
      iconShell: 'bg-fuchsia-50 ring-fuchsia-100',
      accent: 'from-fuchsia-500 via-violet-400 to-purple-300',
    },
    {
      label: 'Gesamtstunden',
      value: `${statsData.totalHours.toFixed(1)}h`,
      icon: User,
      tone: 'text-amber-600',
      iconShell: 'bg-amber-50 ring-amber-100',
      accent: 'from-amber-500 via-orange-400 to-yellow-300',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {statCards.map((card) => {
        const Icon = card.icon
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
        )
      })}
    </div>
  );
}
