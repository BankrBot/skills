import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  appendPick,
  buildInitialRounds,
  getNextMatchup,
  readJson,
  readPicksFile,
  readWalkMeta,
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
const winnerSeedRaw = process.env.WINNER_SEED;

const main = async () => {
  if (!winnerSeedRaw) {
    throw new Error("WINNER_SEED is required.");
  }
  const winnerSeed = Number(winnerSeedRaw);
  if (!Number.isInteger(winnerSeed) || winnerSeed < 1 || winnerSeed > 64) {
    throw new Error(`Invalid WINNER_SEED '${winnerSeedRaw}'. Expected integer 1..64.`);
  }

  const [tournament, teamData, picks] = await Promise.all([
    readJson(tournamentPath),
    readJson(teamDataPath),
    readPicksFile(picksPath),
  ]);

  const meta = await readWalkMeta(picksPath);
  const rounds = buildInitialRounds(tournament, toSeedProfileMap(teamData));
  replayPicks(rounds, picks);
  const applied = appendPick(rounds, picks, winnerSeed);
  await writePicksFile(picksPath, picks, meta);
  const state = getNextMatchup(rounds, picks);

  // Best-effort PATCH to draft API if a draft session exists
  if (meta.draftToken && meta.draftApiUrl) {
    try {
      await fetch(meta.draftApiUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchIndex: applied.gameIndex, winnerSeed }),
      });
    } catch (err) {
      process.stderr.write(`draft sync warning: ${err.message}\n`);
    }
  }

  console.log(
    JSON.stringify(
      {
        kind: "walk_apply_result",
        picksFile: picksPath,
        applied,
        picks,
        ...state,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(`INVALID_WINNER: ${error.message}`);
  process.exit(1);
});
