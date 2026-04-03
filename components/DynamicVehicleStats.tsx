'use client';
import React from 'react';
import { Truck, CircleCheckBig, Briefcase, Wrench } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import type { Vehicle, Project } from '../types';
import { getVehicleStatus } from '../lib/utils/vehicleStatus';

type StatCard = {
  label: string
  value: string | number
  icon: typeof Truck
  tone: string
  iconShell: string
  accent: string
}

interface DynamicVehicleStatsProps {
  vehicles: Vehicle[];
  projects: Project[];
}

export default function DynamicVehicleStats({ vehicles, projects }: DynamicVehicleStatsProps) {
  const stats = React.useMemo(() => {
    let inUse = 0;
    let unavailable = 0;

    vehicles.forEach((vehicle) => {
      const statusInfo = getVehicleStatus(vehicle, projects);
      if (statusInfo.status === 'im_einsatz') {
        inUse += 1;
        return;
      }
      if (statusInfo.status === 'wartung' || String(statusInfo.status).includes('nicht')) {
        unavailable += 1;
      }
    });

    return {
      total: vehicles.length,
      available: Math.max(vehicles.length - inUse - unavailable, 0),
      inUse,
      unavailable,
    };
  }, [vehicles, projects]);

  const statCards: StatCard[] = [
    {
      label: 'Gesamt',
      value: stats.total,
      icon: Truck,
      tone: 'text-blue-600',
      iconShell: 'bg-blue-50 ring-blue-100',
      accent: 'from-blue-500 via-sky-400 to-cyan-300',
    },
    {
      label: 'Verfuegbar',
      value: stats.available,
      icon: CircleCheckBig,
      tone: 'text-emerald-600',
      iconShell: 'bg-emerald-50 ring-emerald-100',
      accent: 'from-emerald-500 via-lime-400 to-green-300',
    },
    {
      label: 'Im Einsatz',
      value: stats.inUse,
      icon: Briefcase,
      tone: 'text-fuchsia-600',
      iconShell: 'bg-fuchsia-50 ring-fuchsia-100',
      accent: 'from-fuchsia-500 via-violet-400 to-purple-300',
    },
    {
      label: 'Nicht verfuegbar',
      value: stats.unavailable,
      icon: Wrench,
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
