import path from "node:path";
import { fileURLToPath } from "node:url";
import {
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

const main = async () => {
  const [tournament, teamData, picks] = await Promise.all([
    readJson(tournamentPath),
    readJson(teamDataPath),
    readPicksFile(picksPath),
  ]);

  const meta = await readWalkMeta(picksPath);

  // If a draft session exists, sync picks from the server
  if (meta.draftToken && meta.draftApiUrl) {
    try {
      const res = await fetch(meta.draftApiUrl);
      if (res.ok) {
        const draft = await res.json();

        // If draft is submitted, report done and exit
        if (draft.submitted) {
          console.log(
            JSON.stringify(
              { kind: "walk_next_state", done: true, submitted: true, picksFile: picksPath },
              null,
              2,
            ),
          );
          return;
        }

        // Sync server picks into local state
        const serverPicks = draft.picks ?? [];
        let synced = false;

        // Check for overrides at existing indices — if a pick changed,
        // truncate from that point and replay forward
        for (let i = 0; i < picks.length; i++) {
          const sv = Number(serverPicks[i]);
          if (sv !== 0 && sv !== picks[i]) {
            // User changed a pick on the frontend — rewind to this point
            picks.length = i;
            synced = true;
            break;
          }
        }

        // Take contiguous non-zero prefix from server beyond local state
        for (let i = picks.length; i < serverPicks.length; i++) {
          const v = Number(serverPicks[i]);
          if (v === 0) break;
          picks.push(v);
          synced = true;
        }

        if (synced) {
          await writePicksFile(picksPath, picks, meta);
        }
      }
    } catch (err) {
      process.stderr.write(`draft sync warning: ${err.message}\n`);
    }
  }

  const rounds = buildInitialRounds(tournament, toSeedProfileMap(teamData));
  replayPicks(rounds, picks);
  const state = getNextMatchup(rounds, picks);

  console.log(
    JSON.stringify(
      {
        kind: "walk_next_state",
        picksFile: picksPath,
        picks,
        ...state,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(`INVALID_INPUT: ${error.message}`);
  process.exit(1);
});
