---
name: manga-page-writing
description: Write source-grounded page scripts before layout or image generation.
version: 1.0.0
---

# Manga page writing

Turn the accepted MangaPlan into a bounded `page-script-set.v1` whose page
entry/exit states, panel beats, camera/blocking, text intent, page-turn payoff,
and source lineage are explicit.

## Workflow

1. Read only the bounded book context and accepted manga canon needed for the pages.
2. Write deliberate page boundaries and a varied panel rhythm.
3. Keep dialogue, narration, and SFX short enough for planned regions.
4. Attach source references and fact IDs to every factual panel beat.
5. Submit the complete set through `submit_page_script_set`.

## Hard rules

- Do not request or generate images.
- Do not compose `RenderedPage` artifacts or renderer commands.
- Do not use arbitrary paths, URLs, shell, filesystem, or network tools.
- Do not invent source facts, characters, assets, or continuity.
- Report a blocker when the accepted evidence cannot support a page beat.
- Broker acceptance is the only valid completion signal.
