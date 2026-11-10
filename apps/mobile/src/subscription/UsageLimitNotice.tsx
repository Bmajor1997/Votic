import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../auth/AuthProvider";
import { useVoticTheme } from "../theme/ThemeProvider";
import { AllowanceNotice, claim_allowance_notice, subscribe_allowance_notice } from "./allowanceNotice";
import { useSubscription } from "./SubscriptionProvider";
import { FreeUpgradeSheet } from "./FreeUpgradeSheet";

/** A quiet, dismissible notice inside the affected screen; never opens a modal, store, or checkout. */
export function UsageLimitNotice() {
  return <UsageLimitNoticeCard {...useUsageLimitNotice()} />;
}

/** Subscribe before a feature starts its request, even when its result panel opens afterward. */
export function useUsageLimitNotice() {
  const { user, homeEntrance } = useAuth();
  const { access } = useSubscription();
  const generation = homeEntrance.key();
  const enabled = Boolean(user);
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
          ((!access &&
            [
              "AI_CREDITS_EXHAUSTED",
              "FREE_SUMMARIES_EXHAUSTED",
              "FREE_SCANS_EXHAUSTED",
              "FREE_PDF_PLUS_REQUIRED",
            ].includes(next.code ?? "")) ||
            claim_allowance_notice(homeEntrance, generation, next.resetsAt))
        )
          setState({ owner: homeEntrance, generation, notice: next });
      });
      return () => {
        stop();
        setState(null);
      };
    }, [enabled, homeEntrance, generation, access]),
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

/** `sheetOnly` keeps the Votic Plus sheet but leaves out the card (the scanner's camera view has no room for it). */
export function UsageLimitNoticeCard({
  notice,
  dismiss,
  sheetOnly = false,
}: ReturnType<typeof useUsageLimitNotice> & { sheetOnly?: boolean }) {
  const { theme } = useVoticTheme();
  const { access, checking } = useSubscription();
  if (!notice) return null;
  const offer =
    !access &&
    !checking &&
    [
      "AI_CREDITS_EXHAUSTED",
      "FREE_SUMMARIES_EXHAUSTED",
      "FREE_SCANS_EXHAUSTED",
      "FREE_PDF_PLUS_REQUIRED",
    ].includes(notice.code ?? "");
  const reason =
    notice.code === "FREE_SUMMARIES_EXHAUSTED"
      ? "summaries"
      : notice.code === "FREE_SCANS_EXHAUSTED"
        ? "scans"
        : notice.code === "FREE_PDF_PLUS_REQUIRED"
          ? "pdf"
          : "credits";
  return (
    <>
      {offer ? (
        <FreeUpgradeSheet visible reason={reason} resetsAt={notice.resetsAt} onClose={dismiss} />
      ) : null}
      {sheetOnly ? null : (
        <View
          testID="ai-usage-notice"
          style={[s.notice, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
        >
          <View style={s.row}>
            <Text
              accessibilityLiveRegion="polite"
              style={[s.detail, s.copy, s.heading, { color: theme.text }]}
            >
              You&apos;ve used this month&apos;s AI usage. It renews{" "}
              {new Date(notice.resetsAt).toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
                year: "numeric",
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
            Reading, listening, and your notes keep working as usual.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="AI Usage"
            accessibilityHint="Shows your monthly AI usage and any options for more. Opening it doesn't buy anything."
            onPress={() => router.push("/ai-usage")}
            style={s.link}
          >
            <Text style={[s.linkText, { color: theme.accentText }]}>See AI Usage</Text>
          </Pressable>
        </View>
      )}
    </>
  );
}
const s = StyleSheet.create({
  notice: { padding: 12, gap: 6, borderRadius: 14, borderWidth: 1 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  copy: { flex: 1 },
  heading: { fontWeight: "700" },
  detail: { fontSize: 14, lineHeight: 21 },
  dismiss: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  link: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  linkText: { fontSize: 14, fontWeight: "600", textDecorationLine: "underline" },
});
