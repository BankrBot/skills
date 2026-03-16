import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  appendPick,
  buildInitialRounds,
  getNextMatchup,
  readJson,
  readPicksFile,
  replayPicks,
  toSeedProfileMap,
  writePicksFile,
} from "./lib/bracket-walk.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const tournamentPath =
  process.env.TOURNAMENT_FILE ??
  path.resolve(scriptDir, "../reference/tournament.json");
const teamDataPath =
  process.env.TEAM_DATA_FILE ??
  path.resolve(scriptDir, "../data/team-data.json");
const picksPath =
  process.env.PICKS_FILE ?? path.resolve(scriptDir, "../out/model-walk-picks.json");
const predictionOutputFile =
  process.env.PREDICTION_OUTPUT_FILE ??
  path.resolve(scriptDir, "../out/model-bracket-output.json");
const policyModulePath = process.env.POLICY_MODULE;
const policyExport = process.env.POLICY_EXPORT ?? "chooseWinner";

const resolveWinnerSeed = (result) => {
  if (typeof result === "number") return result;
  if (typeof result === "string") return Number(result);
  if (result && typeof result.seed !== "undefined") return Number(result.seed);
  return Number.NaN;
};

const main = async () => {
  if (!policyModulePath) {
    throw new Error("POLICY_MODULE is required.");
  }

  const absolutePolicyModulePath = path.resolve(policyModulePath);
  const policyModule = await import(pathToFileURL(absolutePolicyModulePath).href);
  const chooseWinner = policyModule[policyExport];
  if (typeof chooseWinner !== "function") {
    throw new Error(
      `Policy export '${policyExport}' is not a function in ${absolutePolicyModulePath}.`,
    );
  }

  const [tournament, teamData, picks] = await Promise.all([
    readJson(tournamentPath),
    readJson(teamDataPath),
    readPicksFile(picksPath),
  ]);

  const rounds = buildInitialRounds(tournament, toSeedProfileMap(teamData));
  replayPicks(rounds, picks);
  const initialPickCount = picks.length;

  while (picks.length < 63) {
    const state = getNextMatchup(rounds, picks);
    if (state.done) break;

    const decision = await chooseWinner({
      gameIndex: state.gameIndex,
      roundIndex: state.roundIndex,
      roundName: state.roundName,
      matchIndex: state.matchIndex,
      teamA: state.teamA,
      teamB: state.teamB,
      picks: [...picks],
    });

    const winnerSeed = resolveWinnerSeed(decision);
    if (!Number.isInteger(winnerSeed) || winnerSeed < 1 || winnerSeed > 64) {
      throw new Error(
        `Policy returned invalid winner at game ${state.gameIndex}: ${JSON.stringify(decision)}`,
      );
    }

    appendPick(rounds, picks, winnerSeed);
  }

  await writePicksFile(picksPath, picks);

  const champion = rounds[6]?.seeds?.[0]?.teams?.[0];
  const outputPayload = {
    generatedAt: new Date().toISOString(),
    source: {
      tournamentPath,
      teamDataPath,
      picksPath,
      policyModulePath: absolutePolicyModulePath,
      policyExport,
    },
    champion: champion
      ? {
          seed: champion.seed,
          name: champion.name,
          shortName: champion.shortName,
        }
      : null,
    predictions: picks,
  };

  await fs.mkdir(path.dirname(predictionOutputFile), { recursive: true });
  await fs.writeFile(
    predictionOutputFile,
    JSON.stringify(outputPayload, null, 2) + "\n",
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        kind: "walk_run_policy_result",
        picksFile: picksPath,
        predictionOutputFile,
        initialPickCount,
        finalPickCount: picks.length,
        champion: outputPayload.champion,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(`INVALID_POLICY: ${error.message}`);
  process.exit(1);
});
