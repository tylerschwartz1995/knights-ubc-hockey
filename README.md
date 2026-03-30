# UBC Knights Stats

A stats dashboard for the UBC Knights hockey team. Black and gold theme with dark/light mode, sortable leaderboards, goalie stats, team analytics, and season history.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Project Structure

```
public/seasons/
  2025-26/
    skaters.csv     ← current season skater stats
    goalies.csv     ← current season goalie stats
    games.csv       ← current season game results
  2024-25/
    skaters.csv     ← previous season
    goalies.csv
config/
  ingestion.yml     ← SportNinja API config
  .env              ← API token (gitignored)
scripts/
  ingestion.py      ← pulls stats from SportNinja API
src/
  App.jsx           ← entire app (single file)
```

## CSV Formats

**Skaters** (`skaters.csv`):
```csv
Player,GP,G,A,P,PM
Scott Coy,16,24,9,33,12
```
Column names are flexible — handles `Goals`/`G`, `Assists`/`A`, `Points`/`P`/`PTS`, `PIM`/`PM`, etc. Points auto-calculate from `G + A` if omitted. PPG is calculated automatically.

**Goalies** (`goalies.csv`):
```csv
Player,GP,GAA,SV%,SV,GA,SA,MIN,OTL
Shawn Rassekh,20,6.84,0.844,494,91,585,798,2
```

**Games** (`games.csv`):
```csv
Date,Opponent,GF,GA,Result,OT,Home
2025-10-15,Whalers,4,2,W,0,1
```

**All Time** stats are auto-aggregated from all season files — no separate file needed.

## Features

### Tabs
- **Skaters** — sortable leaderboard with GP, G, A, PTS, PPG, PIM. Click any player row to expand a season-by-season breakdown card. Leader cards for top scorer, goal leader, assist leader.
- **Goalies** — sortable table with GAA, SV%, SV, GA, SA, MIN, OTL. SV% semicircle gauges for each goalie.
- **Team** — team record (W-L-OTL), goals for/against, goal differential, roster size, PIM, team SV%. Current form indicator (last 5 games). Opponent breakdown table (sortable). Recent results with scores. Goal distribution donut chart.

### Season Navigation
- Current season tab
- All Time (aggregated across all seasons)
- History dropdown for past seasons

### Visualizations
- Leader cards (top scorer, goal leader, assist leader)
- Points breakdown bar chart (goals vs assists per player)
- Goal distribution donut chart (team tab)
- SV% semicircle gauges (goalies)
- Milestone tracker (players within 5 of a career milestone)
- Current form indicator (W/L/OTL boxes)

### Other
- Dark/light mode toggle
- Expandable player cards with per-season sparklines
- Sortable tables throughout

## Pull Stats from SportNinja

```bash
# Install Python dependencies
poetry install
# Or: pip install requests python-dotenv pyyaml

# Run ingestion
python -m scripts.ingestion
```

This pulls skater stats, goalie stats, and game results from the SportNinja API and writes CSVs to `public/seasons/{season}/`.

**First-time setup:**
1. Copy `config/.env.example` to `config/.env` (or create it)
2. Open your team page on [app.sportninja.com](https://app.sportninja.com)
3. Open DevTools (F12) > Network tab > filter by Fetch/XHR
4. Find any stats request > copy the Bearer token from the Authorization header
5. Set `SPORTNINJA_TOKEN=<your token>` in `config/.env`

API configuration is in `config/ingestion.yml`:
```yaml
schedule_id: "oLtOPiBmSkBVNlIo"
team_id: "vzPOLIu6nhIQ8GXh"
season: "2025-26"
api_base: "https://metal-api.sportninja.net/v1"
```

**Update workflow:** grab token > `python -m scripts.ingestion` > `git push` > auto-deploys.

## Adding a New Season

1. Create the directory: `public/seasons/{season-id}/`
2. Add `skaters.csv`, `goalies.csv`, and optionally `games.csv`
3. Add the season to the `SEASONS` array in `src/App.jsx`:
```js
const SEASONS = [
  { id: "2025-26", label: "2025-26", dir: "/seasons/2025-26" },
  { id: "2024-25", label: "2024-25", dir: "/seasons/2024-25" },
];
```

## Customize

In `src/App.jsx`, edit the config at the top:
```js
const CONFIG = {
  teamName: "UBC Knights",
  established: "2023",
};
```

The knight helmet logo is an SVG component (`KnightLogo`). To use your own logo, replace it with `<img src="/logo.png" />` and drop the image in `public/`.

## Deploy to Vercel

1. Push to a GitHub repo
2. Go to [vercel.com](https://vercel.com) > sign in with GitHub
3. Import your repo — framework auto-detects as Vite
4. Deploy

To update: run ingestion, commit & push. Vercel auto-redeploys.

## Tech Stack

- **Frontend:** React 18 + Vite, PapaParse for CSV parsing
- **Ingestion:** Python 3.11+, requests, PyYAML
- **Styling:** Inline CSS with dark/light theme support
- **Fonts:** Outfit, DM Mono (Google Fonts)
