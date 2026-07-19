"""Source-grounded manga planning and deterministic reader contracts."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import Field, model_validator

from .base import ContentHash, ContractModel, Identifier, NonEmptyText, ShortText, UnitInterval
from .source import SourceRef


class CharacterIntent(ContractModel):
    character_id: Identifier
    intent: NonEmptyText
    emotional_state: ShortText


class AdaptationBeat(ContractModel):
    beat_id: Identifier
    sequence: Annotated[int, Field(ge=0)]
    source_refs: list[SourceRef] = Field(min_length=1, max_length=128)
    required_fact_ids: list[Identifier] = Field(default_factory=list, max_length=128)
    narrative_purpose: Literal[
        "hook", "setup", "conflict", "explanation", "reveal", "payoff", "cliffhanger"
    ]
    book_essence: NonEmptyText
    dramatization: NonEmptyText
    character_intent: list[CharacterIntent] = Field(default_factory=list, max_length=64)
    visual_intent: list[ShortText] = Field(min_length=1, max_length=64)
    must_preserve: list[NonEmptyText] = Field(min_length=1, max_length=128)
    may_compress: list[NonEmptyText] = Field(default_factory=list, max_length=128)
    confidence: UnitInterval


class DialogueLine(ContractModel):
    speaker_id: Identifier
    text: Annotated[str, Field(min_length=1, max_length=1_000)]
    delivery: ShortText | None = None


class LayoutBoxPct(ContractModel):
    x_pct: Annotated[float, Field(ge=0, le=100)]
    y_pct: Annotated[float, Field(ge=0, le=100)]
    width_pct: Annotated[float, Field(gt=0, le=100)]
    height_pct: Annotated[float, Field(gt=0, le=100)]

    @model_validator(mode="after")
    def fits_container(self) -> "LayoutBoxPct":
        if self.x_pct + self.width_pct > 100:
            raise ValueError("x_pct + width_pct must be <= 100")
        if self.y_pct + self.height_pct > 100:
            raise ValueError("y_pct + height_pct must be <= 100")
        return self


class CropHint(ContractModel):
    crop_id: Identifier
    box_pct: LayoutBoxPct
    subject: ShortText


class StoryboardPanel(ContractModel):
    panel_id: Identifier
    scene_id: Identifier
    beat_ids: list[Identifier] = Field(min_length=1, max_length=32)
    purpose: Literal[
        "establishing", "action", "dialogue", "reaction", "explanation", "reveal", "transition"
    ]
    shot_type: Literal[
        "extreme_wide", "wide", "medium", "close_up", "extreme_close_up", "over_shoulder", "insert"
    ]
    composition: NonEmptyText
    action: NonEmptyText | None = None
    dialogue: list[DialogueLine] = Field(default_factory=list, max_length=16)
    narration: list[Annotated[str, Field(min_length=1, max_length=1_000)]] = Field(
        default_factory=list, max_length=8
    )
    source_refs: list[SourceRef] = Field(min_length=1, max_length=128)
    source_fact_ids: list[Identifier] = Field(default_factory=list, max_length=128)
    character_ids: list[Identifier] = Field(default_factory=list, max_length=32)
    visual_asset_ids: list[Identifier] = Field(default_factory=list, max_length=32)
    emotional_tone: ShortText

    @model_validator(mode="after")
    def has_readable_content(self) -> "StoryboardPanel":
        if self.action is None and not self.dialogue and not self.narration:
            raise ValueError("panel needs action, dialogue, or narration")
        speakers = {line.speaker_id for line in self.dialogue}
        if not speakers.issubset(set(self.character_ids)):
            raise ValueError("every dialogue speaker must appear in character_ids")
        return self


class StoryboardPage(ContractModel):
    page_id: Identifier
    page_index: Annotated[int, Field(ge=0)]
    panels: list[StoryboardPanel] = Field(min_length=1, max_length=7)
    page_turn_hook: Annotated[str, Field(max_length=1_000)] = ""
    reading_flow: Literal["top-right to bottom-left", "top-left to bottom-right"] = (
        "top-right to bottom-left"
    )

    @model_validator(mode="after")
    def panel_ids_are_unique(self) -> "StoryboardPage":
        ids = [panel.panel_id for panel in self.panels]
        if len(ids) != len(set(ids)):
            raise ValueError("panel ids must be unique within a page")
        return self


class PanelPlacement(ContractModel):
    bbox_pct: LayoutBoxPct
    z_index: Annotated[int, Field(ge=0, le=100)] = 0
    bleed_edges: list[Literal["top", "right", "bottom", "left"]] = Field(
        default_factory=list, max_length=4
    )


class SpriteLayer(ContractModel):
    character_id: Identifier
    asset_id: Identifier
    expression: ShortText = "neutral"
    bbox_pct: LayoutBoxPct
    z_index: Annotated[int, Field(ge=0, le=100)] = 20
    opacity: UnitInterval = 1.0
    flip_x: bool = False


class BubblePlacement(ContractModel):
    line_index: Annotated[int, Field(ge=0)]
    speaker_id: Identifier
    bbox_pct: LayoutBoxPct
    tail_side: Literal["left", "right", "bottom", "top"] = "bottom"
    tail_offset_pct: Annotated[float, Field(ge=0, le=100)] = 50
    variant: Literal["speech", "thought", "shout"] = "speech"
    z_index: Annotated[int, Field(ge=0, le=100)] = 40


class PageComposition(ContractModel):
    page_index: Annotated[int, Field(ge=0)]
    panel_order: list[Identifier] = Field(min_length=1, max_length=7)
    panel_placements: dict[Identifier, PanelPlacement] = Field(min_length=1, max_length=7)
    sprite_layers: dict[Identifier, list[SpriteLayer]] = Field(default_factory=dict, max_length=7)
    bubble_placements: dict[Identifier, list[BubblePlacement]] = Field(default_factory=dict, max_length=7)
    page_turn_panel_id: Identifier | None = None
    gutter_px: Annotated[int, Field(ge=0, le=32)] = 6
    composition_notes: Annotated[str, Field(max_length=2_000)] = ""

    @model_validator(mode="after")
    def validate_composition_keys(self) -> "PageComposition":
        panel_ids = set(self.panel_order)
        if len(panel_ids) != len(self.panel_order):
            raise ValueError("panel_order must not contain duplicates")
        if set(self.panel_placements) != panel_ids:
            raise ValueError("panel_placements must cover panel_order exactly")
        if not set(self.sprite_layers).issubset(panel_ids):
            raise ValueError("sprite_layers references an unknown panel")
        if not set(self.bubble_placements).issubset(panel_ids):
            raise ValueError("bubble_placements references an unknown panel")
        if self.page_turn_panel_id is not None and self.page_turn_panel_id not in panel_ids:
            raise ValueError("page_turn_panel_id must reference panel_order")
        return self


class PanelRenderArtifact(ContractModel):
    asset_id: Identifier | None = None
    aspect_ratio: Annotated[str, Field(pattern=r"^[1-9][0-9]*:[1-9][0-9]*$")] | None = None
    used_reference_asset_ids: list[Identifier] = Field(default_factory=list, max_length=32)
    requested_character_count: Annotated[int, Field(ge=0)] = 0
    render_status: Literal["not_requested", "rendered", "failed"] = "not_requested"
    error_code: Identifier | None = None

    @model_validator(mode="after")
    def validate_render_result(self) -> "PanelRenderArtifact":
        if self.render_status == "rendered" and self.asset_id is None:
            raise ValueError("rendered panel artifacts require asset_id")
        if self.render_status == "failed" and self.error_code is None:
            raise ValueError("failed panel artifacts require error_code")
        if self.render_status != "failed" and self.error_code is not None:
            raise ValueError("error_code is only valid for failed panel artifacts")
        return self


class RenderedPage(ContractModel):
    schema_version: Literal["rendered-page.v1"]
    storyboard_page: StoryboardPage
    composition: PageComposition | None = None
    panel_artifacts: dict[Identifier, PanelRenderArtifact] = Field(min_length=1, max_length=7)

    @model_validator(mode="after")
    def validate_layers(self) -> "RenderedPage":
        panels = {panel.panel_id: panel for panel in self.storyboard_page.panels}
        panel_ids = set(panels)
        if set(self.panel_artifacts) != panel_ids:
            raise ValueError("panel_artifacts must cover storyboard panels exactly")
        if self.composition is None:
            return self
        if self.composition.page_index != self.storyboard_page.page_index:
            raise ValueError("composition page_index must match storyboard page_index")
        if set(self.composition.panel_order) != panel_ids:
            raise ValueError("composition panel_order must cover storyboard panels exactly")
        for panel_id, sprites in self.composition.sprite_layers.items():
            known_characters = set(panels[panel_id].character_ids)
            if any(sprite.character_id not in known_characters for sprite in sprites):
                raise ValueError("sprite layer character must be present in its storyboard panel")
        for panel_id, bubbles in self.composition.bubble_placements.items():
            dialogue = panels[panel_id].dialogue
            for bubble in bubbles:
                if bubble.line_index >= len(dialogue):
                    raise ValueError("bubble line_index is outside panel dialogue")
                if dialogue[bubble.line_index].speaker_id != bubble.speaker_id:
                    raise ValueError("bubble speaker_id must match the dialogue line")
        return self


class ManifestPanel(ContractModel):
    panel_id: Identifier
    page_id: Identifier
    sequence: Annotated[int, Field(ge=0)]
    beat_ids: list[Identifier] = Field(min_length=1, max_length=32)
    panel_type: ShortText
    dialogue: list[DialogueLine] = Field(default_factory=list, max_length=16)
    narration: list[Annotated[str, Field(min_length=1, max_length=1_000)]] = Field(
        default_factory=list, max_length=8
    )
    visual_asset_ids: list[Identifier] = Field(default_factory=list, max_length=32)
    crop_hints: list[CropHint] = Field(default_factory=list, max_length=16)
    emotional_tone: ShortText
    source_refs: list[SourceRef] = Field(min_length=1, max_length=128)


class MangaManifest(ContractModel):
    schema_version: Literal["manga-manifest.v1"]
    manga_id: Identifier
    project_id: Identifier
    scope_id: Identifier
    memory_version: Annotated[int, Field(ge=0)]
    rendered_page_artifact_ids: list[Identifier] = Field(min_length=1, max_length=1_000)
    beats: list[AdaptationBeat] = Field(min_length=1, max_length=1_000)
    panels: list[ManifestPanel] = Field(min_length=1, max_length=10_000)
    character_asset_ids: list[Identifier] = Field(default_factory=list, max_length=1_000)
    art_direction_artifact_id: Identifier
    content_hash: ContentHash

    @model_validator(mode="after")
    def validate_manifest_graph(self) -> "MangaManifest":
        beat_ids = [beat.beat_id for beat in self.beats]
        if len(beat_ids) != len(set(beat_ids)):
            raise ValueError("beat ids must be unique")
        known_beats = set(beat_ids)
        panel_ids = [panel.panel_id for panel in self.panels]
        if len(panel_ids) != len(set(panel_ids)):
            raise ValueError("panel ids must be unique")
        if any(not set(panel.beat_ids).issubset(known_beats) for panel in self.panels):
            raise ValueError("every panel beat_id must reference a manifest beat")
        sequences = [beat.sequence for beat in self.beats]
        if sequences != list(range(len(self.beats))):
            raise ValueError("beat sequence values must be contiguous from zero")
        return self
