"""
Pointstreak Scraper
Builds recaps.json from box score pages and updates goalie CSVs with
W, L, OTL, SO from team roster pages for 2023-24 and 2024-25 seasons.

Usage:
    python scripts/pointstreak_scraper.py
"""

import csv
import json
import re
import time
from pathlib import Path
from urllib.request import urlopen, Request

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "public" / "seasons"

TEAM_NAME = "Knights"

# Pointstreak team roster IDs per season for goalie stats scraping
# (season_dir, game_type): (teamid, seasonid)
GOALIE_ROSTER_IDS = {
    ("2023-24", "regular"): (799108, 21262),
    ("2023-24", "playoffs"): (799108, 21385),
    ("2024-25", "regular"): (807571, 21465),
    ("2024-25", "playoffs"): (807571, 21560),
}

# All game IDs mapped to seasons, keyed by (season_dir, type)
SEASONS = {
    ("2023-24", "regular"): [
        3636530, 3636543, 3636567, 3641567, 3641578, 3644238,
        3644253, 3644263, 3644278, 3644305, 3644318, 3644342,
        3644346, 3647341, 3647354, 3647367, 3647388, 3647403,
        3647419, 3649636, 3649651, 3649667, 3652225, 3652240,
    ],
    ("2023-24", "playoffs"): [
        3654714, 3654857, 3656051, 3656589,
    ],
    ("2024-25", "regular"): [
        3666532, 3666544, 3666558, 3666572, 3666585,
        # 3670021 is a forfeit (0-0), skip it
        3670034, 3670047, 3670060, 3670075, 3670088,
        3670112, 3670125, 3670138, 3674215, 3674241,
        3674252, 3674265, 3674273, 3676343, 3676353,
        3676367, 3676382, 3678575,
    ],
    ("2024-25", "playoffs"): [
        3678788, 3678850, 3679803,
    ],
}


def fetch_html(game_id):
    url = f"https://pointstreak.com/players/players-boxscore.html?gameid={game_id}"
    req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(req, timeout=15) as resp:
        return resp.read().decode("utf-8", errors="replace")


def strip_tags(html_str):
    """Remove HTML tags, returning plain text."""
    return re.sub(r'<[^>]+>', '', html_str).strip()


def parse_boxscore(html, game_id):
    """Parse a Pointstreak box score HTML page into a recap dict."""

    # --- Date ---
    date_match = re.search(
        r'(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*,?\s+'
        r'([A-Z][a-z]+)\s+(\d{1,2}),?\s+(\d{4})\s+at\s+[\d:]+\s*[APap][Mm]',
        html
    )
    if date_match:
        month_str, day_str, year_str = date_match.group(1), date_match.group(2), date_match.group(3)
        months = {
            "January": "01", "February": "02", "March": "03", "April": "04",
            "May": "05", "June": "06", "July": "07", "August": "08",
            "September": "09", "October": "10", "November": "11", "December": "12",
            "Jan": "01", "Feb": "02", "Mar": "03", "Apr": "04",
            "Jun": "06", "Jul": "07", "Aug": "08", "Sep": "09",
            "Oct": "10", "Nov": "11", "Dec": "12",
        }
        month = months.get(month_str, "01")
        date = f"{year_str}-{month}-{int(day_str):02d}"
    else:
        date = "unknown"
        print(f"    WARNING: Could not parse date for game {game_id}")

    # --- Teams and score ---
    # HTML structure: <span class="boxScore"><a href="...">Knights</a> 1 </span>
    #                 <span class="boxScore"><a href="..."> Eatery Wings</a> 8 </span>
    box_scores = re.findall(
        r'<span\s+class="boxScore">\s*'
        r'<a[^>]*>\s*([^<]+?)\s*</a>\s*'
        r'(\d+)\s*'
        r'</span>',
        html, re.DOTALL
    )

    if len(box_scores) < 2:
        print(f"    WARNING: Could not parse teams/score for game {game_id}")
        return None

    home_team = box_scores[0][0].strip()
    home_score = int(box_scores[0][1])
    away_team = box_scores[1][0].strip()
    away_score = int(box_scores[1][1])

    is_home = TEAM_NAME.lower() in home_team.lower()
    if is_home:
        opponent = away_team
        gf, ga = home_score, away_score
    else:
        opponent = home_team
        gf, ga = away_score, home_score

    # --- OT / SO detection ---
    # Check the "vs" header line: "Knights vs. Eatery Wings (DIVISION 5)"
    # and nearby text for OT/SO indicators
    final_idx = html.upper().find("FINAL")
    is_ot = False
    if final_idx > 0:
        # Check within ~300 chars around FINAL for OT or SO markers
        area = html[max(0, final_idx - 300):final_idx + 100]
        is_ot = bool(re.search(r'\b(?:OT|SO)\b', area, re.IGNORECASE))

    # --- Period scoring breakdown & Shots on Goal ---
    game_details = re.search(r'Game Details.*?Scoring Summary', html, re.DOTALL | re.IGNORECASE)
    periods = []
    if game_details:
        section = game_details.group(0)

        # Goals per period: <td>N</td><td>N</td><td>N</td> (two rows: home, away)
        data_rows = re.findall(
            r'<td>(\d+)</td><td>(\d+)</td><td>(\d+)</td>',
            section
        )
        if len(data_rows) >= 2:
            for i, pname in enumerate(["1st", "2nd", "3rd"]):
                periods.append({
                    "name": pname,
                    "shotsHome": 0,
                    "shotsAway": 0,
                    "goalsHome": int(data_rows[0][i]),
                    "goalsAway": int(data_rows[1][i]),
                })

        # Total shots are displayed as plain text: "Knights 40<br>Ravens 22"
        shots_match = re.findall(
            r'([A-Za-z][A-Za-z &\'-]+?)\s+(\d+)\s*<br>\s*'
            r'([A-Za-z][A-Za-z &\'-]+?)\s+(\d+)',
            section
        )
        if shots_match and periods:
            # Store total shots (not per-period, since Pointstreak doesn't provide that)
            home_shots = int(shots_match[0][1])
            away_shots = int(shots_match[0][3])
            # Distribute evenly across periods as an approximation
            for i, p in enumerate(periods):
                p["shotsHome"] = round(home_shots / 3) if i < 2 else home_shots - 2 * round(home_shots / 3)
                p["shotsAway"] = round(away_shots / 3) if i < 2 else away_shots - 2 * round(away_shots / 3)

    # The period data from Pointstreak lists home team first, away team second.
    # "Home" and "Away" in our recaps.json means Knights and Opponent respectively.
    # If Knights is the away team on Pointstreak, we need to swap.
    if not is_home and periods:
        for p in periods:
            p["goalsHome"], p["goalsAway"] = p["goalsAway"], p["goalsHome"]
            p["shotsHome"], p["shotsAway"] = p["shotsAway"], p["shotsHome"]

    # --- Scoring Summary ---
    goals = []
    scoring_section = re.search(
        r'Scoring Summary</td>(.*?)Penalties</td>',
        html, re.DOTALL | re.IGNORECASE
    )
    if scoring_section:
        section = scoring_section.group(1)

        for period_match in re.finditer(r'Period\s+(\d)', section):
            pnum = period_match.group(1)
            period_name = {"1": "1st", "2": "2nd", "3": "3rd"}.get(pnum, f"{pnum}th")

            start = period_match.end()
            next_period = re.search(r'Period\s+\d', section[start:])
            end = start + next_period.start() if next_period else len(section)
            period_text = section[start:end]

            # Strip HTML tags for easier parsing, but first extract player names from links
            # HTML: <b>Knights</b> - <b><a href="...">Alex Knifel</a></b>  (<a href="...">Chris Atkins</a>, <a href="...">Nathaniel Stuart</a>) , 1:57
            # Also handle: (unassisted) , 14:31

            # Find each goal entry
            # Some goals have <i>(power play)</i> or <i>(short handed)</i> between name and assists
            goal_entries = re.findall(
                r'<b>([^<]+)</b>\s*-\s*<b><a[^>]*>([^<]+)</a></b>\s*'
                r'(?:<i>[^<]*</i>\s*)?'
                r'(?:\(([^)]*)\))?\s*,?\s*(\d{1,2}:\d{2})',
                period_text
            )

            for team_raw, scorer, assists_html, time_str in goal_entries:
                team_raw = team_raw.strip()
                scorer = scorer.strip()

                if TEAM_NAME.lower() in team_raw.lower():
                    team = TEAM_NAME
                else:
                    team = opponent

                # Parse assists - they may contain <a> tags
                if assists_html:
                    assists_text = strip_tags(assists_html).strip()
                    if assists_text.lower() == "unassisted" or not assists_text:
                        assists = []
                    else:
                        assists = [a.strip() for a in assists_text.split(",") if a.strip()]
                else:
                    assists = []

                parts = time_str.split(":")
                time_formatted = f"00:{int(parts[0]):02d}:{int(parts[1]):02d}"

                goals.append({
                    "period": period_name,
                    "time": time_formatted,
                    "team": team,
                    "scorer": scorer,
                    "assists": assists,
                })

    # --- Penalties ---
    penalties = []
    penalty_section = re.search(
        r'Penalties</td>(.*?)Rosters</td>',
        html, re.DOTALL | re.IGNORECASE
    )
    if penalty_section:
        section = penalty_section.group(1)

        for period_match in re.finditer(r'Period\s+(\d)', section):
            pnum = period_match.group(1)
            period_name = {"1": "1st", "2": "2nd", "3": "3rd"}.get(pnum, f"{pnum}th")

            start = period_match.end()
            next_period = re.search(r'Period\s+\d', section[start:])
            end = start + next_period.start() if next_period else len(section)
            period_text = section[start:end]

            if "no penalties" in period_text.lower():
                continue

            # HTML: <b>Knights</b> - <b><a href="...">Kerry Regan</a></b> (Interference), 2 min , 6:11
            pen_entries = re.findall(
                r'<b>([^<]+)</b>\s*-\s*<b><a[^>]*>([^<]+)</a></b>\s*'
                r'\(([^)]+)\)\s*,\s*(\d+)\s*min\s*,\s*(\d{1,2}:\d{2})',
                period_text
            )

            for team_raw, player, pen_type, minutes, time_str in pen_entries:
                team_raw = team_raw.strip()
                player = player.strip()
                pen_type = pen_type.strip()

                if TEAM_NAME.lower() in team_raw.lower():
                    team = TEAM_NAME
                else:
                    team = opponent

                parts = time_str.split(":")
                time_formatted = f"00:{int(parts[0]):02d}:{int(parts[1]):02d}"

                penalties.append({
                    "period": period_name,
                    "time": time_formatted,
                    "team": team,
                    "player": player,
                    "type": pen_type,
                    "severity": "Minor" if int(minutes) <= 2 else "Major",
                    "minutes": int(minutes),
                })

    # --- Result ---
    if gf > ga:
        result = "W"
    elif is_ot:
        result = "OTL"
    else:
        result = "L"

    return {
        "date": date,
        "opponent": opponent,
        "gf": gf,
        "ga": ga,
        "result": result,
        "ot": is_ot,
        "periods": periods,
        "goals": goals,
        "penalties": penalties,
    }


def scrape_season(season_dir, game_type, game_ids):
    label = f"{season_dir} {game_type}"
    print(f"\n{'='*50}")
    print(f"Scraping {label} ({len(game_ids)} games)")
    print(f"{'='*50}")

    recaps = []
    for i, gid in enumerate(game_ids):
        print(f"  [{i+1}/{len(game_ids)}] Fetching game {gid}...")
        try:
            html = fetch_html(gid)
            recap = parse_boxscore(html, gid)
            if recap:
                recaps.append(recap)
                print(f"    {recap['date']} vs {recap['opponent']}: {recap['gf']}-{recap['ga']} ({recap['result']}) "
                      f"| {len(recap['goals'])} goals, {len(recap['penalties'])} penalties")
            else:
                print(f"    FAILED to parse")
        except Exception as e:
            print(f"    ERROR: {e}")

        time.sleep(0.5)  # be polite

    # Sort by date
    recaps.sort(key=lambda r: r["date"])

    # Write output
    out_dir = OUTPUT_DIR / season_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    if game_type == "playoffs":
        filename = "playoffs-recaps.json"
    else:
        filename = "recaps.json"

    out_path = out_dir / filename
    with open(out_path, "w") as f:
        json.dump(recaps, f, indent=2)

    print(f"\nWrote {len(recaps)} recaps to {out_path}")
    return recaps


def fetch_goalie_stats(team_id, season_id):
    """Scrape goalie W/L/T/SO from Pointstreak team roster page."""
    url = (
        f"https://pointstreak.com/players/players-team-roster.html"
        f"?teamid={team_id}&seasonid={season_id}"
    )
    req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(req, timeout=15) as resp:
        html = resp.read().decode("utf-8", errors="replace")

    goalie_marker = re.search(r'Goalie Stats', html, re.IGNORECASE)
    if not goalie_marker:
        print("  WARNING: No goalie stats section found")
        return {}

    table_html = html[goalie_marker.end():]
    table_match = re.search(r'<table[^>]*>(.*?)</table>', table_html, re.DOTALL)
    if not table_match:
        print("  WARNING: No goalie table found")
        return {}

    table = table_match.group(1)

    # Columns: #, NAME, GP, MIN, W, L, T, SO, GA, GAA, SV, SV%
    stats = []
    for row_match in re.finditer(r'<tr class="lightGrey">(.*?)</tr>', table, re.DOTALL):
        cells = re.findall(r'<td[^>]*>(.*?)</td>', row_match.group(1), re.DOTALL)
        if len(cells) < 12:
            continue

        name_match = re.search(r'<a[^>]*>([^<]+)</a>', cells[1])
        name = name_match.group(1).strip() if name_match else re.sub(r'<[^>]+>', '', cells[1]).strip()

        def val(cell):
            return re.sub(r'<[^>]+>', '', cell).strip()

        stats.append({
            "name": name,
            "GP": val(cells[2]),
            "W": val(cells[4]),
            "L": val(cells[5]),
            "OTL": val(cells[6]),  # T column = OTL in rec league
            "SO": val(cells[7]),
        })

    return stats


def update_goalie_csv(season_dir, game_type, goalie_stats):
    """Update existing goalie CSV with W, L, OTL, SO from Pointstreak."""
    csv_filename = "playoffs-goalies.csv" if game_type == "playoffs" else "goalies.csv"
    csv_path = OUTPUT_DIR / season_dir / csv_filename
    if not csv_path.exists():
        print(f"  CSV not found: {csv_path}")
        return

    with open(csv_path, "r") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    fieldnames = ["Player", "GP", "W", "L", "GAA", "SV%", "SV", "GA", "SA", "MIN", "OTL", "SO"]

    # Build lookup by name and by GP for fuzzy matching
    by_name = {ps["name"]: ps for ps in goalie_stats}
    by_gp = {ps["GP"]: ps for ps in goalie_stats}

    for row in rows:
        name = row["Player"]
        gp = row.get("GP", "0")

        # Try exact name match first, then fall back to GP match
        ps = by_name.get(name) or by_gp.get(gp)

        if ps:
            matched_via = "name" if name in by_name else f"GP={gp} (Pointstreak name: {ps['name']})"
            row["W"] = ps["W"]
            row["L"] = ps["L"]
            row["OTL"] = ps["OTL"]
            row["SO"] = ps["SO"]
            print(f"    {name}: W={ps['W']} L={ps['L']} OTL={ps['OTL']} SO={ps['SO']} (matched via {matched_via})")
        else:
            row.setdefault("W", "0")
            row.setdefault("L", "0")
            row.setdefault("SO", "0")
            row.setdefault("OTL", row.get("OTL", "0"))
            print(f"    {name}: not found on Pointstreak, defaulting to 0")

    with open(csv_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"  Updated {csv_path}")


if __name__ == "__main__":
    # Scrape box scores for recaps
    for (season_dir, game_type), game_ids in SEASONS.items():
        scrape_season(season_dir, game_type, game_ids)

    # Update goalie CSVs with W/L/OTL/SO from roster pages
    print(f"\n{'='*50}")
    print("Updating goalie stats from Pointstreak roster pages")
    print(f"{'='*50}")
    for (season_dir, game_type), (team_id, season_id) in GOALIE_ROSTER_IDS.items():
        print(f"\n  {season_dir} {game_type} (team={team_id}, season={season_id})")
        goalie_stats = fetch_goalie_stats(team_id, season_id)
        if goalie_stats:
            print(f"  Found {len(goalie_stats)} goalies")
            update_goalie_csv(season_dir, game_type, goalie_stats)
        else:
            print(f"  No goalie stats found, skipping")
        time.sleep(0.5)

    print("\nDone!")
