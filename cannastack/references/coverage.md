# CannaStack Coverage

## Metro Areas

CannaStack covers 13 US metro areas across 9 states:

| Metro | State | Dispensaries (approx.) |
|-------|-------|----------------------|
| Phoenix | Arizona | 80+ |
| Tucson | Arizona | 30+ |
| Los Angeles | California | 100+ |
| San Francisco | California | 40+ |
| San Diego | California | 40+ |
| Sacramento | California | 30+ |
| Denver | Colorado | 60+ |
| Chicago | Illinois | 30+ |
| Boston | Massachusetts | 20+ |
| Detroit | Michigan | 30+ |
| Las Vegas | Nevada | 40+ |
| Portland | Oregon | 50+ |
| Seattle | Washington | 50+ |

## Data Source

All data is crawled from Weedmaps dispensary menus.

## Freshness

- Crawl interval: every 6 hours
- Total dispensaries: 600+
- Total menu items: 7000+
- Each crawl updates prices, availability, and deals
- Historical price data is retained for trend analysis

## Location Format

When specifying a location in API requests, use the format: `"City, ST"` (e.g. "Phoenix, AZ", "Los Angeles, CA").

The API matches against known metro areas. Searches outside covered metros will return empty results.
