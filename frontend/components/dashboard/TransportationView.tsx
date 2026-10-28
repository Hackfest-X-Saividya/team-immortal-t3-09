'use client'

import React, { useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  Bus,
  BusFront,
  CheckCircle2,
  ChevronRight,
  Cloud,
  Compass,
  Edit2,
  FileCheck,
  Fuel,
  GitMerge,
  MoreHorizontal,
  Plus,
  Route,
  Sparkles,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react'
import { ModuleAiAdvisor } from '@/components/ai/ModuleAiAdvisor'
import { BusRouteModal } from '@/components/dashboard/BusRouteModal'
import { RouteComparisonModal } from '@/components/dashboard/RouteComparisonModal'
import { TransportationRecordModal } from '@/components/dashboard/TransportationRecordModal'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/Card'
import { Metric } from '@/components/ui/Metric'
import { MiniSpark } from '@/components/ui/MiniSpark'
import { PageTitle } from '@/components/ui/PageTitle'
import { Pill } from '@/components/ui/Pill'
import { ToastNotification } from '@/components/ui/ToastNotification'
import { useAuth } from '@/context/auth-context'
import {
  calculateTransportationEmissions,
  generateBusRouteOptimizations,
} from '@/lib/calculations'
import { aiAdvisorsService } from '@/services/ai-advisors.service'
import type {
  BusRoute,
  RouteOptimizationProposal,
  TransportationRecord,
} from '@/types/sustainability'

const INITIAL_TRANSPORT_RECORDS: TransportationRecord[] = [
  {
    id: 'tr-1',
    date: '2026-10-28',
    mode: 'Bus',
    distanceKm: 580,
    fuelType: 'Diesel',
    fuelConsumedLiters: 112,
    fuelEfficiencyKmPerL: 5.2,
    fuelExpenditureInr: 10584,
    vehicleId: 'BUS-04',
    passengerCount: 38,
    notes: 'Campus North Corridor - 2 shifts',
    calculationMethod: 'actual_fuel',
    calculatedEmissionsKg: calculateTransportationEmissions({
      distanceKm: 580,
      fuelType: 'Diesel',
      fuelConsumedLiters: 112,
    }).emissionsKg,
    createdAt: '2026-10-28T08:00:00.000Z',
  },
  {
    id: 'tr-2',
    date: '2026-10-24',
    mode: 'Bus',
    distanceKm: 540,
    fuelType: 'Diesel',
    fuelConsumedLiters: 104,
    fuelEfficiencyKmPerL: 5.2,
    fuelExpenditureInr: 9828,
    vehicleId: 'BUS-07',
    passengerCount: 34,
    notes: 'South Sector route',
    calculationMethod: 'actual_fuel',
    calculatedEmissionsKg: calculateTransportationEmissions({
      distanceKm: 540,
      fuelType: 'Diesel',
      fuelConsumedLiters: 104,
    }).emissionsKg,
    createdAt: '2026-10-24T08:00:00.000Z',
  },
  {
    id: 'tr-3',
    date: '2026-10-18',
    mode: 'Fleet Van',
    distanceKm: 180,
    fuelType: 'Diesel',
    fuelConsumedLiters: 22,
    fuelEfficiencyKmPerL: 8.2,
    fuelExpenditureInr: 2079,
    vehicleId: 'VAN-02',
    passengerCount: 8,
    notes: 'Faculty inter-campus transfer',
    calculationMethod: 'actual_fuel',
    calculatedEmissionsKg: calculateTransportationEmissions({
      distanceKm: 180,
      fuelType: 'Diesel',
      fuelConsumedLiters: 22,
    }).emissionsKg,
    createdAt: '2026-10-18T08:00:00.000Z',
  },
  {
    id: 'tr-4',
    date: '2026-10-12',
    mode: 'Bus',
    distanceKm: 420,
    fuelType: 'CNG',
    fuelConsumedLiters: 80,
    fuelEfficiencyKmPerL: 5.25,
    fuelExpenditureInr: 6560,
    vehicleId: 'BUS-09',
    passengerCount: 32,
    notes: 'Metro feeder connector',
    calculationMethod: 'actual_fuel',
    calculatedEmissionsKg: calculateTransportationEmissions({
      distanceKm: 420,
      fuelType: 'CNG',
      fuelConsumedLiters: 80,
    }).emissionsKg,
    createdAt: '2026-10-12T08:00:00.000Z',
  },
]

const INITIAL_BUS_ROUTES: BusRoute[] = [
  {
    id: 'route-a',
    routeName: 'Route 101 — North Hub',
    startLocation: 'Hebbal Flyover',
    destination: 'Main Campus Gate 1',
    intermediateStops: ['Sahakar Nagar', 'Jakkur Aerodrome', 'Yelahanka Bypass'],
    distanceKm: 30,
    durationMinutes: 45,
    tripsPerDay: 2,
    operatingDaysPerWeek: 5,
    assignedStudents: 22,
    busId: 'BUS-01',
    fuelType: 'Diesel',
    fuelEfficiencyKmPerL: 5.0,
    seatingCapacity: 40,
    currentBusesCount: 1,
    status: 'active',
    notes: 'Low morning occupancy (22/40)',
  },
  {
    id: 'route-b',
    routeName: 'Route 102 — Jakkur Corridor',
    startLocation: 'Kogilu Cross',
    destination: 'Main Campus Gate 1',
    intermediateStops: ['Jakkur Aerodrome', 'Kogilu Village', 'Judicial Layout'],
    distanceKm: 28,
    durationMinutes: 42,
    tripsPerDay: 2,
    operatingDaysPerWeek: 5,
    assignedStudents: 16,
    busId: 'BUS-02',
    fuelType: 'Diesel',
    fuelEfficiencyKmPerL: 5.2,
    seatingCapacity: 40,
    currentBusesCount: 1,
    status: 'active',
    notes: 'Overlaps with Route 101 at Jakkur',
  },
  {
    id: 'route-c',
    routeName: 'Route 201 — South Ring',
    startLocation: 'Banashankari Depot',
    destination: 'Main Campus Gate 2',
    intermediateStops: ['Silk Board', 'HSR Layout', 'Bellandur'],
    distanceKm: 42,
    durationMinutes: 65,
    tripsPerDay: 2,
    operatingDaysPerWeek: 5,
    assignedStudents: 36,
    busId: 'BUS-03',
    fuelType: 'Diesel',
    fuelEfficiencyKmPerL: 4.8,
    seatingCapacity: 40,
    currentBusesCount: 1,
    status: 'active',
    notes: 'Near full capacity (36/40)',
  },
]

export function TransportationView() {
  const { requestMutation } = useAuth()
  const optimizationSectionRef = useRef<HTMLDivElement>(null)

  const [records, setRecords] = useState<TransportationRecord[]>(INITIAL_TRANSPORT_RECORDS)
  const [routes, setRoutes] = useState<BusRoute[]>(INITIAL_BUS_ROUTES)
  const [proposals, setProposals] = useState<RouteOptimizationProposal[]>(() =>
    generateBusRouteOptimizations(INITIAL_BUS_ROUTES)
  )

  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<TransportationRecord | null>(null)

  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false)
  const [editingRoute, setEditingRoute] = useState<BusRoute | null>(null)

  const [selectedProposal, setSelectedProposal] = useState<RouteOptimizationProposal | null>(null)
  const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false)

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Aggregated metrics from records
  const totalDistanceKm = useMemo(
    () => records.reduce((acc, r) => acc + r.distanceKm, 0),
    [records]
  )

  const totalFuelLiters = useMemo(
    () => records.reduce((acc, r) => acc + (r.fuelConsumedLiters || 0), 0),
    [records]
  )

  const totalExpenditureInr = useMemo(
    () => records.reduce((acc, r) => acc + (r.fuelExpenditureInr || 0), 0),
    [records]
  )

  const totalEmissionsKg = useMemo(
    () => records.reduce((acc, r) => acc + r.calculatedEmissionsKg, 0),
    [records]
  )

  // Potential monthly savings from active proposals
  const potentialOptimizationSavingsInr = useMemo(
    () => proposals.reduce((acc, p) => acc + p.estimatedMonthlySavingsInr, 0),
    [proposals]
  )

  const scrollToOptimizer = () => {
    optimizationSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Record actions
  const handleOpenAddRecord = () => {
    if (!requestMutation('add transportation records')) return
    setEditingRecord(null)
    setIsRecordModalOpen(true)
  }

  const handleOpenEditRecord = (rec: TransportationRecord) => {
    if (!requestMutation('edit transportation records')) return
    setEditingRecord(rec)
    setIsRecordModalOpen(true)
    setActiveMenuId(null)
  }

  const handleDeleteRecord = (id: string) => {
    if (!requestMutation('delete transportation records')) return
    setRecords((prev) => prev.filter((r) => r.id !== id))
    setActiveMenuId(null)
    setToastMessage('Travel record removed from workspace.')
  }

  const handleSaveRecord = (
    data: Omit<TransportationRecord, 'id' | 'createdAt'>,
    existingId?: string
  ) => {
    if (existingId) {
      setRecords((prev) =>
        prev.map((r) => (r.id === existingId ? { ...r, ...data } : r))
      )
      setToastMessage('Travel record updated successfully.')
    } else {
      const newRec: TransportationRecord = {
        ...data,
        id: `tr-${Date.now()}`,
        createdAt: new Date().toISOString(),
      }
      setRecords((prev) => [newRec, ...prev])
      setToastMessage('Transportation entry saved to workspace.')
    }
  }

  // Bus route actions
  const handleOpenAddRoute = () => {
    if (!requestMutation('manage bus routes')) return
    setEditingRoute(null)
    setIsRouteModalOpen(true)
  }

  const handleOpenEditRoute = (rt: BusRoute) => {
    if (!requestMutation('edit bus routes')) return
    setEditingRoute(rt)
    setIsRouteModalOpen(true)
  }

  const handleDeleteRoute = (id: string) => {
    if (!requestMutation('delete bus routes')) return
    const updated = routes.filter((r) => r.id !== id)
    setRoutes(updated)
    setProposals(generateBusRouteOptimizations(updated))
    setToastMessage('Bus route deleted.')
  }

  const handleSaveRoute = (data: Omit<BusRoute, 'id'>, existingId?: string) => {
    let updatedRoutes: BusRoute[]
    if (existingId) {
      updatedRoutes = routes.map((r) => (r.id === existingId ? { ...r, ...data } : r))
      setToastMessage('Bus route updated successfully.')
    } else {
      const newRt: BusRoute = {
        ...data,
        id: `route-${Date.now()}`,
      }
      updatedRoutes = [...routes, newRt]
      setToastMessage('New bus route configured and added.')
    }
    setRoutes(updatedRoutes)
    setProposals(generateBusRouteOptimizations(updatedRoutes))
  }

  const handleRunOptimizer = () => {
    const updated = generateBusRouteOptimizations(routes)
    setProposals(updated)
    if (updated.length > 0) {
      setToastMessage(
        `Optimization completed: ${updated.length} consolidation candidate identified.`
      )
    } else {
      setToastMessage(
        'Optimization completed: All current routes operate within optimal capacity thresholds.'
      )
    }
  }

  const handleAcceptProposal = (proposalId: string) => {
    setProposals((prev) =>
      prev.map((p) =>
        p.id === proposalId ? { ...p, status: 'accepted' as const } : p
      )
    )
    setToastMessage('Route consolidation proposal recorded as Planned Intervention.')
  }

  const handleRejectProposal = (proposalId: string) => {
    setProposals((prev) =>
      prev.map((p) =>
        p.id === proposalId ? { ...p, status: 'rejected' as const } : p
      )
    )
    setToastMessage('Recommendation dismissed.')
  }

  return (
    <div className="space-y-6">
      <ToastNotification message={toastMessage} onClose={() => setToastMessage(null)} />

      <PageTitle
        eyebrow="MOBILITY & LOGISTICS MODULE"
        title="Transportation & Fuel Optimization"
        description="Monitor fleet distance, track verifiable fuel usage, and optimize transit bus routes using capacity-aware algorithms."
        action={
          <div className="flex flex-wrap gap-2.5">
            <Button variant="secondary" onClick={scrollToOptimizer}>
              <GitMerge size={15} /> Optimize Bus Routes
            </Button>
            <Button onClick={handleOpenAddRecord}>
              <Plus size={15} /> Add Record
            </Button>
          </div>
        }
      />

      {/* Top 4 Metrics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={BusFront}
          label="Total distance logged"
          value={totalDistanceKm.toLocaleString()}
          unit="km"
          trend={<MiniSpark />}
          note={`Across ${records.length} travel entries`}
          tone="green"
        />
        <Metric
          icon={Fuel}
          label="Total fuel consumed"
          value={totalFuelLiters.toLocaleString()}
          unit="L"
          trend={<Pill tone="sage">Verified entries</Pill>}
          note="Actual liters recorded"
          tone="sage"
        />
        <Metric
          icon={Cloud}
          label="Transport emissions"
          value={Math.round(totalEmissionsKg).toLocaleString()}
          unit="kg CO₂e"
          trend={<span className="text-[11px] font-medium text-[#4B8A63]">Strict fuel method</span>}
          note="No double-counting"
          tone="olive"
        />
        <Metric
          icon={Wallet}
          label="Potential route savings"
          value={`₹${potentialOptimizationSavingsInr.toLocaleString('en-IN')}`}
          unit="/mo"
          trend={<Pill>AI Modeled</Pill>}
          note={`${proposals.length} active corridor proposal(s)`}
          tone="amber"
        />
      </div>

      {/* Travel Entries Table */}
      <Card className="p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-[#304739]">Travel & Fleet Log</h2>
            <p className="mt-0.5 text-xs text-[#8A978D]">
              Verified records with separated actual vs efficiency-based emissions
            </p>
          </div>
          <Button variant="secondary" onClick={handleOpenAddRecord} className="text-xs">
            <Plus size={14} /> New travel log
          </Button>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead className="border-b border-[#E8EEE6] text-[10px] uppercase tracking-[.12em] text-[#98A49A]">
              <tr>
                <th className="pb-3 font-medium">Date</th>
                <th className="pb-3 font-medium">Vehicle / Mode</th>
                <th className="pb-3 font-medium">Distance</th>
                <th className="pb-3 font-medium">Fuel Consumed</th>
                <th className="pb-3 font-medium">Expenditure</th>
                <th className="pb-3 font-medium">Emissions</th>
                <th className="pb-3 font-medium">Calculation Method</th>
                <th className="pb-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFF3EE] text-[#55675A]">
              {records.map((rec) => (
                <tr key={rec.id} className="hover:bg-[#FAFDF9]">
                  <td className="py-3 font-medium text-[#2F4436]">{rec.date}</td>
                  <td className="py-3">
                    <span className="font-medium text-[#304739]">{rec.vehicleId || rec.mode}</span>
                    <span className="text-[#87998D] block text-[10px]">{rec.notes || rec.mode}</span>
                  </td>
                  <td className="py-3 font-semibold text-[#285943]">
                    {rec.distanceKm.toLocaleString()} km
                  </td>
                  <td className="py-3">
                    {rec.fuelConsumedLiters ? `${rec.fuelConsumedLiters} L (${rec.fuelType})` : '—'}
                  </td>
                  <td className="py-3">
                    {rec.fuelExpenditureInr ? `₹${rec.fuelExpenditureInr.toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td className="py-3 font-medium text-[#3A5243]">
                    {rec.calculatedEmissionsKg.toLocaleString()} kg CO₂e
                  </td>
                  <td className="py-3">
                    <Pill tone={rec.calculationMethod === 'actual_fuel' ? 'green' : 'sage'}>
                      {rec.calculationMethod === 'actual_fuel' ? 'Actual Fuel' : 'Distance/Eff.'}
                    </Pill>
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

      {/* DEDICATED BUS ROUTE MANAGEMENT & OPTIMIZATION SECTION */}
      <div ref={optimizationSectionRef} className="space-y-6 pt-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-[#E0E7DE] pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#285943] text-white">
                <Route size={16} />
              </span>
              <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#28352D]">
                Smart Bus Route Optimization
              </h2>
            </div>
            <p className="mt-1 text-xs text-[#7A8C80]">
              Analyze bus routes, student demand, and vehicle capacity to identify opportunities for more efficient transportation.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button variant="secondary" onClick={handleOpenAddRoute} className="text-xs">
              <Plus size={14} /> Add Route
            </Button>
            <Button onClick={handleRunOptimizer} className="text-xs bg-[#285943]">
              <Sparkles size={14} /> Analyze & Optimize Routes
            </Button>
          </div>
        </div>

        {/* Configured Bus Routes Table */}
        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-[#304739]">Active Bus Routes & Passenger Load</h3>
            <span className="text-xs text-[#7D8E81]">{routes.length} configured routes</span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="border-b border-[#E8EEE6] text-[10px] uppercase tracking-[.12em] text-[#98A49A]">
                <tr>
                  <th className="pb-3 font-medium">Route ID / Name</th>
                  <th className="pb-3 font-medium">Origin ➔ Destination</th>
                  <th className="pb-3 font-medium">Intermediate Stops</th>
                  <th className="pb-3 font-medium">Distance</th>
                  <th className="pb-3 font-medium">Student Demand</th>
                  <th className="pb-3 font-medium">Bus Specs</th>
                  <th className="pb-3 font-medium">Occupancy</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFF3EE] text-[#55675A]">
                {routes.map((rt) => {
                  const occupancyPct = Math.round((rt.assignedStudents / rt.seatingCapacity) * 100)
                  return (
                    <tr key={rt.id} className="hover:bg-[#FAFDF9]">
                      <td className="py-3 font-medium text-[#285943]">
                        <div className="flex items-center gap-1.5">
                          <Bus size={13} />
                          <span>{rt.routeName}</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className="font-medium text-[#304739]">{rt.startLocation}</span>
                        <span className="text-[#889B8E] block text-[10px]">➔ {rt.destination}</span>
                      </td>
                      <td className="py-3 max-w-[200px] truncate" title={rt.intermediateStops.join(', ')}>
                        {rt.intermediateStops.length > 0 ? rt.intermediateStops.join(', ') : 'Direct run'}
                      </td>
                      <td className="py-3 font-medium">{rt.distanceKm} km ({rt.durationMinutes} min)</td>
                      <td className="py-3">
                        <span className="font-semibold text-[#2F4436]">{rt.assignedStudents}</span>
                        <span className="text-[#889B8E]"> / {rt.seatingCapacity} seats</span>
                      </td>
                      <td className="py-3">
                        <span>{rt.busId} ({rt.fuelType})</span>
                        <span className="text-[10px] text-[#889B8E] block">{rt.fuelEfficiencyKmPerL} km/L</span>
                      </td>
                      <td className="py-3">
                        <Pill tone={occupancyPct > 80 ? 'green' : occupancyPct < 60 ? 'amber' : 'sage'}>
                          {occupancyPct}%
                        </Pill>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditRoute(rt)}
                            className="p-1 text-[#788B7D] hover:text-[#285943] cursor-pointer"
                            title="Edit Route"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRoute(rt.id)}
                            className="p-1 text-[#A35C49] hover:text-[#7A3626] cursor-pointer"
                            title="Delete Route"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Optimization Recommendations Results UI */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-[#28352D]">Optimization Opportunities</h3>
              <p className="text-xs text-[#8A978D]">
                Grounded in passenger load limits, stop overlap, and realistic distance models
              </p>
            </div>
            <span className="text-xs font-semibold text-[#285943]">
              {proposals.length} active recommendation(s)
            </span>
          </div>

          {proposals.length === 0 ? (
            <Card className="p-8 text-center bg-[#FAFCF8]">
              <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-[#E7F1E5] text-[#285943]">
                <CheckCircle2 size={18} />
              </span>
              <p className="mt-3 text-sm font-semibold text-[#3D5245]">
                No route conflicts or consolidation candidates detected
              </p>
              <p className="mt-1 text-xs text-[#7F9083]">
                All active routes operate with balanced occupancy. Add more overlapping routes to explore multi-bus consolidation.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {proposals.map((prop) => {
                const isAccepted = prop.status === 'accepted'
                const isRejected = prop.status === 'rejected'
                return (
                  <Card
                    key={prop.id}
                    className={`p-5 transition-all ${
                      isAccepted
                        ? 'border-[#98BA93] bg-[#F7FBF6]'
                        : isRejected
                          ? 'opacity-60 border-[#E8EDE5]'
                          : 'hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm text-[#28352D]">{prop.title}</h4>
                          <Pill tone={isAccepted ? 'green' : prop.feasibility === 'High' ? 'green' : 'amber'}>
                            {isAccepted ? 'Accepted for Planning' : `${prop.feasibility} Feasibility`}
                          </Pill>
                        </div>
                        <p className="mt-1.5 text-xs text-[#6B7C70] leading-relaxed">
                          {prop.summary}
                        </p>
                      </div>
                    </div>

                    {/* Quick Metric Comparison Box */}
                    <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-[#F0F5ED] p-3 text-center text-xs">
                      <div>
                        <p className="text-[10px] text-[#78897D]">Distance Delta</p>
                        <p className="mt-0.5 font-bold text-[#285943]">
                          -{prop.estimatedDistanceReductionKm} km/day
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#78897D]">Fuel Savings</p>
                        <p className="mt-0.5 font-bold text-[#285943]">
                          ~{prop.estimatedFuelSavingsLiters} L/mo
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#78897D]">Estimated Cost</p>
                        <p className="mt-0.5 font-bold text-[#285943]">
                          ₹{prop.estimatedMonthlySavingsInr.toLocaleString('en-IN')}/mo
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#EEF3EC] pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProposal(prop)
                          setIsComparisonModalOpen(true)
                        }}
                        className="flex items-center gap-1 text-xs font-semibold text-[#285943] hover:underline cursor-pointer"
                      >
                        <span>Compare Routes</span>
                        <ChevronRight size={14} />
                      </button>

                      <div className="flex items-center gap-2">
                        {!isAccepted && (
                          <button
                            type="button"
                            onClick={() => handleRejectProposal(prop.id)}
                            className="rounded-lg px-2.5 py-1 text-xs text-[#994734] hover:bg-[#FDF2F0] cursor-pointer"
                          >
                            Reject
                          </button>
                        )}
                        <Button
                          variant={isAccepted ? 'secondary' : 'primary'}
                          onClick={() => handleAcceptProposal(prop.id)}
                          className="text-xs px-3 py-1.5"
                          disabled={isAccepted}
                        >
                          {isAccepted ? 'Planned' : 'Accept for Planning'}
                        </Button>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* AI Transport Advisor Section */}
      <ModuleAiAdvisor
        title="AI Transport Advisor"
        subtitle="Ask questions about travel patterns, fuel usage, student transportation, and route optimization."
        suggestedQuestions={[
          'Which route consumes the most fuel?',
          'Which buses have low occupancy?',
          'Can any of my routes be combined?',
          'How can I reduce transportation emissions?',
          'Compare the current routes with the proposed optimized routes.',
          'Which routes carry the most students per kilometre?',
        ]}
        onQuery={(q) => aiAdvisorsService.queryTransportationAdvisor(q, records, routes, proposals)}
        emptyStateDescription="Ask questions about passenger density, route mileage, fuel economics, and consolidation criteria. The assistant evaluates active bus routes and logged fleet travel."
      />

      {/* Transportation Record Modal */}
      <TransportationRecordModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        onSave={handleSaveRecord}
        initialRecord={editingRecord}
      />

      {/* Bus Route Modal */}
      <BusRouteModal
        isOpen={isRouteModalOpen}
        onClose={() => setIsRouteModalOpen(false)}
        onSave={handleSaveRoute}
        initialRoute={editingRoute}
      />

      {/* Route Comparison Modal */}
      <RouteComparisonModal
        proposal={selectedProposal}
        isOpen={isComparisonModalOpen}
        onClose={() => setIsComparisonModalOpen(false)}
        onAccept={handleAcceptProposal}
        onReject={handleRejectProposal}
      />
    </div>
  )
}
