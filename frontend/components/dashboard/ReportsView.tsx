'use client'

import React, { useState } from 'react'
import {
  ArrowDownRight,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Filter,
  Layers,
  Leaf,
  Recycle,
  Sparkles,
  Target,
  Truck,
  Zap,
} from 'lucide-react'
import { EmissionsLineChart } from '@/components/charts/EmissionsLineChart'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/Card'
import { PageTitle } from '@/components/ui/PageTitle'
import { Pill } from '@/components/ui/Pill'
import { useAuth } from '@/context/auth-context'
import {
  DEFAULT_ELECTRICITY_DATA,
  DEFAULT_MONTHLY_EMISSIONS,
  DEFAULT_WASTE_DATA,
} from '@/lib/constants'

export interface InterventionItem {
  id: string
  title: string
  category: 'Electricity' | 'Transportation' | 'Waste'
  dateRecorded: string
  expectedReductionKg: number
  actualReductionKg?: number
  costSavingsInr: number
  status: 'implemented' | 'in_planning' | 'proposed'
  savingsType: 'achieved' | 'projected' | 'estimated'
  description: string
  baselineMetric: string
  postMetric: string
}

const ALL_INTERVENTIONS: InterventionItem[] = [
  {
    id: 'intv-1',
    title: 'Switch common-area fixtures to Smart LEDs',
    category: 'Electricity',
    dateRecorded: 'Oct 12, 2026',
    expectedReductionKg: 152.5,
    actualReductionKg: 148.0,
    costSavingsInr: 1581,
    status: 'implemented',
    savingsType: 'achieved',
    description: 'Replaced 120 fluorescent ballast fixtures with sensor-controlled LED arrays.',
    baselineMetric: '1,240 kWh / mo',
    postMetric: '1,054 kWh / mo (-15%)',
  },
  {
    id: 'intv-2',
    title: 'Consolidate low-occupancy routes (Route 2 & 4)',
    category: 'Transportation',
    dateRecorded: 'Oct 18, 2026',
    expectedReductionKg: 93.8,
    actualReductionKg: undefined,
    costSavingsInr: 3307,
    status: 'in_planning',
    savingsType: 'projected',
    description: 'Shared-stop consolidation proposal saving 35 km/day with 38/40 passenger load.',
    baselineMetric: '250 km / day (50L Diesel)',
    postMetric: '215 km / day (-35 km/day)',
  },
  {
    id: 'intv-3',
    title: 'Install 3-stream source separation waste stations',
    category: 'Waste',
    dateRecorded: 'Oct 21, 2026',
    expectedReductionKg: 45.0,
    actualReductionKg: 48.2,
    costSavingsInr: 820,
    status: 'implemented',
    savingsType: 'achieved',
    description: 'Added organic composting and verified clean dry recyclables bins.',
    baselineMetric: '420 kg total / 218 kg recycled (52%)',
    postMetric: '350 kg total / 245 kg recycled (70%)',
  },
  {
    id: 'intv-4',
    title: 'Nighttime HVAC setbacks & chiller scheduling',
    category: 'Electricity',
    dateRecorded: 'Oct 24, 2026',
    expectedReductionKg: 110.0,
    actualReductionKg: undefined,
    costSavingsInr: 1140,
    status: 'in_planning',
    savingsType: 'projected',
    description: 'Automated 11 PM to 6 AM cooling setback across main administration zones.',
    baselineMetric: 'Off-hours idle 14 kW load',
    postMetric: 'Estimated 4.5 kW idle load (-68%)',
  },
  {
    id: 'intv-5',
    title: 'Biodegradable campus cafeteria packaging shift',
    category: 'Waste',
    dateRecorded: 'Oct 26, 2026',
    expectedReductionKg: 35.0,
    actualReductionKg: undefined,
    costSavingsInr: 450,
    status: 'proposed',
    savingsType: 'estimated',
    description: 'Replacing single-use plastic takeaway containers with bagasse compostables.',
    baselineMetric: '85 kg single-use packaging / mo',
    postMetric: '0 kg plastic to landfill',
  },
  {
    id: 'intv-6',
    title: 'Fleet tyre pressure and eco-driving calibration',
    category: 'Transportation',
    dateRecorded: 'Oct 27, 2026',
    expectedReductionKg: 42.0,
    actualReductionKg: undefined,
    costSavingsInr: 1480,
    status: 'proposed',
    savingsType: 'estimated',
    description: 'Monthly tyre maintenance protocol to improve average fleet efficiency from 4.8 to 5.4 km/L.',
    baselineMetric: '4.8 km / L fuel economy',
    postMetric: '5.4 km / L projected (+12%)',
  },
]

export function ReportsView() {
  const { session, user, requestMutation } = useAuth()
  const [selectedInterventionId, setSelectedInterventionId] = useState<string>('intv-1')
  const [categoryFilter, setCategoryFilter] = useState<'All' | 'Electricity' | 'Transportation' | 'Waste'>('All')

  const isIndividual = user.accountType === 'individual'

  // Filter interventions based on account permissions & category filter
  const availableInterventions = ALL_INTERVENTIONS.filter((intv) => {
    if (isIndividual && intv.category === 'Transportation') {
      return false
    }
    if (categoryFilter === 'All') return true
    return intv.category === categoryFilter
  })

  const selectedIntervention =
    availableInterventions.find((i) => i.id === selectedInterventionId) || availableInterventions[0]

  // CSV Export Generator
  const handleExportCsv = () => {
    if (!requestMutation('export audit-ready CSV reports')) {
      return
    }

    const rows: string[] = []
    const quote = (val: any) => `"${String(val).replace(/"/g, '""')}"`

    // Header metadata
    rows.push('CARBONIQ SUSTAINABILITY PERFORMANCE & AUDIT REPORT')
    rows.push(`Workspace,${quote(user.workspaceName || 'Sustainability Workspace')}`)
    rows.push(`Account Type,${quote(user.accountType || 'individual')}`)
    rows.push(`Reporting Period,2026-YTD`)
    rows.push(`Generated On,${quote(new Date().toISOString())}`)
    rows.push('')

    // Executive Summary
    rows.push('--- EXECUTIVE SUSTAINABILITY SUMMARY ---')
    rows.push('Metric,Value,Unit,Notes')
    rows.push('Total Estimated Emissions,2480,kg CO2e,October 2026 period')
    rows.push('Emissions Reduction Target,50,%,Long-term commitment')
    rows.push('Goal Progress Achieved,34,%,On track towards 2026-12 milestone')
    rows.push(`Recorded Interventions,${availableInterventions.length},count,Active and planned measures`)
    rows.push('')

    // Category Summary
    rows.push('--- RESOURCE CONSUMPTION & EMISSIONS BREAKDOWN ---')
    rows.push('Category,Consumption / Quantity,Calculated Emissions (kg CO2e),Estimated Cost (INR),Baseline Factor Used')
    rows.push('Electricity,1240 kWh,1016.8,14500,0.82 kg CO2e/kWh (CEA Grid baseline)')
    if (!isIndividual) {
      rows.push('Transportation,148 L Diesel (580 km),396.6,18500,2.68 kg CO2e/L (Diesel Standard)')
    }
    rows.push('Waste Management,420 kg (218 kg recycled),185.0,-,1.25 kg CO2e/kg landfill; -0.45 kg/kg recycling credit')
    rows.push('')

    // Historical Monthly Data
    rows.push('--- HISTORICAL MONTHLY PERFORMANCE (2026) ---')
    rows.push('Month,Total Emissions (kg CO2e),Electricity (kWh),Electricity Cost (INR),Waste Generated (kg),Waste Recycled (kg)')
    DEFAULT_MONTHLY_EMISSIONS.forEach((m, idx) => {
      const elec = DEFAULT_ELECTRICITY_DATA[idx] || { usage: 0, cost: 0 }
      const waste = DEFAULT_WASTE_DATA[idx] || { generated: 0, recycled: 0 }
      rows.push(`${m.month},${m.value},${elec.usage},${elec.cost},${waste.generated},${waste.recycled}`)
    })
    rows.push('')

    // Interventions Log
    rows.push('--- SUSTAINABILITY INTERVENTIONS & ACTIONS LOG ---')
    rows.push('ID,Title,Category,Date Recorded,Status,Savings Type,Expected Reduction (kg CO2e),Actual Reduction (kg CO2e),Monthly Cost Savings (INR),Description')
    availableInterventions.forEach((item) => {
      rows.push([
        quote(item.id),
        quote(item.title),
        quote(item.category),
        quote(item.dateRecorded),
        quote(item.status),
        quote(item.savingsType),
        item.expectedReductionKg,
        item.actualReductionKg !== undefined ? item.actualReductionKg : 'Under Measurement',
        item.costSavingsInr,
        quote(item.description),
      ].join(','))
    })
    rows.push('')

    // Before and After Comparison
    if (selectedIntervention) {
      rows.push('--- BEFORE VS AFTER INTERVENTION COMPARISON ---')
      rows.push(`Intervention,${quote(selectedIntervention.title)}`)
      rows.push(`Category,${quote(selectedIntervention.category)}`)
      rows.push(`Pre-Intervention Baseline,${quote(selectedIntervention.baselineMetric)}`)
      rows.push(`Post-Intervention Outcome,${quote(selectedIntervention.postMetric)}`)
      rows.push(`Expected Emissions Reduction,${selectedIntervention.expectedReductionKg} kg CO2e/month`)
      rows.push(`Estimated Financial Benefit,₹${selectedIntervention.costSavingsInr.toLocaleString('en-IN')}/month`)
      rows.push(`Status,${quote(selectedIntervention.status)}`)
    }

    const csvContent = rows.join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `CarbonIQ_Sustainability_Report_${new Date().getFullYear()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-7">
      {/* Header */}
      <PageTitle
        eyebrow="PERFORMANCE & AUDIT"
        title="Reports & exports"
        description="Comprehensive sustainability reporting, verified historical trends, intervention impact tracking, and audit-ready data exports."
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="hidden sm:inline-flex items-center rounded-lg border border-[#DCE7DA] bg-white px-3 py-2 text-xs font-medium text-[#465B4D]">
              Period: 2026-YTD
            </span>
            <Button
              onClick={handleExportCsv}
              className="bg-[#285943] text-white hover:bg-[#1f4735] shadow-xs cursor-pointer"
            >
              <Download size={15} /> Export CSV
            </Button>
          </div>
        }
      />

      {/* SECTION A: Sustainability Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5 border border-[#E0E7DE] bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[.12em] text-[#4A6252]">
              Total Emissions
            </span>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#E7F1E5] text-[#285943]">
              <Leaf size={16} />
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight text-[#1F3D2C]">
            2,480 <span className="text-sm font-medium text-[#4F6355]">kg CO₂e</span>
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-[#285943] font-medium">
            <ArrowDownRight size={14} />
            <span>-140 kg from May baseline</span>
          </div>
        </Card>

        <Card className="p-5 border border-[#E0E7DE] bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[.12em] text-[#4A6252]">
              Goal Progress
            </span>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#E7F1E5] text-[#285943]">
              <Target size={16} />
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight text-[#1F3D2C]">
            34% <span className="text-xs font-normal text-[#5A6F61]">of 50% target</span>
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#E5ECE3]">
            <div className="h-full rounded-full bg-[#285943]" style={{ width: '68%' }} />
          </div>
        </Card>

        <Card className="p-5 border border-[#E0E7DE] bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[.12em] text-[#4A6252]">
              Interventions
            </span>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#E7F1E5] text-[#285943]">
              <Sparkles size={16} />
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight text-[#1F3D2C]">
            {availableInterventions.length}{' '}
            <span className="text-sm font-medium text-[#4F6355]">measures</span>
          </p>
          <p className="mt-2 text-xs text-[#4F6355]">
            2 implemented · 3 in planning · 1 proposed
          </p>
        </Card>

        <Card className="p-5 border border-[#E0E7DE] bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[.12em] text-[#4A6252]">
              Projected Benefit
            </span>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#E7F1E5] text-[#285943]">
              <Zap size={16} />
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight text-[#285943]">
            ₹8,788 <span className="text-xs font-medium text-[#4F6355]">/ month</span>
          </p>
          <p className="mt-2 text-xs text-[#4F6355]">
            Across energy, waste & route optimizations
          </p>
        </Card>
      </div>

      {/* SECTION B: Historical Performance */}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-6 border border-[#E0E7DE] bg-white">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-[#1F3D2C]">Emissions trends over time</h2>
              <p className="mt-0.5 text-xs text-[#4E6254]">
                Total monthly carbon intensity in kg CO₂e from verified records.
              </p>
            </div>
            <span className="inline-flex items-center rounded-full bg-[#E7F1E5] px-2.5 py-0.5 text-xs font-medium text-[#285943]">
              May - Oct 2026
            </span>
          </div>

          <div className="mt-6">
            <EmissionsLineChart data={DEFAULT_MONTHLY_EMISSIONS} height={240} />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#EDF2EB] pt-4 text-xs text-[#4A5E50]">
            <span>Baseline: May 2026 (2,080 kg)</span>
            <span>Peak: Sep 2026 (2,520 kg)</span>
            <span className="font-semibold text-[#285943]">Current: Oct 2026 (2,480 kg)</span>
          </div>
        </Card>

        {/* Resource Consumption Highlights */}
        <Card className="p-6 border border-[#E0E7DE] bg-white flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#1F3D2C]">Resource breakdown trends</h2>
            <p className="mt-0.5 text-xs text-[#4E6254]">
              Historical consumption patterns across active modules.
            </p>

            <div className="mt-5 space-y-4">
              {/* Electricity Row */}
              <div className="rounded-xl border border-[#E4ECE2] bg-[#F9FBF8] p-3.5">
                <div className="flex items-center justify-between text-xs font-semibold text-[#244230]">
                  <span className="flex items-center gap-1.5">
                    <Zap size={14} className="text-[#285943]" /> Electricity
                  </span>
                  <span className="text-[#1F3D2C] tabular-nums font-bold">1,240 kWh / ₹14,500</span>
                </div>
                <p className="mt-1 text-[11px] text-[#4E6254]">
                  Trend: +8.4% above May baseline. Peak occurred in Oct 2026.
                </p>
              </div>

              {/* Transportation Row */}
              {!isIndividual ? (
                <div className="rounded-xl border border-[#E4ECE2] bg-[#F9FBF8] p-3.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-[#244230]">
                    <span className="flex items-center gap-1.5">
                      <Truck size={14} className="text-[#285943]" /> Transportation Fleet
                    </span>
                    <span className="text-[#1F3D2C] tabular-nums font-bold">148 L Diesel / 580 km</span>
                  </div>
                  <p className="mt-1 text-[11px] text-[#4E6254]">
                    Trend: 2 active bus routes analyzed. Route consolidation saves 35 km/day.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-[#E4ECE2] bg-[#F9FBF8] p-3.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-[#244230]">
                    <span className="flex items-center gap-1.5">
                      <Truck size={14} className="text-[#285943]" /> Commute & Mobility
                    </span>
                    <span className="text-[#1F3D2C] tabular-nums font-bold">Low-Carbon Commute</span>
                  </div>
                  <p className="mt-1 text-[11px] text-[#4E6254]">
                    Personal account: Fleet management & bus optimization are reserved for College/Org accounts.
                  </p>
                </div>
              )}

              {/* Waste Row */}
              <div className="rounded-xl border border-[#E4ECE2] bg-[#F9FBF8] p-3.5">
                <div className="flex items-center justify-between text-xs font-semibold text-[#244230]">
                  <span className="flex items-center gap-1.5">
                    <Recycle size={14} className="text-[#285943]" /> Waste & Recycling
                  </span>
                  <span className="text-[#1F3D2C] tabular-nums font-bold">420 kg (52% Recycled)</span>
                </div>
                <p className="mt-1 text-[11px] text-[#4E6254]">
                  Trend: 218 kg diverted from landfill. Recycling rate improved from 33% in May.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-[#F0F5EE] p-3 text-xs text-[#3E5244]">
            <span className="font-semibold text-[#244230]">Audit note:</span> Metrics are verified
            from authorized workspace logs and CEA baseline standards.
          </div>
        </Card>
      </div>

      {/* SECTION C: Intervention Tracking */}
      <Card className="p-6 border border-[#E0E7DE] bg-white">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#1F3D2C]">Intervention tracking</h2>
            <p className="mt-0.5 text-xs text-[#4E6254]">
              Documented sustainability actions, expected reductions, and verified outcomes.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-[#4E6254] mr-1 flex items-center gap-1">
              <Filter size={12} /> Filter:
            </span>
            {(['All', 'Electricity', ...(!isIndividual ? ['Transportation'] : []), 'Waste'] as const).map(
              (cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat as any)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                    categoryFilter === cat
                      ? 'bg-[#285943] text-white'
                      : 'bg-[#F0F4EE] text-[#465B4D] hover:bg-[#E2EBE0]'
                  }`}
                >
                  {cat}
                </button>
              )
            )}
          </div>
        </div>

        {/* Interventions Table / Deck */}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E4ECE2] text-[#4A6252] font-semibold uppercase tracking-[.06em]">
                <th className="pb-3 pr-4">Intervention</th>
                <th className="pb-3 px-3">Category</th>
                <th className="pb-3 px-3">Date</th>
                <th className="pb-3 px-3 text-right">Expected CO₂e</th>
                <th className="pb-3 px-3 text-right">Actual Outcome</th>
                <th className="pb-3 px-3 text-right">Cost Savings</th>
                <th className="pb-3 pl-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFF3EE]">
              {availableInterventions.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => setSelectedInterventionId(item.id)}
                  className={`cursor-pointer transition-colors hover:bg-[#F9FAF8] ${
                    selectedIntervention?.id === item.id ? 'bg-[#F2F7F0]' : ''
                  }`}
                >
                  <td className="py-3.5 pr-4">
                    <p className="font-semibold text-[#1F3D2C]">{item.title}</p>
                    <p className="mt-0.5 text-[11px] text-[#55695B] line-clamp-1">{item.description}</p>
                  </td>
                  <td className="py-3.5 px-3">
                    <span className="inline-flex items-center gap-1 font-medium text-[#2C4234]">
                      {item.category === 'Electricity' && <Zap size={12} className="text-[#285943]" />}
                      {item.category === 'Transportation' && <Truck size={12} className="text-[#285943]" />}
                      {item.category === 'Waste' && <Recycle size={12} className="text-[#285943]" />}
                      {item.category}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-[#526658] whitespace-nowrap">{item.dateRecorded}</td>
                  <td className="py-3.5 px-3 text-right font-medium text-[#204F38] tabular-nums whitespace-nowrap">
                    -{item.expectedReductionKg} kg
                  </td>
                  <td className="py-3.5 px-3 text-right tabular-nums whitespace-nowrap">
                    {item.actualReductionKg !== undefined ? (
                      <span className="font-semibold text-[#285943] inline-flex items-center gap-1">
                        <CheckCircle2 size={12} /> -{item.actualReductionKg} kg
                      </span>
                    ) : (
                      <span className="text-[#6C8072] italic">Under measurement</span>
                    )}
                  </td>
                  <td className="py-3.5 px-3 text-right font-semibold text-[#1F3D2C] tabular-nums whitespace-nowrap">
                    ₹{item.costSavingsInr.toLocaleString('en-IN')}/mo
                  </td>
                  <td className="py-3.5 pl-3 text-center whitespace-nowrap">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        item.status === 'implemented'
                          ? 'bg-[#E7F1E5] text-[#285943]'
                          : item.status === 'in_planning'
                            ? 'bg-[#F5F2DF] text-[#7A6B29]'
                            : 'bg-[#F0F2ED] text-[#59695E]'
                      }`}
                    >
                      {item.status === 'implemented'
                        ? 'Implemented'
                        : item.status === 'in_planning'
                          ? 'In Planning'
                          : 'Proposed'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend / Distinction Note */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-[#4E6254] border-t border-[#EDF2EB] pt-3">
          <span className="font-semibold text-[#244230]">Savings classification:</span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[#285943]" />
            <strong>Achieved:</strong> Verified post-implementation reduction
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[#C29D38]" />
            <strong>Projected:</strong> Accepted plan awaiting measurement cycle
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[#7D8F82]" />
            <strong>Estimated:</strong> Initial modeled opportunity
          </span>
        </div>
      </Card>

      {/* SECTION D: Before-and-After Comparison */}
      {selectedIntervention && (
        <Card className="p-6 border border-[#DCE7DA] bg-white">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.12em] text-[#4A6252]">
                Detailed Impact Evaluation
              </p>
              <h2 className="mt-1 text-base font-semibold text-[#1F3D2C]">
                Before-and-after comparison: {selectedIntervention.title}
              </h2>
            </div>
            <Pill tone={selectedIntervention.status === 'implemented' ? 'green' : 'amber'}>
              {selectedIntervention.status === 'implemented' ? 'Verified Reduction' : 'Modeled Scenario'}
            </Pill>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {/* Before Box */}
            <div className="rounded-xl border border-[#E0E7DE] bg-[#FBFCF9] p-4">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#637567]">
                Baseline (Before)
              </span>
              <p className="mt-2 text-base font-bold text-[#1F3D2C]">
                {selectedIntervention.baselineMetric}
              </p>
              <p className="mt-1 text-xs text-[#526658]">
                Standard pre-intervention operating consumption.
              </p>
            </div>

            {/* After Box */}
            <div className="rounded-xl border border-[#D6E6D3] bg-[#F2F7F0] p-4">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#285943]">
                Outcome (After)
              </span>
              <p className="mt-2 text-base font-bold text-[#204F38]">
                {selectedIntervention.postMetric}
              </p>
              <p className="mt-1 text-xs text-[#43594A]">
                {selectedIntervention.actualReductionKg !== undefined
                  ? 'Measured achievement from meter/fuel records.'
                  : 'Projected outcome upon full implementation.'}
              </p>
            </div>

            {/* Net Impact Box */}
            <div className="rounded-xl border border-[#285943]/20 bg-[#285943] text-white p-4">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#B9D0B3]">
                Net Monthly Impact
              </span>
              <p className="mt-2 text-2xl font-bold tracking-tight text-white">
                -{selectedIntervention.expectedReductionKg} kg CO₂e
              </p>
              <p className="mt-1 text-xs text-[#D8E6D5]">
                ₹{selectedIntervention.costSavingsInr.toLocaleString('en-IN')}/mo financial savings
              </p>
            </div>
          </div>

          <p className="mt-4 text-xs text-[#5C6E61]">
            <span className="font-semibold text-[#244230]">Methodology compliance:</span> Emission
            savings are computed strictly against documented baselines using Indian CEA grid
            emission baselines (0.82 kg CO₂e/kWh) and standard diesel emission factors (2.68 kg
            CO₂e/L). No hypothetical reduction is claimed as verified without record corroboration.
          </p>
        </Card>
      )}
    </div>
  )
}
