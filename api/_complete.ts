export type GuideRequest = {
  question?: string
  system?: string
  history?: { role: string; content: string }[]
}

export function guideSettings(env: Record<string, string | undefined>) {
  return {
    apiKey: env.LLAMA_API_KEY || env.MODEL_API_KEY || '',
    base: (env.LLAMA_API_BASE || 'https://api.meta.ai/v1').replace(/\/$/, ''),
    model: env.LLAMA_MODEL || 'muse-spark-1.3',
  }
}

export async function completeVeraGuide(
  env: Record<string, string | undefined>,
  parsed: GuideRequest,
): Promise<{ status: number; body: string }> {
  const { apiKey, base, model } = guideSettings(env)
  if (!apiKey) {
    return {
      status: 501,
      body: JSON.stringify({
        error:
          'Add MODEL_API_KEY (or LLAMA_API_KEY) to the environment, then restart the server.',
      }),
    }
  }

  const question = parsed.question?.trim()
  const system = parsed.system?.trim()
  if (!question || !system) {
    return { status: 400, body: JSON.stringify({ error: 'Missing question or system prompt' }) }
  }

  const history = Array.isArray(parsed.history) ? parsed.history : []
  const messages = [
    { role: 'system', content: system },
    ...history
      .filter((turn) => turn.role === 'user' || turn.role === 'assistant')
      .map((turn) => ({ role: turn.role, content: String(turn.content ?? '') })),
    { role: 'user', content: question },
  ]

  try {
    const upstream = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.3,
        max_tokens: 700,
      }),
    })
    const text = await upstream.text()
    return {
      status: upstream.status,
      body: text || JSON.stringify({ error: 'Empty upstream response' }),
    }
  } catch (error) {
    return {
      status: 502,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Llama request failed',
      }),
    }
  }
}
