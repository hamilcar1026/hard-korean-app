'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { createClient, supabaseConfigured } from '@/lib/supabase'

type Mode = 'login' | 'register'

function getEmailRedirectUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (configuredUrl) {
    return `${configuredUrl.replace(/\/$/, '')}/auth`
  }

  if (typeof window !== 'undefined') {
    return `${window.location.origin}/auth`
  }

  return undefined
}

function isVerifiedUser(user: User | null | undefined) {
  return !!user?.email_confirmed_at
}

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  if (!supabaseConfigured) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 sm:py-20 text-center">
        <h1 className="text-2xl font-bold text-text mb-4">Auth not configured</h1>
        <p className="text-text-subtle text-sm leading-relaxed">
          Set <code className="text-coral-light">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
          <code className="text-coral-light">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in{' '}
          <code className="text-text-muted">.env.local</code> to enable authentication.
        </p>
        <Link href="/" className="mt-6 inline-block text-coral hover:text-coral-light transition-colors">
          Back to home
        </Link>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()

    try {
      if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: getEmailRedirectUrl(),
          },
        })
        if (error) throw error
        if (data.session && !isVerifiedUser(data.user)) {
          await supabase.auth.signOut()
        }
        setDone(true)
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        if (!isVerifiedUser(data.user)) {
          await supabase.auth.signOut()
          throw new Error('Please verify your email before logging in.')
        }
        router.push('/')
        router.refresh()
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 sm:py-20 text-center">
        <div className="text-4xl mb-4">Email sent</div>
        <h2 className="text-xl font-bold text-text mb-2">Check your email</h2>
        <p className="text-text-subtle text-sm leading-relaxed">
          We sent a confirmation link to <span className="text-text-muted">{email}</span>.
        </p>
        <p className="text-text-faint text-xs mt-3">
          The confirmation link should bring you back to this site.
        </p>
        <Link href="/" className="mt-6 inline-block text-coral hover:text-coral-light transition-colors">
          Back to home
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto w-full px-4 py-10 sm:py-16">
      <div className="flex bg-card border border-border rounded-xl p-1 mb-8">
        {(['login', 'register'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setError('') }}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
              mode === m
                ? 'text-white'
                : 'text-text-subtle hover:text-text-muted'
            }`}
            style={mode === m ? { background: 'linear-gradient(135deg, #FF6B6B, #FF8E9E)' } : {}}
          >
            {m === 'login' ? 'Log In' : 'Create Account'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-text-subtle mb-1.5 font-medium uppercase tracking-wide">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            className="w-full min-w-0 px-4 py-3 bg-card border border-border rounded-xl text-text placeholder-text-faint focus:outline-none focus:border-border-hover transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs text-text-subtle mb-1.5 font-medium uppercase tracking-wide">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            placeholder="••••••••"
            className="w-full min-w-0 px-4 py-3 bg-card border border-border rounded-xl text-text placeholder-text-faint focus:outline-none focus:border-border-hover transition-colors"
          />
        </div>

        {error && (
          <p
            className="text-coral text-sm rounded-xl px-3 py-2 border"
            style={{ background: 'var(--t-error-box-bg)', borderColor: 'var(--t-error-box-border)' }}
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-coral w-full py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '...' : mode === 'login' ? 'Log In' : 'Create Account'}
        </button>
      </form>
    </div>
  )
}
