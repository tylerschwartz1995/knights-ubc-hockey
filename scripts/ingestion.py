"""
SportNinja Stats Ingestion
Pulls skater and goalie stats from the SportNinja API and outputs CSVs
compatible with the UBC Knights stats dashboard.

Usage:
    python -m scripts.ingestion
"""

import csv
import json
import os
import time

import requests
from dotenv import load_dotenv
from pathlib import Path

from common import PROJECT_ROOT
from common.config import load_config

# ── Config ───────────────────────────────────────────────
load_dotenv(PROJECT_ROOT / "config" / ".env")
cfg = load_config("ingestion.yml")

TOKEN = os.environ["SPORTNINJA_TOKEN"]
SCHEDULE_ID = cfg["schedule_id"]
TEAM_ID = cfg["team_id"]
SEASON = cfg["season"]
API_BASE = cfg["api_base"]

OUTPUT_DIR = PROJECT_ROOT / "public" / "seasons" / SEASON

STATS_BASE_URL = (
    f"{API_BASE}/schedules/{SCHEDULE_ID}"
    f"/stats/team/{TEAM_ID}"
)

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Origin": "https://app.sportninja.com",
    "Referer": "https://app.sportninja.com/",
}


# ── Fetch & Parse ────────────────────────────────────────
def fetch_skaters():
    url = f"{STATS_BASE_URL}?page=1&sortBy=4&sort=desc&goalie=0"
    resp = requests.get(url, headers=HEADERS)
    resp.raise_for_status()
    data = resp.json()["data"]

    rows = []
    for entry in data:
        player = entry.get("player", {})
        first = player.get("name_first", "")
        last = player.get("name_last", "")
        name = f"{first} {last}".strip()

        stats = {s["abbr"]: s["value"] for s in entry.get("stats", [])}

        rows.append({
            "Player": name,
            "GP": stats.get("GP", "0"),
            "G": stats.get("G", "0"),
            "A": stats.get("A", "0"),
            "P": stats.get("P", "0"),
            "PM": stats.get("PiM", "0"),
        })

    return rows


def fetch_goalies():
    url = f"{STATS_BASE_URL}?page=1&sortBy=32&sort=desc&goalie=1"
    resp = requests.get(url, headers=HEADERS)
    resp.raise_for_status()
    data = resp.json()["data"]

    rows = []
    for entry in data:
        player = entry.get("player", {})
        first = player.get("name_first", "")
        last = player.get("name_last", "")
        name = f"{first} {last}".strip()

        stats = {s["abbr"]: s["value"] for s in entry.get("stats", [])}

        rows.append({
            "Player": name,
            "GP": stats.get("GP", "0"),
            "GAA": stats.get("GAA", "0.00"),
            "SV%": stats.get("SV%", "0.000"),
            "SV": stats.get("SV", "0"),
            "GA": stats.get("GA", "0"),
            "SA": stats.get("SA", "0"),
            "MIN": stats.get("MIN", "0"),
            "OTL": stats.get("OTL", "0"),
        })

    return rows


def fetch_games():
    url = (
        f"{API_BASE}/schedules/{SCHEDULE_ID}/games"
        f"?page=1&order=desc&exclude_cancelled_games=1"
        f"&team_id={TEAM_ID}"
    )
    resp = requests.get(url, headers=HEADERS)
    resp.raise_for_status()
    data = resp.json()["data"]

    rows = []
    for game in data:
        status = game.get("game_status_id")
        if status != 9:  # only completed games
            continue

        home_id = game.get("homeTeam", {}).get("id")
        home_score = int(game.get("home_team_score", 0))
        away_score = int(game.get("visiting_team_score", 0))

        is_home = home_id == TEAM_ID
        gf = home_score if is_home else away_score
        ga = away_score if is_home else home_score
        opponent = game.get("visitingTeam" if is_home else "homeTeam", {}).get("name", "Unknown")

        period = game.get("current_period", {})
        is_ot = period.get("period_type", {}).get("is_overtime", False)
        is_shootout = game.get("shootout", False)

        if gf > ga:
            result = "W"
        elif is_ot or is_shootout:
            result = "OTL"
        else:
            result = "L"

        date = game.get("starts_at", "")[:10]

        rows.append({
            "id": game.get("id"),
            "Date": date,
            "Opponent": opponent,
            "GF": str(gf),
            "GA": str(ga),
            "Result": result,
            "OT": "1" if is_ot or is_shootout else "0",
            "Home": "1" if is_home else "0",
        })

    rows.sort(key=lambda r: r["Date"])
    return rows


def fetch_game_timeline(game_id):
    url = f"{API_BASE}/games/{game_id}/timeline"
    resp = requests.get(url, headers=HEADERS)
    resp.raise_for_status()
    return resp.json()["data"]


def build_recaps(games):
    recaps = []

    for game in games:
        game_id = game["id"]
        print(f"  Fetching timeline for {game['Date']} vs {game['Opponent']}...")

        try:
            tl = fetch_game_timeline(game_id)
        except Exception as e:
            print(f"    Skipped: {e}")
            continue

        # Build player ID → name lookup from rosters
        player_names = {}
        for roster in tl.get("playerRosters", []):
            for p in roster.get("players", []):
                first = p.get("name_first", "")
                last = p.get("name_last", "")
                player_names[p["id"]] = f"{first} {last}".strip()

        # Build period ID → name lookup
        period_names = {}
        for period in tl.get("periods", []):
            period_names[period["id"]] = period["period_type"]["name"]

        # Period summary (shots/goals per period)
        periods = []
        for period in tl.get("periods", []):
            is_home = True  # We need to figure out which side is home
            # Home team shots are shots_home_count
            periods.append({
                "name": period["period_type"]["name"],
                "shotsHome": period.get("shots_home_count", 0),
                "shotsAway": period.get("shots_visiting_count", 0),
                "goalsHome": period.get("goals_home_count", 0),
                "goalsAway": period.get("goals_visiting_count", 0),
            })

        # Goals
        goals = []
        for goal in tl.get("goals", []):
            shot = goal.get("shot", {})
            scorer_id = shot.get("player_id")
            scorer_name = player_names.get(scorer_id, "Unknown") if scorer_id else "Unknown"
            is_knights = shot.get("team_id") == TEAM_ID

            assists = []
            for a in goal.get("assists", []):
                p = a.get("player", {})
                first = p.get("name_first", "")
                last = p.get("name_last", "")
                assists.append(f"{first} {last}".strip())

            goals.append({
                "period": period_names.get(goal.get("period_id"), "?"),
                "time": goal.get("period_clock_time", ""),
                "team": "Knights" if is_knights else game["Opponent"],
                "scorer": scorer_name,
                "assists": assists,
            })

        # Penalties
        penalties = []
        for off in tl.get("offenses", []):
            player_id = off.get("player_id")
            player_name = player_names.get(player_id, "Unknown") if player_id else "Unknown"
            is_knights = off.get("team_id") == TEAM_ID

            penalties.append({
                "period": period_names.get(off.get("period_id"), "?"),
                "time": off.get("period_clock_time", ""),
                "team": "Knights" if is_knights else game["Opponent"],
                "player": player_name,
                "type": off.get("offense_type", {}).get("name", ""),
                "severity": off.get("offense_severity", {}).get("name", ""),
                "minutes": off.get("penalty", {}).get("amount", 0),
            })

        recaps.append({
            "date": game["Date"],
            "opponent": game["Opponent"],
            "gf": int(game["GF"]),
            "ga": int(game["GA"]),
            "result": game["Result"],
            "ot": game["OT"] == "1",
            "periods": periods,
            "goals": goals,
            "penalties": penalties,
        })

        time.sleep(0.3)  # be polite to the API

    return recaps


def write_csv(rows, filepath, fieldnames):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(filepath, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} players to {filepath}")


if __name__ == "__main__":
    # Skaters
    skaters = fetch_skaters()
    write_csv(
        skaters,
        OUTPUT_DIR / "skaters.csv",
        ["Player", "GP", "G", "A", "P", "PM"],
    )
    print("\nSkaters preview:")
    for r in skaters[:5]:
        print(f"  {r['Player']:20s}  GP={r['GP']:>3s}  G={r['G']:>3s}  A={r['A']:>3s}  P={r['P']:>3s}  PIM={r['PM']:>3s}")
    if len(skaters) > 5:
        print(f"  ... and {len(skaters) - 5} more")

    # Goalies
    goalies = fetch_goalies()
    write_csv(
        goalies,
        OUTPUT_DIR / "goalies.csv",
        ["Player", "GP", "GAA", "SV%", "SV", "GA", "SA", "MIN", "OTL"],
    )
    print("\nGoalies preview:")
    for r in goalies[:5]:
        print(f"  {r['Player']:20s}  GP={r['GP']:>3s}  GAA={r['GAA']:>6s}  SV%={r['SV%']:>5s}  SV={r['SV']:>3s}  GA={r['GA']:>3s}")
    if len(goalies) > 5:
        print(f"  ... and {len(goalies) - 5} more")

    # Games
    games = fetch_games()
    games_csv = [{k: v for k, v in g.items() if k != "id"} for g in games]
    write_csv(
        games_csv,
        OUTPUT_DIR / "games.csv",
        ["Date", "Opponent", "GF", "GA", "Result", "OT", "Home"],
    )
    wins = sum(1 for g in games if g["Result"] == "W")
    losses = sum(1 for g in games if g["Result"] == "L")
    otl = sum(1 for g in games if g["Result"] == "OTL")
    print(f"\nGames: {len(games)} ({wins}W-{losses}L-{otl}OTL)")
    for r in games[-5:]:
        print(f"  {r['Date']}  vs {r['Opponent']:20s}  {r['GF']}-{r['GA']}  {r['Result']}")

    # Game Recaps
    print(f"\nFetching game timelines...")
    recaps = build_recaps(games)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_DIR / "recaps.json", "w") as f:
        json.dump(recaps, f, indent=2)
    print(f"Wrote {len(recaps)} recaps to {OUTPUT_DIR / 'recaps.json'}")

    print("\nDone!")
