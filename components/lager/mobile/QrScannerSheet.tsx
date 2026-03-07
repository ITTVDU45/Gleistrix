'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Camera, CameraOff } from 'lucide-react'

interface QrScannerSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onScanSuccess: (decodedText: string) => void
  closeOnScan?: boolean
}

export default function QrScannerSheet({ open, onOpenChange, onScanSuccess, closeOnScan = true }: QrScannerSheetProps) {
  const [error, setError] = useState('')
  const [isStarting, setIsStarting] = useState(false)
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null)
  const regionId = useMemo(() => `qr-reader-${Math.random().toString(36).slice(2, 10)}`, [])

  useEffect(() => {
    let cancelled = false

    async function startScanner() {
      if (!open) return
      setError('')
      setIsStarting(true)
      try {
        const scannerModule = await import('html5-qrcode')
        if (cancelled) return

        const scanner = new scannerModule.Html5Qrcode(regionId)
        scannerRef.current = scanner

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText: string) => {
            onScanSuccess(decodedText)
            if (closeOnScan) {
              onOpenChange(false)
            }
          },
          () => {}
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Kamera konnte nicht gestartet werden'
        setError(message)
      } finally {
        setIsStarting(false)
      }
    }

    async function stopScanner() {
      const activeScanner = scannerRef.current
      scannerRef.current = null
      if (!activeScanner) return
      try {
        await activeScanner.stop()
      } catch (_) {
        // ignore
      }
    }

    startScanner()
    if (!open) stopScanner()

    return () => {
      cancelled = true
      stopScanner()
    }
  }, [open, onOpenChange, onScanSuccess, regionId, closeOnScan])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl p-0">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            QR-Code scannen
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 px-4 pb-4">
          <div id={regionId} className="overflow-hidden rounded-xl border border-slate-200 bg-black/90" />
          {isStarting && (
            <p className="text-sm text-slate-500">Kamera wird gestartet...</p>
          )}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
          )}
          <Button variant="outline" className="h-12 w-full" onClick={() => onOpenChange(false)}>
            <CameraOff className="mr-2 h-4 w-4" />
            Scanner schliessen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
