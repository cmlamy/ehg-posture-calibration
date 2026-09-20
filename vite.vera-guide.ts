import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { completeVeraGuide, type GuideRequest } from './api/_complete.ts'

function readBody(req: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function send(res: ServerResponse, status: number, body: string) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(body)
}

export function veraGuidePlugin(env: Record<string, string>): Plugin {
  const handler = async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== 'POST') {
      send(res, 405, JSON.stringify({ error: 'POST only' }))
      return
    }

    let parsed: GuideRequest
    try {
      parsed = JSON.parse(await readBody(req)) as GuideRequest
    } catch {
      send(res, 400, JSON.stringify({ error: 'Invalid JSON' }))
      return
    }

    const result = await completeVeraGuide(env, parsed)
    send(res, result.status, result.body)
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
