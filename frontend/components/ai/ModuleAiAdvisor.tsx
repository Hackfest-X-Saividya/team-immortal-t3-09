'use client'

import React, { useState } from 'react'
import {
  ArrowRight,
  BrainCircuit,
  Calculator,
  RotateCcw,
  Sparkles,
  User,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Pill } from '@/components/ui/Pill'
import type { AiChatMessage } from '@/types/sustainability'

export interface ModuleAiAdvisorProps {
  title: string
  subtitle: string
  badgeText?: string
  suggestedQuestions: string[]
  onQuery: (question: string) => Promise<AiChatMessage>
  emptyStateDescription?: string
}

export function ModuleAiAdvisor({
  title,
  subtitle,
  badgeText = 'DATA-GROUNDED ADVISOR',
  suggestedQuestions,
  onQuery,
  emptyStateDescription,
}: ModuleAiAdvisorProps) {
  const [messages, setMessages] = useState<AiChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const handleAsk = async (question: string) => {
    const q = question.trim()
    if (!q || isProcessing) return

    const userMsg: AiChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsProcessing(true)

    try {
      const response = await onQuery(q)
      setMessages((prev) => [...prev, response])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'An error occurred while evaluating your workspace data. Please try another query.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    } finally {
      setIsProcessing(false)
    }
  }

  const handleClear = () => {
    setMessages([])
  }

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#EDF1EB] pb-5">
        <div className="flex items-center gap-3.5">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#285943] text-white shadow-xs">
            <BrainCircuit size={20} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#2F4436]">{title}</h2>
              <Pill tone="green">{badgeText}</Pill>
            </div>
            <p className="mt-1 text-xs text-[#8A978D]">{subtitle}</p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-1.5 self-start sm:self-auto rounded-lg px-2.5 py-1.5 text-xs text-[#7A887D] hover:bg-[#F2F6F0] hover:text-[#285943] cursor-pointer"
          >
            <RotateCcw size={13} />
            <span>Clear conversation</span>
          </button>
        )}
      </div>

      {/* Suggested Question Chips */}
      <div className="mt-4">
        <p className="text-[11px] font-medium uppercase tracking-[.14em] text-[#9AA69C]">
          Suggested Questions
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {suggestedQuestions.map((sq) => (
            <button
              key={sq}
              type="button"
              onClick={() => handleAsk(sq)}
              disabled={isProcessing}
              className="rounded-full border border-[#DCE5DA] bg-[#F8FAF6] px-3.5 py-1.5 text-xs font-medium text-[#465B4E] transition-all hover:border-[#98BA93] hover:bg-[#EEF5EC] hover:text-[#285943] cursor-pointer disabled:opacity-50"
            >
              {sq}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation Thread */}
      <div className="mt-6 rounded-2xl border border-[#E3EAE1] bg-[#FAFCF8] p-4 sm:p-5">
        {messages.length === 0 ? (
          <div className="py-8 text-center">
            <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-[#E7F1E5] text-[#285943]">
              <Sparkles size={18} />
            </span>
            <p className="mt-3 text-sm font-semibold text-[#3D5245]">
              Ask questions grounded in your actual data
            </p>
            <p className="mx-auto mt-1 max-w-[500px] text-xs leading-5 text-[#829286]">
              {emptyStateDescription ||
                'Select a suggested question above or type your own question. The advisor evaluates your active records and applies calculation functions to provide verifiable estimates.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#285943] text-white">
                    <BrainCircuit size={15} />
                  </span>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-4 text-xs leading-6 ${
                    msg.role === 'user'
                      ? 'bg-[#285943] text-white font-medium rounded-tr-xs'
                      : 'bg-white border border-[#E0E7DE] text-[#36493D] shadow-xs rounded-tl-xs'
                  }`}
                >
                  <div className="whitespace-pre-line">{msg.content}</div>

                  {/* Calculation Breakdown Card */}
                  {msg.calculationBreakdown && (
                    <div className="mt-3 rounded-xl border border-[#DCE6DA] bg-[#F7FAF5] p-3 text-xs text-[#455A4C]">
                      <div className="flex items-center gap-1.5 font-semibold text-[#285943]">
                        <Calculator size={13} />
                        <span>Calculation Engine Breakdown</span>
                      </div>

                      <div className="mt-2 space-y-1.5 font-mono text-[11px]">
                        <p className="text-[#677A6D]">
                          <span className="font-semibold text-[#36493D]">Formula:</span>{' '}
                          {msg.calculationBreakdown.formula}
                        </p>
                        <div className="border-t border-[#E8EFE5] pt-1.5">
                          {Object.entries(msg.calculationBreakdown.inputs).map(([k, v]) => (
                            <div key={k} className="flex justify-between">
                              <span className="text-[#7A8D80]">{k}:</span>
                              <span className="font-semibold text-[#2F4436]">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                        {msg.calculationBreakdown.result && (
                          <div className="border-t border-[#DDE7DA] pt-1.5 flex justify-between font-bold text-[#285943]">
                            <span>Result:</span>
                            <span>{msg.calculationBreakdown.result}</span>
                          </div>
                        )}
                      </div>

                      {msg.calculationBreakdown.assumptions &&
                        msg.calculationBreakdown.assumptions.length > 0 && (
                          <div className="mt-2.5 border-t border-[#E8EFE5] pt-2 text-[10px] text-[#788B7E]">
                            <span className="font-semibold text-[#506657]">Notes & Assumptions:</span>
                            <ul className="mt-1 list-disc pl-4 space-y-0.5">
                              {msg.calculationBreakdown.assumptions.map((a, i) => (
                                <li key={i}>{a}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                    </div>
                  )}

                  {/* Follow-up question chips */}
                  {msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-[#EEF3EC]">
                      <p className="text-[10px] font-semibold text-[#7E9083]">Follow-up questions:</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {msg.suggestedFollowUps.map((fu) => (
                          <button
                            key={fu}
                            type="button"
                            onClick={() => handleAsk(fu)}
                            className="rounded-lg bg-[#F0F5ED] px-2 py-1 text-[11px] font-medium text-[#285943] hover:bg-[#E3EFE0] cursor-pointer"
                          >
                            {fu}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="mt-2 text-[10px] opacity-60 text-right">{msg.timestamp}</p>
                </div>

                {msg.role === 'user' && (
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#DDEBDD] text-[#285943]">
                    <User size={15} />
                  </span>
                )}
              </div>
            ))}

            {isProcessing && (
              <div className="flex gap-3 items-center text-xs text-[#7A8B7E] italic py-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#285943] text-white">
                  <BrainCircuit size={15} className="animate-spin" />
                </span>
                <span>Calculating response from your workspace records…</span>
              </div>
            )}
          </div>
        )}

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleAsk(input)
          }}
          className="mt-4 flex gap-2 border-t border-[#E8EFE6] pt-4"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask ${title} a question about your data...`}
            disabled={isProcessing}
            className="flex-1 rounded-xl border border-[#DCE4DA] bg-white px-3.5 py-2.5 text-xs text-[#28352D] placeholder-[#9AA59C] outline-none focus:border-[#285943] focus:ring-1 focus:ring-[#285943]"
          />
          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            className="flex items-center gap-1.5 rounded-xl bg-[#285943] px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#1F4635] disabled:opacity-50 cursor-pointer"
          >
            <span>Ask</span>
            <ArrowRight size={14} />
          </button>
        </form>
      </div>
    </Card>
  )
}
