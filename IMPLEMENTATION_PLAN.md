# New season implementation

## Goal

Start the new season with accurate statistics, preserved history, and a repeatable
refresh process. The season label, SportNinja schedule/team, and season length
were confirmed from the supplied link and logged-in team page. Season length
is still unknown, so projections remain disabled.

## Work order

1. Fix preseason awards and empty states; restrict pace projections to regular
   season and make season length configurable per season.
2. Refactor ingestion to fetch every page, use bounded network requests, validate
   responses, and finish all downloads before writing. Stage a complete season
   directory and restore the previous directory if publishing fails.
3. Support explicit regular-season, playoff, and tournament imports without
   overwriting the other competitions or manually maintained awards.
4. Register and initialize the confirmed new season; preserve all older files.
5. Implement upcoming schedule and automated refresh if selected by the owner.
   Automation activation depends on usable credentials and repository access.
6. Add regression checks for zero-game awards, pagination, failed refreshes,
   competition isolation, and any new schedule behavior. Build and browser-check
   current season, history, and career totals.
7. Update the README with setup, refresh, verification, and credential instructions.

## Decisions and implementation status

- Confirmed current season: 2026–27, team `vzPOLIu6nhIQ8GXh`, schedule
  `QFp35Jr1ctPw0GZX`.
- Keep Stuart Coy excluded from goalie statistics; he remains in skater stats.
- Upcoming schedule implemented; refresh remains manual as requested.
- Existing local token refreshed from the authorized, logged-in browser session.
- September 19 game imported as an explicitly confirmed 8–2 final from its
  scoring summary. A scoped correction is recorded and reconciles on the next
  official refresh without double counting.
- One upcoming game imported: September 26, 10:15 p.m. PDT vs West Coast Express.
- Season length remains null until the league publishes it.
- Implementation and regression checks complete; final browser/build checks are
  recorded in the task response. Deployment follows the repository Git integration
  after merging to main.

## Completion criteria

- No changes to historical data from the rollover.
- Zero-game seasons render without errors or premature award winners.
- A failed fetch/validation leaves existing season files untouched.
- Imports cannot silently stop at page one or mix competition outputs.
- New season settings reflect confirmed information.
- Production build, regression checks, and relevant browser flows pass.
- Any remaining external setup is explicitly documented.
