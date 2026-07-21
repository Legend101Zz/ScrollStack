# Deterministic pages 1-15 demo evidence

This is the HTTP-verified, no-text-model demo run for the already parsed PDF.
The plan and script are system-authored deterministic artifacts validated by the
canonical domain validators. They have no model receipt and the accepted text
cost is exactly `$0`.

## Immutable lineage

- Book: `book_d584c9fd6bd3506fa2167d69`
- Project: `project_163d0056c7e9d9bda3abe824`
- Scope: `scope_d56263bb9d311b4b1834cef7` (PDF pages 1-15)
- Run: `run_7f884b611dfcbc2cd0922137`
- ContextPack: `context_a264c5df25bcc0f22fb846c4`
- MangaPlan: `manga_plan_eca9e6e8a04c46fd52ee70ea`
- PageScriptSet: `page_script_set_fc9222110cd1a70c4b474ef6`
- ThumbnailSet: `thumbnail_set_5dfb362b5743c2906ae27e30`
- Edition: `edition_3f9de5435d5422ee7924b4eb`
- Implementation: `source-locked-pages-1-15.v1`
- Renderer: `deterministic-svg-letterer.v1`

Stages:

- Context: `stage_context_compilation_20e4e51d30a6b4358e7c`
- Direction: `stage_manga_direction_86a7efc5653c740d5fec`
- Page writing: `stage_manga_page_writing_4babbaf91492787882b2`
- Thumbnail: `stage_manga_thumbnail_8807e7f16e1a2a442294`
- Asset generation: `stage_asset_generation_9c4abcd5977e28dc6a1a`
- Composition: `stage_manga_composition_dca656252eea93b17f01`

## Image lineage and cost

Provider/model: `openrouter` / `google/gemini-2.5-flash-image`.

- Accepted panel images: 10 exactly
- Accepted attempts: 11 (Kai plus 10 panels)
- Rejected attempts: 3 (two Kai validation rejections and one panel rejection)
- Accepted-attempt cost: `$0.4319757`
- Rejected-attempt cost: `$0.1173453`
- Total new image cost: `$0.549321`

Kai accepted reference:

- Attempt: `image_attempt_845e5fe91492dae76c6b1b38`
- Artifact: `image_asset_846f19712f755b7861d7be5a`
- Asset: `asset_character_reference_846f19712f755b7861d7be5a`

All attempts, in immutable order:

| Subject | Status | Attempt artifact | Image artifact | Accepted asset |
| --- | --- | --- | --- | --- |
| Kai | rejected | `image_attempt_303730055665b0356bb27ec9` | `image_asset_f316961566c591c0307b1f3d` | - |
| Kai | rejected | `image_attempt_e7ae35d31773a889db890cfc` | `image_asset_6f0beaceda7d8ee027f8fde9` | - |
| Kai | accepted | `image_attempt_845e5fe91492dae76c6b1b38` | `image_asset_846f19712f755b7861d7be5a` | `asset_character_reference_846f19712f755b7861d7be5a` |
| Panel 0 | accepted | `image_attempt_a732bf98b8247aa74522a8fd` | `image_asset_0b55bdca1d1afc4aecf12fcc` | `asset_panel_0b55bdca1d1afc4aecf12fcc` |
| Panel 1 | accepted | `image_attempt_7259864a681638bc46fc1863` | `image_asset_38eb73bfd230f5b8932594fa` | `asset_panel_38eb73bfd230f5b8932594fa` |
| Panel 2 | accepted | `image_attempt_647d7bb438294f1357e2d3bb` | `image_asset_1a8fb1b909c77ac5c53b77c8` | `asset_panel_1a8fb1b909c77ac5c53b77c8` |
| Panel 3 | accepted | `image_attempt_3a7a5564ed69b6e919481c8d` | `image_asset_fc4e85a64242880f8ecb7c77` | `asset_panel_fc4e85a64242880f8ecb7c77` |
| Panel 4 | rejected | `image_attempt_3486ca1b7aa03322362d7a8f` | `image_asset_bc1f5c6b02cd9e03383cb64b` | - |
| Panel 4 | accepted | `image_attempt_d1230771d88c052ce35e67a7` | `image_asset_d69cf6a3127ab605c6a9e16a` | `asset_panel_d69cf6a3127ab605c6a9e16a` |
| Panel 5 | accepted | `image_attempt_b1c0b4c983d2637f4144ed13` | `image_asset_d81b7f5ec88e7dd2d1bb64fb` | `asset_panel_d81b7f5ec88e7dd2d1bb64fb` |
| Panel 6 | accepted | `image_attempt_2a736e30ddfe061eec8563ad` | `image_asset_b9f63655159428a8477add69` | `asset_panel_b9f63655159428a8477add69` |
| Panel 7 | accepted | `image_attempt_c8ee9991ca8fbdf237e3f891` | `image_asset_1a3aea9bc488cc7e49765e74` | `asset_panel_1a3aea9bc488cc7e49765e74` |
| Panel 8 | accepted | `image_attempt_fb94ffc4cb84bf4801f00fb0` | `image_asset_16bcccce4599479dd1d0a724` | `asset_panel_16bcccce4599479dd1d0a724` |
| Panel 9 | accepted | `image_attempt_2226f403655f458468f684ae` | `image_asset_77355b9065dde698d568cb5c` | `asset_panel_77355b9065dde698d568cb5c` |

## Final pages

All five are ordered 1200x1800 PNGs. Captions, balloons, SFX, borders, and page
numbers are deterministic SVG renderer output outside the generated raster
layers.

| Page | Rendered artifact | Raster asset | SHA-256 |
| --- | --- | --- | --- |
| 1 | `rendered_page_f95d0402e855242988581560` | `asset_page_png_577753878a5737080dc1697f` | `577753878a5737080dc1697f992d0ee71d3c87afdb4565cb08d9da953a42d594` |
| 2 | `rendered_page_4e9424942f90a62749b3f822` | `asset_page_png_7b57963fcf524263af66be06` | `7b57963fcf524263af66be062aab6260d7ca4d3d55d85be2b5c98db95fc32e19` |
| 3 | `rendered_page_d19dbcd5cf5f650f4fa0dc92` | `asset_page_png_e334b9015ea1588291754afe` | `e334b9015ea1588291754afe801b56e2c3608053734a89c3be3eecad7b89e87f` |
| 4 | `rendered_page_55f2dae2ca8b4ff98eba7c6b` | `asset_page_png_0f7295303121731c981781fd` | `0f7295303121731c981781fda36fe5d5a7e9dac24b9c89855bd630c80af51661` |
| 5 | `rendered_page_8847ddb2f460c60f87ef9ea1` | `asset_page_png_ee0fda370c8fd7674a613359` | `ee0fda370c8fd7674a6133597b40eb88bff91022ce64cfbc7fcda1b34f457159` |

Evidence files: `page-01.png` through `page-05.png`, `contact-sheet.png`,
`library.jpg`, `reader.jpg`, and `upload.jpg`.

HTTP routes:

- Library: `http://127.0.0.1:3001/library`
- Reader: `http://127.0.0.1:3001/manga/edition_3f9de5435d5422ee7924b4eb`
- Upload: `http://127.0.0.1:3001/books/new`

## Honest limitations and warnings

- The restored Mongo archive originated on Mongo 7 and is currently served by
  Mongo 8.2.3. This cross-major restore compatibility should remain an explicit
  operational warning even though this run read and wrote the restored data.
- The existing parser persists one source unit per PDF page. PDF pages 1-15 are
  front-matter and contents heavy, with only pages 11 and 13-15 containing prose.
  The deterministic token threshold accepted page 5 copyright text as a source
  beat; it is grounded but weak demo material.
- OCR validation rejected detected text, but several accepted raster layers
  contain empty manga-balloon shapes. They contain no detected letters or
  generated dialogue, while all visible words are renderer-authored; future
  image prompting or deterministic masking should eliminate those empty shapes.
