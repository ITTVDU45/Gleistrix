import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'
import LagerClient from './LagerClient'

export default async function LagerPage() {
  const headersList = await headers()
  const req = new NextRequest(new URL('/lager', process.env.NEXTAUTH_URL ?? 'http://localhost:3000'), {
    headers: headersList
  })
  const user = await getCurrentUser(req)
  if (!user) redirect('/login')
  if (user.role !== 'superadmin') redirect('/dashboard')

  return (
    <div className="space-y-6">
      <LagerClient />
    </div>
  )
}
