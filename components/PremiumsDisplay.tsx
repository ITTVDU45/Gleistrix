"use client"

import React from 'react'
import { Moon, Sun, Calendar, Clock, Briefcase } from 'lucide-react'

interface PremiumsData {
  nightMinutes?: number
  nightHours?: number
  sundayMinutes?: number
  sundayHours?: number
  holidayMinutes?: number
  holidayHours?: number
  nightHolidayMinutes?: number
  nightHolidayHours?: number
  normalMinutes?: number
  normalHours?: number
  totalWorkMinutes?: number
  totalWorkHours?: number
  breakTotalMinutes?: number
}

interface PremiumsDisplayProps {
  premiums: PremiumsData
  showMinutes?: boolean
  compact?: boolean
  className?: string
}

/**
 * Anzeige der berechneten Zuschläge
 * Zeigt Nacht-, Sonntags-, Feiertags- und normale Arbeitsstunden
 */
export function PremiumsDisplay({
  premiums,
  showMinutes = false,
  compact = false,
  className = ''
}: PremiumsDisplayProps) {
  // Formatiert Stunden als String mit Komma
  const formatHours = (hours?: number): string => {
    if (hours === undefined || hours === null) return '-'
    return hours.toFixed(2).replace('.', ',') + 'h'
  }

  // Formatiert Minuten als String
  const formatMinutes = (minutes?: number): string => {
    if (minutes === undefined || minutes === null) return '-'
    return `${minutes} Min`
  }

  const items = [
    {
      label: 'Nachtstunden',
      icon: Moon,
      value: showMinutes ? formatMinutes(premiums.nightMinutes) : formatHours(premiums.nightHours),
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      show: (premiums.nightMinutes ?? 0) > 0 || (premiums.nightHours ?? 0) > 0
    },
    {
      label: 'Sonntagsstunden',
      icon: Sun,
      value: showMinutes ? formatMinutes(premiums.sundayMinutes) : formatHours(premiums.sundayHours),
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      show: (premiums.sundayMinutes ?? 0) > 0 || (premiums.sundayHours ?? 0) > 0
    },
    {
      label: 'Feiertagsstunden',
      icon: Calendar,
      value: showMinutes ? formatMinutes(premiums.holidayMinutes) : formatHours(premiums.holidayHours),
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      show: (premiums.holidayMinutes ?? 0) > 0 || (premiums.holidayHours ?? 0) > 0
    },
    {
      label: 'Nacht + Feiertag',
      icon: Moon,
      value: showMinutes ? formatMinutes(premiums.nightHolidayMinutes) : formatHours(premiums.nightHolidayHours),
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      show: (premiums.nightHolidayMinutes ?? 0) > 0 || (premiums.nightHolidayHours ?? 0) > 0
    },
    {
      label: 'Normale Stunden',
      icon: Briefcase,
      value: showMinutes ? formatMinutes(premiums.normalMinutes) : formatHours(premiums.normalHours),
      color: 'text-slate-600',
      bgColor: 'bg-slate-50',
      show: true
    }
  ]

  // Nur Items mit Werten anzeigen (außer "Normale Stunden" immer anzeigen)
  const visibleItems = items.filter(item => item.show)

  if (compact) {
    return (
      <div className={`flex flex-wrap gap-2 ${className}`}>
        {visibleItems.map((item, index) => (
          <div
            key={index}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg ${item.bgColor}`}
          >
            <item.icon className={`h-3 w-3 ${item.color}`} />
            <span className={`text-xs font-medium ${item.color}`}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <Clock className="h-4 w-4 text-slate-600" />
        <span className="text-sm font-semibold text-slate-700">
          Berechnete Zuschläge
        </span>
        {premiums.totalWorkHours !== undefined && (
          <span className="text-xs text-slate-500 ml-auto">
            Gesamt: {formatHours(premiums.totalWorkHours)}
            {premiums.breakTotalMinutes !== undefined && premiums.breakTotalMinutes > 0 && (
              <span className="ml-1">(abzgl. {premiums.breakTotalMinutes} Min Pause)</span>
            )}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {visibleItems.map((item, index) => (
          <div
            key={index}
            className={`flex items-center gap-2 p-2 rounded-xl ${item.bgColor}`}
          >
            <item.icon className={`h-4 w-4 ${item.color}`} />
            <div>
              <div className={`text-xs ${item.color}`}>{item.label}</div>
              <div className={`text-sm font-semibold ${item.color}`}>
                {item.value}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default PremiumsDisplay
