import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../auth/AuthProvider";
import { useVoticTheme } from "../theme/ThemeProvider";
import { useSubscription } from "./SubscriptionProvider";
import { AllowanceNotice, claim_allowance_notice, subscribe_allowance_notice } from "./allowanceNotice";

/** A quiet notice inside the affected screen; never opens a modal, store, or checkout. */
export function UsageLimitNotice() {
  return <UsageLimitNoticeCard {...useUsageLimitNotice()} />;
}

/** Subscribe before a feature starts its request, even when its result panel opens afterward. */
export function useUsageLimitNotice() {
  const { user, homeEntrance } = useAuth();
  const { access, checking } = useSubscription();
  const generation = homeEntrance.key();
  const enabled = Boolean(user && access && !checking);
  const [state, setState] = useState<{ owner: object; generation: number; notice: AllowanceNotice } | null>(
    null,
  );
  const notice = state?.owner === homeEntrance && state.generation === generation ? state.notice : null;
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      const stop = subscribe_allowance_notice((next) => {
        if (
          homeEntrance.key() === generation &&
          claim_allowance_notice(homeEntrance, generation, next.resetsAt)
        )
          setState({ owner: homeEntrance, generation, notice: next });
      });
      return () => {
        stop();
        setState(null);
      };
    }, [enabled, homeEntrance, generation]),
  );
  const setNotice = useCallback(() => setState(null), []);
  useEffect(() => {
    if (!notice) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const expire = () => {
      clearTimeout(timer);
      const remaining = Date.parse(notice.resetsAt) - Date.now();
      if (remaining <= 0) setNotice();
      else timer = setTimeout(expire, Math.min(remaining, 86_400_000));
    };
    expire();
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") expire();
    });
    return () => {
      clearTimeout(timer);
      listener.remove();
    };
  }, [notice, setNotice]);
  return { notice: enabled ? notice : null, dismiss: setNotice };
}

export function UsageLimitNoticeCard({ notice, dismiss }: ReturnType<typeof useUsageLimitNotice>) {
  const { theme } = useVoticTheme();
  if (!notice) return null;
  return (
    <View
      testID="ai-usage-notice"
      style={[s.notice, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
    >
      <View style={s.row}>
        <Text accessibilityLiveRegion="polite" style={[s.detail, s.copy, { color: theme.text }]}>
          Your monthly AI allowance resets{" "}
          {new Date(notice.resetsAt).toLocaleString(undefined, {
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            timeZoneName: "short",
          })}
          .
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss AI usage notice"
          onPress={dismiss}
          style={s.dismiss}
        >
          <Ionicons name="close" size={20} color={theme.mutedText} accessible={false} />
        </Pressable>
      </View>
      <Text style={[s.detail, { color: theme.mutedText }]}>
        You can wait for this reset. Keep reading, listening to saved text, and using your notes on your
        current plan.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="View plans"
        accessibilityHint="Compare available plans. Opening this page does not change your subscription."
        onPress={() => router.push("/subscription")}
        style={s.link}
      >
        <Text style={[s.linkText, { color: theme.accentText }]}>View plans</Text>
      </Pressable>
    </View>
  );
}
const s = StyleSheet.create({
  notice: { padding: 12, gap: 6, borderRadius: 14, borderWidth: 1 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  copy: { flex: 1 },
  detail: { fontSize: 14, lineHeight: 21 },
  dismiss: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  link: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  linkText: { fontSize: 14, fontWeight: "600", textDecorationLine: "underline" },
});
