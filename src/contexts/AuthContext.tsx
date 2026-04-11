'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { createClient, supabaseConfigured } from '@/lib/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  role: string | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  role: null,
  loading: false,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole]       = useState<string | null>(null)
  const [loading, setLoading] = useState(supabaseConfigured)

  const fetchRole = async (userId: string, userEmail?: string) => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    if (error) {
      console.warn('[AuthContext] fetchRole error:', error.message, '— falling back to email check')
      // profiles 테이블이 없거나 row가 없으면 env 이메일로 판단
      const teacherEmail = process.env.NEXT_PUBLIC_TEACHER_EMAIL
      setRole(teacherEmail && userEmail === teacherEmail ? 'teacher' : 'student')
      return
    }

    console.log('[AuthContext] fetched role:', data?.role)
    setRole(data?.role ?? 'student')
  }

  useEffect(() => {
    if (!supabaseConfigured) return

    const supabase = createClient()

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      if (data.session?.user) {
        fetchRole(data.session.user.id, data.session.user.email)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) fetchRole(s.user.id, s.user.email)
      else setRole(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    if (!supabaseConfigured) return
    await createClient().auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
