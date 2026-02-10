#!/usr/bin/env python3
"""
Prompt injection sanitizer for AI agent replies.

Strips bot commands from LLM-generated text before posting to social platforms.
Prevents attackers from tricking your agent into outputting live transaction
commands (tip, buy, sell, send, swap, etc.).

Usage:
    # As a module
    from sanitize import sanitize_reply, BOT_COMMAND_RE

    reply = sanitize_reply(llm_output)

    # As a CLI tool (pipe text through it)
    echo "some reply with @bankrbot tip 1 ETH" | python sanitize.py
"""
import re
import sys

# Customize: add your bot handles and action keywords
BOT_COMMAND_RE = re.compile(
    r"@bankrbot\s+(?:tip|buy|sell|send|swap|transfer|deploy|bridge|trade|bet|long|short|open|close)",
    re.IGNORECASE,
)


def sanitize_reply(text: str) -> str:
    """Strip bot commands from agent reply text.

    Returns sanitized text, or a canned rejection if the entire
    reply was just a bot command.
    """
    if not text:
        return text

    if BOT_COMMAND_RE.search(text):
        cleaned = BOT_COMMAND_RE.sub("[blocked command]", text)
        if len(cleaned.strip()) < 10:
            return "Nice try. That's a prompt injection attempt."
        return cleaned

    return text


def main():
    """CLI mode: read from stdin, sanitize, write to stdout."""
    text = sys.stdin.read()
    result = sanitize_reply(text)
    if result != text:
        print("[BLOCKED]", file=sys.stderr)
    print(result)


if __name__ == "__main__":
    main()
