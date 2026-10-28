'use client'

import React, { useState } from 'react'
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar'
import { DashboardTopbar } from '@/components/dashboard/DashboardTopbar'
import { DemoAccessModal } from '@/components/ui/DemoAccessModal'
import { useAuth } from '@/context/auth-context'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const { isAccessModalOpen, closeAccessModal, accessModalMessage } = useAuth()

  return (
    <div className="flex min-h-screen bg-[#F7F8F2] text-[#28352D]">
      <DashboardSidebar
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      <div className="min-w-0 flex-1 flex flex-col">
        <DashboardTopbar onOpenMobile={() => setIsMobileOpen(true)} />

        <main className="mx-auto w-full max-w-[1380px] p-5 sm:p-8 flex-1">
          {children}
        </main>
      </div>

      <DemoAccessModal
        isOpen={isAccessModalOpen}
        onClose={closeAccessModal}
        customMessage={accessModalMessage}
      />
    </div>
  )
}
