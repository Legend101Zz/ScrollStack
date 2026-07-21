"""Source-locked five-page demo planning with no text-model execution."""

from __future__ import annotations

import re

from app.contracts.context import ContextPack
from app.contracts.manga import (
    AdaptationBeat,
    MangaPlan,
    NormalizedBox,
    NormalizedPoint,
    PageScript,
    PageScriptPanel,
    PageScriptSet,
    PanelCamera,
    PanelMotion,
    TextElement,
    TextTailTarget,
    TextTypography,
)
from app.contracts.source import SourceUnitExcerpt

from .errors import ArtifactValidationError
from .hashing import content_hash

DETERMINISTIC_DEMO_PIPELINE = "manga-demo-deterministic.v1"
DETERMINISTIC_DEMO_VERSION = "source-locked-pages-1-15.v1"
DETERMINISTIC_DEMO_PAGE_COUNT = 5
DETERMINISTIC_DEMO_PANEL_COUNT = 10
DETERMINISTIC_DEMO_SOURCE_PAGES = (4, 5, 6, 7, 8, 9, 11, 13, 14, 15)

# These strings are copied from the persisted, hash-verified source units. The
# builder refuses to proceed if a future parse no longer contains them.
_BEAT_TEXT_BY_PAGE = {
    4: "what’s worth doing",
    5: "All rights reserved",
    6: "Actions, not words, reveal our real values",
    7: "There are always more than two options",
    8: "Obvious to you. Amazing to others.",
    9: "Whatever scares you, go do it",
    11: "So I had to make a real change in my life.",
    13: "What would you do then?",
    14: "Neither approach is right or wrong, but you need to be aware of the trade-off.",
    15: "Both are necessary. Neither is right or wrong.",
}

_SFX_BY_PAGE_PAIR = ("WORTH", "OPTIONS", "GO", "CHANGE", "TRADE-OFF")
_NARRATIVE_PURPOSES = (
    "hook",
    "setup",
    "explanation",
    "explanation",
    "reveal",
    "conflict",
    "setup",
    "reveal",
    "conflict",
    "payoff",
)
_PANEL_PURPOSES = (
    "setup",
    "insert",
    "action",
    "reveal",
    "setup",
    "action",
    "transition",
    "reaction",
    "setup",
    "payoff",
)
_SHOTS = (
    "wide",
    "insert",
    "medium",
    "close_up",
    "wide",
    "medium",
    "medium",
    "close_up",
    "wide",
    "close_up",
)


class DeterministicMangaDemoBuilder:
    """Build canonical MangaPlan and PageScriptSet objects from stored text only."""

    implementation_version = DETERMINISTIC_DEMO_VERSION

    def build_plan(self, context: ContextPack) -> MangaPlan:
        selected = self._selected_excerpts(context)
        beats = [
            AdaptationBeat(
                beat_id=f"beat_demo_{index:02d}_{excerpt.source_ref.text_hash[:10]}",
                sequence=index,
                source_refs=[excerpt.source_ref],
                required_fact_ids=[],
                narrative_purpose=_NARRATIVE_PURPOSES[index],
                book_essence=self._grounded_text(excerpt),
                dramatization=self._grounded_text(excerpt),
                character_intent=[],
                visual_intent=[self._grounded_text(excerpt)],
                must_preserve=[self._grounded_text(excerpt)],
                may_compress=[],
                confidence=1.0,
            )
            for index, excerpt in enumerate(selected)
        ]
        identity = content_hash(
            {
                "context_pack_id": context.context_pack_id,
                "implementation_version": self.implementation_version,
                "source_refs": [
                    item.source_ref.model_dump(mode="json") for item in selected
                ],
            }
        )
        return MangaPlan(
            schema_version="manga-plan.v1",
            plan_id=f"plan_deterministic_demo_{identity[:20]}",
            project_id=context.project_id,
            scope_id=context.scope_id,
            context_pack_id=context.context_pack_id,
            memory_version=context.memory_version,
            title="Hell Yeah or No",
            summary=beats[0].book_essence,
            target_page_count=DETERMINISTIC_DEMO_PAGE_COUNT,
            beats=beats,
            character_state_updates=[],
            terminology_updates=[],
            new_facts=[],
            ending_state=beats[-1].book_essence,
            unresolved_thread_updates=[],
        )

    def build_script_set(
        self,
        context: ContextPack,
        *,
        plan_artifact_id: str,
    ) -> PageScriptSet:
        selected = self._selected_excerpts(context)
        identity = content_hash(
            {
                "context_pack_id": context.context_pack_id,
                "plan_artifact_id": plan_artifact_id,
                "implementation_version": self.implementation_version,
            }
        )
        pages: list[PageScript] = []
        for page_index in range(DETERMINISTIC_DEMO_PAGE_COUNT):
            first_index = page_index * 2
            second_index = first_index + 1
            first_excerpt = selected[first_index]
            second_excerpt = selected[second_index]
            first_panel_id = f"panel_demo_{first_index:02d}"
            second_panel_id = f"panel_demo_{second_index:02d}"
            first_text = self._grounded_text(first_excerpt)
            second_text = self._grounded_text(second_excerpt)
            sfx = _SFX_BY_PAGE_PAIR[page_index]
            combined_source = f"{first_excerpt.excerpt} {second_excerpt.excerpt}".casefold()
            if sfx.casefold() not in combined_source:
                raise ArtifactValidationError(
                    f"Deterministic SFX token {sfx!r} is absent from its source page pair"
                )
            panels = [
                self._panel(first_index, first_panel_id, first_text, first_excerpt),
                self._panel(second_index, second_panel_id, second_text, second_excerpt),
            ]
            pages.append(
                PageScript(
                    page_id=f"page_demo_{page_index:02d}_{identity[:10]}",
                    page_index=page_index,
                    page_kind="standard",
                    entry_state=first_text,
                    exit_state=second_text,
                    page_turn_panel_id=second_panel_id,
                    panels=panels,
                    text_elements=[
                        self._caption(page_index, first_panel_id, first_text),
                        self._dialogue(page_index, second_panel_id, second_text),
                        self._sfx(page_index, second_panel_id, sfx),
                    ],
                )
            )
        return PageScriptSet(
            schema_version="page-script-set.v1",
            script_set_id=f"script_deterministic_demo_{identity[:20]}",
            project_id=context.project_id,
            plan_artifact_id=plan_artifact_id,
            context_pack_id=context.context_pack_id,
            pages=pages,
        )

    def _selected_excerpts(self, context: ContextPack) -> list[SourceUnitExcerpt]:
        by_page = {
            item.source_ref.page_start: item
            for item in context.source_units
            if item.source_ref.page_start == item.source_ref.page_end
        }
        selected = [by_page.get(page) for page in DETERMINISTIC_DEMO_SOURCE_PAGES]
        if any(item is None for item in selected):
            missing = [
                page
                for page, item in zip(DETERMINISTIC_DEMO_SOURCE_PAGES, selected, strict=True)
                if item is None
            ]
            raise ArtifactValidationError(
                f"Deterministic pages 1-15 demo is missing persisted source pages {missing}"
            )
        resolved = [item for item in selected if item is not None]
        if len(resolved) != DETERMINISTIC_DEMO_PANEL_COUNT:
            raise ArtifactValidationError("Deterministic demo requires exactly ten source units")
        for excerpt in resolved:
            if excerpt.token_count < 20:
                raise ArtifactValidationError(
                    f"Source unit {excerpt.source_ref.source_unit_id} is not substantive enough"
                )
            self._grounded_text(excerpt)
        return resolved

    @staticmethod
    def _grounded_text(excerpt: SourceUnitExcerpt) -> str:
        phrase = _BEAT_TEXT_BY_PAGE[excerpt.source_ref.page_start]
        normalized_source = re.sub(r"\s+", " ", excerpt.excerpt).strip().casefold()
        if phrase.casefold() not in normalized_source:
            raise ArtifactValidationError(
                f"Grounded demo phrase is absent from {excerpt.source_ref.source_unit_id}"
            )
        return phrase

    @staticmethod
    def _panel(
        index: int,
        panel_id: str,
        story_beat: str,
        excerpt: SourceUnitExcerpt,
    ) -> PageScriptPanel:
        return PageScriptPanel(
            panel_id=panel_id,
            purpose=_PANEL_PURPOSES[index],
            story_beat=story_beat,
            importance="page_turn" if index % 2 else "high",
            tempo="impact" if index % 2 else "hold",
            camera=PanelCamera(
                shot=_SHOTS[index],
                angle="eye" if index % 3 else "low",
                movement="static" if index % 2 else "push_in",
            ),
            blocking=[],
            environment_ref=None,
            prop_refs=[],
            focal_regions=[],
            avoid_text_regions=[],
            motion=PanelMotion(),
            source_refs=[excerpt.source_ref],
            source_fact_ids=[],
        )

    @staticmethod
    def _caption(page_index: int, panel_id: str, content: str) -> TextElement:
        regions = {
            0: NormalizedBox(x=0.08, y=0.07, width=0.70, height=0.15),
            1: NormalizedBox(x=0.56, y=0.08, width=0.35, height=0.22),
            2: NormalizedBox(x=0.08, y=0.07, width=0.70, height=0.14),
            3: NormalizedBox(x=0.66, y=0.08, width=0.28, height=0.24),
            4: NormalizedBox(x=0.08, y=0.07, width=0.70, height=0.15),
        }
        return TextElement(
            text_id=f"text_demo_caption_{page_index:02d}",
            panel_id=panel_id,
            kind="narration",
            content=content,
            shape="caption",
            preferred_region=regions[page_index],
            typography=TextTypography(
                font_token="manga-caption",
                weight=700,
                min_px=24,
                max_px=40,
                emphasis="bold",
            ),
            overflow="reflow",
            z_index=40,
        )

    @staticmethod
    def _dialogue(page_index: int, panel_id: str, content: str) -> TextElement:
        regions = {
            0: NormalizedBox(x=0.10, y=0.64, width=0.72, height=0.20),
            1: NormalizedBox(x=0.06, y=0.08, width=0.34, height=0.26),
            2: NormalizedBox(x=0.10, y=0.50, width=0.72, height=0.22),
            3: NormalizedBox(x=0.06, y=0.08, width=0.46, height=0.28),
            4: NormalizedBox(x=0.10, y=0.64, width=0.72, height=0.20),
        }
        return TextElement(
            text_id=f"text_demo_dialogue_{page_index:02d}",
            panel_id=panel_id,
            kind="dialogue",
            content=content,
            speaker_ref="char_kai",
            emotion="reflective",
            shape="oval",
            preferred_region=regions[page_index],
            tail_target=TextTailTarget(
                subject_ref="char_kai",
                point=NormalizedPoint(x=0.55, y=0.62),
            ),
            typography=TextTypography(
                font_token="manga-dialogue",
                weight=700,
                min_px=24,
                max_px=38,
                emphasis="normal",
            ),
            overflow="reflow",
            z_index=42,
        )

    @staticmethod
    def _sfx(page_index: int, panel_id: str, content: str) -> TextElement:
        regions = {
            0: NormalizedBox(x=0.50, y=0.84, width=0.34, height=0.10),
            1: NormalizedBox(x=0.06, y=0.72, width=0.34, height=0.14),
            2: NormalizedBox(x=0.50, y=0.78, width=0.34, height=0.12),
            3: NormalizedBox(x=0.10, y=0.70, width=0.40, height=0.14),
            4: NormalizedBox(x=0.50, y=0.84, width=0.34, height=0.10),
        }
        return TextElement(
            text_id=f"text_demo_sfx_{page_index:02d}",
            panel_id=panel_id,
            kind="sfx",
            content=content,
            shape="free_sfx",
            preferred_region=regions[page_index],
            typography=TextTypography(
                font_token="manga-sfx",
                weight=900,
                min_px=30,
                max_px=54,
                emphasis="shout",
            ),
            overflow="fit",
            z_index=45,
        )
