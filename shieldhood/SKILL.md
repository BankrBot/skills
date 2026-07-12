---
name: Shieldhood
description: Advanced AI Security Layer that protects autonomous DeFi agents from prompt injection, jailbreaks, and malicious commands. Includes human confirmation gate and spending policy.
version: 2.0.1
tags: [security, defi, prompt-injection, safety, robinhood]
visibility: public
---

# Shieldhood - AI Security Shield

**Shieldhood** adalah last line of defense untuk autonomous agents di Robinhood Chain.

### Capabilities
- Real-time detection of prompt injection & jailbreak attempts
- Deep payload decoding (Base64, Hex, ROT, Entropy, etc.)
- Human confirmation gate for high-risk actions
- Spending policy & address allowlist
- Lightweight pure Python

### How to Use

```bash
pip install shieldhood
```

```python
from shieldhood import Shieldhood

shield = Shieldhood()

result = shield.scan("your prompt here")
```

### Commands
- `/shieldhood scan <text>`
- `/shieldhood status`
- `/shieldhood confirm / cancel`

### Links
- GitHub: https://github.com/0xPoyraz/Shieldhood
- PyPI: https://pypi.org/project/shieldhood/
- Website: https://www.shieldhood.xyz/

**Made for Bankr.bot agents on Robinhood Chain.**
