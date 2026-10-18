import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useEffect, useState } from "react";
import { Animated, ColorValue, Easing, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAccessibilityPreferences } from "../../src/accessibility/AccessibilityProvider";
import { useVoticTheme } from "../../src/theme/ThemeProvider";
import { WalkthroughOverlay } from "../../src/walkthrough/WalkthroughOverlay";
import { useWalkthrough } from "../../src/walkthrough/WalkthroughProvider";

const TAB_BAR_HEIGHT = 64;
// Home, Documents, Notes, Settings (Ask is hidden from the bar).
const VISIBLE_TABS = 4;
const SHIFT_TRANSITION = {
  animation: "timing",
  config: { duration: 150, easing: Easing.inOut(Easing.ease) },
} as const;
const INSTANT_TRANSITION = { animation: "timing", config: { duration: 0 } } as const;

function AnimatedTabIcon({
  focused,
  color,
  size,
  active,
  inactive,
}: {
  focused: boolean;
  color: ColorValue;
  size: number;
  active: keyof typeof Ionicons.glyphMap;
  inactive: keyof typeof Ionicons.glyphMap;
}) {
  const progress = useState(() => new Animated.Value(focused ? 1 : 0))[0];
  const { reduceMotion } = useAccessibilityPreferences();
  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(focused ? 1 : 0);
      return;
    }
    Animated.spring(progress, {
      toValue: focused ? 1 : 0,
      useNativeDriver: true,
      speed: 24,
      bounciness: 4,
    }).start();
  }, [focused, progress, reduceMotion]);
  return (
    <View style={s.iconWrap}>
      <Ionicons name={focused ? active : inactive} color={color} size={size} />
      <Animated.View
        style={[
          s.indicator,
          { backgroundColor: color, opacity: progress, transform: [{ scaleX: progress }] },
        ]}
      />
    </View>
  );
}

export default function TabLayout() {
  const { theme } = useVoticTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const { registerTarget, pressed } = useWalkthrough();
  // Tab buttons are drawn by the navigator, so the walkthrough locates them from the bar's layout.
  useEffect(() => {
    const tab_rect = (index: number) => async () => ({
      x: (window.width / VISIBLE_TABS) * index,
      y: window.height - (TAB_BAR_HEIGHT + insets.bottom),
      width: window.width / VISIBLE_TABS,
      height: TAB_BAR_HEIGHT,
    });
    registerTarget("tab.documents", tab_rect(1));
    registerTarget("tab.notes", tab_rect(2));
    return () => {
      registerTarget("tab.documents", null);
      registerTarget("tab.notes", null);
    };
  }, [registerTarget, window.width, window.height, insets.bottom]);
  return (
    <View style={[s.navigator, { backgroundColor: theme.background }]}>
      <Tabs
        detachInactiveScreens={false}
        screenOptions={{
          headerShown: false,
          // Keep the same animation and make it instant for Less motion. Switching it to "none" while the tabs
          // are open left the hidden tabs faded out, so Home and Notes went blank until Votic restarted.
          animation: "shift",
          transitionSpec: reduceMotion ? INSTANT_TRANSITION : SHIFT_TRANSITION,
          sceneStyle: { backgroundColor: theme.background },
          tabBarActiveTintColor: theme.accentText,
          tabBarInactiveTintColor: theme.mutedText,
          tabBarHideOnKeyboard: true,
          tabBarStyle: {
            backgroundColor: theme.surface,
            shadowColor: "#071A38",
            shadowOpacity: 0.06,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: -3 },
            borderTopColor: theme.border,
            borderTopWidth: 1,
            height: TAB_BAR_HEIGHT + insets.bottom,
            paddingTop: 6,
            paddingBottom: Math.max(insets.bottom, 8),
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
          tabBarItemStyle: { minHeight: 52 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarAccessibilityLabel: "Home",
            tabBarIcon: ({ color, size, focused }) => (
              <AnimatedTabIcon
                focused={focused}
                color={color}
                size={size}
                active="home"
                inactive="home-outline"
              />
            ),
          }}
        />
        <Tabs.Screen
          name="documents"
          listeners={{ tabPress: () => pressed("tab.documents") }}
          options={{
            title: "Documents",
            tabBarAccessibilityLabel: "Documents",
            tabBarIcon: ({ color, size, focused }) => (
              <AnimatedTabIcon
                focused={focused}
                color={color}
                size={size}
                active="documents"
                inactive="documents-outline"
              />
            ),
          }}
        />
        <Tabs.Screen name="ask" options={{ href: null }} />
        <Tabs.Screen
          name="notes"
          options={{
            title: "Notes",
            tabBarAccessibilityLabel: "Notes",
            tabBarIcon: ({ color, size, focused }) => (
              <AnimatedTabIcon
                focused={focused}
                color={color}
                size={size}
                active="create"
                inactive="create-outline"
              />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarAccessibilityLabel: "Settings",
            tabBarIcon: ({ color, size, focused }) => (
              <AnimatedTabIcon
                focused={focused}
                color={color}
                size={size}
                active="settings"
                inactive="settings-outline"
              />
            ),
          }}
        />
      </Tabs>
      <WalkthroughOverlay host="tabs" />
    </View>
  );
}

const s = StyleSheet.create({
  navigator: { flex: 1 },
  iconWrap: { alignItems: "center", justifyContent: "center", minWidth: 34 },
  // Sits above the icon, so it never runs into the tab's name underneath.
  indicator: { position: "absolute", top: -6, width: 18, height: 2.5, borderRadius: 999 },
});
