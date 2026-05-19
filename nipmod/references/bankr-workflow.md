# Nipmod Bankr Workflow

## Install in Bankr

Bankr skills use one `SKILL.md` file with optional sibling `references/` files. The Nipmod folder follows that layout and is ready for a public GitHub mirror or Bankr skill catalog PR.

Tell a Bankr agent:

```text
Read https://nipmod.com/integrations/bankr/nipmod/SKILL.md and use Nipmod before installing agent packages.
```

Public skill file:

```text
https://nipmod.com/integrations/bankr/nipmod/SKILL.md
```

Public GitHub skill folder:

```text
https://github.com/nipmod/nipmod/tree/main/integrations/bankr/nipmod
```

Catalog submission packet:

```text
https://nipmod.com/integrations/bankr/CATALOG_SUBMISSION.md
```

The canonical source remains Gitlawb:

```text
https://gitlawb.com/node/repos/z6Mkwbud/nipmod
```

## First run

```bash
curl -fsSL https://nipmod.com/.well-known/nipmod.json
curl -fsSL https://nipmod.com/llms.txt
nipmod doctor --online
nipmod search gitlawb --online
```

If `nipmod` is missing:

```bash
curl -fsSLO https://nipmod.com/install.sh && bash install.sh
```

## Agent package use

1. Search the registry.
2. Inspect the package as JSON.
3. Plan the install.
4. Ask for approval before workspace mutation.
5. Install.
6. Audit.
7. Export SBOM when reporting completion.

```bash
nipmod search gitlawb --online
nipmod inspect gitlawb-repo-reader --json
nipmod install --plan gitlawb-repo-reader --json
nipmod install gitlawb-repo-reader
nipmod audit --online
nipmod sbom --json
```

## Repo to package

Use this when a Bankr agent sees a public Gitlawb repo that should become a package.

```bash
nipmod package pr gitlawb://did:key:.../repo --dir repo-package-pr --json
nipmod publish repo-package-pr --dry-run --json
```

The source owner must sign and push the claim proof from their own DID before the package is treated as claimed.

## Bankr profile

When authenticated in Bankr, Nipmod can maintain a public Agent Profile. This is an operator action, not an automatic package install step.

```bash
bankr agent profile create \
  --name "Nipmod" \
  --description "Package layer for agent built software." \
  --token 0x5155Eaa3B5784B829DeAD78189Eb4Bf69359dbA3 \
  --image "https://nipmod.com/nipmod-logo.png" \
  --website "https://nipmod.com"
```

Updates should be concise and factual:

```bash
bankr agent profile add-update \
  --title "Bankr skill ready" \
  --content "Bankr agents can install the Nipmod skill and use free package search, inspect, audit and draft workflows."
```

Profile creation and public listing require Bankr authentication and Bankr review.

## External references

- Bankr skill format: https://docs.bankr.bot/skills/in-bankr/skill-format/
