"""Explicit private configuration loading without printing or mutating environment."""
from collections.abc import Mapping
from pathlib import Path
from dotenv import dotenv_values
from agent_factory import ModelSettings


def load_model_settings(path: Path, environment: Mapping[str, str]) -> ModelSettings:
    if not path.is_absolute():
        raise ValueError('Private configuration path must be absolute')
    values = {}
    if path.is_file():
        values = dict(dotenv_values(path, interpolate=False))
    values.update(environment)
    return ModelSettings.from_environment(values)
