'use client'

import type { GaebBillOfQuantities } from '@/types/gaeb'

interface GaebBoqPreviewProps {
  boq: GaebBillOfQuantities
}

function formatMoney(value: number | undefined, currency: string): string {
  if (value === undefined || value === null) return '–'
  return value.toLocaleString('de-DE', { style: 'currency', currency: currency || 'EUR' })
}

function formatQty(value?: number): string {
  return value === undefined || value === null ? '' : value.toLocaleString('de-DE', { maximumFractionDigits: 3 })
}

export default function GaebBoqPreview({ boq }: GaebBoqPreviewProps) {
  return (
    <div className="space-y-4">
      {/* Kopf */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Version / Phase" value={`${boq.version}${boq.phase ? ` · ${boq.phase}` : ''}`} />
        <Kpi label="Positionen" value={String(boq.positionCount)} />
        <Kpi label="Lose / Titel" value={`${boq.lots.length} / ${boq.lots.reduce((s, l) => s + l.titles.length, 0)}`} />
        <Kpi label="Nettosumme" value={formatMoney(boq.netSum, boq.currency)} />
      </div>

      {boq.projectName && (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          <span className="font-medium">Projekt:</span> {boq.projectName}
        </p>
      )}

      {/* Lose → Titel → Positionen */}
      <div className="space-y-4">
        {boq.lots.map((lot, li) => (
          <div key={li} className="rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100">
              {lot.label}
            </div>
            {lot.titles.map((title, ti) => (
              <div key={ti}>
                <div className="px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {title.label} · {title.positions.length} Positionen
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                        <th className="px-4 py-1 font-medium">OZ</th>
                        <th className="px-4 py-1 font-medium">Kurztext</th>
                        <th className="px-4 py-1 text-right font-medium">Menge</th>
                        <th className="px-4 py-1 font-medium">Einheit</th>
                        <th className="px-4 py-1 text-right font-medium">EP</th>
                        <th className="px-4 py-1 text-right font-medium">GP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700/60">
                      {title.positions.slice(0, 200).map((pos, pi) => (
                        <tr key={pi}>
                          <td className="px-4 py-1.5 font-mono text-xs text-slate-500">{pos.ordinalNumber}</td>
                          <td className="px-4 py-1.5 text-slate-800 dark:text-slate-100" title={pos.longText}>
                            {pos.shortText}
                          </td>
                          <td className="px-4 py-1.5 text-right tabular-nums">{formatQty(pos.quantity)}</td>
                          <td className="px-4 py-1.5 text-slate-600 dark:text-slate-300">{pos.unit ?? ''}</td>
                          <td className="px-4 py-1.5 text-right tabular-nums">
                            {pos.price?.unitPrice !== undefined ? formatMoney(pos.price.unitPrice, boq.currency) : ''}
                          </td>
                          <td className="px-4 py-1.5 text-right tabular-nums">
                            {pos.price?.totalPrice !== undefined ? formatMoney(pos.price.totalPrice, boq.currency) : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {title.positions.length > 200 && (
                    <p className="px-4 py-2 text-xs text-slate-400">
                      … {title.positions.length - 200} weitere Positionen (Vorschau begrenzt)
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  )
}
