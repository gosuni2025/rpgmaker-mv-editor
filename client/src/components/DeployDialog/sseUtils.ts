import { SSEEvent } from './types';

export async function readSSEStream(
  url: string,
  options: RequestInit,
  onEvent: (data: SSEEvent) => boolean,
): Promise<void> {
  const response = await fetch(url, options);
  if (!response.ok) {
    let msg = `HTTP ${response.status}`;
    try { msg = ((await response.json()) as { error?: string }).error || msg; } catch {}
    throw new Error(msg);
  }
  if (!response.body) throw new Error('No response body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';
    for (const part of parts) {
      for (const line of part.split('\n')) {
        if (line.startsWith('data: ')) {
          try {
            if (!onEvent(JSON.parse(line.slice(6)) as SSEEvent)) return;
          } catch {}
        }
      }
    }
  }
}
