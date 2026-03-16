import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TOTAL_GAMES = 63;
const FIRST_ROUND_GAMES = 32;
const ROUND_SIZES = [16, 8, 4, 2, 1];
const ROUND_NAMES = [
  "Second Round",
  "Sweet 16",
  "Elite 8",
  "Final Four",
  "Championship",
];

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const tournamentPath =
  process.env.TOURNAMENT_FILE ??
  path.resolve(scriptDir, "../reference/tournament.json");
const teamDataPath =
  process.env.TEAM_DATA_FILE ??
  path.resolve(scriptDir, "../data/team-data.json");
const outputPath =
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

const toSeedProfileMap = (payload) => {
  const map = new Map();
  for (const team of payload.teams ?? []) {
    map.set(Number(team.seed), team);
  }
  return map;
};

const hydrateTeam = (team, seedProfiles) => {
  const profile = seedProfiles.get(Number(team.seed));
  if (!profile) {
    throw new Error(`Missing model profile for seed ${team.seed}`);
  }
  return { ...team, profile };
};

const buildBracket = (matches, seedProfiles) => {
  const firstRound = {
    title: "First Round",
    seeds: matches.slice(0, FIRST_ROUND_GAMES).map((match) => ({
      ...match,
      teams: match.teams.map((team) => hydrateTeam(team, seedProfiles)),
    })),
  };

  const remainingRounds = ROUND_SIZES.map((size, roundOffset) => ({
    title: ROUND_NAMES[roundOffset],
    seeds: Array.from({ length: size }, (_, i) => ({
      id:
        33 + i + ROUND_SIZES.slice(0, roundOffset).reduce((sum, n) => sum + n, 0),
      teams: [],
    })),
  }));

  return [
    firstRound,
    ...remainingRounds,
    { title: "Champion", seeds: [{ teams: [], id: 64 }] },
  ];
};

// Replace this function with your own AI/ML model inference.
const chooseWinner = ({ teamA, teamB }) => {
  const scoreA =
    teamA.profile.teamRating +
    teamA.profile.offenseRating * 0.35 +
    teamA.profile.defenseRating * 0.35 +
    teamA.profile.threePtPct * 100 * 0.3;
  const scoreB =
    teamB.profile.teamRating +
    teamB.profile.offenseRating * 0.35 +
    teamB.profile.defenseRating * 0.35 +
    teamB.profile.threePtPct * 100 * 0.3;
  return scoreA >= scoreB ? teamA : teamB;
};

const validateFirstRound = (rounds) => {
  const seen = new Set();
  for (const matchup of rounds[0].seeds) {
    for (const team of matchup.teams) {
      if (!team || typeof team.seed !== "number") {
        throw new Error("Invalid team in first-round matchup");
      }
      if (seen.has(team.seed)) {
        throw new Error(`Duplicate first-round seed ${team.seed}`);
      }
      seen.add(team.seed);
    }
  }
  if (seen.size !== 64) {
    throw new Error(`Expected 64 seeded teams, found ${seen.size}`);
  }
};

const buildPredictions = (rounds) => {
  const picks = Array(TOTAL_GAMES).fill(0);

  for (let gameIndex = 0; gameIndex < TOTAL_GAMES; gameIndex += 1) {
    const roundIndex = getRoundIndex(gameIndex);
    const matchIndex = getMatchIndexInRound(gameIndex);
    const matchup = rounds[roundIndex].seeds[matchIndex];
    const [teamA, teamB] = matchup.teams;

    if (!teamA || !teamB) {
      throw new Error(
        `Missing matchup teams at game ${gameIndex} (round ${roundIndex})`,
      );
    }

    const winner = chooseWinner({ teamA, teamB, gameIndex, picks });
    if (winner.seed !== teamA.seed && winner.seed !== teamB.seed) {
      throw new Error(`Model returned invalid winner for game ${gameIndex}`);
    }

    picks[gameIndex] = winner.seed;

    const nextMatchIndex = Math.floor(matchIndex / 2);
    const slot = matchIndex % 2;
    rounds[roundIndex + 1].seeds[nextMatchIndex].teams[slot] = winner;
  }

  return picks;
};

const main = async () => {
  const [matchesRaw, teamDataRaw] = await Promise.all([
    fs.readFile(tournamentPath, "utf8"),
    fs.readFile(teamDataPath, "utf8"),
  ]);

  const matches = JSON.parse(matchesRaw);
  const teamData = JSON.parse(teamDataRaw);
  const seedProfiles = toSeedProfileMap(teamData);

  const rounds = buildBracket(matches, seedProfiles);
  validateFirstRound(rounds);
  const predictions = buildPredictions(rounds);
  const champion = rounds[6].seeds[0].teams[0];

  const result = {
    generatedAt: new Date().toISOString(),
    source: {
      tournamentPath,
      teamDataPath,
    },
    champion: {
      seed: champion.seed,
      name: champion.name,
      shortName: champion.shortName,
    },
    predictions,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(result, null, 2) + "\n", "utf8");

  console.log(`Wrote ${outputPath}`);
  console.log(`Champion: #${champion.seed} ${champion.name}`);
  console.log(`Prediction length: ${predictions.length}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
