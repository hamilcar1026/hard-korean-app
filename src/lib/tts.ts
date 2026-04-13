'use client'

let activeAudio: HTMLAudioElement | null = null
let activeObjectUrl: string | null = null

function cleanupObjectUrl() {
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl)
    activeObjectUrl = null
  }
}

function stopBrowserSpeech() {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel()
  }
}

function speakWithBrowser(text: string, lang: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return

  stopBrowserSpeech()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = lang
  utterance.rate = 0.85
  window.speechSynthesis.speak(utterance)
}

export async function playTextToSpeech(text: string, lang = 'ko-KR') {
  if (typeof window === 'undefined' || !text.trim()) return

  stopBrowserSpeech()

  if (!activeAudio) {
    activeAudio = new Audio()
  } else {
    activeAudio.pause()
    activeAudio.currentTime = 0
  }

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
    activeObjectUrl = URL.createObjectURL(blob)
    activeAudio.src = activeObjectUrl
    activeAudio.currentTime = 0
    await activeAudio.play()
  } catch {
    speakWithBrowser(text, lang)
  }
}
