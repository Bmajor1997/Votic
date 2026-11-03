import { Ionicons } from "@expo/vector-icons";
import { forwardRef, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  findNodeHandle,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { editorial } from "../design/editorial";
import { controlSizes, spacing } from "../design/tokens";
import { BrandMark } from "../onboarding/WelcomeMotion";
import { useVoticTheme } from "../theme/ThemeProvider";
import { billing_period_label, period_length } from "./offerText";
import { RetentionOffer } from "./subscriptionTypes";

/** What the testing build shows when Google Play has no retention offer set up yet. Never claimable. */
export const PREVIEW_RETENTION_OFFER: RetentionOffer = {
  id: "preview",
  productId: "preview",
  offerPrice: "$7.99",
  offerPeriod: { count: 1, unit: "month" },
  offerCycles: 2,
  regularPrice: "$9.99",
  regularPeriod: { count: 1, unit: "month" },
};

/** "$7.99/month", "for your next 2 months", "Then $9.99/month. Cancel anytime in Google Play." */
export function retention_offer_text(offer: RetentionOffer, store: "App Store" | "Google Play") {
  const per = billing_period_label(offer.offerPeriod);
  const regularPer = billing_period_label(offer.regularPeriod);
  const count = offer.offerPeriod.count * offer.offerCycles;
  // "for your next year", not "for your next 1 year".
  const length =
    count === 1 ? offer.offerPeriod.unit : period_length({ count, unit: offer.offerPeriod.unit });
  return {
    price: `${offer.offerPrice}/${per}`,
    regular: regularPer ? `${offer.regularPrice}/${regularPer}` : offer.regularPrice,
    length: `for your next ${length}`,
    terms: `Then ${regularPer ? `${offer.regularPrice}/${regularPer}` : offer.regularPrice}. Auto-renews. Cancel anytime in ${store}.`,
  };
}

type PanelProps = {
  offer: RetentionOffer;
  store: "App Store" | "Google Play";
  /** Testing build without a store offer: shows the design with example prices, and can't be claimed. */
  preview: boolean;
  claiming: boolean;
  message: string | null;
  onClaim: () => void;
  onContinue: () => void;
  onClose: () => void;
};

/** How long the sheet takes to rise: slow enough to read as moving up the screen, not popping in. */
export const SHEET_RISE_MS = 700;
const SHEET_DROP_MS = 260;

/**
 * The offer as a sheet that rises slowly from the bottom of the screen over a dimmed backdrop, and drops back
 * down when it closes. With Less motion it simply appears.
 */
export function RetentionOfferSheet({ visible, ...panel }: PanelProps & { visible: boolean }) {
  const { theme } = useVoticTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const heading = useRef<Text>(null);
  const [progress] = useState(() => new Animated.Value(0));
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);
  if (!visible && mounted && reduceMotion) setMounted(false);
  useEffect(() => {
    if (!mounted) return;
    progress.stopAnimation();
    if (reduceMotion) {
      progress.setValue(visible ? 1 : 0);
      return;
    }
    // The JS driver lets a sheet interrupted mid-rise settle cleanly; it is one view moving for under a second.
    const motion = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? SHEET_RISE_MS : SHEET_DROP_MS,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
      useNativeDriver: false,
    });
    motion.start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
    return () => motion.stop();
  }, [visible, mounted, reduceMotion, progress]);
  function focus_heading() {
    const handle = heading.current && Platform.OS !== "web" ? findNodeHandle(heading.current) : null;
    if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
  }
  return (
    <Modal
      testID="retention-offer"
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={panel.onClose}
      onShow={focus_heading}
    >
      <Animated.View
        accessible={false}
        importantForAccessibility="no"
        style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.45)", opacity: progress }]}
      />
      <Animated.View
        accessibilityViewIsModal
        style={[
          s.sheet,
          {
            top: insets.top + 12,
            paddingBottom: insets.bottom,
            backgroundColor: theme.background,
            transform: [
              { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) },
            ],
          },
        ]}
      >
        <View style={[s.grabber, { backgroundColor: theme.border }]} />
        <RetentionOfferPanel ref={heading} {...panel} />
      </Animated.View>
    </Modal>
  );
}

/**
 * "Are you sure you want to leave?": a discount for staying, shown once before account deletion. Leaving is
 * always one tap away and never hidden; claiming goes through the store's own purchase sheet.
 */
export const RetentionOfferPanel = forwardRef<
  Text,
  {
    offer: RetentionOffer;
    store: "App Store" | "Google Play";
    /** Testing build without a store offer: shows the design with example prices, and can't be claimed. */
    preview: boolean;
    claiming: boolean;
    message: string | null;
    onClaim: () => void;
    onContinue: () => void;
    onClose: () => void;
  }
>(function RetentionOfferPanel(
  { offer, store, preview, claiming, message, onClaim, onContinue, onClose },
  heading,
) {
  const { theme } = useVoticTheme();
  const text = retention_offer_text(offer, store);
  return (
    <ScrollView contentContainerStyle={s.content}>
      <View style={s.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          accessibilityHint="Closes this without deleting your account"
          disabled={claiming}
          onPress={onClose}
          hitSlop={8}
          style={[s.close, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <Ionicons name="close" size={22} color={theme.text} />
        </Pressable>
      </View>
      <View style={s.mark}>
        <BrandMark size={72} arrive />
      </View>
      <Text style={[s.eyebrow, { color: theme.accentText }]}>BEFORE YOU GO</Text>
      <Text ref={heading} accessibilityRole="header" style={[s.title, { color: theme.text }]}>
        Are you sure you want to leave?
      </Text>
      <Text style={[s.body, { color: theme.mutedText }]}>
        Stay with Votic Plus for less, and keep listening to your documents, asking Votic and saving notes.
      </Text>
      <View
        accessible
        accessibilityLabel={`Stay and save: ${text.price} ${text.length}, instead of ${text.regular}. ${text.terms}`}
        style={[s.card, { backgroundColor: theme.brandTint, borderColor: theme.accent }]}
      >
        <View style={[s.badge, { backgroundColor: theme.accent }]}>
          <Text style={[s.badgeText, { color: theme.onAccent }]}>STAY &amp; SAVE</Text>
        </View>
        <Text style={[s.was, { color: theme.mutedText }]}>{text.regular}</Text>
        <Text style={[s.price, { color: theme.text }]}>{text.price}</Text>
        <Text style={[s.length, { color: theme.text }]}>{text.length}</Text>
        <Text style={[s.terms, { color: theme.mutedText }]}>{text.terms}</Text>
      </View>
      {preview ? (
        <Text style={[s.body, { color: theme.mutedText }]}>
          Testing build: this offer isn&apos;t set up in {store} yet, so these are example prices and it
          can&apos;t be claimed.
        </Text>
      ) : null}
      {message ? (
        <Text accessibilityRole="alert" style={[s.body, { color: theme.text }]}>
          {message}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Claim offer, ${text.price} ${text.length}`}
        accessibilityState={{ disabled: preview || claiming, busy: claiming }}
        disabled={preview || claiming}
        onPress={onClaim}
        style={({ pressed }) => [
          s.button,
          {
            backgroundColor: theme.accent,
            borderColor: theme.accent,
            opacity: preview ? 0.5 : pressed ? 0.8 : 1,
          },
        ]}
      >
        {claiming ? (
          <ActivityIndicator color={theme.onAccent} />
        ) : (
          <Text style={[s.buttonText, { color: theme.onAccent }]}>Claim offer</Text>
        )}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Continue to delete account"
        accessibilityHint="Opens the account deletion steps. Your account is not deleted yet"
        disabled={claiming}
        onPress={onContinue}
        style={({ pressed }) => [
          s.button,
          { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Text style={[s.buttonText, { color: theme.text }]}>Continue to delete account</Text>
      </Pressable>
    </ScrollView>
  );
});

const s = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
  grabber: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, marginTop: 10 },
  content: { padding: spacing.lg, gap: spacing.md, maxWidth: 560, width: "100%", alignSelf: "center" },
  top: { flexDirection: "row", justifyContent: "flex-end" },
  close: {
    width: controlSizes.minimumTouch,
    height: controlSizes.minimumTouch,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  mark: { alignItems: "center", marginTop: -spacing.md },
  eyebrow: { fontSize: 13, fontWeight: "800", letterSpacing: 1.2, textAlign: "center" },
  title: { ...editorial, fontSize: 32, lineHeight: 40, textAlign: "center" },
  body: { fontSize: 17, lineHeight: 25, textAlign: "center" },
  card: {
    borderWidth: 2,
    borderRadius: 24,
    padding: spacing.lg,
    alignItems: "center",
    gap: 4,
    marginTop: spacing.sm,
  },
  badge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, marginBottom: spacing.sm },
  badgeText: { fontSize: 12, fontWeight: "800", letterSpacing: 0.8 },
  was: { fontSize: 18, textDecorationLine: "line-through" },
  price: { fontSize: 40, lineHeight: 48, fontWeight: "800" },
  length: { fontSize: 18, fontWeight: "700" },
  terms: { fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: spacing.sm },
  button: {
    minHeight: 56,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  buttonText: { fontSize: 17, fontWeight: "800" },
});
