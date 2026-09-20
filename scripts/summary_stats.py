"""Explicit one-game fallback when the owner confirms an unfinalized game is final.

Intentionally limited to a season with one game and no official player totals.
This avoids adding a summary on top of totals that might already include it.
"""


def stats_from_summary(timeline, team_id, game):
    roster = next(r for r in timeline['playerRosters'] if r['team_id'] == team_id)
    players = [p for p in roster['players'] if p.get('is_playing')]
    skaters = {}
    goalies = []
    for player in players:
        name = f"{player['name_first']} {player['name_last']}".strip()
        if player['player_type'].get('is_goalie'):
            goalies.append(player)
        else:
            skaters[player['id']] = dict(Player=name, GP=1, G=0, A=0, P=0, PM=0)
    goals_for = 0
    for goal in timeline['goals']:
        if goal['shot']['team_id'] != team_id:
            continue
        goals_for += 1
        skaters[goal['shot']['player_id']]['G'] += 1
        for assist in goal.get('assists', []):
            skaters[assist['player']['id']]['A'] += 1
    if goals_for != int(game['GF']):
        raise ValueError('Scoring summary does not match the confirmed final score')
    for offense in timeline['offenses']:
        if offense['team_id'] == team_id and offense.get('player_id') in skaters:
            skaters[offense['player_id']]['PM'] += float(offense['penalty']['amount'])
    for player in skaters.values():
        player['P'] = player['G'] + player['A']
    # This correction supports a single goalie who played the whole game only.
    if len(goalies) != 1 or timeline.get('goalieChanges'):
        raise ValueError('Summary fallback requires one goalie and no goalie changes; use official totals')
    goalie = goalies[0]
    shots = [shot for shot in timeline['shots'] if shot['team_id'] != team_id]
    if any(shot.get('opposing_goalie_id') != goalie['id'] for shot in shots):
        raise ValueError('Summary shots cannot all be attributed to the starting goalie')
    ga = sum(1 for goal in timeline['goals'] if goal['shot']['team_id'] != team_id)
    sa = len(shots)
    if ga != int(game['GA']) or sa < ga:
        raise ValueError('Goalie summary does not match the confirmed final score')
    # Owner confirmed the game is over; use the three recorded regulation periods.
    minutes = sum(period['duration'] for period in timeline['periods']) / 60000
    if minutes <= 0 or game['OT'] == '1':
        raise ValueError('Summary fallback requires known regulation length and no overtime')
    goalie_row = {
        'Player': f"{goalie['name_first']} {goalie['name_last']}".strip(),
        'GP': 1, 'W': int(game['Result'] == 'W'), 'L': int(game['Result'] == 'L'),
        'GAA': round(ga / minutes * 60, 2), 'SV%': round((sa - ga) / sa, 3) if sa else 0,
        'SV': sa - ga, 'GA': ga, 'SA': sa, 'MIN': minutes, 'OTL': 0, 'SO': int(ga == 0),
    }
    return sorted(skaters.values(), key=lambda p: (-p['P'], -p['G'], p['Player'])), [goalie_row]
