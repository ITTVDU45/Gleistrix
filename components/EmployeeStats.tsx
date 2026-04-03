'use client';
import React from 'react';
import { Users, UserCheck, UserX, Clock } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import type { Employee } from '../types/main';

interface EmployeeStatsProps {
  employees: Employee[];
}

type StatCard = {
  label: string
  value: string | number
  icon: typeof Users
  tone: string
  iconShell: string
  accent: string
}

export default function EmployeeStats({ employees }: EmployeeStatsProps) {
  const stats = React.useMemo(() => {
    const totalEmployees = employees.length;
    const activeEmployees = employees.filter(emp => emp.status === 'aktiv').length;
    const inactiveEmployees = employees.filter(emp => emp.status === 'nicht aktiv').length;
    const onVacationEmployees = employees.filter(emp => {
      if (!emp.vacationDays || emp.vacationDays.length === 0) return false;
      const today = new Date();
      return emp.vacationDays.some(vacation => {
        const startDate = new Date(vacation.startDate);
        const endDate = new Date(vacation.endDate);
        return today >= startDate && today <= endDate;
      });
    }).length;

    return {
      totalEmployees,
      activeEmployees,
      inactiveEmployees,
      onVacationEmployees,
    };
  }, [employees]);

  const statCards: StatCard[] = [
    {
      label: 'Gesamt',
      value: stats.totalEmployees,
      icon: Users,
      tone: 'text-blue-600',
      iconShell: 'bg-blue-50 ring-blue-100',
      accent: 'from-blue-500 via-sky-400 to-cyan-300',
    },
    {
      label: 'Aktiv',
      value: stats.activeEmployees,
      icon: UserCheck,
      tone: 'text-emerald-600',
      iconShell: 'bg-emerald-50 ring-emerald-100',
      accent: 'from-emerald-500 via-lime-400 to-green-300',
    },
    {
      label: 'Inaktiv',
      value: stats.inactiveEmployees,
      icon: UserX,
      tone: 'text-fuchsia-600',
      iconShell: 'bg-fuchsia-50 ring-fuchsia-100',
      accent: 'from-fuchsia-500 via-violet-400 to-purple-300',
    },
    {
      label: 'Im Urlaub',
      value: stats.onVacationEmployees,
      icon: Clock,
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
