import unittest
from unittest.mock import Mock
from scripts.summary_stats import stats_from_summary
from scripts.ingestion import collect_snapshot, SportNinjaClient


def fixture():
    def player(id, goalie=False, playing=True):
        return dict(id=id, name_first=id, name_last='Player', is_playing=playing, player_type={'is_goalie': goalie})
    home_shot = dict(team_id='knights', player_id='Scorer', opposing_goalie_id='other-goalie')
    away_shot = dict(team_id='other', player_id='other-scorer', opposing_goalie_id='Goalie')
    timeline = {
        'playerRosters': [{'team_id': 'knights', 'players': [player('Scorer'), player('Assist'), player('Absent', playing=False), player('Goalie', goalie=True)]}],
        'goals': [{'shot': home_shot, 'assists': [{'player': {'id': 'Assist'}}]}, {'shot': away_shot, 'assists': []}],
        'offenses': [{'team_id': 'knights', 'player_id': 'Assist', 'penalty': {'amount': 2}}],
        'shots': [home_shot, away_shot, away_shot, away_shot],
        'periods': [{'duration': 780000}] * 3,
        'goalieChanges': [],
    }
    game = dict(id='confirmed', GF='1', GA='1', OT='0', Result='L')
    return timeline, game


class SummaryTests(unittest.TestCase):
    def test_summary_uses_active_roster_and_counts_scoring_penalties_and_saves(self):
        timeline, game = fixture()
        skaters, goalies = stats_from_summary(timeline, 'knights', game)
        by_name = {p['Player']: p for p in skaters}
        self.assertNotIn('Absent Player', by_name)
        self.assertEqual(by_name['Scorer Player']['G'], 1)
        self.assertEqual(by_name['Assist Player']['A'], 1)
        self.assertEqual(by_name['Assist Player']['PM'], 2)
        self.assertEqual(goalies[0]['SV'], 2)
        self.assertEqual(goalies[0]['SA'], 3)
        self.assertEqual(goalies[0]['MIN'], 39)

    def test_score_mismatch_aborts(self):
        timeline, game = fixture()
        game['GF'] = '8'
        with self.assertRaisesRegex(ValueError, 'final score'):
            stats_from_summary(timeline, 'knights', game)

    def test_cannot_double_count_summary_on_top_of_official_totals(self):
        c = Mock()
        c.summary_game_ids = ['confirmed']
        c.fetch_skaters.return_value = [{'Player': 'Official player'}]
        c.fetch_goalies.return_value = []
        c.fetch_games.return_value = ([fixture()[1]], [], [])
        with self.assertRaisesRegex(ValueError, 'reconciliation'):
            collect_snapshot(c)

    def test_confirmation_is_inactive_after_official_finalization(self):
        c = SportNinjaClient({'team_id': 'knights', 'api_base': 'https://example.test', 'schedules': {'regular': 'season'}, 'confirmed_final_games': ['confirmed']}, 'test')
        c.fetch_pages = Mock(return_value=[{
            'id': 'confirmed', 'game_status_id': 9, 'starts_at': '2026-09-19T20:00:00Z',
            'homeTeam': {'id': 'knights'}, 'visitingTeam': {'id': 'other', 'name': 'Other'},
            'home_team_score': 8, 'visiting_team_score': 2,
        }])
        games, upcoming, pending = c.fetch_games()
        self.assertEqual(c.summary_game_ids, [])
        self.assertEqual(len(games), 1)


if __name__ == '__main__':
    unittest.main()
