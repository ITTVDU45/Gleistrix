import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'
import FinancePageClient from './FinancePageClient'

export default async function FinancePage() {
  const headerList = await headers()
  const request = new NextRequest(new URL('/finanzen', process.env.NEXTAUTH_URL || 'http://localhost:3000'), { headers: headerList })
  const user = await getCurrentUser(request)
  if (!user) redirect('/login')
  if (user.role !== 'superadmin') redirect('/dashboard')
  return <FinancePageClient />
}
