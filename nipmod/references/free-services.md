# Nipmod Free Services For Bankr

Nipmod's Bankr integration is free for core package workflows.

Bankr agents should use the public Nipmod site, registry, Scout endpoints, CLI and MCP tools. Do not use x402 payment for package search, inspect, audit or draft planning.

## Service Map

### package-search

Search packages:

```bash
nipmod search gitlawb --online
```

Read the public registry:

```text
https://nipmod.com/registry/packages.json
```

Browse packages:

```text
https://nipmod.com/packages
```

### package-audit

Inspect a package:

```bash
nipmod inspect gitlawb-repo-reader --json
```

Plan before install:

```bash
nipmod install --plan gitlawb-repo-reader --json
```

Audit the workspace:

```bash
nipmod audit --online
```

Read audit docs:

```text
https://nipmod.com/audit
```

### repo-package-draft

Create a local package PR draft:

```bash
nipmod package pr gitlawb://did:key:.../repo --dir repo-package-pr --json
```

Read a Scout draft:

```text
https://nipmod.com/scout/draft?repo=gitlawb://did:key:.../repo
```

Open the human draft page:

```text
https://nipmod.com/package?repo=gitlawb://did:key:.../repo
```

## Bankr Coin

The $NPM Bankr coin is an investor/community token link, not a required payment rail for using Nipmod package workflows.

```text
https://bankr.bot/launches/0x5155Eaa3B5784B829DeAD78189Eb4Bf69359dbA3
```
