// Export a conversation as Markdown.
//
// Everything needed is already in the browser, so the export is a pure
// client-side transform: no endpoint, no server round-trip.

import type { Message } from '../store/chatStore';

export function conversationToMarkdown(title: string, messages: Message[]): string {
  const lines: string[] = [`# ${title || 'maxAI chat'}`, '', `_Exported ${new Date().toLocaleString()}_`, ''];

  for (const message of messages) {
    if (message.pending) continue;
    const stamp = new Date(message.createdAt).toLocaleString();
    lines.push(`## ${message.role === 'user' ? 'You' : 'Max'} · ${stamp}`, '', message.content.trim(), '');

    if (message.sources?.length) {
      lines.push('**Sources**', '');
      message.sources.forEach((source, i) => lines.push(`${i + 1}. [${source.title || source.url}](${source.url})`));
      lines.push('');
    }
  }

  return lines.join('\n');
}

export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
  return slug || 'maxai-chat';
}

export function downloadMarkdown(filename: string, markdown: string): void {
  const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
