"use client";
import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Send, FileText, Building2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import styles from './PortalPromoBanner.module.css'

/**
 * Animierter Eyecatcher: Projekt → Leistungen prüfen → Rechnung → digital
 * einreichen. Reine CSS-Keyframes (compositor-freundlich), pausiert außerhalb
 * des Viewports und respektiert prefers-reduced-motion.
 */
export default function PortalPromoBanner() {
  const rootRef = useRef<HTMLDivElement>(null)
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setIsPaused(!entry.isIntersecting)
        }
      },
      { threshold: 0.15 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      ref={rootRef}
      aria-label="Rechnungen digital einreichen"
      className={`${styles.banner} ${isPaused ? styles.paused : ''}`}
    >
      <div className={styles.inner}>
        {/* Textbereich */}
        <div className="space-y-4">
          <p className="inline-flex items-center gap-2 rounded-full bg-blue-100/70 dark:bg-blue-900/40 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
            <FileText className="h-3.5 w-3.5" />
            Digitale Abrechnung
          </p>
          <h2 className="text-xl md:text-2xl font-bold leading-snug text-slate-900 dark:text-white">
            Leistungen prüfen.
            <br />
            Rechnung erstellen.
            <br />
            Digital einreichen.
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-sm">
            Übernehmen Sie bestätigte Einsätze und Zuschläge direkt aus Ihren Projekten in
            eine Rechnung – und verfolgen Sie den Status bis zur Freigabe.
          </p>
          <Button
            asChild
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <Link href="/rechnungen/neu">
              <Send className="h-4 w-4 mr-2" />
              Rechnung erstellen
            </Link>
          </Button>
        </div>

        {/* Animations-Bühne */}
        <div className={styles.stage} aria-hidden="true">
          {/* Projektkarte */}
          <div className={`${styles.card} ${styles.projectCard}`}>
            <div className={styles.cardHeader}>
              <Building2 className="h-3.5 w-3.5 text-blue-600" />
              Projekt A-1042
            </div>
            <div className={`${styles.row} ${styles.assignRow1}`}>
              <span className={styles.check}>
                <Check className="h-2.5 w-2.5" />
              </span>
              <span>3× SIPO · 8,0 h</span>
              <span className={styles.rowBar} />
            </div>
            <div className={`${styles.row} ${styles.assignRow2}`}>
              <span className={styles.check}>
                <Check className="h-2.5 w-2.5" />
              </span>
              <span>2× HFE · 10,0 h</span>
              <span className={styles.rowBar} />
            </div>
            <div style={{ height: '0.5rem' }} />
          </div>

          {/* Flugbahn + Papierflieger */}
          <div className={styles.flight} />
          <div className={styles.plane}>
            <Send className="h-4 w-4" />
          </div>

          {/* Rechnungskarte */}
          <div className={`${styles.card} ${styles.invoiceCard}`}>
            <div className={styles.cardHeader}>
              <FileText className="h-3.5 w-3.5 text-blue-600" />
              Rechnung RE-2026-0042
            </div>
            <div className={`${styles.row} ${styles.lineItem1}`}>
              <span>24,0 h Sicherungsposten</span>
              <span className={styles.rowBar} />
            </div>
            <div className={`${styles.row} ${styles.lineItem2}`}>
              <span>20,0 h HFE</span>
              <span className={styles.rowBar} />
            </div>
            <div className={`${styles.row} ${styles.surchargeRow}`}>
              <span>+ Nacht- & Sonntagszuschläge</span>
            </div>
            <div className={styles.totalRow}>
              <span>Gesamt</span>
              <span>3.487,40 €</span>
            </div>
          </div>

          {/* Status-Ablauf */}
          <div className={styles.statusChips}>
            <span className={`${styles.chip} ${styles.chipSubmitted}`}>Eingereicht</span>
            <span className={`${styles.chip} ${styles.chipReview}`}>In Prüfung</span>
            <span className={`${styles.chip} ${styles.chipApproved}`}>Freigegeben</span>
          </div>
        </div>
      </div>
    </section>
  )
}
