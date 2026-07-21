---
name: manga-thumbnail
description: Propose hierarchical page layouts and image-free SVG name previews.
version: 1.0.0
---

# Manga thumbnail

Turn an accepted `page-script-set.v1` into `manga-page-plan.v1` candidates with
intentional panel hierarchy, reading edges, text reserves, focal regions, and
page-turn anchors.

## Workflow

1. Fetch the accepted page script and only relevant accepted asset metadata.
2. Propose a hierarchical `panel | split | overlay | freeform_panel` layout.
3. Call `validate_layout_draft` before submission and repair only addressable issues.
4. Check page rhythm, eye path, text reserve, and camera repetition across pages.
5. Submit the complete set through `submit_thumbnail_set`.

## Hard rules

- Do not request or generate images.
- Do not submit page composition, lettering, or `RenderedPage` artifacts.
- Do not use arbitrary paths, URLs, shell, filesystem, or network tools.
- Do not bypass geometry, reading-order, text-fit, or source-lineage errors.
- Use stable node, panel, and text IDs so repairs remain addressable.
- Broker acceptance is the only valid completion signal.
