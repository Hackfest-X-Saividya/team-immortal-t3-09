'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  BusFront,
  CircleHelp,
  Cloud,
  MoreHorizontal,
  Package,
  Recycle,
  Target,
  Truck,
  Wallet,
  Zap,
} from 'lucide-react'
import { EmissionsLineChart } from '@/components/charts/EmissionsLineChart'
import { ResourceBreakdownChart } from '@/components/charts/ResourceBreakdownChart'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/Card'
import { Metric } from '@/components/ui/Metric'
import { MiniSpark } from '@/components/ui/MiniSpark'
import { Pill } from '@/components/ui/Pill'
import {
  DEFAULT_MONTHLY_EMISSIONS,
  DEFAULT_RECOMMENDATIONS,
  DEFAULT_RESOURCE_BREAKDOWN,
} from '@/lib/constants'
import { demoService } from '@/services/demo.service'

export function OverviewView() {
  const router = useRouter()
  const activities = demoService.getRecentActivities()

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="rounded-2xl bg-[#285943] px-5 py-5 text-white sm:px-7 sm:py-6 shadow-xs">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-medium text-[#B9D0B3]">
              OCTOBER 2026 · SUSTAINABILITY WORKSPACE
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-.04em] sm:text-3xl">
              Your impact, at a glance.
            </h1>
            <p className="mt-2 max-w-[510px] text-sm leading-6 text-white/65">
              A clear starting point for making more sustainable decisions across your resources.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3 rounded-xl bg-white/10 p-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#9DBB99]/20 text-[#C7DFC0]">
              <Target size={18} />
            </span>
            <div>
              <p className="text-[10px] text-white/55">Reduction goal</p>
              <p className="mt-1 text-xl font-semibold">
                34% <span className="text-xs font-normal text-white/55">of 50%</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Metric
          icon={Cloud}
          label="Estimated carbon emissions"
          value="2,480"
          unit="kg CO₂e"
          trend={<MiniSpark up />}
          note="Compared with 2,260 kg last period"
          tone="green"
        />
        <Metric
          icon={Zap}
          label="Electricity consumption"
          value="1,240"
          unit="kWh"
          trend={<MiniSpark up />}
          note="8.4% above your baseline"
          tone="olive"
        />
        <Metric
          icon={Truck}
          label="Transport & fuel cost"
          value="₹18,500"
          trend={<MiniSpark />}
          note="Estimated for current routes"
          tone="sage"
        />
        <Metric
          icon={Package}
          label="Total waste generated"
          value="420"
          unit="kg"
          trend={<MiniSpark />}
          note="52% recovery rate"
          tone="amber"
        />
        <Metric
          icon={Wallet}
          label="Potential monthly savings"
          value="₹6,800"
          trend={<Pill>Estimated</Pill>}
          note="Based on 3 recommended actions"
          tone="green"
        />
        <Metric
          icon={Target}
          label="Reduction goal progress"
          value="34"
          unit="%"
          trend={<span className="text-[11px] font-medium text-[#4B8A63]">On track</span>}
          note="16% remaining to your next milestone"
          tone="sage"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid gap-5 xl:grid-cols-[1.38fr_.82fr]">
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-[#405448]">Emissions trend</h2>
              <p className="mt-1 text-xs text-[#8A978D]">Estimated monthly footprint · kg CO₂e</p>
            </div>
            <button
              type="button"
              aria-label="More chart options"
              className="rounded-lg p-1.5 text-[#8A978D] hover:bg-[#F1F5EF]"
            >
              <MoreHorizontal size={18} />
            </button>
          </div>
          <div className="mt-5">
            <EmissionsLineChart data={DEFAULT_MONTHLY_EMISSIONS} height={230} showAxes={true} />
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-[#829087]">
            <span className="h-2 w-2 rounded-full bg-[#285943]" /> October is 1.7% lower than your September peak
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-[#405448]">Where impact comes from</h2>
              <p className="mt-1 text-xs text-[#8A978D]">Share of estimated emissions</p>
            </div>
            <CircleHelp size={16} className="text-[#A4AEA5]" />
          </div>
          <div className="mt-4 flex items-center justify-center">
            <ResourceBreakdownChart data={DEFAULT_RESOURCE_BREAKDOWN} />
          </div>
          <div className="mt-2 space-y-2.5">
            {DEFAULT_RESOURCE_BREAKDOWN.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-[#65756A]">
                  <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
                  {item.name}
                </span>
                <span className="font-medium text-[#405448]">{item.value}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recommended actions & Recent activity */}
      <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-[#405448]">Recommended actions</h2>
              <p className="mt-1 text-xs text-[#8A978D]">Illustrative opportunities based on your demo data</p>
            </div>
            <Button
              variant="ghost"
              onClick={() => router.push('/dashboard/insights')}
              className="px-2 py-1 text-xs"
            >
              View all <ArrowRight size={13} />
            </Button>
          </div>

          <div className="mt-5 space-y-3">
            {DEFAULT_RECOMMENDATIONS.map((rec, i) => (
              <div key={rec.id} className="flex items-center gap-3 rounded-xl border border-[#EDF1EB] p-3">
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                    i === 0
                      ? 'bg-[#E7F1E5] text-[#285943]'
                      : i === 1
                        ? 'bg-[#F0F3E9] text-[#7C8750]'
                        : 'bg-[#FBF1D8] text-[#8A6C2E]'
                  }`}
                >
                  {i === 0 ? <Zap size={16} /> : i === 1 ? <BusFront size={16} /> : <Recycle size={16} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#405448]">{rec.title}</p>
                  <p className="mt-1 text-[11px] text-[#8A978D]">
                    {rec.category} · {rec.difficulty}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-[#4B8A63]">{rec.savingsMonthly}</p>
                  <p className="mt-1 text-[10px] text-[#A0AAA2]">estimated</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-[#405448]">Recent activity</h2>
              <p className="mt-1 text-xs text-[#8A978D]">Latest demo records</p>
            </div>
            <button
              type="button"
              className="text-xs font-medium text-[#285943] hover:underline cursor-pointer"
              onClick={() => router.push('/dashboard/reports')}
            >
              See report
            </button>
          </div>
          <div className="mt-4 space-y-1">
            {activities.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-[54px_1fr_auto] items-center gap-3 border-b border-[#F0F3EF] py-3 last:border-0"
              >
                <span className="text-[10px] text-[#98A49A]">{row.date.split(',')[0]}</span>
                <div>
                  <p className="text-xs font-medium text-[#5A6A5F]">{row.activity}</p>
                  <p className="mt-0.5 text-[10px] text-[#9AA59C]">{row.category}</p>
                </div>
                <span className="text-xs font-medium text-[#607168]">{row.quantity}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="rounded-xl border border-[#DFEBDD] bg-[#F0F6EE] px-4 py-3 text-xs text-[#718074]">
        <span className="font-medium text-[#4E6654]">Demo workspace:</span> All figures are illustrative and prepared for exploring CarbonIQ. They are not verified measurements or achieved savings.
      </div>
    </div>
  )
}
