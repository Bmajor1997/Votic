import { HomeLogoEntrance, HomeRobotCloseUp } from "./HomeLogoEntrance";
import { CarryOptionsStudy } from "./CarryOptions";
import { Composition } from "remotion";
import { MOTION } from "../../mobile/src/motion/motionSpec";
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
      id="HomeLogoEntrance"
      component={HomeLogoEntrance}
      durationInFrames={Math.ceil((MOTION.homeLogo.duration / 1000 + 2) * 60)}
      fps={60}
      width={390}
      height={844}
      defaultProps={{
        dark: false,
        reducedMotion: false,
        returningSession: false,
      }}
    />
    <Composition
      id="HomeRobotCloseUp"
      component={HomeRobotCloseUp}
      durationInFrames={Math.ceil((MOTION.homeLogo.duration / 1000 + 2) * 60)}
      fps={60}
      width={1200}
      height={420}
      defaultProps={{ dark: false, zoom: 5, guides: true }}
    />
    <Composition
      id="CarryOptions"
      component={CarryOptionsStudy}
      durationInFrames={Math.ceil((MOTION.homeLogo.duration / 1000 + 2) * 60)}
      fps={60}
      width={1280}
      height={1080}
      defaultProps={{ dark: false, zoom: 3.4 }}
    />
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
