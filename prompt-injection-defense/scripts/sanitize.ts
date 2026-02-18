/**
 * Prompt injection sanitizer for AI agent replies.
 *
 * Strips bot commands from LLM-generated text before posting to social platforms.
 * Prevents attackers from tricking your agent into outputting live transaction
 * commands (tip, buy, sell, send, swap, etc.).
 *
 * Usage:
 *   import { sanitizeReply } from './sanitize';
 *   const safe = sanitizeReply(llmOutput);
 */

// Customize: add your bot handles and action keywords
const BOT_COMMAND_RE =
  /@bankrbot\s+(?:tip|buy|sell|send|swap|transfer|deploy|bridge|trade|bet|long|short|open|close)/gi;

/**
 * Strip bot commands from agent reply text.
 *
 * Returns sanitized text, or a canned rejection if the entire
 * reply was just a bot command.
 */
export function sanitizeReply(text: string): string {
  if (!text) return text;

  if (BOT_COMMAND_RE.test(text)) {
    BOT_COMMAND_RE.lastIndex = 0; // reset stateful regex
    const stripped = text.replace(BOT_COMMAND_RE, "");
    if (stripped.trim().length < 10) {
      return "Nice try. That's a prompt injection attempt.";
    }
    BOT_COMMAND_RE.lastIndex = 0;
    return text.replace(BOT_COMMAND_RE, "[blocked command]");
  }

  return text;
}
