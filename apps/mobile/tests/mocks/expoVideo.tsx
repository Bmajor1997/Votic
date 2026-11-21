import { useState } from "react";
import { View } from "react-native";

type Listener = () => void;

/** A stand-in for expo-video's player: records what Welcome sets and lets a test end the video. */
export class FakeVideoPlayer {
  loop = true;
  muted = false;
  audioMixingMode = "auto";
  playing = false;
  private listeners = new Map<string, Set<Listener>>();
  play() {
    this.playing = true;
  }
  addListener(event: string, listener: Listener) {
    const set = this.listeners.get(event) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(event, set);
    return { remove: () => set.delete(listener) };
  }
  finish() {
    this.playing = false;
    this.listeners.get("playToEnd")?.forEach((listener) => listener());
  }
}

/** Every player made since the last reset, newest last. */
export const fakeVideoPlayers: FakeVideoPlayer[] = [];
export function reset_expo_video_mock() {
  fakeVideoPlayers.length = 0;
}

export function useVideoPlayer(_source: unknown, setup?: (player: FakeVideoPlayer) => void) {
  return useState(() => {
    const player = new FakeVideoPlayer();
    fakeVideoPlayers.push(player);
    setup?.(player);
    return player;
  })[0];
}

export function VideoView(props: { testID?: string }) {
  return <View testID={props.testID} />;
}
