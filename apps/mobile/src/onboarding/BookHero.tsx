import { useEventListener } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";

const FLIP_VIDEO = require("../../assets/welcome-book.mp4");
/** The open book before its pages turn: shown while the video loads, so nothing jumps when it starts. */
const FIRST_PAGE = require("../../assets/welcome-book-start.jpg");
/** Pages 84 and 85 with the light up and a sentence highlighted: where the video ends, and all there is with Less motion. */
const LAST_PAGE = require("../../assets/welcome-book.jpg");

/** The video's shape (390 × 318), so the book is never stretched. */
const ASPECT_RATIO = 390 / 318;

/**
 * Welcome's open book. Its pages turn three times, landing on 84 and 85, a soft light rises and a highlight reads
 * along a sentence; it plays once, silently and without controls, then holds that last page. With Less motion the
 * last page is simply shown. It is decoration: screen readers skip it, and the buttons below never wait for it.
 */
export function BookHero() {
  const { reduceMotion } = useAccessibilityPreferences();
  return (
    <View style={s.frame} accessible={false} importantForAccessibility="no-hide-descendants">
      {reduceMotion ? (
        <Image testID="welcome-book-still" source={LAST_PAGE} style={s.fill} resizeMode="contain" />
      ) : (
        <FlippingBook />
      )}
    </View>
  );
}

function FlippingBook() {
  const [ended, set_ended] = useState(false);
  const player = useVideoPlayer(FLIP_VIDEO, (video) => {
    video.loop = false;
    video.muted = true;
    // Never pause music or a Votic reading that's already playing.
    video.audioMixingMode = "mixWithOthers";
    video.play();
  });
  // Swap in the still of the last page, so it stays exactly there whatever the device does at a video's end.
  useEventListener(player, "playToEnd", () => set_ended(true));
  if (ended)
    return <Image testID="welcome-book-still" source={LAST_PAGE} style={s.fill} resizeMode="contain" />;
  return (
    <>
      <Image source={FIRST_PAGE} style={s.fill} resizeMode="contain" />
      <VideoView
        testID="welcome-book-video"
        player={player}
        style={s.fill}
        contentFit="contain"
        nativeControls={false}
        allowsPictureInPicture={false}
        surfaceType="textureView"
      />
    </>
  );
}

const s = StyleSheet.create({
  frame: { width: "100%", aspectRatio: ASPECT_RATIO, maxHeight: 340, alignSelf: "center" },
  fill: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" },
});
