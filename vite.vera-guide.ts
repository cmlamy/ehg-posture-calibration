import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

function readBody(req: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

type GuideRequest = {
  question?: string
  system?: string
  history?: { role: string; content: string }[]
}

export function veraGuidePlugin(env: Record<string, string>): Plugin {
  const apiKey = env.LLAMA_API_KEY || env.MODEL_API_KEY || ''
  const base = (env.LLAMA_API_BASE || 'https://api.llama.com/compat/v1').replace(/\/$/, '')
  const model = env.LLAMA_MODEL || 'Llama-4-Maverick-17B-128E-Instruct-FP8'

  const handler = async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== 'POST') {
      json(res, 405, { error: 'POST only' })
      return
    }
    if (!apiKey) {
      json(res, 501, {
        error:
          'Add LLAMA_API_KEY to a .env file in the project root (Meta Llama API), then restart npm run dev.',
      })
      return
    }

    let parsed: GuideRequest
    try {
      parsed = JSON.parse(await readBody(req)) as GuideRequest
    } catch {
      json(res, 400, { error: 'Invalid JSON' })
      return
    }

    const question = parsed.question?.trim()
    const system = parsed.system?.trim()
    if (!question || !system) {
      json(res, 400, { error: 'Missing question or system prompt' })
      return
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
      res.statusCode = upstream.status
      res.setHeader('Content-Type', 'application/json')
      res.end(text || JSON.stringify({ error: 'Empty upstream response' }))
    } catch (error) {
      json(res, 502, {
        error: error instanceof Error ? error.message : 'Llama request failed',
      })
    }
  }

  return {
    name: 'vera-guide-ai',
    configureServer(server) {
      server.middlewares.use('/api/vera-guide', (req, res) => {
        void handler(req, res)
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/vera-guide', (req, res) => {
        void handler(req, res)
      })
    },
  }
}
