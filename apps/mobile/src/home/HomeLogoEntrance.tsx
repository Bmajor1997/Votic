import { useCallback, useEffect } from "react";
import { Animated } from "react-native";
import { useFocusEffect } from "expo-router";
import { VoticWordmark } from "../components/VoticWordmark";
import { useWordmarkEntrance } from "./WordmarkEntrance";

/**
 * Home's wordmark. Home is where the shared entrance (WordmarkEntrance) starts after a fresh sign-in, once Home's
 * content is ready and Home is in front. Before it starts, the pieces are hidden so the finished logo never flashes.
 */
export function HomeLogoEntrance({ ready }: { ready: boolean }) {
  const entrance = useWordmarkEntrance();
  const { set_home_ready, set_home_focused } = entrance;
  useEffect(() => {
    set_home_ready(ready);
    return () => set_home_ready(false);
  }, [ready, set_home_ready]);
  useFocusEffect(
    useCallback(() => {
      set_home_focused(true);
      return () => set_home_focused(false);
    }, [set_home_focused]),
  );
  return (
    <Animated.View testID="home-logo-entrance" pointerEvents="none">
      <VoticWordmark entrance={entrance.progress} robotEntrance live={entrance.live} />
    </Animated.View>
  );
}
