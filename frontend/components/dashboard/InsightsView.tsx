'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, BrainCircuit, Lightbulb, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/Card'
import { PageTitle } from '@/components/ui/PageTitle'
import { Pill } from '@/components/ui/Pill'
import { demoService } from '@/services/demo.service'

export function InsightsView() {
  const router = useRouter()
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')

  const ask = (q: string) => {
    setQuestion(q)
    const reply = demoService.getAiAnswer(q)
    setAnswer(reply)
  }

  const sampleQuestions = [
    'What is my largest emission source?',
    'How can I reduce electricity costs?',
    'How can we improve recycling?',
  ]

  return (
    <div className="space-y-6">
      <PageTitle
        eyebrow="DECISION SUPPORT"
        title="Sustainability insights"
        description="A transparent, rule-based assistant for exploring what your demo data might be saying."
        action={<Pill tone="amber">Demo assistant</Pill>}
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_370px]">
        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#E7F1E5] text-[#285943]">
                <Sparkles size={18} />
              </span>
              <div>
                <h2 className="font-semibold text-[#405448]">Your biggest opportunities</h2>
                <p className="mt-1 text-xs text-[#8A978D]">Prioritized from the displayed demonstration data</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                ['01', 'Electricity', '46% of emissions', '₹2,140/mo'],
                ['02', 'Transport', '31% of emissions', '₹1,680/mo'],
                ['03', 'Waste', '52% recovery', '₹820/mo'],
              ].map((x) => (
                <div key={x[1]} className="rounded-xl border border-[#E7EDE5] p-4">
                  <span className="text-[10px] font-semibold tracking-[.12em] text-[#9BA79D]">
                    {x[0]}
                  </span>
                  <p className="mt-3 text-sm font-medium text-[#506257]">{x[1]}</p>
                  <p className="mt-2 text-xs text-[#7E8D81]">{x[2]}</p>
                  <p className="mt-4 text-xs font-semibold text-[#4B8A63]">{x[3]} estimated</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-[#405448]">Recommended actions</h2>
                <p className="mt-1 text-xs text-[#8A978D]">Small steps, clearly scoped</p>
              </div>
              <Button variant="secondary" onClick={() => router.push('/dashboard/simulator')}>
                Open simulator <ArrowRight size={14} />
              </Button>
            </div>

            <div className="mt-5 space-y-3">
              {[
                ['Switch common-area lighting to LED', 'Electricity', 'High impact', '₹2,140/mo'],
                ['Consolidate low-use transport routes', 'Transport', 'Medium impact', '₹1,680/mo'],
                ['Expand source separation stations', 'Waste', 'Quick win', '₹820/mo'],
              ].map(([a, b, c, d]) => (
                <div key={a} className="flex items-center gap-3 rounded-xl bg-[#F7F9F5] p-3">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-[#285943]">
                    <Lightbulb size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#4A5D50]">{a}</p>
                    <p className="mt-1 text-[10px] text-[#8D998F]">
                      {b} · {c}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-[#4B8A63]">{d}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card className="flex min-h-[430px] flex-col p-5">
          <div className="flex items-center gap-3 border-b border-[#EDF1EB] pb-4">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#285943] text-white">
              <BrainCircuit size={17} />
            </span>
            <div>
              <h2 className="font-semibold text-[#405448]">Ask CarbonIQ</h2>
              <p className="text-[10px] text-[#93A097]">Local demo responses · not a live AI model</p>
            </div>
          </div>

          <div className="flex-1 py-5">
            <div className="rounded-xl rounded-tl-sm bg-[#F0F5ED] p-3 text-xs leading-5 text-[#5E7063]">
              I can help you explore the patterns in your demo data. Try a question below.
            </div>
            {answer && (
              <div className="mt-4 rounded-xl rounded-tr-sm bg-[#285943] p-3 text-xs leading-5 text-white/90 animate-in fade-in">
                {answer}
              </div>
            )}
          </div>

          <div className="space-y-2">
            {sampleQuestions.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => ask(q)}
                className="w-full rounded-lg border border-[#E1E9DF] px-3 py-2 text-left text-[11px] text-[#6E7E73] hover:border-[#B5CEB1] hover:bg-[#F7FAF5] cursor-pointer"
              >
                {q}
              </button>
            ))}
            <div className="mt-3 flex gap-2">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && question.trim()) ask(question)
                }}
                placeholder="Ask a demo question..."
                className="field mt-0"
              />
              <Button
                onClick={() => question.trim() && ask(question)}
                className="shrink-0 px-3"
              >
                <ArrowRight size={15} />
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <div className="rounded-xl border border-[#DFEBDD] bg-[#F0F6EE] px-4 py-3 text-xs text-[#718074]">
        Insights are generated from predefined rules and displayed demo values. Connect a FastAPI
        service and a model later to enable production intelligence.
      </div>
    </div>
  )
}
