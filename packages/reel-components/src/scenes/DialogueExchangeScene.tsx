import { colors } from "@scrollstack/design-tokens";

import { SpeechBubble } from "../primitives/SpeechBubble";
import { PanelImage, SceneShell, getPanelAsset, type SceneRendererProps } from "./shared";

export function DialogueExchangeSceneRenderer({ compiled, compiledScene }: SceneRendererProps) {
  if (compiledScene.scene.scene_type !== "dialogue_exchange") {
    throw new Error("dialogue_exchange renderer received a different scene type");
  }
  const scene = compiledScene.scene;
  return (
    <SceneShell>
      <PanelImage
        asset={getPanelAsset(compiled, compiledScene, scene.panel_id)}
        style={{ transform: "scale(1.06)", filter: "grayscale(0.92) contrast(1.3) brightness(0.58)" }}
      />
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(${colors.shell}22, ${colors.shell}88)` }} />
      {scene.dialogue.map((line, index) => (
        <SpeechBubble
          key={`${line.speaker_id}-${index}`}
          text={line.text}
          speakerId={line.speaker_id}
          index={index}
          total={scene.dialogue.length}
          motionPreset={scene.bubble_motion ?? "pop"}
        />
      ))}
    </SceneShell>
  );
}
