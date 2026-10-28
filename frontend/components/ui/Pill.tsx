'use client'

import React from 'react'

export interface PillProps {
  children: React.ReactNode
  tone?: 'green' | 'amber' | 'sage'
  className?: string
}

export function Pill({ children, tone = 'green', className = '' }: PillProps) {
  const toneClasses =
    tone === 'amber'
      ? 'bg-[#FBF1D8] text-[#8A6C2E]'
      : tone === 'sage'
        ? 'bg-[#EDF2EA] text-[#60745F]'
        : 'bg-[#E7F1E5] text-[#285943]'

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${toneClasses} ${className}`}
    >
      {children}
    </span>
  )
}
