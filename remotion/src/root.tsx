import React from "react";
import { Composition } from "remotion";
import { VoticIntro, VoticPremium } from "./scenes";

export function MotionRoot() {
  return (
    <>
      <Composition id="VoticIntro" component={VoticIntro} durationInFrames={120} fps={30} width={1080} height={1920} />
      <Composition id="VoticPremium" component={VoticPremium} durationInFrames={210} fps={30} width={1080} height={1920} />
    </>
  );
}
