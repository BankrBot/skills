/**
 * build-season-guide.mjs
 *
 * Generates the seed-dependent sections of the season guide from team-data.json.
 * Appends mismatch analysis and title contenders to the base season guide.
 *
 * Usage:
 *   node scripts/build-season-guide.mjs
 *
 * Run after build-team-data.mjs whenever the bracket or stats change.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");
const teamDataFile = path.resolve(packageRoot, "data/team-data.json");
const baseGuideFile = path.resolve(packageRoot, "reference/2026-season-guide.md");

const main = async () => {
  const teamData = JSON.parse(await fs.readFile(teamDataFile, "utf8"));
  const teams = teamData.teams;

  if (!teams?.length) {
    console.error("No teams in team-data.json. Run build-team-data.mjs first.");
    process.exit(1);
  }

  // Parse W-L records
  const parseRecord = (r) => {
    if (!r) return { wins: 0, losses: 0 };
    const [w, l] = r.split("-").map(Number);
    return { wins: w, losses: l };
  };

  // Regional seed from overall seed: ceil(seed / 4)
  const regionalSeed = (seed) => Math.ceil(seed / 4);

  // Find mismatches: teams whose SRS rank doesn't match their seed tier
  const sorted = [...teams].filter((t) => t.srs != null).sort((a, b) => b.srs - a.srs);
  const srsRank = new Map(sorted.map((t, i) => [t.seed, i + 1]));

  const underseeded = [];
  const overseeded = [];

  for (const team of teams) {
    const rs = regionalSeed(team.seed);
    const rank = srsRank.get(team.seed);
    const { wins, losses } = parseRecord(team.record);

    // Underseeded: SRS rank much better than seed position
    if (rank && rs >= 5 && rank <= 15) {
      underseeded.push({ ...team, srsRank: rank, regionalSeed: rs });
    }

    // Overseeded: losing record or very low SRS for their seed
    if (rs <= 6 && losses > wins) {
      overseeded.push({ ...team, srsRank: rank, regionalSeed: rs });
    } else if (rs <= 4 && rank && rank > 40) {
      overseeded.push({ ...team, srsRank: rank, regionalSeed: rs });
    }
  }

  // Title contenders: top 10 by SRS
  const contenders = sorted.slice(0, 10);

  // Build the dynamic sections
  let sections = "\n\n---\n\n";
  sections += "<!-- AUTO-GENERATED: Run build-season-guide.mjs to regenerate -->\n\n";

  if (contenders.length > 0) {
    sections += "## Title Contenders (by SRS)\n\n";
    sections += "| Team | Seed | Record | SRS | ORtg | DRtg |\n";
    sections += "|------|------|--------|-----|------|------|\n";
    for (const t of contenders) {
      const rs = regionalSeed(t.seed);
      sections += `| ${t.name} | ${rs}-seed | ${t.record ?? "?"} | ${t.srs?.toFixed(2) ?? "?"} | ${t.offenseRating ?? "?"} | ${t.defenseRating ?? "?"} |\n`;
    }
  }

  if (underseeded.length > 0) {
    sections += "\n## Underseeded Teams (Upset Threats)\n\n";
    sections += "These teams have top-15 SRS but are seeded 5th or lower:\n\n";
    for (const t of underseeded.sort((a, b) => a.srsRank - b.srsRank)) {
      sections += `- **${t.name} (${t.regionalSeed}-seed, ${t.record}, #${t.srsRank} SRS)**\n`;
    }
  }

  if (overseeded.length > 0) {
    sections += "\n## Overseeded Teams (Upset Vulnerable)\n\n";
    sections += "These teams have losing records or weak SRS for their seed line:\n\n";
    for (const t of overseeded.sort((a, b) => a.seed - b.seed)) {
      const { wins, losses } = parseRecord(t.record);
      sections += `- **${t.name} (${t.regionalSeed}-seed, ${t.record}, #${t.srsRank ?? "?"} SRS)**`;
      if (losses > wins) sections += " — sub-.500 record";
      sections += "\n";
    }
  }

  // Read the base guide and append
  let guide = await fs.readFile(baseGuideFile, "utf8");

  // Remove any previous auto-generated sections
  const marker = "<!-- AUTO-GENERATED:";
  const markerIdx = guide.indexOf(marker);
  if (markerIdx !== -1) {
    // Also trim the --- separator before it
    let trimIdx = markerIdx;
    while (trimIdx > 0 && guide[trimIdx - 1] === "\n") trimIdx--;
    if (guide.substring(trimIdx - 3, trimIdx) === "---") trimIdx -= 3;
    while (trimIdx > 0 && guide[trimIdx - 1] === "\n") trimIdx--;
    guide = guide.substring(0, trimIdx);
  }

  guide += sections;

  await fs.writeFile(baseGuideFile, guide, "utf8");
  console.log(
    `Updated season guide: ${contenders.length} contenders, ${underseeded.length} underseeded, ${overseeded.length} overseeded`
  );
};

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
