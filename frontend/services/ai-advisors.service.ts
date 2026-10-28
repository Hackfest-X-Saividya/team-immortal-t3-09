import {
  BENCHMARK_PRICES,
  calculateElectricityEmissions,
  calculateElectricitySavingsScenario,
  calculateTransportationEmissions,
  calculateWasteEmissions,
  calculateWasteRecoveryRate,
  EMISSION_FACTORS,
} from '@/lib/calculations'
import type {
  AiChatMessage,
  BusRoute,
  ElectricityRecord,
  RouteOptimizationProposal,
  TransportationRecord,
  WasteRecord,
} from '@/types/sustainability'

/**
 * AI Advisors Service
 * Provides deterministic, data-grounded responses using actual module records
 * and calculation functions. Prepares clean payload contracts for future FastAPI endpoints.
 */

export const aiAdvisorsService = {
  /**
   * Electricity AI Advisor response engine
   */
  async queryElectricityAdvisor(
    question: string,
    records: ElectricityRecord[]
  ): Promise<AiChatMessage> {
    const q = question.toLowerCase().trim()
    const id = `ai-elec-${Date.now()}`
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    // If no records exist
    if (!records || records.length === 0) {
      return {
        id,
        role: 'assistant',
        content:
          'No electricity records are available in your workspace yet. Please add a monthly electricity record using the "Add record" button above to enable calculated insights.',
        timestamp,
      }
    }

    // Sort records chronologically
    const sorted = [...records].sort((a, b) => a.reportingMonth.localeCompare(b.reportingMonth))
    const latest = sorted[sorted.length - 1]
    const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null

    // Question 1: Reduce by % (e.g., 15%)
    const reductionMatch = q.match(/(\d+)%/)
    if (q.includes('save') || q.includes('reduc') || reductionMatch) {
      const percent = reductionMatch ? parseInt(reductionMatch[1], 10) : 15
      const scenario = calculateElectricitySavingsScenario(latest.consumptionKwh, percent)

      return {
        id,
        role: 'assistant',
        content: `Under a modeled **${percent}% electricity reduction** for your latest recorded period (${latest.reportingMonth}), your workspace would cut approximately **${scenario.kwhReduction} kWh**, reducing estimated monthly emissions by **${scenario.emissionsReduction} kg CO₂e**.`,
        timestamp,
        calculationBreakdown: {
          formula: 'Potential Reduction = Current kWh × (Reduction % ÷ 100)',
          inputs: {
            'Current consumption': `${latest.consumptionKwh.toLocaleString()} kWh`,
            'Target reduction': `${percent}%`,
            'Estimated variable tariff': `₹${BENCHMARK_PRICES.electricityTariffInr}/kWh`,
            'Grid emission factor': `${EMISSION_FACTORS.electricityGrid} kg CO₂e/kWh`,
          },
          assumptions: scenario.assumptions,
          result: `₹${scenario.costSavings.toLocaleString('en-IN')}/month estimated savings (${scenario.kwhReduction} kWh / ${scenario.emissionsReduction} kg CO₂e)`,
        },
        suggestedFollowUps: [
          'What actions can reduce my electricity emissions?',
          'Compare this month with the previous month.',
          'Which month had the highest electricity consumption?',
        ],
      }
    }

    // Question 2: Highest consumption month
    if (q.includes('highest') || q.includes('peak') || q.includes('maximum')) {
      const highest = [...sorted].sort((a, b) => b.consumptionKwh - a.consumptionKwh)[0]
      return {
        id,
        role: 'assistant',
        content: `Your highest recorded consumption was in **${highest.reportingMonth}** at **${highest.consumptionKwh.toLocaleString()} kWh** (resulting in **${highest.calculatedEmissionsKg.toLocaleString()} kg CO₂e** emissions).`,
        timestamp,
        calculationBreakdown: {
          formula: 'Peak Month = max(consumptionKwh across records)',
          inputs: {
            'Peak Period': highest.reportingMonth,
            Consumption: `${highest.consumptionKwh.toLocaleString()} kWh`,
            'Calculated emissions': `${highest.calculatedEmissionsKg.toLocaleString()} kg CO₂e`,
          },
          result: `Peak observed in ${highest.reportingMonth} across ${sorted.length} recorded periods`,
        },
        suggestedFollowUps: [
          'Why is my electricity consumption increasing?',
          'How much can I save by reducing electricity usage by 15%?',
        ],
      }
    }

    // Question 3: Compare this month with previous month
    if (q.includes('compare') || q.includes('previous') || q.includes('trend')) {
      if (!previous) {
        return {
          id,
          role: 'assistant',
          content: `You currently have 1 record for **${latest.reportingMonth}** (${latest.consumptionKwh.toLocaleString()} kWh). Add a record for a prior period to compare monthly trajectories.`,
          timestamp,
        }
      }

      const diffKwh = latest.consumptionKwh - previous.consumptionKwh
      const pctChange = Number(((diffKwh / previous.consumptionKwh) * 100).toFixed(1))
      const direction = diffKwh > 0 ? 'higher' : 'lower'

      return {
        id,
        role: 'assistant',
        content: `Comparing **${latest.reportingMonth}** (${latest.consumptionKwh.toLocaleString()} kWh) with **${previous.reportingMonth}** (${previous.consumptionKwh.toLocaleString()} kWh): your consumption was **${Math.abs(diffKwh).toLocaleString()} kWh (${Math.abs(pctChange)}%) ${direction}**.`,
        timestamp,
        calculationBreakdown: {
          formula: 'Delta % = ((Latest kWh - Previous kWh) ÷ Previous kWh) × 100',
          inputs: {
            [previous.reportingMonth]: `${previous.consumptionKwh} kWh`,
            [latest.reportingMonth]: `${latest.consumptionKwh} kWh`,
            Difference: `${diffKwh > 0 ? '+' : ''}${diffKwh} kWh`,
          },
          result: `${Math.abs(pctChange)}% ${direction} than preceding period`,
        },
        suggestedFollowUps: [
          'What actions can reduce my electricity emissions?',
          'How much can I save by reducing electricity usage by 15%?',
        ],
      }
    }

    // Question 4: Building or department breakdown
    if (q.includes('building') || q.includes('department')) {
      const byDept = new Map<string, number>()
      sorted.forEach((r) => {
        const dept = r.buildingOrDepartment || 'Main Facility'
        byDept.set(dept, (byDept.get(dept) || 0) + r.consumptionKwh)
      })

      const summaryList = Array.from(byDept.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([dept, kwh]) => `• **${dept}**: ${kwh.toLocaleString()} kWh (${calculateElectricityEmissions(kwh)} kg CO₂e)`)
        .join('\n')

      return {
        id,
        role: 'assistant',
        content: `Here is the consumption distribution across recorded departments and buildings:\n\n${summaryList}`,
        timestamp,
        suggestedFollowUps: [
          'What actions can reduce my electricity emissions?',
          'How much can I save by reducing electricity usage by 15%?',
        ],
      }
    }

    // Default: actionable recommendations
    return {
      id,
      role: 'assistant',
      content: `Based on your **${latest.reportingMonth}** consumption of **${latest.consumptionKwh.toLocaleString()} kWh** (${latest.calculatedEmissionsKg} kg CO₂e), here are 3 verified efficiency opportunities:\n\n1. **HVAC & Cooling Optimization**: Adjust cooling thermostats to 24°C–25°C. Modeled variable savings: ~8% (~${Math.round(latest.consumptionKwh * 0.08)} kWh/mo).\n2. **LED & Daylighting Sensors**: Retrofit remaining non-LED fixtures in common halls.\n3. **Off-hours Base-load Audit**: Power down idle machinery and lab monitors over weekends.`,
      timestamp,
      suggestedFollowUps: [
        'How much can I save by reducing electricity usage by 15%?',
        'Compare this month with the previous month.',
        'Which month had the highest electricity consumption?',
      ],
    }
  },

  /**
   * Transportation AI Advisor response engine
   */
  async queryTransportationAdvisor(
    question: string,
    records: TransportationRecord[],
    routes: BusRoute[],
    optimizations: RouteOptimizationProposal[]
  ): Promise<AiChatMessage> {
    const q = question.toLowerCase().trim()
    const id = `ai-trans-${Date.now()}`
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    // Question 1: Routes consolidation / optimization
    if (q.includes('combin') || q.includes('optimi') || q.includes('consolidat') || q.includes('proposal')) {
      if (optimizations.length === 0) {
        return {
          id,
          role: 'assistant',
          content: `Currently, no route consolidation meets the strict capacity criteria without overcrowding buses. Add more route segments or adjust bus capacities in the **Smart Bus Route Optimization** section above to re-evaluate.`,
          timestamp,
        }
      }

      const topOpt = optimizations[0]
      return {
        id,
        role: 'assistant',
        content: `Yes! Our optimization engine identified an opportunity to **${topOpt.title}**.\n\n${topOpt.reason}\n\n• **Distance reduction**: ~${topOpt.estimatedDistanceReductionKm} km per run\n• **Monthly fuel savings**: ~${topOpt.estimatedFuelSavingsLiters} Litres\n• **Monthly cost savings**: ~₹${topOpt.estimatedMonthlySavingsInr.toLocaleString('en-IN')}\n• **Emissions reduction**: ~${topOpt.estimatedEmissionsReductionKg} kg CO₂e\n\n*Review and accept this proposal under the Smart Bus Route Optimization table.*`,
        timestamp,
        calculationBreakdown: {
          formula: 'Fuel Savings = Distance Reduction (km) ÷ Fuel Efficiency (km/L) × Operating Days',
          inputs: {
            'Current combined distance': `${topOpt.currentConfig.totalDistanceKm} km`,
            'Proposed combined route': `${topOpt.proposedConfig.totalDistanceKm} km`,
            'Distance delta': `-${topOpt.estimatedDistanceReductionKm} km`,
            'Students served': `${topOpt.proposedConfig.studentsServed} students`,
          },
          result: `~₹${topOpt.estimatedMonthlySavingsInr.toLocaleString('en-IN')}/month in planned savings`,
        },
        suggestedFollowUps: [
          'Which buses have low occupancy?',
          'Which route consumes the most fuel?',
          'Compare the current routes with the proposed optimized routes.',
        ],
      }
    }

    // Question 2: Low occupancy buses
    if (q.includes('occupan') || q.includes('capacity') || q.includes('underutil')) {
      const underutilized = routes
        .map((r) => ({
          name: r.routeName,
          students: r.assignedStudents,
          capacity: r.seatingCapacity,
          occupancyPct: Math.round((r.assignedStudents / r.seatingCapacity) * 100),
        }))
        .filter((r) => r.occupancyPct < 75)
        .sort((a, b) => a.occupancyPct - b.occupancyPct)

      if (underutilized.length === 0) {
        return {
          id,
          role: 'assistant',
          content: 'All active bus routes are operating at healthy occupancy levels (>75% capacity).',
          timestamp,
        }
      }

      const list = underutilized
        .map((u) => `• **${u.name}**: ${u.occupancyPct}% occupancy (${u.students}/${u.capacity} seats filled)`)
        .join('\n')

      return {
        id,
        role: 'assistant',
        content: `The following bus routes are currently operating with low occupancy (<75%):\n\n${list}\n\n*These are the primary candidates for consolidation in the Smart Bus Route Optimization tool.*`,
        timestamp,
        suggestedFollowUps: [
          'Can any of my routes be combined?',
          'Which route consumes the most fuel?',
        ],
      }
    }

    // Question 3: Which route consumes most fuel
    if (q.includes('fuel') || q.includes('consum') || q.includes('highest')) {
      const fuelRanked = [...routes]
        .map((r) => {
          const dailyFuel = Number(((r.distanceKm * r.tripsPerDay) / r.fuelEfficiencyKmPerL).toFixed(1))
          return {
            name: r.routeName,
            dailyFuel,
            monthlyFuel: Math.round(dailyFuel * 22),
            dist: r.distanceKm,
          }
        })
        .sort((a, b) => b.dailyFuel - a.dailyFuel)

      if (fuelRanked.length > 0) {
        const top = fuelRanked[0]
        return {
          id,
          role: 'assistant',
          content: `**${top.name}** consumes the most fuel at approximately **${top.dailyFuel} Litres/day** (~${top.monthlyFuel} Litres/month across 22 operating days) covering a route distance of ${top.dist} km.`,
          timestamp,
          calculationBreakdown: {
            formula: 'Daily Fuel = (Distance × Trips) ÷ Fuel Efficiency (km/L)',
            inputs: {
              Route: top.name,
              'Daily Fuel': `${top.dailyFuel} L`,
              'Monthly Fuel': `${top.monthlyFuel} L`,
            },
            result: `Top fuel consumer: ${top.name}`,
          },
          suggestedFollowUps: [
            'Can any of my routes be combined?',
            'Which buses have low occupancy?',
          ],
        }
      }
    }

    // Default response: general mobility recommendations
    return {
      id,
      role: 'assistant',
      content:
        'To reduce transportation emissions, prioritize these verified operational steps:\n\n1. **Consolidate Low-Use Bus Corridors**: Merge routes serving overlapping pickup sectors with under 65% occupancy.\n2. **Routine Vehicle Maintenance**: Ensure tyre pressure checks and engine servicing every 5,000 km (~4-6% fuel economy gain).\n3. **Carpooling & Public Transit Incentives**: Encourage staff carpooling programs for daily commute legs.',
      timestamp,
      suggestedFollowUps: [
        'Can any of my routes be combined?',
        'Which buses have low occupancy?',
        'Which route consumes the most fuel?',
      ],
    }
  },

  /**
   * Waste AI Advisor response engine
   */
  async queryWasteAdvisor(
    question: string,
    records: WasteRecord[]
  ): Promise<AiChatMessage> {
    const q = question.toLowerCase().trim()
    const id = `ai-waste-${Date.now()}`
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    if (!records || records.length === 0) {
      return {
        id,
        role: 'assistant',
        content:
          'No waste records found in your workspace yet. Please add a record using the "Add record" button above to enable waste metrics and advisor analytics.',
        timestamp,
      }
    }

    const totalGenerated = records.reduce((acc, r) => acc + r.quantityKg, 0)
    const totalRecycled = records
      .filter((r) => r.treatmentMethod === 'Recycling' || r.category === 'Recyclable')
      .reduce((acc, r) => acc + r.quantityKg, 0)
    const recoveryRate = calculateWasteRecoveryRate(totalRecycled, totalGenerated)

    // Question 1: Recycling rate
    if (q.includes('recycl') || q.includes('rate') || q.includes('recover')) {
      return {
        id,
        role: 'assistant',
        content: `Your current measured **recovery rate is ${recoveryRate}%** (${totalRecycled.toLocaleString()} kg recovered out of ${totalGenerated.toLocaleString()} kg total generated).`,
        timestamp,
        calculationBreakdown: {
          formula: 'Recovery Rate % = (Recycled Waste kg ÷ Total Waste Generated kg) × 100',
          inputs: {
            'Total generated': `${totalGenerated.toLocaleString()} kg`,
            'Recycled & recovered': `${totalRecycled.toLocaleString()} kg`,
          },
          result: `${recoveryRate}% recovery rate across all active records`,
        },
        suggestedFollowUps: [
          'Which waste category contributes the most to our total waste?',
          'What practical steps could reduce organic waste?',
          'How can we improve waste segregation?',
        ],
      }
    }

    // Question 2: Category breakdown
    if (q.includes('category') || q.includes('breakdown') || q.includes('contribut') || q.includes('most')) {
      const byCat = new Map<string, number>()
      records.forEach((r) => {
        byCat.set(r.category, (byCat.get(r.category) || 0) + r.quantityKg)
      })

      const sortedCat = Array.from(byCat.entries()).sort((a, b) => b[1] - a[1])
      const topCat = sortedCat[0]
      const catList = sortedCat
        .map(([cat, kg]) => `• **${cat}**: ${kg.toLocaleString()} kg (${Math.round((kg / totalGenerated) * 100)}%)`)
        .join('\n')

      return {
        id,
        role: 'assistant',
        content: `**${topCat[0]}** is your largest waste stream at **${topCat[1].toLocaleString()} kg** (${Math.round((topCat[1] / totalGenerated) * 100)}% of total waste).\n\nCategory breakdown:\n${catList}`,
        timestamp,
        calculationBreakdown: {
          formula: 'Category Share % = (Category Quantity ÷ Total Generated) × 100',
          inputs: {
            [topCat[0]]: `${topCat[1]} kg`,
            Total: `${totalGenerated} kg`,
          },
          result: `${topCat[0]} leads with ${Math.round((topCat[1] / totalGenerated) * 100)}% share`,
        },
        suggestedFollowUps: [
          'What practical steps could reduce organic waste?',
          'How can we improve our recycling rate?',
        ],
      }
    }

    // Question 3: How to improve segregation / organic waste
    if (q.includes('segregat') || q.includes('organic') || q.includes('compost')) {
      return {
        id,
        role: 'assistant',
        content:
          'Here are 3 concrete interventions to improve waste segregation and organic recovery:\n\n1. **Dual-Bin Stations at Cafeterias**: Provide clearly labelled bins (Wet/Compostable vs Dry/Recyclable) at every collection station.\n2. **On-Site Composting Unit**: Divert cafeteria and horticultural waste into an aerobic composter, avoiding ~1.15 kg CO₂e per kg diverted from landfill.\n3. **Vendor Segregation SLA**: Require waste collection partners to issue weigh-bridge receipts categorizing recyclables vs general refuse.',
        timestamp,
        suggestedFollowUps: [
          'Which waste category contributes the most to our total waste?',
          'How can we improve our recycling rate?',
        ],
      }
    }

    // Default response: overall waste snapshot
    return {
      id,
      role: 'assistant',
      content: `Your workspace has logged a cumulative **${totalGenerated.toLocaleString()} kg** of waste with an estimated **${recoveryRate}% recovery rate**.\n\nDiverting recyclable and organic materials away from open landfills is your highest-impact action in this module.`,
      timestamp,
      suggestedFollowUps: [
        'Which waste category contributes the most to our total waste?',
        'How can we improve our recycling rate?',
        'How can we improve waste segregation?',
      ],
    }
  },
}
