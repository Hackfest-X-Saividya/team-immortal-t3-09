'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function CtaSection() {
  const router = useRouter()

  return (
    <section id="about" className="mx-6 mb-16 overflow-hidden rounded-[28px] bg-[#285943] lg:mx-auto lg:max-w-[1200px]">
      <div className="flex flex-col items-start justify-between gap-8 px-7 py-10 sm:px-12 lg:flex-row lg:items-center lg:py-14">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#B5CDAA]">
            START WITH CURIOSITY
          </p>
          <h2 className="mt-3 max-w-[560px] text-3xl font-semibold tracking-[-.04em] text-white sm:text-4xl">
            Better choices start with a clearer picture.
          </h2>
        </div>
        <Button
          onClick={() => router.push('/dashboard')}
          className="bg-white text-[#285943] hover:bg-[#F0F5ED]"
        >
          Explore demo <ArrowRight size={16} />
        </Button>
      </div>
    </section>
  )
}
