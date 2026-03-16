import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildInitialRounds,
  replayPicks,
  toSeedProfileMap,
} from "./lib/bracket-walk.mjs";

const TOTAL_GAMES = 63;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const tournamentPath =
  process.env.TOURNAMENT_FILE ??
  path.resolve(scriptDir, "../reference/tournament.json");
const teamDataPath =
  process.env.TEAM_DATA_FILE ??
  path.resolve(scriptDir, "../data/team-data.json");
const predictionOutputFile =
  process.env.PREDICTION_OUTPUT_FILE ??
  path.resolve(scriptDir, "../out/model-bracket-output.json");

const semanticPolicy = process.env.SEMANTIC_POLICY;
const predictionsJson = process.env.PREDICTIONS_JSON;
const predictionsFile = process.env.PREDICTIONS_FILE;

const fail = (code, message) => {
  const error = new Error(message);
  error.code = code;
  throw error;
};

const parsePredictions = async () => {
  if (!predictionsJson && !predictionsFile) {
    fail(
      "INVALID_INPUT",
      "Provide PREDICTIONS_JSON or PREDICTIONS_FILE with 63 winner seeds.",
    );
  }

  if (predictionsJson) {
    const parsed = JSON.parse(predictionsJson);
    if (!Array.isArray(parsed)) {
      fail("INVALID_INPUT", "PREDICTIONS_JSON must be a JSON array of seeds.");
    }
    return parsed;
  }

  const raw = await fs.readFile(predictionsFile, "utf8");
  const payload = JSON.parse(raw);
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.predictions)) return payload.predictions;
  fail(
    "INVALID_INPUT",
    "PREDICTIONS_FILE must be an array or object containing `predictions` array.",
  );
};

const normalizePredictions = (predictions) => {
  if (!Array.isArray(predictions)) {
    fail("INVALID_INPUT", "Predictions must be an array.");
  }
  if (predictions.length !== TOTAL_GAMES) {
    fail(
      "INVALID_INPUT",
      `Predictions must contain exactly ${TOTAL_GAMES} picks, found ${predictions.length}.`,
    );
  }

  return predictions.map((value, index) => {
    const pick = Number(value);
    if (!Number.isInteger(pick) || pick < 1 || pick > 64) {
      fail("INVALID_INPUT", `Invalid prediction at index ${index}: '${value}'.`);
    }
    return pick;
  });
};

const main = async () => {
  const [tournamentRaw, teamDataRaw, predictionsRaw] = await Promise.all([
    fs.readFile(tournamentPath, "utf8"),
    fs.readFile(teamDataPath, "utf8"),
    parsePredictions(),
  ]);

  const tournament = JSON.parse(tournamentRaw);
  const teamData = JSON.parse(teamDataRaw);
  const predictions = normalizePredictions(predictionsRaw);

  const rounds = buildInitialRounds(tournament, toSeedProfileMap(teamData));
  replayPicks(rounds, predictions);

  const champion = rounds[6]?.seeds?.[0]?.teams?.[0];
  if (!champion) {
    fail("INVALID_INPUT", "Unable to derive champion from predictions.");
  }

  const output = {
    generatedAt: new Date().toISOString(),
    source: {
      mode: "semantic-run",
      tournamentPath,
      teamDataPath,
      predictionsFile: predictionsFile ?? null,
      semanticPolicy: semanticPolicy ?? null,
    },
    champion: {
      seed: champion.seed,
      name: champion.name,
      shortName: champion.shortName,
    },
    predictions,
  };

  await fs.mkdir(path.dirname(predictionOutputFile), { recursive: true });
  await fs.writeFile(predictionOutputFile, JSON.stringify(output, null, 2) + "\n", "utf8");

  console.log(
    JSON.stringify(
      {
        kind: "semantic_run_result",
        predictionOutputFile,
        picks: predictions.length,
        champion: output.champion,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  const code = error.code ?? "INVALID_INPUT";
  console.error(`${code}: ${error.message}`);
  process.exit(1);
});
