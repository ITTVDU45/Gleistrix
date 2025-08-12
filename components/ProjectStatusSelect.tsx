"use client";
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { CheckCircle } from 'lucide-react';

interface ProjectStatusSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  variant?: 'inline' | 'form';
  disabled?: boolean;
}

export default function ProjectStatusSelect({ 
  value, 
  onValueChange, 
  variant = 'form',
  disabled = false 
}: ProjectStatusSelectProps) {
  const statusOptions = [
    { value: 'aktiv', label: 'Aktiv', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
    { value: 'abgeschlossen', label: 'Abgeschlossen', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400' },
    { value: 'fertiggestellt', label: 'Fertiggestellt', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
    { value: 'geleistet', label: 'Geleistet', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
    { value: 'kein Status', label: 'Kein Status', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' }
  ];

  const currentStatus = statusOptions.find(option => option.value === value);

  if (variant === 'inline') {
    return (
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className="h-8 w-32 border-0 bg-transparent p-0 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg">
          <SelectValue>
            <Badge className={`${currentStatus?.color} rounded-lg text-xs font-medium`}>
              {currentStatus?.label}
            </Badge>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex items-center gap-2">
                <Badge className={`${option.color} rounded-lg text-xs font-medium`}>
                  {option.label}
                </Badge>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {statusOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
} 