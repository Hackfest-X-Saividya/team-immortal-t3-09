'use client'

import React, { useMemo, useState } from 'react'
import {
  Calendar,
  Cloud,
  Edit2,
  MoreHorizontal,
  Package,
  Plus,
  Recycle,
  Trash2,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { ModuleAiAdvisor } from '@/components/ai/ModuleAiAdvisor'
import { ModuleBarChart } from '@/components/charts/ModuleBarChart'
import { WasteRecordModal } from '@/components/dashboard/WasteRecordModal'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/Card'
import { Metric } from '@/components/ui/Metric'
import { MiniSpark } from '@/components/ui/MiniSpark'
import { PageTitle } from '@/components/ui/PageTitle'
import { Pill } from '@/components/ui/Pill'
import { ToastNotification } from '@/components/ui/ToastNotification'
import { useAuth } from '@/context/auth-context'
import {
  calculateWasteEmissions,
  calculateWasteRecoveryRate,
  EMISSION_FACTORS,
} from '@/lib/calculations'
import { aiAdvisorsService } from '@/services/ai-advisors.service'
import type { WasteData, WasteRecord } from '@/types/sustainability'

const INITIAL_WASTE_RECORDS: WasteRecord[] = [
  {
    id: 'w-1',
    date: '2026-10-28',
    category: 'Recyclable',
    quantityKg: 118,
    treatmentMethod: 'Recycling',
    buildingOrDepartment: 'Central Library & Admin',
    collectionProvider: 'CleanLoop Recyclers',
    disposalCostInr: 920,
    notes: 'Baled paper & plastic packaging',
    calculatedEmissionsKg: calculateWasteEmissions(118, 'Recycling'),
    status: 'Verified',
    createdAt: '2026-10-28T10:00:00.000Z',
  },
  {
    id: 'w-2',
    date: '2026-10-25',
    category: 'Biodegradable',
    quantityKg: 100,
    treatmentMethod: 'Composting',
    buildingOrDepartment: 'Student Dining Hall',
    collectionProvider: 'Campus Compost Facility',
    disposalCostInr: 450,
    notes: 'Kitchen peelings and cafeteria scraps',
    calculatedEmissionsKg: calculateWasteEmissions(100, 'Composting'),
    status: 'Verified',
    createdAt: '2026-10-25T10:00:00.000Z',
  },
  {
    id: 'w-3',
    date: '2026-10-20',
    category: 'General',
    quantityKg: 160,
    treatmentMethod: 'Landfill',
    buildingOrDepartment: 'Campus Facilities',
    collectionProvider: 'City Municipal Waste',
    disposalCostInr: 2100,
    notes: 'Mixed non-recyclable refuse',
    calculatedEmissionsKg: calculateWasteEmissions(160, 'Landfill'),
    status: 'Verified',
    createdAt: '2026-10-20T10:00:00.000Z',
  },
  {
    id: 'w-4',
    date: '2026-10-15',
    category: 'E-waste',
    quantityKg: 42,
    treatmentMethod: 'Recycling',
    buildingOrDepartment: 'Computer Labs & IT',
    collectionProvider: 'Certified E-Waste Corp',
    disposalCostInr: 790,
    notes: 'Decommissioned PC peripherals & cables',
    calculatedEmissionsKg: calculateWasteEmissions(42, 'Recycling'),
    status: 'Verified',
    createdAt: '2026-10-15T10:00:00.000Z',
  },
]

export function WasteView() {
  const { requestMutation } = useAuth()
  const [records, setRecords] = useState<WasteRecord[]>(INITIAL_WASTE_RECORDS)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<WasteRecord | null>(null)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Aggregated totals
  const totalGeneratedKg = useMemo(
    () => records.reduce((acc, r) => acc + r.quantityKg, 0),
    [records]
  )

  const totalRecoveredKg = useMemo(
    () =>
      records
        .filter((r) => r.treatmentMethod === 'Recycling' || r.treatmentMethod === 'Composting')
        .reduce((acc, r) => acc + r.quantityKg, 0),
    [records]
  )

  const recoveryRate = useMemo(
    () => calculateWasteRecoveryRate(totalRecoveredKg, totalGeneratedKg),
    [totalRecoveredKg, totalGeneratedKg]
  )

  const totalDisposalCostInr = useMemo(
    () => records.reduce((acc, r) => acc + (r.disposalCostInr || 0), 0),
    [records]
  )

  const totalNetEmissionsKg = useMemo(
    () => records.reduce((acc, r) => acc + r.calculatedEmissionsKg, 0),
    [records]
  )

  // Chart data
  const chartData: WasteData[] = useMemo(() => {
    return [
      { month: 'May', generated: 320, recycled: 108 },
      { month: 'Jun', generated: 350, recycled: 132 },
      { month: 'Jul', generated: 340, recycled: 148 },
      { month: 'Aug', generated: 390, recycled: 171 },
      { month: 'Sep', generated: 410, recycled: 195 },
      { month: 'Oct', generated: totalGeneratedKg, recycled: totalRecoveredKg },
    ]
  }, [totalGeneratedKg, totalRecoveredKg])

  // Category breakdown counts
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>()
    records.forEach((r) => map.set(r.category, (map.get(r.category) || 0) + r.quantityKg))
    return Array.from(map.entries()).map(([name, val]) => ({
      name,
      val,
      pct: totalGeneratedKg > 0 ? Math.round((val / totalGeneratedKg) * 100) : 0,
    }))
  }, [records, totalGeneratedKg])

  const handleOpenAddRecord = () => {
    if (!requestMutation('add waste records')) return
    setEditingRecord(null)
    setIsModalOpen(true)
  }

  const handleOpenEditRecord = (rec: WasteRecord) => {
    if (!requestMutation('edit waste records')) return
    setEditingRecord(rec)
    setIsModalOpen(true)
    setActiveMenuId(null)
  }

  const handleDeleteRecord = (id: string) => {
    if (!requestMutation('delete waste records')) return
    setRecords((prev) => prev.filter((r) => r.id !== id))
    setActiveMenuId(null)
    setToastMessage('Waste record removed from workspace.')
  }

  const handleSaveRecord = (
    data: Omit<WasteRecord, 'id' | 'createdAt'>,
    existingId?: string
  ) => {
    if (existingId) {
      setRecords((prev) =>
        prev.map((r) => (r.id === existingId ? { ...r, ...data } : r))
      )
      setToastMessage('Waste record updated successfully.')
    } else {
      const newRec: WasteRecord = {
        ...data,
        id: `w-${Date.now()}`,
        createdAt: new Date().toISOString(),
      }
      setRecords((prev) => [newRec, ...prev])
      setToastMessage('Waste entry added to your workspace.')
    }
  }

  return (
    <div className="space-y-6">
      <ToastNotification message={toastMessage} onClose={() => setToastMessage(null)} />

      <PageTitle
        eyebrow="CIRCULARITY MODULE"
        title="Waste management"
        description="Monitor solid waste generation, track composting and recycling recovery, and calculate material disposal emissions."
        action={
          <Button onClick={handleOpenAddRecord}>
            <Plus size={15} /> Add record
          </Button>
        }
      />

      {/* Top 4 Metrics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={Package}
          label="Total waste generated"
          value={totalGeneratedKg.toLocaleString()}
          unit="kg"
          trend={<MiniSpark />}
          note={`Across ${records.length} logged streams`}
          tone="amber"
        />
        <Metric
          icon={Recycle}
          label="Recycling / recovery rate"
          value={`${recoveryRate}%`}
          trend={<Pill tone="green">Healthy</Pill>}
          note={`${totalRecoveredKg.toLocaleString()} kg diverted from landfill`}
          tone="green"
        />
        <Metric
          icon={Cloud}
          label="Net waste emissions"
          value={Math.round(totalNetEmissionsKg).toLocaleString()}
          unit="kg CO₂e"
          trend={<span className="text-[11px] font-medium text-[#4B8A63]">Net balance</span>}
          note="Includes recycling avoidance credit"
          tone="olive"
        />
        <Metric
          icon={Wallet}
          label="Total disposal cost"
          value={`₹${totalDisposalCostInr.toLocaleString('en-IN')}`}
          trend={<Pill tone="sage">Recorded</Pill>}
          note="Municipal & vendor fees"
          tone="sage"
        />
      </div>

      {/* Main Charts Row */}
      <div className="grid gap-5 xl:grid-cols-[1.3fr_.7fr]">
        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-[#304739]">Waste Generation vs Recovery</h2>
              <p className="mt-0.5 text-xs text-[#8A978D]">Six-month trend in kg material</p>
            </div>
            <Pill tone="green">{recoveryRate}% Current Recovery</Pill>
          </div>

          <ModuleBarChart type="waste" electricityData={[]} wasteData={chartData} />

          <div className="mt-4 flex items-center gap-4 text-xs text-[#738478] border-t border-[#EEF2EC] pt-3">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#B6B86B]" />
              <span>Total Generated (kg)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#8DAE83]" />
              <span>Recovered & Recycled (kg)</span>
            </div>
          </div>
        </Card>

        {/* Stream Breakdown Card */}
        <Card className="p-5 sm:p-6">
          <h2 className="font-semibold text-[#304739]">Stream Breakdown</h2>
          <p className="mt-0.5 text-xs text-[#8A978D]">Distribution of logged material</p>

          <div className="mt-5 space-y-3.5">
            {categoryBreakdown.map((cat) => (
              <div key={cat.name} className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-[#445649]">{cat.name}</span>
                  <span className="text-[#78897D]">
                    {cat.val} kg ({cat.pct}%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#EEF2EB]">
                  <div
                    className="h-full rounded-full bg-[#285943]"
                    style={{ width: `${cat.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-[#DCE7DA] bg-[#F7FAF5] p-3 text-[11px] leading-5 text-[#5A6F60]">
            <span className="font-semibold text-[#285943]">Recovery Note:</span> Recyclable paper,
            plastics, and composted organics offset net emissions by avoiding methane generation in
            landfills.
          </div>
        </Card>
      </div>

      {/* Verified Waste Records Table */}
      <Card className="p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-[#304739]">Waste Stream Entries</h2>
            <p className="mt-0.5 text-xs text-[#8A978D]">
              Verified material receipts and disposal logs
            </p>
          </div>
          <Button variant="secondary" onClick={handleOpenAddRecord} className="text-xs">
            <Plus size={14} /> New waste entry
          </Button>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead className="border-b border-[#E8EEE6] text-[10px] uppercase tracking-[.12em] text-[#98A49A]">
              <tr>
                <th className="pb-3 font-medium">Date</th>
                <th className="pb-3 font-medium">Category</th>
                <th className="pb-3 font-medium">Quantity</th>
                <th className="pb-3 font-medium">Treatment Method</th>
                <th className="pb-3 font-medium">Facility / Dept</th>
                <th className="pb-3 font-medium">Disposal Cost</th>
                <th className="pb-3 font-medium">Emissions Impact</th>
                <th className="pb-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFF3EE] text-[#55675A]">
              {records.map((rec) => (
                <tr key={rec.id} className="hover:bg-[#FAFDF9]">
                  <td className="py-3 font-medium text-[#2F4436]">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={13} className="text-[#7A8E80]" />
                      <span>{rec.date}</span>
                    </div>
                  </td>
                  <td className="py-3 font-semibold text-[#304739]">{rec.category}</td>
                  <td className="py-3 font-bold text-[#285943]">{rec.quantityKg} kg</td>
                  <td className="py-3">
                    <Pill
                      tone={
                        rec.treatmentMethod === 'Recycling' || rec.treatmentMethod === 'Composting'
                          ? 'green'
                          : 'amber'
                      }
                    >
                      {rec.treatmentMethod || 'Unspecified'}
                    </Pill>
                  </td>
                  <td className="py-3">{rec.buildingOrDepartment || 'Main Workspace'}</td>
                  <td className="py-3">
                    {rec.disposalCostInr ? `₹${rec.disposalCostInr.toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td className="py-3 font-medium">
                    <span
                      className={
                        rec.calculatedEmissionsKg < 0
                          ? 'text-[#367954]'
                          : 'text-[#445649]'
                      }
                    >
                      {rec.calculatedEmissionsKg > 0 ? `+${rec.calculatedEmissionsKg}` : rec.calculatedEmissionsKg} kg CO₂e
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <div className="relative inline-block text-left">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveMenuId(activeMenuId === rec.id ? null : rec.id)
                        }
                        aria-label="Record options"
                        className="rounded-lg p-1 text-[#8A978D] hover:bg-[#EEF3EC] hover:text-[#285943] cursor-pointer"
                      >
                        <MoreHorizontal size={15} />
                      </button>

                      {activeMenuId === rec.id && (
                        <>
                          <div
                            className="fixed inset-0 z-20"
                            onClick={() => setActiveMenuId(null)}
                            aria-hidden="true"
                          />
                          <div className="absolute right-0 top-7 z-30 w-36 rounded-xl border border-[#E0E7DE] bg-white p-1.5 shadow-lg animate-in fade-in duration-100">
                            <button
                              type="button"
                              onClick={() => handleOpenEditRecord(rec)}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-[#526357] hover:bg-[#F3F7F1] cursor-pointer"
                            >
                              <Edit2 size={13} /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRecord(rec.id)}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-[#A35C49] hover:bg-[#FDF2F0] cursor-pointer"
                            >
                              <Trash2 size={13} /> Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* AI Waste Advisor Section */}
      <ModuleAiAdvisor
        title="AI Waste Advisor"
        subtitle="Understand your waste generation and discover opportunities to reduce disposal and emissions."
        suggestedQuestions={[
          'Which waste category contributes the most to our total waste?',
          'How can we improve our recycling rate?',
          'What practical steps could reduce organic waste?',
          'How can we improve waste segregation?',
        ]}
        onQuery={(q) => aiAdvisorsService.queryWasteAdvisor(q, records)}
        emptyStateDescription="Inquire about material segregation, landfill diversion, and organic composting opportunities. The advisor analyzes your active waste streams and calculates recovery benchmarks."
      />

      {/* Waste Record Modal */}
      <WasteRecordModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveRecord}
        initialRecord={editingRecord}
      />
    </div>
  )
}
