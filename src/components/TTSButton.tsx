'use client'

import { useRef, useState } from 'react'

interface Props {
  text: string
  lang?: string
  size?: 'sm' | 'md'
}

export default function TTSButton({ text, lang = 'ko-KR', size = 'sm' }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const [loading, setLoading] = useState(false)

  const speakWithBrowser = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang
    utterance.rate = 0.85
    window.speechSynthesis.speak(utterance)
  }

  const cleanupObjectUrl = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }

  const speak = async () => {
    if (loading) return

    setLoading(true)
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, lang }),
      })

      if (!response.ok) {
        throw new Error('Natural TTS unavailable')
      }

      const blob = await response.blob()
      cleanupObjectUrl()
      objectUrlRef.current = URL.createObjectURL(blob)

      if (!audioRef.current) {
        audioRef.current = new Audio()
      }

      audioRef.current.src = objectUrlRef.current
      audioRef.current.currentTime = 0
      await audioRef.current.play()
    } catch {
      speakWithBrowser()
    } finally {
      setLoading(false)
    }
  }

  const cls =
    size === 'md'
      ? 'p-2 rounded-xl bg-card-surface hover:bg-border text-text-subtle hover:text-coral transition-colors disabled:opacity-50'
      : 'p-1 rounded-lg bg-card-surface hover:bg-border text-text-faint hover:text-coral-light transition-colors disabled:opacity-50'

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        void speak()
      }}
      title={loading ? 'Loading voice...' : 'Listen'}
      className={cls}
      disabled={loading}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className={size === 'md' ? 'w-5 h-5' : 'w-4 h-4'}
      >
        <path d="M10 3.75a.75.75 0 00-1.264-.546L4.703 7H3.167a.75.75 0 00-.7.48A6.985 6.985 0 002 10c0 .887.165 1.737.468 2.52.111.29.39.48.7.48h1.535l4.033 3.796A.75.75 0 0010 16.25V3.75zM15.95 5.05a.75.75 0 00-1.06 1.061 5.5 5.5 0 010 7.778.75.75 0 001.06 1.06 7 7 0 000-9.899z" />
        <path d="M13.829 7.172a.75.75 0 00-1.061 1.06 2.5 2.5 0 010 3.536.75.75 0 001.06 1.06 4 4 0 000-5.656z" />
      </svg>
    </button>
  )
}
