"use client";
import React, { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import InvoiceEditor from '@/components/subunternehmen/InvoiceEditor'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

function NeueRechnungInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialProjectId = searchParams.get('projectId') || undefined

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/rechnungen')}
          className="mb-2 -ml-2 text-slate-500"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Rechnungen
        </Button>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">Neue Rechnung</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Aus bestätigten Leistungen oder mit freien Positionen – zunächst als Entwurf
        </p>
      </div>

      <InvoiceEditor
        initialProjectId={initialProjectId}
        onSaved={(invoice) => router.push(`/rechnungen/${invoice.id}`)}
        onCancel={() => router.push('/rechnungen')}
      />
    </div>
  )
}

export default function NeueRechnungPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}>
      <NeueRechnungInner />
    </Suspense>
  )
}
