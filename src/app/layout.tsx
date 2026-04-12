import type { Metadata } from 'next'
import './globals.css'
import NavBar from '@/components/NavBar'
import { AuthProvider } from '@/contexts/AuthContext'

export const metadata: Metadata = {
  title: 'Hard Korean | TOPIK Study',
  description: 'Master Korean with TOPIK vocabulary and grammar. No fluff, just hard work.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}})()` }} />
      </head>
      <body className="min-h-full flex flex-col bg-app-bg text-text">
        <AuthProvider>
          <NavBar />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-border text-center text-xs text-text-faint py-4">
            Hard Korean • Built with TOPIK vocabulary &amp; grammar data
          </footer>
        </AuthProvider>
      </body>
    </html>
  )
}
