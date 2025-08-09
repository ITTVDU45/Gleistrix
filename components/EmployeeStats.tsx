'use client';
import React from 'react';
import { Card, CardContent, CardHeader } from './ui/card';
import { Users, UserCheck, UserX, Clock } from 'lucide-react';
import type { Employee } from '../types/main';

interface EmployeeStatsProps {
  employees: Employee[];
}

export default function EmployeeStats({ employees }: EmployeeStatsProps) {
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
      <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="text-sm font-medium text-slate-600 dark:text-slate-300">Gesamt</div>
          <Users className="h-4 w-4 text-slate-400 dark:text-slate-300" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{totalEmployees}</div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Mitarbeiter</p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="text-sm font-medium text-slate-600 dark:text-slate-300">Aktiv</div>
          <UserCheck className="h-4 w-4 text-green-500 dark:text-green-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{activeEmployees}</div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Aktive Mitarbeiter</p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="text-sm font-medium text-slate-600 dark:text-slate-300">Inaktiv</div>
          <UserX className="h-4 w-4 text-red-500 dark:text-red-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">{inactiveEmployees}</div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Inaktive Mitarbeiter</p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="text-sm font-medium text-slate-600 dark:text-slate-300">Im Urlaub</div>
          <Clock className="h-4 w-4 text-orange-500 dark:text-orange-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{onVacationEmployees}</div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Aktuell im Urlaub</p>
        </CardContent>
      </Card>
    </div>
  );
} 