'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/Card'
import { Logo } from '@/components/ui/Logo'
import { Pill } from '@/components/ui/Pill'
import { useAuth } from '@/context/auth-context'
import { isValidEmail } from '@/lib/validation'
import type { AuthMode } from '@/types/auth'

export interface AuthFormProps {
  mode: AuthMode
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter()
  const { signIn, signUp } = useAuth()
  const isSignup = mode === 'signup'

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (isSignup && !name.trim()) {
      return setError('Please enter your full name.')
    }
    if (!isValidEmail(email)) {
      return setError('Please enter a valid email address.')
    }
    if (!password) {
      return setError('Please enter a password.')
    }
    if (isSignup && password !== confirmPassword) {
      return setError('Passwords do not match.')
    }

    setSubmitted(true)

    if (isSignup) {
      signUp({
        name: name.trim(),
        email: email.trim(),
        workspaceName: workspaceName.trim() || undefined,
      })
    } else {
      signIn(email.trim())
    }

    window.setTimeout(() => {
      router.push('/dashboard')
    }, 450)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F8F2] px-5 py-10">
      <div className="w-full max-w-md">
        <Logo onClick={() => router.push('/')} />
        <Card className="mt-8 p-6 sm:p-8">
          <Pill>{isSignup ? 'CREATE YOUR WORKSPACE' : 'WELCOME BACK'}</Pill>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-.05em] text-[#234A36]">
            {isSignup ? 'Start with a clearer picture.' : 'Sign in to CarbonIQ.'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#7A887D]">
            Frontend demonstration mode. Simulated authenticated session.
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
            {isSignup && (
              <label className="block text-sm text-[#536458]">
                Full name
                <input
                  className="field"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    if (error === 'Please enter your full name.' && e.target.value.trim()) {
                      setError('')
                    }
                  }}
                />
              </label>
            )}

            <label className="block text-sm text-[#536458]">
              Email
              <input
                className="field"
                type="email"
                value={email}
                onChange={(e) => {
                  const val = e.target.value
                  setEmail(val)
                  if (error === 'Please enter a valid email address.' && isValidEmail(val)) {
                    setError('')
                  }
                }}
              />
            </label>

            <label className="block text-sm text-[#536458]">
              Password
              <input
                className="field"
                type="password"
                value={password}
                onChange={(e) => {
                  const val = e.target.value
                  setPassword(val)
                  if (error === 'Please enter a password.' && val) {
                    setError('')
                  } else if (error === 'Passwords do not match.' && val === confirmPassword) {
                    setError('')
                  }
                }}
              />
            </label>

            {isSignup && (
              <>
                <label className="block text-sm text-[#536458]">
                  Confirm password
                  <input
                    className="field"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => {
                      const val = e.target.value
                      setConfirmPassword(val)
                      if (error === 'Passwords do not match.' && val === password) {
                        setError('')
                      }
                    }}
                  />
                </label>

                <label className="block text-sm text-[#536458]">
                  Workspace name <span className="text-xs text-[#8A978D] font-normal">(optional)</span>
                  <input
                    className="field"
                    placeholder="e.g., Campus Operations or Team Eco"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                  />
                </label>
              </>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-lg bg-[#FBF1D8] px-3 py-2 text-xs text-[#8A6C2E] animate-in fade-in"
              >
                {error}
              </p>
            )}

            <Button type="submit" className="w-full">
              {submitted
                ? 'Opening workspace…'
                : isSignup
                  ? 'Create workspace'
                  : 'Sign in'}
            </Button>
          </form>

          <div className="mt-5 flex justify-between text-xs text-[#7A887D]">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="hover:text-[#285943] cursor-pointer"
            >
              Back to home
            </button>
            {isSignup ? (
              <button
                type="button"
                onClick={() => router.push('/signin')}
                className="font-medium text-[#285943] cursor-pointer"
              >
                Already have an account? Sign in
              </button>
            ) : (
              <button
                type="button"
                onClick={() => router.push('/signup')}
                className="font-medium text-[#285943] cursor-pointer"
              >
                Sign up
              </button>
            )}
          </div>
        </Card>
      </div>
    </main>
  )
}
