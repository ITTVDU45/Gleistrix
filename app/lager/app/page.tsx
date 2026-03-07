import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'
import LagerMobileApp from '@/components/lager/mobile/LagerMobileApp'

export default async function LagerAppPage() {
  const headersList = await headers()
  const req = new NextRequest(new URL('/lager/app', process.env.NEXTAUTH_URL ?? 'http://localhost:3000'), {
    headers: headersList
  })
  const user = await getCurrentUser(req)
  if (!user) redirect('/login')
  if (user.role !== 'lager') redirect('/dashboard')

  return <LagerMobileApp />
}
