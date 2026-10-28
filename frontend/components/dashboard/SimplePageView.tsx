'use client'

import React from 'react'
import { BarChart3, FileText, Shield, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/Card'
import { PageTitle } from '@/components/ui/PageTitle'
import { Pill } from '@/components/ui/Pill'
import { useAuth } from '@/context/auth-context'

export interface SimplePageViewProps {
  view: 'progress' | 'reports' | 'settings'
}

export function SimplePageView({ view }: SimplePageViewProps) {
  const { session, user, requestMutation } = useAuth()

  const handleExportCsv = () => {
    if (!requestMutation('export CSV reports')) {
      return
    }
    alert('Sustainability report exported as CSV.')
  }

  const eyebrow =
    view === 'progress' ? 'LOOKING BACK' : 'YOUR WORKSPACE'

  const title =
    view === 'progress'
      ? 'Progress tracking'
      : view === 'reports'
        ? 'Reports & exports'
        : 'Workspace settings'

  const description =
    view === 'progress'
      ? 'Compare your resource trends and keep a record of the interventions that matter.'
      : view === 'reports'
        ? 'Create a clear, demo-ready summary of your sustainability performance.'
        : 'Manage your profile and preferences for this workspace session.'

  const action =
    view === 'reports' ? (
      <Button onClick={handleExportCsv}>
        <FileText size={15} /> Export CSV
      </Button>
    ) : undefined

  return (
    <div className="space-y-6">
      <PageTitle eyebrow={eyebrow} title={title} description={description} action={action} />

      {view === 'settings' && (
        <Card className="p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-[#EDF1EB] pb-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#E7F1E5] text-[#285943]">
                <User size={18} />
              </span>
              <div>
                <h2 className="font-semibold text-[#405448]">Active Profile Details</h2>
                <p className="mt-0.5 text-xs text-[#8A978D]">
                  Centrally synchronized across all CarbonIQ dashboard pages.
                </p>
              </div>
            </div>
            <Pill tone={session.isAuthenticated ? 'green' : 'amber'}>
              {session.isAuthenticated ? 'Authenticated Account' : 'Demo Mode'}
            </Pill>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-[#F6F8F4] p-4">
              <p className="text-xs text-[#8A978D]">Full Name</p>
              <p className="mt-1.5 text-sm font-semibold text-[#2F4436] truncate">{user.name}</p>
              <p className="mt-1 text-[11px] text-[#7D8A80]">ID: {user.id}</p>
            </div>

            <div className="rounded-xl bg-[#F6F8F4] p-4">
              <p className="text-xs text-[#8A978D]">Email Address</p>
              <p className="mt-1.5 text-sm font-semibold text-[#2F4436] truncate">{user.email}</p>
              <p className="mt-1 text-[11px] text-[#7D8A80]">
                {session.isAuthenticated ? 'Session active' : 'Demo contact'}
              </p>
            </div>

            <div className="rounded-xl bg-[#F6F8F4] p-4">
              <p className="text-xs text-[#8A978D]">Workspace Name</p>
              <p className="mt-1.5 text-sm font-semibold text-[#285943] truncate">
                {user.workspaceName || 'Sustainability Workspace'}
              </p>
              <p className="mt-1 text-[11px] text-[#7D8A80]">Fixed workspace</p>
            </div>

            <div className="rounded-xl bg-[#F6F8F4] p-4">
              <p className="text-xs text-[#8A978D]">Account Status</p>
              <p className="mt-1.5 text-sm font-semibold text-[#2F4436]">
                {session.isAuthenticated ? 'Active Workspace' : 'Read-only Demo'}
              </p>
              <p className="mt-1 text-[11px] text-[#7D8A80]">
                {session.isAuthenticated ? 'Verified account' : 'Public sandbox'}
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-6">
        <div className="grid gap-5 sm:grid-cols-3">
          {[
            ['This month', '2,480 kg', 'Estimated emissions'],
            ['Goal progress', '34%', 'Reduction target'],
            ['Interventions', '08', 'Recorded in demo'],
          ].map(([r0, r1, r2]) => (
            <div key={r0} className="rounded-xl bg-[#F6F8F4] p-4">
              <p className="text-xs text-[#8A978D]">{r0}</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-.04em] text-[#2F4436]">{r1}</p>
              <p className="mt-1 text-[11px] text-[#7D8A80]">{r2}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-dashed border-[#C8D8C5] bg-[#FAFCF8] p-10 text-center">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[#E7F1E5] text-[#285943]">
            {view === 'settings' ? <Shield size={20} /> : <BarChart3 size={20} />}
          </span>
          <h2 className="mt-4 font-semibold text-[#405448]">
            {view === 'settings'
              ? 'Security & Storage Preferences'
              : 'Your demo history is taking shape'}
          </h2>
          <p className="mx-auto mt-2 max-w-[420px] text-sm leading-6 text-[#829087]">
            {view === 'settings'
              ? 'Client-side profile preferences are stored locally without sensitive credentials. All passwords and tokens remain strictly guarded.'
              : 'Add more records in each resource module to build a richer historical view.'}
          </p>
        </div>
      </Card>
    </div>
  )
}
