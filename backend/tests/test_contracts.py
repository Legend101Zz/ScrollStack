from __future__ import annotations

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.contracts.manga import RenderedPage
from app.contracts.reel import ReelSpec
from app.contracts.registry import CONTRACT_MODELS
from scripts.export_contracts import DEFAULT_OUTPUT, export_contracts


FIXTURE_ROOT = Path(__file__).resolve().parents[2] / "packages" / "fixtures"


def fixture_manifest() -> dict:
    return json.loads((FIXTURE_ROOT / "manifest.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("entry", fixture_manifest()["fixtures"])
def test_canonical_fixture_validates_in_python(entry: dict) -> None:
    payload = (FIXTURE_ROOT / entry["path"]).read_text(encoding="utf-8")
    model = CONTRACT_MODELS[entry["schema"]]

    restored = model.model_validate_json(payload)

    assert model.model_validate(restored.model_dump(mode="json")) == restored


def test_fixture_manifest_matches_registry() -> None:
    fixture_names = {entry["schema"] for entry in fixture_manifest()["fixtures"]}
    assert fixture_names == set(CONTRACT_MODELS)


def test_exported_schemas_are_deterministic() -> None:
    assert export_contracts(DEFAULT_OUTPUT, check=True) == []


def test_contract_json_uses_snake_case_and_rejects_unknown_fields() -> None:
    schema = CONTRACT_MODELS["agent_goal.v1"].model_json_schema()
    properties = schema["properties"]

    assert "goal_id" in properties
    assert "goalId" not in properties
    assert schema["additionalProperties"] is False


def test_rendered_page_rejects_artifact_layer_drift() -> None:
    payload = json.loads(
        (FIXTURE_ROOT / "canonical/rendered_page.v1.json").read_text(encoding="utf-8")
    )
    payload["panel_artifacts"]["unknown_panel"] = payload["panel_artifacts"]["panel_001"]

    with pytest.raises(ValidationError, match="panel_artifacts must cover"):
        RenderedPage.model_validate(payload)


def test_reel_spec_rejects_unknown_components_and_urls() -> None:
    payload = json.loads(
        (FIXTURE_ROOT / "canonical/reel_spec.v1.json").read_text(encoding="utf-8")
    )
    payload["scenes"][0]["asset_id"] = "https://attacker.invalid/panel.png"

    with pytest.raises(ValidationError):
        ReelSpec.model_validate(payload)


def test_reel_spec_rejects_timeline_drift() -> None:
    payload = json.loads(
        (FIXTURE_ROOT / "canonical/reel_spec.v1.json").read_text(encoding="utf-8")
    )
    payload["format"]["duration_frames"] = 181

    with pytest.raises(ValidationError, match="scene durations"):
        ReelSpec.model_validate(payload)
