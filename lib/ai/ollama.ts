export async function askOllama(prompt: string): Promise<string | null> {
  const host = process.env.OLLAMA_HOST?.trim() || 'http://localhost:11434'
  try {
    const response = await fetch(`${host.replace(/\/$/, '')}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
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
  }
}
