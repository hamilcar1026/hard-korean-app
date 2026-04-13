export const dynamic = 'force-dynamic'

const GOOGLE_TTS_ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize'

function pickVoice(lang: string) {
  if (lang.startsWith('ko')) {
    return {
      languageCode: 'ko-KR',
      name: process.env.GOOGLE_CLOUD_TTS_VOICE_NAME || 'ko-KR-Chirp3-HD-Aoede',
      ssmlGender: 'FEMALE',
    }
  }

  return {
    languageCode: lang,
    name: process.env.GOOGLE_CLOUD_TTS_VOICE_NAME || undefined,
    ssmlGender: 'FEMALE',
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.GOOGLE_CLOUD_TTS_API_KEY

  if (!apiKey) {
    return Response.json(
      { error: 'Google Cloud TTS is not configured.' },
      { status: 503 }
    )
  }

  const body = (await request.json()) as { text?: string; lang?: string }
  const text = body.text?.trim()
  const lang = body.lang?.trim() || 'ko-KR'

  if (!text) {
    return Response.json({ error: 'Text is required.' }, { status: 400 })
  }

  const voice = pickVoice(lang)
  const response = await fetch(`${GOOGLE_TTS_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: { text },
      voice,
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: lang.startsWith('ko') ? 0.92 : 0.96,
        pitch: 0,
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    return Response.json(
      { error: `Google Cloud TTS request failed: ${errorText}` },
      { status: 502 }
    )
  }

  const data = (await response.json()) as { audioContent?: string }
  if (!data.audioContent) {
    return Response.json({ error: 'No audio returned from Google Cloud TTS.' }, { status: 502 })
  }

  const audioBuffer = Buffer.from(data.audioContent, 'base64')

  return new Response(audioBuffer, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-store',
    },
  })
}
