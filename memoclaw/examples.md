# MemoClaw Usage Examples

All examples use x402 for payment. Your wallet address becomes your identity.

## Example 1: User Preferences

```javascript
import { x402Fetch } from '@x402/fetch';

// Store a preference (with optional TTL)
await x402Fetch('POST', 'https://api.memoclaw.com/v1/store', {
  wallet: process.env.MEMOCLAW_PRIVATE_KEY,
  body: {
    content: "Ana prefers coffee without sugar, always in the morning",
    metadata: { tags: ["preferences", "food"], context: "morning routine" },
    importance: 0.8,
    expires_at: "2026-12-31T23:59:59Z" // optional: auto-expire
  }
});

// Recall it later
const result = await x402Fetch('POST', 'https://api.memoclaw.com/v1/recall', {
  wallet: process.env.MEMOCLAW_PRIVATE_KEY,
  body: {
    query: "how does Ana like her coffee?",
    limit: 3
  }
});

console.log(result.memories[0].content);
// → "Ana prefers coffee without sugar, always in the morning"
```

## Example 2: Project-Specific Knowledge

```javascript
// Store architecture decisions in a namespace
await x402Fetch('POST', 'https://api.memoclaw.com/v1/store', {
  wallet: process.env.MEMOCLAW_PRIVATE_KEY,
  body: {
    content: "Team decided PostgreSQL over MongoDB for ACID requirements",
    metadata: { tags: ["architecture", "database"] },
    importance: 0.9,
    namespace: "project-alpha"
  }
});

// Recall only from that project
const result = await x402Fetch('POST', 'https://api.memoclaw.com/v1/recall', {
  wallet: process.env.MEMOCLAW_PRIVATE_KEY,
  body: {
    query: "what database did we choose and why?",
    namespace: "project-alpha"
  }
});
```

## Example 3: Batch Import

```javascript
// Import multiple memories at once ($0.04 for up to 100)
await x402Fetch('POST', 'https://api.memoclaw.com/v1/store/batch', {
  wallet: process.env.MEMOCLAW_PRIVATE_KEY,
  body: {
    memories: [
      {
        content: "User timezone is America/Sao_Paulo (UTC-3)",
        metadata: { tags: ["user-info"] },
        importance: 0.7
      },
      {
        content: "User prefers responses in Portuguese for casual chat",
        metadata: { tags: ["preferences", "language"] },
        importance: 0.9
      },
      {
        content: "User works primarily with TypeScript and Bun runtime",
        metadata: { tags: ["tools", "tech-stack"] },
        importance: 0.8
      }
    ]
  }
});
```

## Example 4: Filtered Recall

```javascript
// Recall only recent food preferences
const result = await x402Fetch('POST', 'https://api.memoclaw.com/v1/recall', {
  wallet: process.env.MEMOCLAW_PRIVATE_KEY,
  body: {
    query: "food and drink preferences",
    limit: 10,
    min_similarity: 0.6,
    filters: {
      tags: ["food", "preferences"],
      after: "2025-01-01"
    }
  }
});
```

## Example 5: Memory Management

```javascript
// List all memories in a namespace
const list = await x402Fetch('GET', 
  'https://api.memoclaw.com/v1/memories?namespace=project-alpha&limit=50',
  { wallet: process.env.MEMOCLAW_PRIVATE_KEY }
);

console.log(`Found ${list.total} memories`);

// Update a memory (only provided fields change)
await x402Fetch('PATCH',
  `https://api.memoclaw.com/v1/memories/${memoryId}`,
  {
    wallet: process.env.MEMOCLAW_PRIVATE_KEY,
    body: {
      content: "Updated: Team chose PostgreSQL 16 (upgraded from 15)",
      importance: 0.95
    }
  }
);

// Set a TTL on a memory
await x402Fetch('PATCH',
  `https://api.memoclaw.com/v1/memories/${memoryId}`,
  {
    wallet: process.env.MEMOCLAW_PRIVATE_KEY,
    body: { expires_at: "2026-06-01T00:00:00Z" }
  }
);

// Delete a specific memory
await x402Fetch('DELETE',
  `https://api.memoclaw.com/v1/memories/${memoryId}`,
  { wallet: process.env.MEMOCLAW_PRIVATE_KEY }
);
```

## Example 6: CLI Usage

```bash
# Setup (one-time)
npm install -g memoclaw
memoclaw init    # Interactive wallet setup

# Store a memory
memoclaw store "User prefers vim keybindings" --importance 0.8 --tags tools,preferences

# Recall memories
memoclaw recall "editor preferences" --limit 5

# Ingest raw text (auto-extract facts, dedup, and relate)
memoclaw ingest "User's name is Ana. She lives in São Paulo. She works with TypeScript."

# Extract facts from conversation
memoclaw extract "I prefer dark mode and use 2-space indentation"

# Consolidate duplicates (preview first)
memoclaw consolidate --namespace default --dry-run
memoclaw consolidate --namespace default

# Review stale memories
memoclaw suggested --category stale --limit 10

# Manage relations between memories
memoclaw relations list <memory-id>
memoclaw relations create <memory-id> <target-id> supersedes

# Migrate local markdown files
memoclaw migrate ./memory/

# Check free tier status
memoclaw status
```

## Example 7: Agent Memory Layer

Integrate MemoClaw as a persistent memory layer for any AI agent:

```javascript
class AgentMemory {
  constructor(walletKey) {
    this.wallet = walletKey;
    this.namespace = 'agent-main';
  }

  async remember(content, importance = 0.5, tags = []) {
    // Check for similar existing memory first
    const existing = await this.recall(content, { limit: 1, min_similarity: 0.9 });
    if (existing.memories.length > 0) {
      console.log('Similar memory exists, skipping');
      return existing.memories[0];
    }
    
    return x402Fetch('POST', 'https://api.memoclaw.com/v1/store', {
      wallet: this.wallet,
      body: { content, importance, metadata: { tags }, namespace: this.namespace }
    });
  }

  async recall(query, options = {}) {
    return x402Fetch('POST', 'https://api.memoclaw.com/v1/recall', {
      wallet: this.wallet,
      body: { query, namespace: this.namespace, ...options }
    });
  }

  async onUserCorrection(wrongAssumption, correction) {
    // Store corrections with high importance
    await this.remember(
      `Correction: Previously assumed "${wrongAssumption}" but actually: ${correction}`,
      0.95,
      ['correction', 'learning']
    );
  }

  async onSessionStart() {
    // Load recent high-importance memories
    return this.recall('recent important context', {
      limit: 10,
      min_similarity: 0.3 // Lower threshold for broad context
    });
  }
}
```

## Example 8: Python SDK

```python
from memoclaw import MemoClawClient

async with MemoClawClient(private_key="0xYourKey") as client:
    # Store a memory
    result = await client.store(
        content="User prefers async/await over callbacks",
        importance=0.8,
        tags=["preferences", "code-style"],
        memory_type="preference",
    )

    # Recall memories
    memories = await client.recall(
        query="coding style preferences",
        limit=5,
        min_similarity=0.6,
    )
    for m in memories:
        print(f"[{m.similarity:.2f}] {m.content}")

    # Ingest raw text
    ingest_result = await client.ingest(
        text="User uses Neovim on macOS. Timezone is PST.",
        auto_relate=True,
    )
    print(f"Extracted {ingest_result.facts_extracted} facts")
```

Install: `pip install memoclaw`

## Cost Breakdown

For typical agent usage:

| Daily Activity | Operations | Cost |
|----------------|------------|------|
| 10 stores | 10 × $0.005 | $0.05 |
| 20 recalls | 20 × $0.005 | $0.10 |
| 2 list queries | Free | $0.00 |
| **Total** | | **~$0.15/day** |

At ~$0.15/day, that's under $5/month for continuous agent memory.
