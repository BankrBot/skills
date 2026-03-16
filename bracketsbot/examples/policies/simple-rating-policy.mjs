export function chooseWinner({ teamA, teamB }) {
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
  return scoreA >= scoreB ? teamA.seed : teamB.seed;
}
