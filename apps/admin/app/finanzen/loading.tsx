import { Skeleton } from '@/components/ui/skeleton'

export default function FinanceLoading() {
  return <div className="space-y-6 p-4 sm:p-6"><div className="space-y-2"><Skeleton className="h-9 w-52"/><Skeleton className="h-4 w-96 max-w-full"/></div><Skeleton className="h-20 w-full"/><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({length:8},(_,index)=><Skeleton key={index} className="h-28"/>)}</div><div className="grid gap-4 xl:grid-cols-2"><Skeleton className="h-80"/><Skeleton className="h-80"/></div></div>
}
