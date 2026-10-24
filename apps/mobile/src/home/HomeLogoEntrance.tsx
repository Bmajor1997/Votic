import { useCallback, useEffect, useState } from "react";
import { Animated, AppState, Easing, useWindowDimensions } from "react-native";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../auth/AuthProvider";
import { useAccountSetup } from "../onboarding/AccountSetupProvider";
import { useSubscription } from "../subscription/SubscriptionProvider";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { useActivity } from "../activity/ActivityProvider";
import { VoticLogo } from "../components/VoticLogo";
import { MOTION } from "../motion/motionSpec";

/** Key by auth generation, including a sign-out/sign-in that React batches into one render. */
export function HomeLogoEntrance({ ready }: { ready: boolean }) {
  const { homeEntrance } = useAuth();
  return <SessionHomeLogo key={homeEntrance.key()} ready={ready} />;
}
function SessionHomeLogo({ ready }: { ready: boolean }) {
  const { user, hydrated, homeEntrance } = useAuth();
  const setup = useAccountSetup();
  const subscription = useSubscription();
  const activity = useActivity();
  const { reduceMotion, motionReady } = useAccessibilityPreferences();
  const uid = user?.uid ?? null;
  const generation = homeEntrance.key();
  const [progress] = useState(
    () => new Animated.Value(homeEntrance.pending(uid, generation) && !reduceMotion ? 0 : 1),
  );
  const [active, setActive] = useState(
    AppState.currentState !== "background" && AppState.currentState !== "inactive",
  );
  const { width } = useWindowDimensions();
  const prepared =
    ready &&
    hydrated &&
    !setup.loading &&
    setup.handedOff &&
    subscription.access &&
    !subscription.checking &&
    activity.hydrated &&
    motionReady;
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => setActive(state === "active"));
    return () => listener.remove();
  }, []);
  useFocusEffect(
    useCallback(() => {
      // A timeout also reveals the logo if initialization or the native driver never settles.
      const settle = () => {
        homeEntrance.claim(uid, generation);
        progress.setValue(1);
      };
      if (!homeEntrance.pending(uid, generation) || reduceMotion) {
        settle();
        return;
      }
      const deadline = setTimeout(settle, MOTION.homeLogo.settleDeadline);
      if (!prepared || !active) return () => clearTimeout(deadline);
      let animation: Animated.CompositeAnimation | undefined;
      let started = false;
      const frame = requestAnimationFrame(() => {
        if (!homeEntrance.claim(uid, generation)) {
          progress.setValue(1);
          return;
        }
        started = true;
        progress.setValue(0);
        try {
          animation = Animated.timing(progress, {
            toValue: 1,
            duration: MOTION.homeLogo.duration,
            easing: Easing.bezier(...MOTION.homeLogo.easing),
            useNativeDriver: true,
            isInteraction: false,
          });
          animation.start(() => progress.setValue(1));
        } catch {
          progress.setValue(1);
        }
      });
      return () => {
        cancelAnimationFrame(frame);
        clearTimeout(deadline);
        animation?.stop();
        if (started) progress.setValue(1);
      };
    }, [homeEntrance, uid, generation, progress, prepared, reduceMotion, active]),
  );
  return (
    <Animated.View
      testID="home-logo-entrance"
      pointerEvents="none"
      style={{
        transform: [
          {
            translateX: reduceMotion
              ? 0
              : progress.interpolate({ inputRange: [0, 1], outputRange: [width, 0], extrapolate: "clamp" }),
          },
        ],
      }}
    >
      <VoticLogo animate={false} />
    </Animated.View>
  );
}
