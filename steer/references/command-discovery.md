# Command discovery

This is a route map, not a frozen command specification. The installed Steer CLI is the authority for command names, aliases, flags, required arguments, and output fields.

At the start of a live workflow, run `steer --version` using Bankr's provided CLI. Stop with `CLI_UNAVAILABLE` if it cannot run. Then inspect the relevant family with `steer <family> --help`. Before a state-changing preparation, inspect its JSON Schema with `steer <family> <subcommand> --schema`. Stop with `CLI_VERSION_UNSUPPORTED` if the provided version or interface cannot satisfy the workflow. Bankr owns CLI provisioning and upgrades; never install, upgrade, or substitute another executable from this skill. Use `--llms-full` only when the task needs the broader machine-readable command manifest. Request `--format json --full-output` for structured operational results.

If Bankr exposes native structured Steer tools, use them only after confirming that their schema and installed CLI version express the same operation. Otherwise use `execute_cli`. Never substitute `--web` for the Bankr transaction path.

| Need | Command family | Inspect before acting |
|---|---|---|
| Supported networks and live service surface | `chains`, `protocols`, `status`, `subgraphs` | `steer <family> --help` |
| Pool identity, history, price, liquidity, and depth | `markets` | `steer markets inspect --schema` or `steer markets history --schema` |
| Lifecycle support and pool creation | `pools` | `steer pools support --help`; before a prepare, `steer pools create prepare --schema` |
| Curated vault inspection, manifests, deposits, quotes, and tends | `vaults` | the selected vault or tend subcommand |
| Submitted action recovery and receipt verification | `transactions` | `steer transactions verify --schema` |

The lifecycle reference contains reviewed operation order and Bankr constraints. It does not replace runtime help or schema checks. A command capability listed by a protocol, subgraph, or an older generated host skill is not authority to prepare or submit an action.
