export async function askOllama(prompt: string): Promise<string | null> {
  const host = process.env.OLLAMA_HOST?.trim() || 'http://127.0.0.1:11434'
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 1500)
  try {
    const response = await fetch(`${host.replace(/\/$/, '')}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || 'llama3:8b',
        prompt,
        stream: false,
      }),
    })
    if (!response.ok) return null
    const data = await response.json() as { response?: string }
    return data.response?.trim() || null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
