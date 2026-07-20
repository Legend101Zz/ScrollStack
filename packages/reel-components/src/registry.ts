import type { ReactElement } from "react";

import { DialogueExchangeSceneRenderer } from "./scenes/DialogueExchangeScene";
import { ImpactCutSceneRenderer } from "./scenes/ImpactCutScene";
import { MontageSceneRenderer } from "./scenes/MontageScene";
import { NarratorCardSceneRenderer } from "./scenes/NarratorCardScene";
import { PageTurnSceneRenderer } from "./scenes/PageTurnScene";
import { PanelFocusSceneRenderer } from "./scenes/PanelFocusScene";
import { SplitPanelSceneRenderer } from "./scenes/SplitPanelScene";
import type { SceneRendererProps } from "./scenes/shared";
import type { ReelComponentId } from "./types";

export type ReelSceneRenderer = (props: SceneRendererProps) => ReactElement;

export const reelComponentRegistry: Readonly<Record<ReelComponentId, ReelSceneRenderer>> =
  Object.freeze({
    panel_focus: PanelFocusSceneRenderer,
    split_panel_reveal: SplitPanelSceneRenderer,
    dialogue_exchange: DialogueExchangeSceneRenderer,
    impact_cut: ImpactCutSceneRenderer,
    narrator_card: NarratorCardSceneRenderer,
    page_turn: PageTurnSceneRenderer,
    panel_montage: MontageSceneRenderer,
  });
