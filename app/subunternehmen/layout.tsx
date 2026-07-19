import type { ReactNode } from 'react'
import PortalShell from '@/components/subunternehmen/PortalShell'

export const metadata = {
  title: 'Gleistrix – Subunternehmen-Portal',
}

export default function SubunternehmenLayout({ children }: { children: ReactNode }) {
  return <PortalShell>{children}</PortalShell>
}
