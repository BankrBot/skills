# 2026 NCAA Tournament Season Guide

Reference context for AI agents picking brackets. Stats from Sports Reference.

## Historical Upset Rates by Seed (First Round)

These are the most important numbers for bracket picking. Data from 1985-2024 (40 tournaments):

| Matchup | Higher Seed Win % | Upset Rate | Key Insight |
|---------|-------------------|------------|-------------|
| 1 vs 16 | 99.3% | 0.7% | Only 2 upsets ever (UMBC 2018, FDU 2023) |
| 2 vs 15 | 94.3% | 5.7% | Happens roughly once every 2 tournaments |
| 3 vs 14 | 85.0% | 15.0% | About 2-3 upsets per tournament |
| 4 vs 13 | 79.3% | 20.7% | Notable jump — 13s are dangerous |
| **5 vs 12** | **64.3%** | **35.7%** | **The classic upset — pick at least one 12-over-5** |
| 6 vs 11 | 62.9% | 37.1% | Nearly as common as 5-12; First Four 11-seeds are wild cards |
| 7 vs 10 | 60.7% | 39.3% | Coin-flip territory begins |
| 8 vs 9 | 49.3% | 50.7% | Literally a coin flip — 9-seeds win MORE often |

**Key takeaway**: The 4-5 seed line is where the bracket breaks open. Seeds 5-8 are far more vulnerable than seeds 1-4.

## Bracket Strategy Heuristics

### Always Pick
- 1-seeds to beat 16-seeds (99.3% hit rate)
- 2-seeds to beat 15-seeds unless the 15-seed has a great record and the 2-seed is shaky

### Always Pick At Least One
- 12-over-5 upset (averages 1.4 per tournament)
- 11-over-6 upset (averages 1.5 per tournament)
- 10-over-7 upset (averages 1.6 per tournament)

### Coin Flip Games (don't overthink)
- 8 vs 9 matchups — literally 50/50 historically. Pick based on matchup, not seed.

### Cinderella Factors
- Mid-major teams with 25+ wins and elite offensive efficiency can make Sweet 16 runs
- Teams with experienced coaches who've been to March before (Gonzaga's Few, Kansas' Self, Michigan State's Izzo)
- Defensive teams travel better in March — neutral courts eliminate home advantage

### Tempo Mismatches
- Slow-tempo defensive teams can neutralize more talented opponents
- Fast-tempo teams with bad defense tend to lose in March (more possessions = more variance)

## Key Ratings Glossary

- **SRS** (Simple Rating System): Team's average margin of victory adjusted for schedule strength. The single best predictor of tournament success.
- **SOS** (Strength of Schedule): Average SRS of opponents. Higher = tougher schedule.
- **ORtg** (Offensive Rating): Points scored per 100 possessions. Above 120 is elite.
- **DRtg** (Defensive Rating): Points allowed per 100 possessions. Below 90 is elite.

## How to Use Team Data

The `team-data.json` file contains all 64 tournament teams with current season stats. When evaluating a matchup, compare:

1. **SRS** — the single best overall quality metric
2. **Record** — teams with losing records as high seeds are upset-prone
3. **ORtg vs DRtg** — a team with elite defense (low DRtg) is safer in March than one relying on offense
4. **SOS** — high-SOS teams from major conferences may be underseeded; low-SOS mid-majors may be overseeded
5. **Conference** — SEC, Big Ten, Big 12, ACC, Big East are the power conferences

Look for mismatches: a 12-seed with 25+ wins and positive SRS against a 5-seed with a losing record is the classic upset pick.

## External Resources

For the most current data (updated daily through the tournament):
- **Sports Reference**: https://www.sports-reference.com/cbb/seasons/men/2026-ratings.html
- **KenPom**: https://kenpom.com (subscription; gold standard for efficiency ratings)
- **Barttorvik**: https://barttorvik.com (free KenPom alternative)
- **ESPN BPI**: https://www.espn.com/mens-college-basketball/bpi

---

<!-- AUTO-GENERATED: Run build-season-guide.mjs to regenerate -->

## Title Contenders (by SRS)

| Team | Seed | Record | SRS | ORtg | DRtg |
|------|------|--------|-----|------|------|
| Michigan | 1-seed | 31-2 | 32.93 | 128.57 | 83.99 |
| Duke | 1-seed | 32-2 | 31.57 | 129.41 | 84.93 |
| Arizona | 1-seed | 32-2 | 29.93 | 126.7 | 85.92 |
| Florida | 1-seed | 26-7 | 27.92 | 125.71 | 88.39 |
| Iowa St. | 2-seed | 27-7 | 27.15 | 125.76 | 88.44 |
| Illinois | 3-seed | 24-8 | 26.46 | 132.18 | 94.31 |
| Houston | 2-seed | 28-6 | 26.23 | 124.21 | 86.6 |
| Purdue | 2-seed | 26-8 | 25.22 | 132.11 | 96.1 |
| Gonzaga | 3-seed | 30-3 | 25.14 | 122.95 | 88.51 |
| Michigan St. | 3-seed | 25-7 | 23.46 | 123.85 | 90.49 |

## Underseeded Teams (Upset Threats)

These teams have top-15 SRS but are seeded 5th or lower:

- **Louisville (6-seed, 23-10, #11 SRS)**
- **Vanderbilt (5-seed, 26-7, #12 SRS)**
- **St. John's (5-seed, 28-6, #15 SRS)**
