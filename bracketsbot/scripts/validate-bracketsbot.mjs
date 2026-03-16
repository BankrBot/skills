import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TOTAL_GAMES = 63;
const FIRST_ROUND_GAMES = 32;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const tournamentPath =
  process.env.TOURNAMENT_FILE ??
  path.resolve(scriptDir, "../reference/tournament.json");
const teamDataPath =
  process.env.TEAM_DATA_FILE ??
  path.resolve(scriptDir, "../data/team-data.json");
const predictionPath =
  process.env.PREDICTION_OUTPUT_FILE ??
  path.resolve(scriptDir, "../out/model-bracket-output.json");

const getRoundIndex = (matchIndex) => {
  if (matchIndex < 32) return 0;
  if (matchIndex < 48) return 1;
  if (matchIndex < 56) return 2;
  if (matchIndex < 60) return 3;
  if (matchIndex < 62) return 4;
  return 5;
};

const getMatchIndexInRound = (matchIndex) => {
  if (matchIndex < 32) return matchIndex;
  if (matchIndex < 48) return matchIndex - 32;
  if (matchIndex < 56) return matchIndex - 48;
  if (matchIndex < 60) return matchIndex - 56;
  if (matchIndex < 62) return matchIndex - 60;
  return 0;
};

const fail = (code, message) => {
  const error = new Error(message);
  error.code = code;
  throw error;
};

const assertTeamData = (payload) => {
  if (!payload || typeof payload !== "object") {
    fail("INVALID_INPUT", "Team data payload must be an object.");
  }
  if (!Array.isArray(payload.teams)) {
    fail("INVALID_INPUT", "Team data payload must include a `teams` array.");
  }

  const seen = new Set();
  for (const team of payload.teams) {
    if (!team || typeof team !== "object") {
      fail("INVALID_INPUT", "Team data contains a non-object team row.");
    }
    const seed = Number(team.seed);
    if (!Number.isInteger(seed) || seed < 1 || seed > 64) {
      fail("INVALID_INPUT", `Invalid team seed '${team.seed}'. Expected integer 1..64.`);
    }
    if (seen.has(seed)) {
      fail("INVALID_INPUT", `Duplicate team seed ${seed} in team data.`);
    }
    if (!team.name || !team.shortName) {
      fail("INVALID_INPUT", `Team seed ${seed} is missing name/shortName.`);
    }
    seen.add(seed);
  }

  if (seen.size !== 64) {
    fail("INVALID_INPUT", `Expected 64 unique seeds in team data, found ${seen.size}.`);
  }
};

const assertTournament = (matches) => {
  if (!Array.isArray(matches)) {
    fail("INVALID_INPUT", "Tournament data must be an array of matches.");
  }
  if (matches.length < TOTAL_GAMES) {
    fail(
      "INVALID_INPUT",
      `Tournament data must contain at least ${TOTAL_GAMES} matches, found ${matches.length}.`,
    );
  }

  const seen = new Set();
  for (const match of matches.slice(0, FIRST_ROUND_GAMES)) {
    if (!Array.isArray(match?.teams) || match.teams.length !== 2) {
      fail(
        "INVALID_INPUT",
        "Each first-round matchup must contain exactly 2 teams.",
      );
    }
    for (const team of match.teams) {
      const seed = Number(team?.seed);
      if (!Number.isInteger(seed) || seed < 1 || seed > 64) {
        fail("INVALID_INPUT", `Invalid first-round team seed '${team?.seed}'.`);
      }
      if (seen.has(seed)) {
        fail("INVALID_INPUT", `Duplicate first-round seed ${seed} in tournament data.`);
      }
      seen.add(seed);
    }
  }
  if (seen.size !== 64) {
    fail(
      "INVALID_INPUT",
      `Expected 64 unique first-round seeds in tournament data, found ${seen.size}.`,
    );
  }
};

const buildRoundsFromTournament = (matches) => {
  const rounds = [
    {
      seeds: matches.slice(0, FIRST_ROUND_GAMES).map((match) => ({
        teams: match.teams.map((team) => ({
          seed: Number(team.seed),
          name: team.name,
          shortName: team.shortName,
        })),
      })),
    },
    { seeds: Array.from({ length: 16 }, () => ({ teams: [] })) },
    { seeds: Array.from({ length: 8 }, () => ({ teams: [] })) },
    { seeds: Array.from({ length: 4 }, () => ({ teams: [] })) },
    { seeds: Array.from({ length: 2 }, () => ({ teams: [] })) },
    { seeds: Array.from({ length: 1 }, () => ({ teams: [] })) },
    { seeds: Array.from({ length: 1 }, () => ({ teams: [] })) },
  ];
  return rounds;
};

const assertPredictions = (predictionPayload, rounds) => {
  if (!predictionPayload || typeof predictionPayload !== "object") {
    fail("INVALID_INPUT", "Prediction payload must be an object.");
  }

  if (!Array.isArray(predictionPayload.predictions)) {
    fail("INVALID_INPUT", "Prediction payload must include a `predictions` array.");
  }
  if (predictionPayload.predictions.length !== TOTAL_GAMES) {
    fail(
      "INVALID_INPUT",
      `Prediction array must have ${TOTAL_GAMES} picks, found ${predictionPayload.predictions.length}.`,
    );
  }

  const picks = predictionPayload.predictions.map((value, index) => {
    const pick = Number(value);
    if (!Number.isInteger(pick) || pick < 1 || pick > 64) {
      fail("INVALID_INPUT", `Invalid pick at game ${index}: '${value}' (expected 1..64).`);
    }
    return pick;
  });

  for (let gameIndex = 0; gameIndex < TOTAL_GAMES; gameIndex += 1) {
    const roundIndex = getRoundIndex(gameIndex);
    const matchIndex = getMatchIndexInRound(gameIndex);
    const matchup = rounds[roundIndex].seeds[matchIndex];
    const [teamA, teamB] = matchup.teams;

    if (!teamA || !teamB) {
      fail(
        "INVALID_INPUT",
        `Tournament progression is incomplete at game ${gameIndex} (round ${roundIndex}).`,
      );
    }

    const winnerSeed = picks[gameIndex];
    if (winnerSeed !== teamA.seed && winnerSeed !== teamB.seed) {
      fail(
        "INVALID_WINNER",
        `Illegal winner at game ${gameIndex}: seed ${winnerSeed} is not in matchup (${teamA.seed} vs ${teamB.seed}).`,
      );
    }

    const winner = winnerSeed === teamA.seed ? teamA : teamB;
    const nextMatchIndex = Math.floor(matchIndex / 2);
    const slot = matchIndex % 2;
    rounds[roundIndex + 1].seeds[nextMatchIndex].teams[slot] = winner;
  }

  const champion = rounds[6].seeds[0].teams[0];
  if (!champion) {
    fail("INVALID_INPUT", "Could not determine champion from prediction progression.");
  }

  return champion;
};

const main = async () => {
  const [tournamentRaw, teamDataRaw, predictionRaw] = await Promise.all([
    fs.readFile(tournamentPath, "utf8"),
    fs.readFile(teamDataPath, "utf8"),
    fs.readFile(predictionPath, "utf8"),
  ]);

  const tournament = JSON.parse(tournamentRaw);
  const teamData = JSON.parse(teamDataRaw);
  const prediction = JSON.parse(predictionRaw);

  assertTournament(tournament);
  assertTeamData(teamData);
  const rounds = buildRoundsFromTournament(tournament);
  const champion = assertPredictions(prediction, rounds);

  console.log(
    JSON.stringify(
      {
        ok: true,
        files: {
          tournamentPath,
          teamDataPath,
          predictionPath,
        },
        counts: {
          teams: teamData.teams.length,
          predictions: prediction.predictions.length,
          tournamentMatches: tournament.length,
        },
        champion: {
          seed: champion.seed,
          name: champion.name,
          shortName: champion.shortName,
        },
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  const code = error.code ?? "UNKNOWN";
  console.error(`${code}: ${error.message}`);
  process.exit(1);
});
