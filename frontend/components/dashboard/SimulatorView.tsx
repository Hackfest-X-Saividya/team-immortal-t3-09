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
        <Card className="p-5 sm:p-7">
          <h2 className="font-semibold text-[#405448]">Adjust your scenario</h2>
          <p className="mt-1 text-xs text-[#8A978D]">Move the sliders to model possible changes.</p>

          <div className="mt-8 space-y-7">
            {sliders.map(([label, val, setter, note]) => (
              <label key={label} className="block">
                <div className="flex justify-between text-sm font-medium text-[#536458]">
                  <span>{label}</span>
                  <span className="text-[#285943]">{val}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={val}
                  onChange={(e) => setter(Number(e.target.value))}
                  className="mt-4 w-full accent-[#285943]"
                />
                <div className="mt-2 flex justify-between text-[10px] text-[#9AA59C]">
                  <span>0%</span>
                  <span>{note}</span>
                  <span>50%</span>
                </div>
              </label>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="bg-[#285943] p-6 text-white">
            <p className="text-xs text-white/60">Projected monthly opportunity</p>
            <p className="mt-2 text-4xl font-semibold tracking-[-.06em]">
              ₹{savingsMonthly.toLocaleString('en-IN')}
            </p>
            <p className="mt-2 text-xs text-white/60">
              Estimated cost difference under this scenario
            </p>
            <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-[#B6D1AB] transition-all duration-300"
                style={{ width: `${Math.min(100, emissionsImprovementPercent * 2)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-white/70">
              {emissionsImprovementPercent}% modeled emissions improvement
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold text-[#405448]">Scenario summary</h2>
            <div className="mt-4 space-y-3 text-xs">
              {summaryRows.map(([k, v]) => (
                <div
                  key={k}
                  className="flex justify-between border-b border-[#EFF3EE] pb-3 last:border-0"
                >
                  <span className="text-[#829087]">{k}</span>
                  <span className="font-medium text-[#536458]">{v}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="rounded-xl border border-[#E9E6D6] bg-[#FBF8E9] px-4 py-3 text-xs leading-5 text-[#827753]">
        <span className="font-medium">Important:</span> this simulator applies illustrative
        assumptions shared across the demo modules. A projected improvement is not proof of an
        achieved reduction.
      </div>
    </div>
  )
}
