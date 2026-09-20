import { completeVeraGuide, type GuideRequest } from './_complete'

type VercelRes = {
  statusCode: number
  setHeader: (name: string, value: string) => void
  end: (body?: string) => void
}

export const config = { maxDuration: 60 }

export default async function handler(
  req: { method?: string; body?: unknown },
  res: VercelRes,
) {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'POST only' }))
    return
  }

  const parsed = (req.body ?? {}) as GuideRequest
  const result = await completeVeraGuide(process.env, parsed)
  res.statusCode = result.status
  res.setHeader('Content-Type', 'application/json')
  res.end(result.body)
}
