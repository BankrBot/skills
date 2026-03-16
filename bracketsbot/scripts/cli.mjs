import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Cli, z } from "incur";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));

const buildTeamDataScript = path.resolve(scriptsDir, "build-example-team-data.mjs");
const generateScript = path.resolve(scriptsDir, "generate-bracketsbot-bracket.mjs");
const validateScript = path.resolve(scriptsDir, "validate-bracketsbot.mjs");
const prepareSubmitTxScript = path.resolve(scriptsDir, "prepare-submit-transaction.mjs");
const walkNextScript = path.resolve(scriptsDir, "walk-next-game.mjs");
const walkApplyScript = path.resolve(scriptsDir, "walk-apply-pick.mjs");
const walkRunPolicyScript = path.resolve(scriptsDir, "walk-run-policy.mjs");
const semanticRunScript = path.resolve(scriptsDir, "semantic-run.mjs");
const shareLinkScript = path.resolve(scriptsDir, "share-link.mjs");

const runNodeScript = async ({ scriptPath, env = {} }) => {
  const stdoutChunks = [];
  const stderrChunks = [];

  const child = spawn(process.execPath, [scriptPath], {
    env: {
      ...process.env,
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => stdoutChunks.push(chunk));
  child.stderr.on("data", (chunk) => stderrChunks.push(chunk));

  const exitCode = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });

  const stdout = Buffer.concat(stdoutChunks).toString("utf8").trim();
  const stderr = Buffer.concat(stderrChunks).toString("utf8").trim();

  if (exitCode !== 0) {
    const firstStderrLine = stderr.split("\n")[0] ?? "";
    const codeMatch = firstStderrLine.match(/^([A-Z_]+):\s/);
    const code = codeMatch ? codeMatch[1] : "COMMAND_FAILED";
    const error = new Error(
      [
        `Command failed (exit ${exitCode})`,
        stdout ? `stdout:\n${stdout}` : "",
        stderr ? `stderr:\n${stderr}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    );
    error.code = code;
    throw error;
  }

  return { exitCode, stdout, stderr };
};

const toCliError = (c, error, fallbackCode = "COMMAND_FAILED") =>
  c.error({
    code: error?.code ?? fallbackCode,
    message: error?.message ?? "Unknown command failure.",
  });

const optionalString = z.string().optional();
const requiredString = z.string().min(1);

Cli.create("bracketsbot", {
  description:
    "Generate and prepare BracketsBot predictions (agent + human CLI).",
})
  .command("build-team-data", {
    description: "Build example team feature data keyed by canonical seed.",
    options: z.object({
      tournamentFile: optionalString.describe("Override TOURNAMENT_FILE"),
      teamDataFile: optionalString.describe("Override TEAM_DATA_FILE"),
    }),
    async run(c) {
      try {
        const result = await runNodeScript({
          scriptPath: buildTeamDataScript,
          env: {
            TOURNAMENT_FILE: c.options.tournamentFile,
            TEAM_DATA_FILE: c.options.teamDataFile,
          },
        });

        return {
          command: "build-team-data",
          script: "scripts/build-example-team-data.mjs",
          ...result,
        };
      } catch (error) {
        return toCliError(c, error);
      }
    },
  })
  .command("validate", {
    description:
      "Validate tournament, team data, and prediction output for legal seeded progression.",
    options: z.object({
      tournamentFile: optionalString.describe("Override TOURNAMENT_FILE"),
      teamDataFile: optionalString.describe("Override TEAM_DATA_FILE"),
      predictionOutputFile: optionalString.describe("Override PREDICTION_OUTPUT_FILE"),
    }),
    async run(c) {
      try {
        const result = await runNodeScript({
          scriptPath: validateScript,
          env: {
            TOURNAMENT_FILE: c.options.tournamentFile,
            TEAM_DATA_FILE: c.options.teamDataFile,
            PREDICTION_OUTPUT_FILE: c.options.predictionOutputFile,
          },
        });

        const parsed = result.stdout ? JSON.parse(result.stdout) : {};
        return {
          command: "validate",
          script: "scripts/validate-bracketsbot.mjs",
          ...parsed,
        };
      } catch (error) {
        return toCliError(c, error, "INVALID_INPUT");
      }
    },
  })
  .command("generate", {
    description: "Generate 63 bracket picks by progressing winners round-by-round.",
    options: z.object({
      tournamentFile: optionalString.describe("Override TOURNAMENT_FILE"),
      teamDataFile: optionalString.describe("Override TEAM_DATA_FILE"),
      predictionOutputFile: optionalString.describe("Override PREDICTION_OUTPUT_FILE"),
    }),
    async run(c) {
      try {
        const result = await runNodeScript({
          scriptPath: generateScript,
          env: {
            TOURNAMENT_FILE: c.options.tournamentFile,
            TEAM_DATA_FILE: c.options.teamDataFile,
            PREDICTION_OUTPUT_FILE: c.options.predictionOutputFile,
          },
        });

        return {
          command: "generate",
          script: "scripts/generate-bracketsbot-bracket.mjs",
          ...result,
        };
      } catch (error) {
        return toCliError(c, error);
      }
    },
  })
  .command("prepare-submit-tx", {
    description:
      "Encode unsigned submit transaction data for agent/external wallet submission.",
    options: z.object({
      predictionOutputFile: optionalString.describe("Override PREDICTION_OUTPUT_FILE"),
      chainId: optionalString.describe("Override CHAIN_ID"),
      contractAddress: optionalString.describe("Override CONTRACT_ADDRESS"),
      deployArtifact: optionalString.describe("Override DEPLOY_ARTIFACT"),
      entryFeeEth: optionalString.describe("Override ENTRY_FEE_ETH"),
      referrer: optionalString.describe("Override REFERRER"),
    }),
    async run(c) {
      try {
        const result = await runNodeScript({
          scriptPath: prepareSubmitTxScript,
          env: {
            PREDICTION_OUTPUT_FILE: c.options.predictionOutputFile,
            CHAIN_ID: c.options.chainId,
            CONTRACT_ADDRESS: c.options.contractAddress,
            DEPLOY_ARTIFACT: c.options.deployArtifact,
            ENTRY_FEE_ETH: c.options.entryFeeEth,
            REFERRER: c.options.referrer,
          },
        });

        const txRequest = result.stdout ? JSON.parse(result.stdout) : {};
        return {
          command: "prepare-submit-tx",
          script: "scripts/prepare-submit-transaction.mjs",
          ...txRequest,
        };
      } catch (error) {
        return toCliError(c, error, "INVALID_INPUT");
      }
    },
  })
  .command("walk-next", {
    description: "Return next matchup from current picks state.",
    options: z.object({
      tournamentFile: optionalString.describe("Override TOURNAMENT_FILE"),
      teamDataFile: optionalString.describe("Override TEAM_DATA_FILE"),
      picksFile: optionalString.describe("Override PICKS_FILE"),
    }),
    async run(c) {
      try {
        const result = await runNodeScript({
          scriptPath: walkNextScript,
          env: {
            TOURNAMENT_FILE: c.options.tournamentFile,
            TEAM_DATA_FILE: c.options.teamDataFile,
            PICKS_FILE: c.options.picksFile,
          },
        });
        const payload = result.stdout ? JSON.parse(result.stdout) : {};
        return {
          command: "walk-next",
          script: "scripts/walk-next-game.mjs",
          ...payload,
        };
      } catch (error) {
        return toCliError(c, error, "INVALID_INPUT");
      }
    },
  })
  .command("walk-apply", {
    description: "Apply winner seed for current game and persist picks state.",
    options: z.object({
      winnerSeed: requiredString.describe("Winner seed for the next game (1..64)"),
      tournamentFile: optionalString.describe("Override TOURNAMENT_FILE"),
      teamDataFile: optionalString.describe("Override TEAM_DATA_FILE"),
      picksFile: optionalString.describe("Override PICKS_FILE"),
    }),
    async run(c) {
      try {
        const result = await runNodeScript({
          scriptPath: walkApplyScript,
          env: {
            WINNER_SEED: c.options.winnerSeed,
            TOURNAMENT_FILE: c.options.tournamentFile,
            TEAM_DATA_FILE: c.options.teamDataFile,
            PICKS_FILE: c.options.picksFile,
          },
        });
        const payload = result.stdout ? JSON.parse(result.stdout) : {};
        return {
          command: "walk-apply",
          script: "scripts/walk-apply-pick.mjs",
          ...payload,
        };
      } catch (error) {
        return toCliError(c, error, "INVALID_WINNER");
      }
    },
  })
  .command("walk-run-policy", {
    description:
      "Run bracket progression by calling a developer-provided policy function.",
    options: z.object({
      policyModule: requiredString.describe("Path to module exporting chooseWinner"),
      policyExport: optionalString.describe(
        "Named export for policy function (default chooseWinner)",
      ),
      tournamentFile: optionalString.describe("Override TOURNAMENT_FILE"),
      teamDataFile: optionalString.describe("Override TEAM_DATA_FILE"),
      picksFile: optionalString.describe("Override PICKS_FILE"),
      predictionOutputFile: optionalString.describe("Override PREDICTION_OUTPUT_FILE"),
    }),
    async run(c) {
      try {
        const result = await runNodeScript({
          scriptPath: walkRunPolicyScript,
          env: {
            POLICY_MODULE: c.options.policyModule,
            POLICY_EXPORT: c.options.policyExport,
            TOURNAMENT_FILE: c.options.tournamentFile,
            TEAM_DATA_FILE: c.options.teamDataFile,
            PICKS_FILE: c.options.picksFile,
            PREDICTION_OUTPUT_FILE: c.options.predictionOutputFile,
          },
        });
        const payload = result.stdout ? JSON.parse(result.stdout) : {};
        return {
          command: "walk-run-policy",
          script: "scripts/walk-run-policy.mjs",
          ...payload,
        };
      } catch (error) {
        return toCliError(c, error, "INVALID_POLICY");
      }
    },
  })
  .command("semantic-run", {
    description:
      "One-pass bracket run from a natural-language policy and agent-provided picks.",
    options: z.object({
      policy: requiredString.describe("Natural-language policy used by the agent."),
      predictionsJson: optionalString.describe(
        "JSON array string with 63 winner seeds.",
      ),
      predictionsFile: optionalString.describe(
        "Path to JSON file with predictions array.",
      ),
      tournamentFile: optionalString.describe("Override TOURNAMENT_FILE"),
      teamDataFile: optionalString.describe("Override TEAM_DATA_FILE"),
      predictionOutputFile: optionalString.describe("Override PREDICTION_OUTPUT_FILE"),
    }),
    async run(c) {
      try {
        if (!c.options.predictionsJson && !c.options.predictionsFile) {
          return c.error({
            code: "INVALID_INPUT",
            message:
              "Provide either --predictions-json or --predictions-file for semantic-run.",
          });
        }

        const result = await runNodeScript({
          scriptPath: semanticRunScript,
          env: {
            SEMANTIC_POLICY: c.options.policy,
            PREDICTIONS_JSON: c.options.predictionsJson,
            PREDICTIONS_FILE: c.options.predictionsFile,
            TOURNAMENT_FILE: c.options.tournamentFile,
            TEAM_DATA_FILE: c.options.teamDataFile,
            PREDICTION_OUTPUT_FILE: c.options.predictionOutputFile,
          },
        });
        const payload = result.stdout ? JSON.parse(result.stdout) : {};
        return {
          command: "semantic-run",
          script: "scripts/semantic-run.mjs",
          policy: c.options.policy,
          ...payload,
        };
      } catch (error) {
        return toCliError(c, error, "INVALID_INPUT");
      }
    },
  })
  .command("share-link", {
    description:
      "Generate a frontend URL that loads predictions into the BracketsBot bracket UI.",
    options: z.object({
      frontendBaseUrl: optionalString.describe(
        "Base URL for the frontend (default https://brackets.bot)",
      ),
      predictionsFile: optionalString.describe(
        "Override PREDICTION_OUTPUT_FILE or specify a JSON file with predictions.",
      ),
    }),
    async run(c) {
      try {
        const result = await runNodeScript({
          scriptPath: shareLinkScript,
          env: {
            FRONTEND_BASE_URL: c.options.frontendBaseUrl,
            PREDICTION_OUTPUT_FILE: c.options.predictionsFile,
          },
        });
        const payload = result.stdout ? JSON.parse(result.stdout) : {};
        return {
          command: "share-link",
          script: "scripts/share-link.mjs",
          ...payload,
        };
      } catch (error) {
        return toCliError(c, error, "INVALID_INPUT");
      }
    },
  })
  .serve();
