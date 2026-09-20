"""Refresh SportNinja data without publishing partial downloads.

Run: python -m scripts.ingestion [--mode regular|playoffs|tournament] [--dry-run]
"""

import argparse
import csv
import io
import json
import os
import re
import shutil
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from zoneinfo import ZoneInfo

import requests
from dotenv import load_dotenv

from common import PROJECT_ROOT
from common.config import load_config
from scripts.summary_stats import stats_from_summary

PREFIXES = {"regular": "", "playoffs": "playoffs-", "tournament": "tournaments-"}
SKATER_FIELDS = ["Player", "GP", "G", "A", "P", "PM"]
GOALIE_FIELDS = ["Player", "GP", "W", "L", "GAA", "SV%", "SV", "GA", "SA", "MIN", "OTL", "SO"]
GAME_FIELDS = ["Date", "Opponent", "GF", "GA", "Result", "OT", "Home"]


def parse_start(value):
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("SportNinja game start time must include its timezone")
    return parsed


class SportNinjaClient:
    def __init__(self, cfg, token, mode="regular", session=None):
        self.schedule_id = cfg.get("schedules", {}).get(mode)
        # Compatibility with the original regular-season configuration.
        if mode == "regular" and not self.schedule_id:
            self.schedule_id = cfg.get("schedule_id")
        if not self.schedule_id or not cfg.get("team_id"):
            raise ValueError(f"Set team_id and schedules.{mode} in config/ingestion.yml")
        if not token:
            raise ValueError("Set SPORTNINJA_TOKEN in config/.env before importing")
        self.team_id = cfg["team_id"]
        self.confirmed_final_ids = set(cfg.get("confirmed_final_games", [])) if mode == "regular" else set()
        self.summary_game_ids = []
        self.timeline_cache = {}
        self.timezone = cfg.get("timezone", "America/Vancouver")
        ZoneInfo(self.timezone)
        self.api_base = cfg["api_base"].rstrip("/")
        self.stats_url = f"{self.api_base}/schedules/{self.schedule_id}/stats/team/{self.team_id}"
        self.session = session or requests.Session()
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "Origin": "https://app.sportninja.com",
            "Referer": "https://app.sportninja.com/",
        }

    def get_json(self, url):
        response = self.session.get(url, headers=self.headers, timeout=(10, 30))
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict):
            raise ValueError("Expected a SportNinja JSON object")
        return payload

    def fetch_pages(self, url):
        parts = urlsplit(url)
        params = dict(parse_qsl(parts.query))
        rows, seen_pages = [], set()
        for page in range(1, 1001):
            params["page"] = str(page)
            page_url = urlunsplit(parts._replace(query=urlencode(params)))
            payload = self.get_json(page_url)
            batch = payload.get("data")
            if not isinstance(batch, list) or any(not isinstance(row, dict) for row in batch):
                raise ValueError("Expected a list of SportNinja records")
            meta = payload.get("meta") or payload.get("pagination") or payload
            if isinstance(meta, dict) and isinstance(meta.get("pagination"), dict):
                meta = meta["pagination"]
            last_page = meta.get("last_page", meta.get("total_pages")) if isinstance(meta, dict) else None
            if not batch:
                if last_page is not None and page < int(last_page):
                    raise ValueError("SportNinja returned an empty page before the last page")
                return rows
            signature = json.dumps(batch, sort_keys=True)
            if signature in seen_pages:
                raise ValueError("SportNinja repeated a page; refusing an incomplete refresh")
            seen_pages.add(signature)
            rows.extend(batch)
            if last_page is not None and page >= int(last_page):
                return rows
            # Without explicit pagination metadata, request pages until empty.
        raise ValueError("Pagination exceeded 1000 pages; existing data preserved")

    # ── Fetch & Parse ────────────────────────────────────────
    def fetch_skaters(self):
        url = f"{self.stats_url}?page=1&sortBy=4&sort=desc&goalie=0"
        data = self.fetch_pages(url)

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


    def fetch_goalies(self):
        url = f"{self.stats_url}?page=1&sortBy=32&sort=desc&goalie=1"
        data = self.fetch_pages(url)

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
                "W": stats.get("W", "0"),
                "L": stats.get("L", "0"),
                "GAA": stats.get("GAA", "0.00"),
                "SV%": stats.get("SV%", "0.000"),
                "SV": stats.get("SV", "0"),
                "GA": stats.get("GA", "0"),
                "SA": stats.get("SA", "0"),
                "MIN": stats.get("MIN", "0"),
                "OTL": stats.get("OTL", "0"),
                "SO": stats.get("SO", "0"),
            })

        return rows


    def fetch_games(self):
        url = (
            f"{self.api_base}/schedules/{self.schedule_id}/games"
            f"?page=1&order=desc&exclude_cancelled_games=1"
            f"&team_id={self.team_id}"
        )
        data = self.fetch_pages(url)

        rows = []
        upcoming = []
        pending = []
        self.summary_game_ids = []
        for game in data:
            home_id = game.get("homeTeam", {}).get("id")
            away_id = game.get("visitingTeam", {}).get("id")
            if self.team_id not in (home_id, away_id):
                raise ValueError("Schedule returned a game for another team")
            if not game.get("id") or not game.get("starts_at"):
                raise ValueError("Game is missing its ID or start time")
            starts_at = parse_start(game["starts_at"])
            status_final = int(game.get("game_status_id", 0)) == 9
            confirmed_final = game["id"] in self.confirmed_final_ids and not status_final
            if confirmed_final:
                self.summary_game_ids.append(game["id"])
            if not status_final and not confirmed_final:
                is_home = home_id == self.team_id
                scheduled = {
                    "id": game["id"],
                    "startsAt": starts_at.isoformat(),
                    "opponent": game.get("visitingTeam" if is_home else "homeTeam", {}).get("name", "TBA"),
                    "home": is_home,
                    "venue": (game.get("venue") or {}).get("name", ""),
                    "facility": (game.get("facility") or {}).get("name", ""),
                }
                if starts_at > datetime.now(timezone.utc):
                    upcoming.append(scheduled)
                elif game.get("started_at") and game.get("home_team_score") is not None and game.get("visiting_team_score") is not None:
                    home_score = int(game["home_team_score"])
                    away_score = int(game["visiting_team_score"])
                    pending.append({**scheduled, "gf": home_score if is_home else away_score, "ga": away_score if is_home else home_score})
                continue
            home_score = int(game["home_team_score"])
            away_score = int(game["visiting_team_score"])

            is_home = home_id == self.team_id
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

            date = starts_at.astimezone(ZoneInfo(self.timezone)).date().isoformat()

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
        upcoming.sort(key=lambda game: game["startsAt"])
        pending.sort(key=lambda game: game["startsAt"], reverse=True)
        return rows, upcoming, pending


    def fetch_game_timeline(self, game_id):
        if game_id in self.timeline_cache:
            return self.timeline_cache[game_id]
        url = f"{self.api_base}/games/{game_id}/timeline"
        data = self.get_json(url).get("data")
        if not isinstance(data, dict) or any(
            not isinstance(data.get(key), list)
            for key in ("playerRosters", "periods", "goals", "offenses")
        ):
            raise ValueError(f"Incomplete timeline for game {game_id}; existing data preserved")
        self.timeline_cache[game_id] = data
        return data


    def build_recaps(self, games):
        recaps = []

        for game in games:
            game_id = game["id"]
            print(f"  Fetching timeline for {game['Date']} vs {game['Opponent']}...")

            tl = self.fetch_game_timeline(game_id)

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
                is_knights = shot.get("team_id") == self.team_id

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
                is_knights = off.get("team_id") == self.team_id

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
                "id": game["id"],
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


def csv_text(rows, fields):
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=fields, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue()


def validate_players(rows, fields):
    names = set()
    for row in rows:
        name = row["Player"]
        if not name or name in names:
            raise ValueError("Missing or duplicate player names in stats")
        names.add(name)
        for field in fields:
            if field != "Player":
                value = float(row[field])
                if not (0 <= value < float("inf")):
                    raise ValueError(f"Invalid {field} for {name}")


def collect_snapshot(client):
    skaters = client.fetch_skaters()
    goalies = client.fetch_goalies()
    games, upcoming, pending = client.fetch_games()
    if client.summary_game_ids:
        if len(games) != 1 or len(client.summary_game_ids) != 1 or skaters or goalies:
            raise ValueError("The temporary scoring-summary correction needs reconciliation with official stats before refreshing")
        skaters, goalies = stats_from_summary(client.fetch_game_timeline(games[0]["id"]), client.team_id, games[0])
    validate_players(skaters, SKATER_FIELDS)
    validate_players(goalies, GOALIE_FIELDS)
    ids = [game["id"] for game in games] + [game["id"] for game in upcoming + pending]
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate games across schedule pages")
    if games and not skaters:
        raise ValueError("Completed games returned without skater statistics")
    for game in games:
        if int(game["GF"]) < 0 or int(game["GA"]) < 0:
            raise ValueError("Negative game score")
    recaps = client.build_recaps(games)
    if len(recaps) != len(games):
        raise ValueError("Missing game recaps")
    return {
        "skaters.csv": csv_text(skaters, SKATER_FIELDS),
        "goalies.csv": csv_text(goalies, GOALIE_FIELDS),
        "games.csv": csv_text([{k: g[k] for k in GAME_FIELDS} for g in games], GAME_FIELDS),
        "recaps.json": json.dumps(recaps, indent=2) + "\n",
        "corrections.json": json.dumps([{
            "gameId": game_id, "reason": "Owner confirmed final; SportNinja status is incorrect",
            "source": "SportNinja scoring timeline and active game roster",
            "goalieMinutes": "Sum of recorded regulation period durations; full game confirmed by owner",
        } for game_id in client.summary_game_ids], indent=2) + "\n",
        "upcoming.json": json.dumps({"games": upcoming, "pendingGames": pending, "statsSource": "scoring-summary" if client.summary_game_ids else "official", "updatedAt": datetime.now(timezone.utc).isoformat()}, indent=2) + "\n",
    }


def validate_no_removals(output_dir, files):
    """Detect accidentally selecting an empty/wrong schedule or partial API results."""
    for name, content in files.items():
        previous = output_dir / name
        if not previous.exists() or not name.endswith(".csv"):
            continue
        old = list(csv.DictReader(io.StringIO(previous.read_text())))
        new = list(csv.DictReader(io.StringIO(content)))
        fields = ("Date", "Opponent") if name.endswith("games.csv") else ("Player",)
        old_keys = {tuple(row[key] for key in fields) for row in old}
        new_keys = {tuple(row[key] for key in fields) for row in new}
        if not old_keys.issubset(new_keys) or len(new) < len(old):
            raise ValueError(f"Refresh would remove records from {name}; check the schedule or use --allow-removals for a verified correction")


def publish_snapshot(output_dir, files):
    """Stage every file, preserving awards/other modes, then swap with rollback."""
    output_dir.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix=".season-refresh-", dir=output_dir.parent))
    staging = temporary / "staged"
    backup = temporary / "backup"
    try:
        if output_dir.exists():
            shutil.copytree(output_dir, staging)
        else:
            staging.mkdir()
        for name, content in files.items():
            (staging / name).write_text(content, encoding="utf-8")
        had_previous = output_dir.exists()
        if had_previous:
            output_dir.rename(backup)
        try:
            staging.rename(output_dir)
        except BaseException:
            if had_previous:
                try:
                    backup.rename(output_dir)
                except OSError as error:
                    raise OSError(f"Could not restore the season; original files retained at {backup}") from error
            raise
    finally:
        # Never delete the only remaining copy if rollback itself fails.
        if output_dir.exists() or not backup.exists():
            shutil.rmtree(temporary)


def refresh(client, output_dir, mode="regular", dry_run=False, allow_removals=False):
    files = {PREFIXES[mode] + name: content for name, content in collect_snapshot(client).items()}
    if not allow_removals:
        validate_no_removals(output_dir, files)
    if not dry_run:
        publish_snapshot(output_dir, files)
    return files


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=PREFIXES, default="regular")
    parser.add_argument("--dry-run", action="store_true", help="Download and validate without writing")
    parser.add_argument("--allow-removals", action="store_true", help="Allow a verified API correction to remove existing records")
    args = parser.parse_args()
    load_dotenv(PROJECT_ROOT / "config" / ".env")
    cfg = load_config("ingestion.yml")
    season = cfg.get("season", "")
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]*", season):
        parser.error("Set a valid season ID in config/ingestion.yml")
    manifest = json.loads((PROJECT_ROOT / "config" / "seasons.json").read_text())
    if season not in {entry["id"] for entry in manifest["seasons"]}:
        parser.error("Register the season in config/seasons.json first")
    output_dir = PROJECT_ROOT / "public" / "seasons" / season
    # flock prevents concurrent refreshes from swapping the same season directory.
    import fcntl
    lock_path = Path(tempfile.gettempdir()) / ("knights-" + str(PROJECT_ROOT).replace("/", "_") + ".lock")
    try:
        with lock_path.open("w") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            client = SportNinjaClient(cfg, os.getenv("SPORTNINJA_TOKEN"), args.mode)
            files = refresh(client, output_dir, args.mode, args.dry_run, args.allow_removals)
        action = "Validated" if args.dry_run else "Updated"
        print(f"{action} {season} / {args.mode}: {', '.join(files)}")
        schedule = json.loads(files[PREFIXES[args.mode] + "upcoming.json"])
        completed = list(csv.DictReader(io.StringIO(files[PREFIXES[args.mode] + "games.csv"])))
        print(f"{len(completed)} finalized games, {len(schedule['pendingGames'])} awaiting finalization, {len(schedule['games'])} upcoming")
    except (ValueError, OSError, requests.RequestException, KeyError, TypeError) as error:
        parser.exit(1, f"Refresh failed: {error}\n")


if __name__ == "__main__":
    main()
