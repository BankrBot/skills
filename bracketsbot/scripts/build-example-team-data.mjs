import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultTournamentPath = path.resolve(
  scriptDir,
  "../reference/tournament.json",
);
const defaultOutputPath = path.resolve(
  scriptDir,
  "../data/team-data.json",
);

const tournamentPath = process.env.TOURNAMENT_FILE ?? defaultTournamentPath;
const outputPath = process.env.TEAM_DATA_FILE ?? defaultOutputPath;

const toProfile = (team) => {
  const seed = Number(team.seed);
  const regionalSeed = Number(team.regionalSeed ?? 16);
  return {
    seed,
    name: team.name,
    shortName: team.shortName ?? team.name,
    regionalSeed,
    // Replace these placeholders with your real model features.
    teamRating: Number(
      (100 - (regionalSeed - 1) * 3.2 + ((65 - seed) % 7) * 0.35).toFixed(2),
    ),
    offenseRating: Number(
      (92 - (regionalSeed - 1) * 2.0 + (seed % 5) * 0.6).toFixed(2),
    ),
    defenseRating: Number(
      (89 - (regionalSeed - 1) * 1.7 + ((seed + 2) % 6) * 0.55).toFixed(2),
    ),
    tempo: Number((63 + (seed % 8) * 0.8).toFixed(2)),
    threePtPct: Number((0.29 + (seed % 11) * 0.006).toFixed(3)),
  };
};

const main = async () => {
  const raw = await fs.readFile(tournamentPath, "utf8");
  const matches = JSON.parse(raw);

  const teamsBySeed = new Map();
  for (const match of matches.slice(0, 32)) {
    for (const team of match.teams ?? []) {
      teamsBySeed.set(Number(team.seed), toProfile(team));
    }
  }

  if (teamsBySeed.size !== 64) {
    throw new Error(`Expected 64 seeded teams, found ${teamsBySeed.size}`);
  }

  const payload = {
    description:
      "Example model input keyed by overall seed. Replace with your own data.",
    teams: [...teamsBySeed.values()].sort((a, b) => a.seed - b.seed),
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(payload, null, 2) + "\n", "utf8");

  console.log(`Wrote ${outputPath} (${payload.teams.length} teams)`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
