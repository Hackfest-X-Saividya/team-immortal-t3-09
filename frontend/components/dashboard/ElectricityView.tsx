'use client'

import React, { useMemo, useState } from 'react'
import {
  Calendar,
  Cloud,
  Edit2,
  FileText,
  MoreHorizontal,
  Plus,
  Trash2,
  Wallet,
  Zap,
} from 'lucide-react'
import { ModuleAiAdvisor } from '@/components/ai/ModuleAiAdvisor'
import { ModuleBarChart } from '@/components/charts/ModuleBarChart'
import { ElectricityRecordModal } from '@/components/dashboard/ElectricityRecordModal'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/Card'
import { Metric } from '@/components/ui/Metric'
import { MiniSpark } from '@/components/ui/MiniSpark'
import { PageTitle } from '@/components/ui/PageTitle'
import { Pill } from '@/components/ui/Pill'
import { ToastNotification } from '@/components/ui/ToastNotification'
import { useAuth } from '@/context/auth-context'
import {
  calculateElectricityEmissions,
  calculateElectricitySavingsScenario,
  EMISSION_FACTORS,
} from '@/lib/calculations'
import { aiAdvisorsService } from '@/services/ai-advisors.service'
import type { ElectricityData, ElectricityRecord } from '@/types/sustainability'

const INITIAL_ELECTRICITY_RECORDS: ElectricityRecord[] = [
  {
    id: 'el-1',
    reportingMonth: '2026-10',
    consumptionKwh: 1240,
    billAmountInr: 10540,
    buildingOrDepartment: 'Main Academic Wing',
    notes: 'October final meter log',
    calculatedEmissionsKg: calculateElectricityEmissions(1240),
    emissionFactorUsed: EMISSION_FACTORS.electricityGrid,
    factorType: 'illustrative_grid_factor',
    createdAt: '2026-10-28T09:00:00.000Z',
  },
  {
    id: 'el-2',
    reportingMonth: '2026-09',
    consumptionKwh: 1190,
    billAmountInr: 10115,
    buildingOrDepartment: 'Science Complex',
    notes: 'HVAC end-of-quarter inspection',
    calculatedEmissionsKg: calculateElectricityEmissions(1190),
    emissionFactorUsed: EMISSION_FACTORS.electricityGrid,
    factorType: 'illustrative_grid_factor',
    createdAt: '2026-09-30T09:00:00.000Z',
  },
  {
    id: 'el-3',
    reportingMonth: '2026-08',
    consumptionKwh: 1160,
    billAmountInr: 9860,
    buildingOrDepartment: 'Administrative Block',
    notes: 'Monsoon cooling adjustment',
    calculatedEmissionsKg: calculateElectricityEmissions(1160),
    emissionFactorUsed: EMISSION_FACTORS.electricityGrid,
    factorType: 'illustrative_grid_factor',
    createdAt: '2026-08-31T09:00:00.000Z',
  },
  {
    id: 'el-4',
    reportingMonth: '2026-07',
    consumptionKwh: 1020,
    billAmountInr: 8670,
    buildingOrDepartment: 'Hostels & Mess',
    notes: 'Mid-term operational log',
    calculatedEmissionsKg: calculateElectricityEmissions(1020),
    emissionFactorUsed: EMISSION_FACTORS.electricityGrid,
    factorType: 'illustrative_grid_factor',
    createdAt: '2026-07-31T09:00:00.000Z',
  },
  {
    id: 'el-5',
    reportingMonth: '2026-06',
    consumptionKwh: 1080,
    billAmountInr: 9180,
    buildingOrDepartment: 'Main Academic Wing',
    notes: 'Summer exam session',
    calculatedEmissionsKg: calculateElectricityEmissions(1080),
    emissionFactorUsed: EMISSION_FACTORS.electricityGrid,
    factorType: 'illustrative_grid_factor',
    createdAt: '2026-06-30T09:00:00.000Z',
  },
  {
    id: 'el-6',
    reportingMonth: '2026-05',
    consumptionKwh: 980,
    billAmountInr: 8330,
    buildingOrDepartment: 'Library & Labs',
    notes: 'Semester close down',
    calculatedEmissionsKg: calculateElectricityEmissions(980),
    emissionFactorUsed: EMISSION_FACTORS.electricityGrid,
    factorType: 'illustrative_grid_factor',
    createdAt: '2026-05-31T09:00:00.000Z',
  },
]

export function ElectricityView() {
  const { requestMutation } = useAuth()
  const [records, setRecords] = useState<ElectricityRecord[]>(INITIAL_ELECTRICITY_RECORDS)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<ElectricityRecord | null>(null)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Derived metrics from actual active records
  const totalConsumptionKwh = useMemo(
    () => records.reduce((acc, r) => acc + r.consumptionKwh, 0),
    [records]
  )

  const totalBillInr = useMemo(
    () => records.reduce((acc, r) => acc + (r.billAmountInr || 0), 0),
    [records]
  )

  const totalEmissionsKg = useMemo(
    () => records.reduce((acc, r) => acc + r.calculatedEmissionsKg, 0),
    [records]
  )

  // Modeled 15% reduction savings on latest month
  const latestRecord = records[0]
  const savingsScenario = useMemo(
    () =>
      latestRecord
        ? calculateElectricitySavingsScenario(latestRecord.consumptionKwh, 15)
        : { costSavings: 0, kwhReduction: 0, emissionsReduction: 0 },
    [latestRecord]
  )

  // Transform records into chart data format
  const chartData: ElectricityData[] = useMemo(() => {
    return [...records]
      .reverse()
      .map((r) => {
        const dateObj = new Date(`${r.reportingMonth}-01`)
        const monthLabel = dateObj.toLocaleDateString('en-US', { month: 'short' })
        return {
          month: monthLabel,
          usage: r.consumptionKwh,
          cost: r.billAmountInr || 0,
        }
      })
  }, [records])

  const handleOpenAddModal = () => {
    if (!requestMutation('add electricity records')) return
    setEditingRecord(null)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (rec: ElectricityRecord) => {
    if (!requestMutation('edit electricity records')) return
    setEditingRecord(rec)
    setIsModalOpen(true)
    setActiveMenuId(null)
  }

  const handleDeleteRecord = (id: string) => {
    if (!requestMutation('delete electricity records')) return
    setRecords((prev) => prev.filter((r) => r.id !== id))
    setActiveMenuId(null)
    setToastMessage('Electricity record removed from workspace.')
  }

  const handleSaveRecord = (
    data: Omit<ElectricityRecord, 'id' | 'createdAt'>,
    existingId?: string
  ) => {
    if (existingId) {
      setRecords((prev) =>
        prev.map((r) =>
          r.id === existingId
            ? {
                ...r,
                ...data,
              }
            : r
        )
      )
      setToastMessage('Electricity record updated successfully.')
    } else {
      const newRec: ElectricityRecord = {
        ...data,
        id: `el-${Date.now()}`,
        createdAt: new Date().toISOString(),
      }
      setRecords((prev) => [newRec, ...prev])
      setToastMessage('Electricity record added to your active workspace.')
    }
  }

  return (
    <div className="space-y-6">
      <ToastNotification message={toastMessage} onClose={() => setToastMessage(null)} />

      <PageTitle
        eyebrow="ENERGY MODULE"
        title="Electricity management"
        description="Track kilowatt-hour consumption, calculate emissions from verified meter records, and uncover efficiency gains."
        action={
          <Button onClick={handleOpenAddModal}>
            <Plus size={15} /> Add record
          </Button>
        }
      />

      {/* Top 4 Metrics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={Zap}
          label="Total consumption"
          value={totalConsumptionKwh.toLocaleString()}
          unit="kWh"
          trend={<MiniSpark up />}
          note={`Across ${records.length} logged periods`}
          tone="green"
        />
        <Metric
          icon={Wallet}
          label="Estimated electricity bill"
          value={`₹${totalBillInr.toLocaleString('en-IN')}`}
          trend={<Pill tone="sage">Recorded</Pill>}
          note="Actual meter billings"
          tone="sage"
        />
        <Metric
          icon={Cloud}
          label="Calculated emissions"
          value={Math.round(totalEmissionsKg).toLocaleString()}
          unit="kg CO₂e"
          trend={<span className="text-[11px] font-medium text-[#4B8A63]">0.82 kg/kWh</span>}
          note="Illustrative Indian grid factor"
          tone="olive"
        />
        <Metric
          icon={Zap}
          label="15% reduction opportunity"
          value={`₹${savingsScenario.costSavings.toLocaleString('en-IN')}`}
          unit="/mo"
          trend={<Pill>Modeled</Pill>}
          note={`-${savingsScenario.kwhReduction} kWh monthly potential`}
          tone="amber"
        />
      </div>

      {/* Main Chart Card */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-[#304739]">Electricity Consumption Trend</h2>
            <p className="mt-0.5 text-xs text-[#8A978D]">
              Monthly kilowatt-hours based on active workspace entries
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg border border-[#E0E7DE] bg-white px-2.5 py-1 text-xs text-[#627367]">
              {records.length} logged months
            </span>
          </div>
        </div>

        <ModuleBarChart type="electricity" electricityData={chartData} wasteData={[]} />

        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-[#738478] border-t border-[#EEF2EC] pt-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#8DAE83]" />
            <span>Monthly consumption (kWh)</span>
          </div>
          <span className="text-[#9BAAA0]">·</span>
          <span>Latest period: {latestRecord ? `${latestRecord.consumptionKwh} kWh` : 'None'}</span>
        </div>
      </Card>

      {/* Verified Records Table Card */}
      <Card className="p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-[#304739]">Electricity Records</h2>
            <p className="mt-0.5 text-xs text-[#8A978D]">
              Manage kilowatt-hour entries and emission values
            </p>
          </div>
          <Button variant="secondary" onClick={handleOpenAddModal} className="text-xs">
            <Plus size={14} /> New entry
          </Button>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-xs">
            <thead className="border-b border-[#E8EEE6] text-[10px] uppercase tracking-[.12em] text-[#98A49A]">
              <tr>
                <th className="pb-3 font-medium">Month</th>
                <th className="pb-3 font-medium">Department / Facility</th>
                <th className="pb-3 font-medium">Consumption</th>
                <th className="pb-3 font-medium">Bill Amount</th>
                <th className="pb-3 font-medium">Calculated Emissions</th>
                <th className="pb-3 font-medium">Method</th>
                <th className="pb-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFF3EE] text-[#55675A]">
              {records.map((rec) => (
                <tr key={rec.id} className="hover:bg-[#FAFDF9]">
                  <td className="py-3 font-medium text-[#2F4436]">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={13} className="text-[#7A8E80]" />
                      <span>{rec.reportingMonth}</span>
                    </div>
                  </td>
                  <td className="py-3">{rec.buildingOrDepartment || 'Main Workspace'}</td>
                  <td className="py-3 font-semibold text-[#285943]">
                    {rec.consumptionKwh.toLocaleString()} kWh
                  </td>
                  <td className="py-3">
                    {rec.billAmountInr ? `₹${rec.billAmountInr.toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td className="py-3 font-medium text-[#3A5243]">
                    {rec.calculatedEmissionsKg.toLocaleString()} kg CO₂e
                  </td>
                  <td className="py-3">
                    <Pill tone="sage">0.82 kg/kWh</Pill>
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
                              onClick={() => handleOpenEditModal(rec)}
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

      {/* AI Electricity Advisor Section */}
      <ModuleAiAdvisor
        title="AI Electricity Advisor"
        subtitle="Understand your energy consumption and discover opportunities to reduce electricity costs and emissions."
        suggestedQuestions={[
          'How much can I save by reducing electricity usage by 15%?',
          'Which month had the highest electricity consumption?',
          'Compare this month with the previous month.',
          'Which buildings or departments consume the most electricity?',
          'What actions can reduce my electricity emissions?',
          'Why is my electricity consumption increasing?',
        ]}
        onQuery={(q) => aiAdvisorsService.queryElectricityAdvisor(q, records)}
        emptyStateDescription="Ask any question regarding your kilowatt-hour trends, seasonal peaks, tariff assumptions, or reduction scenarios. Calculations are performed live against your active records."
      />

      {/* Modal Dialog */}
      <ElectricityRecordModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveRecord}
        initialRecord={editingRecord}
      />
    </div>
  )
}
