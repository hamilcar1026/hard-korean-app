'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import ThemeToggle from './ThemeToggle'

const links = [
  { href: '/', label: 'Home' },
  { href: '/vocabulary', label: 'Vocabulary' },
  { href: '/grammar', label: 'Grammar' },
  { href: '/quiz', label: 'Quiz' },
]

export default function NavBar() {
  const pathname = usePathname()
  const router   = useRouter()
  const { user, role, signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <nav className="sticky top-0 z-50 bg-nav-bg border-b border-border backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-black text-xl tracking-tight bg-gradient-to-r from-coral to-pink-soft bg-clip-text text-transparent">
          Hard Korean
        </Link>

        <div className="flex items-center gap-1">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                pathname === href
                  ? 'bg-gradient-to-r from-coral to-coral-light text-white shadow-sm'
                  : 'text-text-muted hover:text-text hover:bg-card-surface'
              }`}
            >
              {label}
            </Link>
          ))}

          <div className="ml-2 pl-2 border-l border-border flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <>
                {role === 'teacher' && (
                  <Link
                    href="/dashboard"
                    className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                      pathname === '/dashboard'
                        ? 'bg-gradient-to-r from-coral to-coral-light text-white shadow-sm'
                        : 'text-text-muted hover:text-text hover:bg-card-surface'
                    }`}
                  >
                    Dashboard
                  </Link>
                )}
                <span className="text-xs text-text-faint hidden sm:block max-w-[120px] truncate">
                  {user.email}
                </span>
                <button
                  onClick={handleSignOut}
                  className="px-3 py-1.5 rounded-xl text-sm font-medium text-text-muted hover:text-text hover:bg-card-surface transition-colors"
                >
                  Log Out
                </button>
              </>
            ) : (
              <Link
                href="/auth"
                className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                  pathname === '/auth'
                    ? 'bg-gradient-to-r from-coral to-coral-light text-white shadow-sm'
                    : 'text-text-muted hover:text-text hover:bg-card-surface'
                }`}
              >
                Log In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
