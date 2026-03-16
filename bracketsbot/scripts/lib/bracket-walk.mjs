import fs from "node:fs/promises";
import path from "node:path";

export const TOTAL_GAMES = 63;
const FIRST_ROUND_GAMES = 32;
const ROUND_SIZES = [32, 16, 8, 4, 2, 1];
const ROUND_NAMES = [
  "First Round",
  "Second Round",
  "Sweet 16",
  "Elite 8",
  "Final Four",
  "Championship",
];

export const getRoundIndex = (gameIndex) => {
  if (gameIndex < 32) return 0;
  if (gameIndex < 48) return 1;
  if (gameIndex < 56) return 2;
  if (gameIndex < 60) return 3;
  if (gameIndex < 62) return 4;
  return 5;
};

export const getMatchIndexInRound = (gameIndex) => {
  if (gameIndex < 32) return gameIndex;
  if (gameIndex < 48) return gameIndex - 32;
  if (gameIndex < 56) return gameIndex - 48;
  if (gameIndex < 60) return gameIndex - 56;
  if (gameIndex < 62) return gameIndex - 60;
  return 0;
};

export const readJson = async (filePath) => JSON.parse(await fs.readFile(filePath, "utf8"));

export const ensureDirForFile = async (filePath) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
};

export const toSeedProfileMap = (payload) => {
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

export const buildInitialRounds = (matches, seedProfiles) => {
  const firstRound = {
    title: ROUND_NAMES[0],
    seeds: matches.slice(0, FIRST_ROUND_GAMES).map((match) => ({
      teams: match.teams.map((team) => hydrateTeam(team, seedProfiles)),
    })),
  };

  const remainingRounds = ROUND_SIZES.slice(1).map((size, idx) => ({
    title: ROUND_NAMES[idx + 1],
    seeds: Array.from({ length: size }, () => ({ teams: [] })),
  }));

  return [firstRound, ...remainingRounds, { title: "Champion", seeds: [{ teams: [] }] }];
};

export const validatePicksShape = (picks) => {
  if (!Array.isArray(picks)) {
    throw new Error("Picks must be an array.");
  }
  if (picks.length > TOTAL_GAMES) {
    throw new Error(`Picks cannot exceed ${TOTAL_GAMES} games.`);
  }
  for (let i = 0; i < picks.length; i += 1) {
    const pick = Number(picks[i]);
    if (!Number.isInteger(pick) || pick < 1 || pick > 64) {
      throw new Error(`Invalid pick at game ${i}: '${picks[i]}'`);
    }
  }
};

const applyPickToRounds = (rounds, gameIndex, winnerSeed) => {
  const roundIndex = getRoundIndex(gameIndex);
  const matchIndex = getMatchIndexInRound(gameIndex);
  const matchup = rounds[roundIndex]?.seeds?.[matchIndex];
  const [teamA, teamB] = matchup?.teams ?? [];

  if (!teamA || !teamB) {
    throw new Error(`Missing matchup teams at game ${gameIndex}.`);
  }

  if (winnerSeed !== teamA.seed && winnerSeed !== teamB.seed) {
    throw new Error(
      `Illegal winner for game ${gameIndex}: ${winnerSeed} not in ${teamA.seed} vs ${teamB.seed}.`,
    );
  }

  const winner = winnerSeed === teamA.seed ? teamA : teamB;
  const nextMatchIndex = Math.floor(matchIndex / 2);
  const slot = matchIndex % 2;
  rounds[roundIndex + 1].seeds[nextMatchIndex].teams[slot] = winner;
  return winner;
};

export const replayPicks = (rounds, picks) => {
  validatePicksShape(picks);
  for (let gameIndex = 0; gameIndex < picks.length; gameIndex += 1) {
    applyPickToRounds(rounds, gameIndex, Number(picks[gameIndex]));
  }
};

export const getNextMatchup = (rounds, picks) => {
  if (picks.length >= TOTAL_GAMES) {
    const champion = rounds[6]?.seeds?.[0]?.teams?.[0];
    return {
      done: true,
      totalGames: TOTAL_GAMES,
      champion: champion
        ? {
            seed: champion.seed,
            name: champion.name,
            shortName: champion.shortName,
          }
        : null,
    };
  }

  const gameIndex = picks.length;
  const roundIndex = getRoundIndex(gameIndex);
  const matchIndex = getMatchIndexInRound(gameIndex);
  const matchup = rounds[roundIndex].seeds[matchIndex];
  const [teamA, teamB] = matchup.teams;
  if (!teamA || !teamB) {
    throw new Error(`Unable to compute next matchup for game ${gameIndex}.`);
  }

  return {
    done: false,
    totalGames: TOTAL_GAMES,
    gameIndex,
    picksSoFar: picks.length,
    roundIndex,
    roundName: ROUND_NAMES[roundIndex],
    matchIndex,
    teamA,
    teamB,
  };
};

export const appendPick = (rounds, picks, winnerSeed) => {
  if (picks.length >= TOTAL_GAMES) {
    throw new Error("All picks are already complete.");
  }
  const gameIndex = picks.length;
  const winner = applyPickToRounds(rounds, gameIndex, Number(winnerSeed));
  picks.push(Number(winner.seed));
  return { gameIndex, winner };
};

export const readPicksFile = async (picksPath) => {
  try {
    const payload = await readJson(picksPath);
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.predictions)) return payload.predictions;
    throw new Error("Picks file must be an array or object with `predictions`.");
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
};

export const readWalkMeta = async (picksPath) => {
  try {
    const payload = await readJson(picksPath);
    return { draftToken: payload?.draftToken ?? null, draftApiUrl: payload?.draftApiUrl ?? null };
  } catch {
    return { draftToken: null, draftApiUrl: null };
  }
};

export const writePicksFile = async (picksPath, picks, meta = {}) => {
  await ensureDirForFile(picksPath);
  await fs.writeFile(
    picksPath,
    JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        predictions: picks,
        ...meta,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
};
