/**
 * build-team-data.mjs
 *
 * Reads frontend.json (bracket structure) and stats-YYYY-raw.json (season stats),
 * matches teams by name, and outputs data/team-data.json.
 *
 * Usage:
 *   node scripts/build-team-data.mjs
 *
 * Env vars:
 *   TOURNAMENT_FILE  — path to frontend.json (default: frontend/public/tournament/frontend.json)
 *   STATS_FILE       — path to stats-YYYY-raw.json (default: data/stats-2026-raw.json)
 *   OUTPUT_FILE      — path to output (default: data/team-data.json)
 *   SEASON_YEAR      — label for the season (default: "2025-26")
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(packageRoot, "..");

const tournamentFile =
  process.env.TOURNAMENT_FILE ??
  path.resolve(repoRoot, "frontend/public/tournament/frontend.json");
const statsFile =
  process.env.STATS_FILE ??
  path.resolve(packageRoot, "data/stats-2026-raw.json");
const outputFile =
  process.env.OUTPUT_FILE ??
  path.resolve(packageRoot, "data/team-data.json");
const seasonYear = process.env.SEASON_YEAR ?? "2025-26";

// ─── Name normalization ──────────────────────────────────────────────
// Both frontend.json names and stats keys get normalized through this
// so they can match even with minor differences.

const normalize = (name) =>
  name
    .toLowerCase()
    .replace(/['']/g, "")        // remove apostrophes
    .replace(/\./g, "")          // remove dots ("St." → "St")
    .replace(/&/g, "and")        // "A&M" → "AandM"
    .replace(/[^a-z0-9 ]/g, " ") // everything else → space
    .replace(/\s+/g, " ")        // collapse whitespace
    .trim();

// Manual overrides for known mismatches between frontend.json names
// and Sports Reference / stats file names.
// Map: normalized(frontend name) → normalized(stats key)
const NAME_OVERRIDES = {
  "st johns":         "st johns",
  "st marys":         "saint marys",
  "michigan st":      "michigan state",
  "mississippi st":   "mississippi state",
  "iowa st":          "iowa state",
  "utah st":          "utah state",
  "colorado st":      "colorado state",
  "mcneese st":       "mcneese state",
  "norfolk st":       "norfolk state",
  "alabama st":       "alabama state",
  "mt st marys":      "mount st marys",
  "ole miss":         "ole miss",
  "unc wilmington":   "unc wilmington",
  "uc san diego":     "uc san diego",
  "ohio st":          "ohio state",
  "north dakota st":  "north dakota state",
  "wright st":        "wright state",
  "kennesaw st":      "kennesaw state",
  "tennessee st":     "tennessee state",
  "cal baptist":      "california baptist",
  "miami (fl)":       "miami (fl)",
  "queens (nc)":      "queens (nc)",
  "long island":      "long island",
};

// ─── Main ────────────────────────────────────────────────────────────

const main = async () => {
  const tournament = JSON.parse(await fs.readFile(tournamentFile, "utf8"));
  const statsData = JSON.parse(await fs.readFile(statsFile, "utf8"));
  const statsMap = new Map();

  // Build lookup: normalized stats key → stats object
  for (const [key, value] of Object.entries(statsData.teams)) {
    statsMap.set(normalize(key), value);
  }

  // Extract all 64 teams from first-round matchups (ids 1-32)
  const firstRound = tournament.filter(
    (g) => Array.isArray(g.teams) && g.teams.length === 2,
  );

  const teams = [];
  const unmatched = [];

  for (const game of firstRound) {
    for (const team of game.teams) {
      const norm = normalize(team.name);
      const statsKey = NAME_OVERRIDES[norm] ?? norm;
      const stats = statsMap.get(statsKey);

      const entry = {
        seed: team.seed,
        name: team.name,
        shortName: team.shortName,
        regionalSeed: team.regionalSeed,
      };

      if (stats) {
        entry.conference = stats.conference;
        entry.record = stats.record;
        entry.confRecord = stats.confRecord;
        entry.srs = stats.srs;
        entry.sos = stats.sos;
        entry.offenseRating = stats.oRtg;
        entry.defenseRating = stats.dRtg;
      } else {
        unmatched.push({ seed: team.seed, name: team.name, normalized: norm, tried: statsKey });
      }

      teams.push(entry);
    }
  }

  // Sort by seed
  teams.sort((a, b) => a.seed - b.seed);

  const output = {
    description: `${seasonYear} season team data for the NCAA tournament field.`,
    season: seasonYear,
    source: statsData.source ?? "Sports Reference College Basketball",
    updatedAt: new Date().toISOString().slice(0, 10),
    teams,
  };

  await fs.writeFile(outputFile, JSON.stringify(output, null, 2) + "\n", "utf8");

  console.log(`Wrote ${teams.length} teams to ${path.relative(process.cwd(), outputFile)}`);

  if (unmatched.length > 0) {
    console.warn(`\n⚠ ${unmatched.length} team(s) had no stats match:`);
    for (const u of unmatched) {
      console.warn(`  seed ${u.seed}: "${u.name}" (normalized: "${u.tried}")`);
    }
    console.warn(
      `\nAdd overrides to NAME_OVERRIDES in this script, or add entries to the stats file.`,
    );
  }
};

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
