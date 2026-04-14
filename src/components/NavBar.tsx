'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import ThemeToggle from './ThemeToggle'

const links = [
  { href: '/', label: 'Home' },
  { href: '/vocabulary', label: 'Vocabulary' },
  { href: '/quiz', label: 'Vocabulary Quiz' },
  { href: '/grammar', label: 'Grammar' },
  { href: '/grammar-quiz', label: 'Grammar Quiz' },
  { href: '/favorites', label: 'Favorites' },
  { href: '/memory', label: 'Memory' },
  { href: '/crossword', label: 'Crossword' },
]

export default function NavBar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, role, signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    setMobileOpen(false)
    router.push('/')
    router.refresh()
  }

  const closeMobileMenu = () => setMobileOpen(false)

  const navLinkClass = (href: string) => (
    pathname === href
      ? 'bg-gradient-to-r from-coral to-coral-light text-white shadow-sm'
      : 'text-text-muted hover:text-text hover:bg-card-surface'
  )

  return (
    <nav className="sticky top-0 z-50 bg-nav-bg border-b border-border backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            onClick={closeMobileMenu}
            className="font-black text-lg sm:text-xl tracking-tight bg-gradient-to-r from-coral to-pink-soft bg-clip-text text-transparent shrink-0"
          >
            Hard Korean
          </Link>

          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <ThemeToggle />
            {user ? (
              <>
                {role && (
                  <Link
                    href="/dashboard"
                    className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${navLinkClass('/dashboard')}`}
                  >
                    Dashboard
                  </Link>
                )}
                <span className="text-xs text-text-faint hidden md:block max-w-[140px] truncate">
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
                className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${navLinkClass('/auth')}`}
              >
                Log In
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2 sm:hidden">
            <ThemeToggle />
            <button
              type="button"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((open) => !open)}
              className="inline-flex items-center justify-center p-2 rounded-xl text-text-muted hover:text-text hover:bg-card-surface transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5"
              >
                {mobileOpen ? (
                  <>
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </>
                ) : (
                  <>
                    <path d="M3 6h18" />
                    <path d="M3 12h18" />
                    <path d="M3 18h18" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-1 mt-3">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${navLinkClass(href)}`}
            >
              {label}
            </Link>
          ))}
        </div>

        {mobileOpen && (
          <div className="sm:hidden mt-3 rounded-2xl border border-border bg-card p-2 shadow-lg">
            <div className="flex flex-col gap-1">
              {links.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={closeMobileMenu}
                  className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${navLinkClass(href)}`}
                >
                  {label}
                </Link>
              ))}

              {user ? (
                <>
                  {role && (
                    <Link
                      href="/dashboard"
                      onClick={closeMobileMenu}
                      className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${navLinkClass('/dashboard')}`}
                    >
                      Dashboard
                    </Link>
                  )}
                  {user.email && (
                    <div className="px-3 py-2 text-xs text-text-faint truncate">
                      {user.email}
                    </div>
                  )}
                  <button
                    onClick={handleSignOut}
                    className="text-left px-3 py-2 rounded-xl text-sm font-medium text-text-muted hover:text-text hover:bg-card-surface transition-colors"
                  >
                    Log Out
                  </button>
                </>
              ) : (
                <Link
                  href="/auth"
                  onClick={closeMobileMenu}
                  className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${navLinkClass('/auth')}`}
                >
                  Log In
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
