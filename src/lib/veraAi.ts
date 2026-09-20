import { matchGroups } from './community'
import { loadDayNotes } from './researchLog'
import { veraSystemPrompt } from './siteKnowledge'
import { answerQuestion, type GuideLink } from './veraGuide'

type ChatTurn = { role: 'user' | 'guide'; text: string }

function linksFor(question: string, answer: string): GuideLink[] {
  const seen = new Set<string>()
  const links: GuideLink[] = []
  for (const group of [...matchGroups(question, 3), ...matchGroups(answer, 3)]) {
    const mail = `mailto:${group.email}?subject=${encodeURIComponent('VERA community — ' + group.name)}`
    if (seen.has(mail)) continue
    seen.add(mail)
    links.push({
      label: `Email ${group.contact.split(' ').slice(-1)[0]}`,
      to: mail,
    })
  }
  if (links.length > 0) {
    links.unshift({ label: 'Open Community', to: '/community' })
  }
  return links
}

function extractText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const data = payload as Record<string, unknown>
  const choices = data.choices
  if (Array.isArray(choices) && choices[0] && typeof choices[0] === 'object') {
    const message = (choices[0] as { message?: { content?: unknown } }).message
    if (typeof message?.content === 'string') return message.content
  }
  const completion = data.completion_message
  if (completion && typeof completion === 'object') {
    const content = (completion as { content?: unknown }).content
    if (typeof content === 'string') return content
    if (content && typeof content === 'object' && 'text' in content) {
      const text = (content as { text?: unknown }).text
      if (typeof text === 'string') return text
    }
  }
  return ''
}

export async function askVera(
  question: string,
  history: ChatTurn[],
): Promise<{ answer: string; links: GuideLink[]; usedAi: boolean }> {
  const local = answerQuestion(question)
  try {
    const prior = history.filter((turn) => turn.role === 'user' || turn.role === 'guide')
    if (prior.at(-1)?.role === 'user' && prior.at(-1)?.text === question) prior.pop()
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 45_000)
    const response = await fetch('/api/vera-guide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        question,
        system: veraSystemPrompt(loadDayNotes()),
        history: prior.slice(-8).map((turn) => ({
          role: turn.role === 'guide' ? 'assistant' : 'user',
          content: turn.text,
        })),
      }),
    })
    window.clearTimeout(timer)
    if (response.status === 501) {
      return { ...local, usedAi: false }
    }
    if (!response.ok) {
      const detail = await response.text()
      throw new Error(detail || `Guide request failed (${response.status})`)
    }
    const payload: unknown = await response.json()
    const answer = extractText(payload).trim()
    if (!answer) throw new Error('Empty model reply')
    const links = linksFor(question, answer)
    return {
      answer,
      links: links.length > 0 ? links : local.links,
      usedAi: true,
    }
  } catch {
    return { ...local, usedAi: false }
  }
}
