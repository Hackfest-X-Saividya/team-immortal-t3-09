'use client'

import React, { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { PageTitle } from '@/components/ui/PageTitle'
import { Pill } from '@/components/ui/Pill'
import { calculateSavingsProjection } from '@/lib/calculations'

export function SimulatorView() {
  const [elec, setElec] = useState(15)
  const [transport, setTransport] = useState(10)
  const [wasteR, setWasteR] = useState(20)

  const {
    savingsMonthly,
    emissionsImprovementPercent,
    proposedEmissions,
    projectedKwhReduction,
    projectedWasteReduction,
  } = calculateSavingsProjection({
    electricityReduction: elec,
    transportReduction: transport,
    wasteReduction: wasteR,
  })

  const sliders = [
    ['Electricity reduction', elec, setElec, 'Lower monthly kWh'],
    ['Transport distance reduction', transport, setTransport, 'Fewer route kilometres'],
    ['Waste reduction', wasteR, setWasteR, 'Less material generated'],
  ] as const

  const summaryRows = [
    ['Current estimated emissions', '2,480 kg CO₂e'],
    ['Proposed emissions', `${proposedEmissions.toLocaleString()} kg CO₂e`],
    ['Projected kWh reduction', `${projectedKwhReduction} kWh`],
    ['Projected waste reduction', `${projectedWasteReduction} kg`],
  ]

  return (
    <div className="space-y-6">
      <PageTitle
        eyebrow="WHAT-IF PLANNING"
        title="Savings simulator"
        description="Test a scenario before you commit. These are projections, not measured outcomes."
        action={<Pill>Hypothetical scenario</Pill>}
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_.8fr]">
        <Card className="p-5 sm:p-7 border border-[#E0E7DE] bg-white">
          <h2 className="text-base font-semibold text-[#244230]">Adjust your scenario</h2>
          <p className="mt-1 text-xs text-[#4E6254]">Move the sliders to model possible changes.</p>

          <div className="mt-8 space-y-7">
            {sliders.map(([label, val, setter, note]) => (
              <label key={label} className="block cursor-pointer">
                <div className="flex justify-between items-baseline text-sm font-medium">
                  <span className="text-[#2C4234] font-semibold">{label}</span>
                  <span className="text-base font-bold text-[#20513B] tabular-nums">{val}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={val}
                  onChange={(e) => setter(Number(e.target.value))}
                  className="mt-3 w-full accent-[#285943]"
                  aria-label={label}
                />
                <div className="mt-2 flex justify-between text-xs font-medium text-[#4A5E50]">
                  <span>0%</span>
                  <span className="text-[#3D5244] font-normal">{note}</span>
                  <span>50%</span>
                </div>
              </label>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-6 border border-[#D8E4D5] bg-white shadow-xs">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[.12em] text-[#4A6252]">
                Projected monthly opportunity
              </p>
              <span className="inline-flex items-center rounded-full bg-[#E7F1E5] px-2.5 py-0.5 text-[11px] font-semibold text-[#285943]">
                Estimated
              </span>
            </div>

            <p className="mt-3 text-4xl font-bold tracking-[-.05em] text-[#285943] sm:text-[42px] leading-tight tabular-nums">
              ₹{savingsMonthly.toLocaleString('en-IN')}
            </p>

            <p className="mt-2 text-xs font-medium text-[#4D6354]">
              Estimated cost difference under this scenario
            </p>

            <div className="mt-5 space-y-2">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#E5ECE3]">
                <div
                  className="h-full rounded-full bg-[#285943] transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.max(0, emissionsImprovementPercent * 2))}%`,
                  }}
                />
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-[#285943]">
                  {emissionsImprovementPercent}% modeled emissions improvement
                </span>
                <span className="text-[#526857] font-medium">Target: 50%</span>
              </div>
            </div>
          </Card>

          <Card className="p-5 sm:p-6 border border-[#E0E7DE] bg-white">
            <h2 className="text-sm font-semibold tracking-[-0.01em] text-[#244230]">
              Scenario summary
            </h2>
            <div className="mt-4 space-y-3.5 text-xs">
              {summaryRows.map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center justify-between border-b border-[#E8EFE6] pb-3 last:border-0 last:pb-0"
                >
                  <span className="font-medium text-[#465B4D]">{k}</span>
                  <span className="font-semibold text-[#1F3D2C] tabular-nums text-right">{v}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="rounded-xl border border-[#DDD5A8] bg-[#FAF6E4] px-4 py-3 text-xs leading-5 text-[#4A4322]">
        <span className="font-semibold text-[#2D2810]">Important:</span> this simulator applies
        illustrative assumptions shared across the demo modules. A projected improvement is not
        proof of an achieved reduction.
      </div>
    </div>
  )
}
