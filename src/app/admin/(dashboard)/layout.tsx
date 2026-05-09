import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/auth'
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

  return <AdminLayoutClient>{children}</AdminLayoutClient>
}
