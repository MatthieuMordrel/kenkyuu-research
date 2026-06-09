/**
 * Sanitize untrusted text for Telegram's legacy Markdown parser.
 * Classic "Markdown" parse_mode (unlike MarkdownV2) has no escape sequence,
 * so any stray `*`, `_`, `` ` ``, or `[` in user-provided content (error
 * messages, stock labels) can corrupt the rest of the message. We strip them.
 */
export function sanitizeForTelegramMarkdown(str: string): string {
  return str.replace(/[_*`[\]]/g, "");
}
