"use client";
import React, { useState } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ChevronDown, Check } from 'lucide-react';
import type { EmployeeStatus } from '../types/main';

interface EmployeeStatusSelectProps {
  employee: any;
  currentStatus: EmployeeStatus;
  onStatusChange: (employeeId: string, newStatus: EmployeeStatus) => Promise<void>;
  isCurrentlyOnVacation: boolean;
  disabled?: boolean;
}

export default function EmployeeStatusSelect({ 
  employee, 
  currentStatus, 
  onStatusChange,
  isCurrentlyOnVacation,
  disabled = false,
}: EmployeeStatusSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const statusOptions = [
    { value: 'aktiv', label: 'Aktiv', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
    { value: 'nicht aktiv', label: 'Nicht aktiv', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
    { value: 'urlaub', label: 'Urlaub', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' }
  ];

  const currentStatusOption = statusOptions.find(option => option.value === currentStatus) || statusOptions[0];

  const handleStatusChange = async (newStatus: EmployeeStatus) => {
    if (newStatus === currentStatus) {
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      await onStatusChange(employee.id, newStatus);
      setIsOpen(false);
    } catch (error) {
      console.error('Fehler beim Ändern des Status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={isLoading || disabled}
        className="h-auto p-1 hover:bg-slate-100 dark:hover:bg-slate-700"
      >
        <Badge 
          className={`text-xs ${currentStatusOption.color} ${isCurrentlyOnVacation ? 'ring-2 ring-orange-300 dark:ring-orange-600' : ''}`}
        >
          {currentStatusOption.label}
          {isCurrentlyOnVacation && currentStatus !== 'urlaub' && (
            <span className="ml-1 text-orange-600 dark:text-orange-400">⚠️</span>
          )}
        </Badge>
        <ChevronDown className="h-3 w-3 ml-1" />
      </Button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-32 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg">
          <div className="py-1">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleStatusChange(option.value as EmployeeStatus)}
                disabled={isLoading || disabled}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between ${
                  currentStatus === option.value ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                }`}
              >
                <span>{option.label}</span>
                {currentStatus === option.value && (
                  <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 