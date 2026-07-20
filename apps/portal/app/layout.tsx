import '../styles/globals.css'
import type { ReactNode } from 'react'

export const metadata = {
  title: 'Gleistrix – Subunternehmen-Portal',
  description: 'Projekte, Einsätze und Rechnungen für Subunternehmen',
  icons: {
    icon: ['/fivicon.png'],
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de" className="h-full" suppressHydrationWarning>
      <body className="h-full bg-slate-50 antialiased">{children}</body>
    </html>
  )
}
