import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';

type VaticPulseProps = {
  active: boolean;
  color?: string;
  size?: number;
};

/**
 * Lightweight, native-driven pulse for playback and AI pending states.
 * Respects the operating system's Reduce Motion preference.
 */
export function VaticPulse({ active, color = '#8B5CF6', size = 28 }: VaticPulseProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;
  const [reduceMotion, setReduceMotion] = React.useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (mounted) setReduceMotion(value);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    scale.stopAnimation();
    opacity.stopAnimation();
    if (!active || reduceMotion) {
      scale.setValue(1);
      opacity.setValue(0.6);
      return;
    }
    const animation = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.25, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.6, duration: 650, useNativeDriver: true }),
        ]),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [active, reduceMotion, scale, opacity]);

  return (
    <View accessibilityLabel={active ? 'Activity in progress' : 'Idle'} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[styles.circle, { width: size * 0.7, height: size * 0.7, borderRadius: size, backgroundColor: color, opacity, transform: [{ scale }] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { shadowColor: '#8B5CF6', shadowOpacity: 0.35, shadowRadius: 8, elevation: 3 },
});
