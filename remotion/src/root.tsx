import React from "react";
import { Composition } from "remotion";
import { VaticIntro, VaticPaywall } from "./scenes";
export function MotionRoot() {
  return <>
    <Composition id="VaticIntro" component={VaticIntro} durationInFrames={120} fps={30} width={1080} height={1920} />
    <Composition id="VaticPaywall" component={VaticPaywall} durationInFrames={210} fps={30} width={1080} height={1920} />
  </>;
}
