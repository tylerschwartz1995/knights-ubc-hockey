import yaml

from common import PROJECT_ROOT


def load_config(config_file: str) -> dict:
    """
    Load a YAML config file from the top-level config/ directory.

    Args:
        config_file: filename e.g. 'ingestion.yml', 'api.yml'
    """
    config_path = PROJECT_ROOT / "config" / config_file
    with open(config_path) as f:
        return yaml.safe_load(f)
