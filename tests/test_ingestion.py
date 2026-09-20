import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
from urllib.parse import parse_qs, urlsplit

from scripts.ingestion import (
    SportNinjaClient, collect_snapshot, publish_snapshot, refresh,
    validate_no_removals,
)

CONFIG = {
    'team_id': 'knights', 'api_base': 'https://example.test/v1',
    'schedules': {'regular': 'regular-id', 'playoffs': 'playoff-id'},
}


def client():
    return SportNinjaClient(CONFIG, 'test-token')


def game(game_id='played', status=9, starts='2026-09-20T03:00:00Z'):
    return {
        'id': game_id, 'game_status_id': status, 'starts_at': starts,
        'homeTeam': {'id': 'knights', 'name': 'Knights'},
        'visitingTeam': {'id': 'other', 'name': 'Opponents'},
        'home_team_score': 3, 'visiting_team_score': 2,
    }


def empty_client():
    c = Mock()
    c.summary_game_ids = []
    c.fetch_skaters.return_value = []
    c.fetch_goalies.return_value = []
    c.fetch_games.return_value = ([], [], [])
    c.build_recaps.return_value = []
    return c


class IngestionTests(unittest.TestCase):
    def test_pagination_collects_all_pages_and_preserves_query(self):
        c = client()
        c.get_json = Mock(side_effect=[
            {'data': [{'id': 1}], 'meta': {'last_page': 2}},
            {'data': [{'id': 2}], 'meta': {'last_page': 2}},
        ])
        self.assertEqual(c.fetch_pages('https://example.test/stats?goalie=0&page=1'), [{'id': 1}, {'id': 2}])
        query = parse_qs(urlsplit(c.get_json.call_args.args[0]).query)
        self.assertEqual(query, {'goalie': ['0'], 'page': ['2']})

    def test_pagination_without_metadata_stops_on_empty(self):
        c = client()
        c.get_json = Mock(side_effect=[{'data': [{'id': 1}]}, {'data': []}])
        self.assertEqual(c.fetch_pages('https://example.test/stats'), [{'id': 1}])
        self.assertEqual(c.get_json.call_count, 2)

    def test_repeated_or_malformed_page_aborts(self):
        c = client()
        c.get_json = Mock(return_value={'data': [{'id': 1}]})
        with self.assertRaisesRegex(ValueError, 'repeated'):
            c.fetch_pages('https://example.test/stats')
        c.get_json = Mock(return_value={'data': {}})
        with self.assertRaisesRegex(ValueError, 'list'):
            c.fetch_pages('https://example.test/stats')

    def test_empty_page_before_last_aborts(self):
        c = client()
        c.get_json = Mock(return_value={'data': [], 'meta': {'last_page': 3}})
        with self.assertRaisesRegex(ValueError, 'empty page'):
            c.fetch_pages('https://example.test/stats')

    def test_requests_have_timeouts(self):
        c = client()
        c.session = Mock()
        c.session.get.return_value.json.return_value = {'data': []}
        c.get_json('https://example.test/stats')
        self.assertEqual(c.session.get.call_args.kwargs['timeout'], (10, 30))
        c.session.get.return_value.raise_for_status.assert_called_once()

    def test_one_completed_and_one_upcoming_are_separate(self):
        c = client()
        c.fetch_pages = Mock(return_value=[game(), game('upcoming', 1, '2099-09-22T03:00:00Z')])
        played, upcoming, pending = c.fetch_games()
        self.assertEqual(len(played), 1)
        self.assertEqual(len(upcoming), 1)
        self.assertEqual(pending, [])
        self.assertEqual(played[0]['Date'], '2026-09-19')
        self.assertEqual(played[0]['Result'], 'W')
        self.assertNotIn('GF', upcoming[0])
        self.assertEqual(upcoming[0]['opponent'], 'Opponents')

    def test_scored_but_unfinalized_game_is_pending_not_a_result(self):
        c = client()
        unfinalized = game(status=1)
        unfinalized['started_at'] = '2026-09-20T03:01:00Z'
        c.fetch_pages = Mock(return_value=[unfinalized])
        played, upcoming, pending = c.fetch_games()
        self.assertEqual(played, [])
        self.assertEqual(upcoming, [])
        self.assertEqual(pending[0]['gf'], 3)
        self.assertEqual(pending[0]['ga'], 2)

    def test_other_team_game_is_rejected(self):
        c = client()
        wrong = game()
        wrong['homeTeam']['id'] = 'wrong'
        c.fetch_pages = Mock(return_value=[wrong])
        with self.assertRaisesRegex(ValueError, 'another team'):
            c.fetch_games()

    def test_incomplete_timeline_is_rejected(self):
        c = client()
        c.get_json = Mock(return_value={'data': {}})
        with self.assertRaisesRegex(ValueError, 'Incomplete timeline'):
            c.fetch_game_timeline('played')

    def test_fetch_failure_leaves_existing_files_untouched(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp) / 'season'
            d.mkdir()
            (d / 'skaters.csv').write_text('original bytes')
            c = empty_client()
            c.fetch_goalies.side_effect = RuntimeError('network failure')
            with self.assertRaises(RuntimeError):
                refresh(c, d)
            self.assertEqual((d / 'skaters.csv').read_text(), 'original bytes')
            self.assertEqual(len(list(d.iterdir())), 1)

    def test_timeline_failure_leaves_existing_recaps_untouched(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / 'recaps.json').write_text('[{"existing":true}]')
            c = empty_client()
            c.build_recaps.side_effect = RuntimeError('timeline failed')
            with self.assertRaises(RuntimeError):
                refresh(c, d)
            self.assertEqual((d / 'recaps.json').read_text(), '[{"existing":true}]')

    def test_publish_preserves_awards_and_other_competitions(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp) / 'season'
            d.mkdir()
            (d / 'awards.json').write_text('[{"name":"Manual"}]')
            (d / 'skaters.csv').write_text('regular stats')
            refresh(empty_client(), d, mode='playoffs')
            self.assertEqual((d / 'skaters.csv').read_text(), 'regular stats')
            self.assertEqual(json.loads((d / 'awards.json').read_text()), [{'name': 'Manual'}])
            self.assertTrue((d / 'playoffs-upcoming.json').exists())
            self.assertFalse((d / 'upcoming.json').exists())

    def test_publish_failure_rolls_back(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp) / 'season'
            d.mkdir()
            (d / 'skaters.csv').write_text('original')
            original_rename = Path.rename
            def fail_staged(path, target):
                if path.name == 'staged':
                    raise OSError('injected rename failure')
                return original_rename(path, target)
            with patch.object(Path, 'rename', fail_staged):
                with self.assertRaises(OSError):
                    publish_snapshot(d, {'skaters.csv': 'replacement'})
            self.assertEqual((d / 'skaters.csv').read_text(), 'original')

    def test_original_backup_survives_if_rollback_itself_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp) / 'season'
            d.mkdir()
            (d / 'skaters.csv').write_text('original')
            original_rename = Path.rename
            def fail_publish_and_rollback(path, target):
                if path.name in ('staged', 'backup'):
                    raise OSError('injected disk failure')
                return original_rename(path, target)
            with patch.object(Path, 'rename', fail_publish_and_rollback):
                with self.assertRaisesRegex(OSError, 'original files retained'):
                    publish_snapshot(d, {'skaters.csv': 'replacement'})
            backups = list(Path(tmp).glob('.season-refresh-*/backup/skaters.csv'))
            self.assertEqual(len(backups), 1)
            self.assertEqual(backups[0].read_text(), 'original')

    def test_empty_refresh_cannot_erase_existing_players(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / 'skaters.csv').write_text('Player,GP\nExisting,1\n')
            with self.assertRaisesRegex(ValueError, 'remove records'):
                validate_no_removals(d, {'skaters.csv': 'Player,GP\n'})

    def test_dry_run_does_not_create_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp) / 'new-season'
            files = refresh(empty_client(), d, dry_run=True)
            self.assertIn('upcoming.json', files)
            self.assertFalse(d.exists())

    def test_unconfigured_competition_cannot_use_regular_schedule(self):
        with self.assertRaisesRegex(ValueError, 'schedules.tournament'):
            SportNinjaClient(CONFIG, 'test-token', 'tournament')

    def test_zero_game_snapshot_has_headers_and_empty_recaps(self):
        snapshot = collect_snapshot(empty_client())
        self.assertEqual(snapshot['skaters.csv'].strip(), 'Player,GP,G,A,P,PM')
        self.assertEqual(json.loads(snapshot['recaps.json']), [])
        self.assertEqual(json.loads(snapshot['upcoming.json'])['games'], [])


if __name__ == '__main__':
    unittest.main()
