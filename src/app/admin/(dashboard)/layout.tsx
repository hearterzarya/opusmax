import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/auth'
import { ToastProvider } from '@/components/ui/toast'
import AdminLayoutClient from './AdminLayoutClient'

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getAdminSession()

  if (!session) {
    redirect('/admin/login')
  }

  return (
    <ToastProvider>
      <AdminLayoutClient>{children}</AdminLayoutClient>
    </ToastProvider>
  )
}
