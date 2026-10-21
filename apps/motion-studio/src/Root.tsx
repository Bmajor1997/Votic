import { Composition } from "remotion";
import {
  DocumentOpen,
  ReadListen,
  PlayPause,
  ImportSaved,
  FinishReveal,
  BookmarkSaved,
  NoteSaved,
} from "./Scenes";
export const RemotionRoot = () => (
  <>
    <Composition
      id="DocumentOpen"
      component={DocumentOpen}
      durationInFrames={240}
      fps={60}
      width={780}
      height={1688}
      defaultProps={{ dark: false, reducedMotion: false }}
    />
    <Composition
      id="ReadListen"
      component={ReadListen}
      durationInFrames={240}
      fps={60}
      width={780}
      height={1688}
      defaultProps={{ dark: false, reducedMotion: false }}
    />
    <Composition
      id="PlayPause"
      component={PlayPause}
      durationInFrames={240}
      fps={60}
      width={780}
      height={1688}
      defaultProps={{ dark: false, reducedMotion: false }}
    />
    <Composition
      id="ImportSaved"
      component={ImportSaved}
      durationInFrames={240}
      fps={60}
      width={780}
      height={1688}
      defaultProps={{ dark: false, reducedMotion: false }}
    />
    <Composition
      id="FinishReveal"
      component={FinishReveal}
      durationInFrames={240}
      fps={60}
      width={780}
      height={1688}
      defaultProps={{ dark: false, reducedMotion: false }}
    />
    <Composition
      id="BookmarkSaved"
      component={BookmarkSaved}
      durationInFrames={240}
      fps={60}
      width={780}
      height={1688}
      defaultProps={{ dark: false, reducedMotion: false }}
    />
    <Composition
      id="NoteSaved"
      component={NoteSaved}
      durationInFrames={240}
      fps={60}
      width={780}
      height={1688}
      defaultProps={{ dark: false, reducedMotion: false }}
    />
  </>
);
