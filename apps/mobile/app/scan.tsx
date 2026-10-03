import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { scanDocumentImage } from "../src/api/voticApi";
import { useDocumentLibrary } from "../src/documents/DocumentLibraryProvider";
import { useVoticPurpose } from "../src/personalization/PurposeProvider";
import { useVoticTheme } from "../src/theme/ThemeProvider";

type ScanPage = { uri: string; width?: number; height?: number };

export default function ScanDocumentScreen() {
  const { theme } = useVoticTheme();
  const { addTextDocument } = useDocumentLibrary();
  const { defaultPlaybackRate } = useVoticPurpose();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [torch, setTorch] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const current = reviewing ? pages.at(-1) : undefined;

  async function capture() {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9, skipProcessing: false });
      if (photo?.uri) {
        setPages((value) => [...value, photo]);
        setReviewing(true);
      }
    } catch {
      Alert.alert("Camera unavailable", "Votic could not take that photo. Please try again.");
    } finally {
      setCapturing(false);
    }
  }

  async function finishScan() {
    if (!pages.length || processing) return;
    setProcessing(true);
    try {
      const extracted: string[] = [];
      for (let index = 0; index < pages.length; index += 1) {
        const response = await fetch(pages[index].uri);
        if (!response.ok) throw new Error("Votic could not access one of the scanned pages.");
        const bytes = await response.arrayBuffer();
        const text = await scanDocumentImage(`scan-page-${index + 1}.jpg`, bytes);
        if (text.trim()) extracted.push(text.trim());
      }
      const text = extracted.join("\n\n");
      if (!text.trim()) throw new Error("Votic could not find readable text in these pages.");
      const stamp = new Date().toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      addTextDocument(`Scanned document - ${stamp}.txt`, text, { playbackRate: defaultPlaybackRate });
      router.replace("/reader");
    } catch (error) {
      Alert.alert(
        "Could not read scan",
        error instanceof Error ? error.message : "Votic could not read these scanned pages.",
      );
    } finally {
      setProcessing(false);
    }
  }

  if (!permission) {
    return (
      <View style={[s.center, { backgroundColor: "#000" }]}>
        <ActivityIndicator color="#FFF" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[s.permission, { backgroundColor: theme.background }]}>
        <View style={[s.permissionIcon, { backgroundColor: theme.surfaceMuted }]}>
          <Ionicons name="camera-outline" size={36} color={theme.accent} />
        </View>
        <Text accessibilityRole="header" style={[s.permissionTitle, { color: theme.text }]}>
          Scan with your camera
        </Text>
        <Text style={[s.permissionCopy, { color: theme.mutedText }]}>
          Votic uses the camera only when you choose Scan. Take clear photos of one or more pages, then Votic
          will turn the visible text into a document.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void requestPermission()}
          style={[s.permissionButton, { backgroundColor: theme.accent }]}
        >
          <Text style={s.primaryText}>Allow camera</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={s.cancelButton}>
          <Text style={[s.cancelText, { color: theme.text }]}>Not now</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={s.root}>
      {current ? (
        <Image source={{ uri: current.uri }} resizeMode="contain" style={StyleSheet.absoluteFill} />
      ) : (
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} />
      )}

      <SafeAreaView style={s.overlay}>
        <View style={s.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close scanner"
            onPress={() => router.back()}
            style={s.roundButton}
          >
            <Ionicons name="close" size={25} color="#FFF" />
          </Pressable>
          <View
            accessible
            accessibilityLabel={pages.length ? `${pages.length} pages captured` : "Document scanner"}
            style={s.counter}
          >
            <Text style={s.counterText}>
              {pages.length ? `${pages.length} ${pages.length === 1 ? "page" : "pages"}` : "Scan document"}
            </Text>
          </View>
          {!current ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={torch ? "Turn flash off" : "Turn flash on"}
              onPress={() => setTorch((value) => !value)}
              style={s.roundButton}
            >
              <Ionicons name={torch ? "flash" : "flash-outline"} size={23} color="#FFF" />
            </Pressable>
          ) : (
            <View style={s.roundButtonPlaceholder} />
          )}
        </View>

        {!current ? (
          <>
            <View pointerEvents="none" style={s.guideWrap}>
              <View style={s.guide}>
                <View style={[s.corner, s.topLeft]} />
                <View style={[s.corner, s.topRight]} />
                <View style={[s.corner, s.bottomLeft]} />
                <View style={[s.corner, s.bottomRight]} />
              </View>
              <Text style={s.hint}>Fit the page inside the frame</Text>
            </View>
            <View style={s.captureBar}>
              {pages.length ? (
                <View style={s.sideSlot}>
                  <Text style={s.sideText}>{pages.length} saved</Text>
                </View>
              ) : (
                <View style={s.sideSlot} />
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Take photo"
                disabled={capturing}
                onPress={() => void capture()}
                style={s.shutterOuter}
              >
                <View style={[s.shutterInner, { opacity: capturing ? 0.5 : 1 }]} />
              </Pressable>
              <View style={s.sideSlot} />
            </View>
          </>
        ) : (
          <View style={s.reviewBar}>
            <Text style={s.reviewTitle}>Is this page clear?</Text>
            <View style={s.reviewActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retake page"
                onPress={() => {
                  setPages((value) => value.slice(0, -1));
                  setReviewing(false);
                }}
                style={s.secondaryAction}
              >
                <Ionicons name="refresh" size={20} color="#FFF" />
                <Text style={s.secondaryText}>Retake</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add another page"
                onPress={() => setReviewing(false)}
                style={s.secondaryAction}
              >
                <Ionicons name="add" size={21} color="#FFF" />
                <Text style={s.secondaryText}>Add page</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={processing}
                onPress={() => void finishScan()}
                style={[s.useAction, { opacity: processing ? 0.7 : 1 }]}
              >
                {processing ? (
                  <ActivityIndicator color="#111827" />
                ) : (
                  <Ionicons name="checkmark" size={21} color="#111827" />
                )}
                <Text style={s.useText}>{processing ? "Reading…" : "Use scan"}</Text>
              </Pressable>
            </View>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  overlay: { flex: 1, justifyContent: "space-between" },
  topBar: {
    paddingHorizontal: 18,
    paddingTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  roundButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  roundButtonPlaceholder: { width: 46, height: 46 },
  counter: {
    paddingHorizontal: 15,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
  },
  counterText: { color: "#FFF", fontSize: 15, fontWeight: "700" },
  guideWrap: { flex: 1, justifyContent: "center", paddingHorizontal: 26 },
  guide: { height: "66%", position: "relative" },
  corner: { position: "absolute", width: 34, height: 34, borderColor: "#FFF" },
  topLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  topRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
  hint: {
    color: "#FFF",
    textAlign: "center",
    marginTop: 18,
    fontSize: 15,
    fontWeight: "600",
    textShadowColor: "#000",
    textShadowRadius: 4,
  },
  captureBar: {
    paddingBottom: 28,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sideSlot: { width: 82, alignItems: "center" },
  sideText: { color: "#FFF", fontSize: 13, fontWeight: "700" },
  shutterOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 5,
    borderColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: "#FFF" },
  reviewBar: {
    backgroundColor: "rgba(0,0,0,0.76)",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
  },
  reviewTitle: { color: "#FFF", textAlign: "center", fontSize: 17, fontWeight: "700", marginBottom: 14 },
  reviewActions: { flexDirection: "row", gap: 12, justifyContent: "center" },
  secondaryAction: {
    minHeight: 50,
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { color: "#FFF", fontSize: 15, fontWeight: "700" },
  useAction: {
    minHeight: 50,
    flex: 1,
    borderRadius: 14,
    backgroundColor: "#FFF",
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  useText: { color: "#111827", fontSize: 15, fontWeight: "800" },
  permission: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 30 },
  permissionIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  permissionTitle: { fontSize: 25, fontWeight: "800", textAlign: "center", marginBottom: 10 },
  permissionCopy: { fontSize: 16, lineHeight: 23, textAlign: "center", maxWidth: 420, marginBottom: 24 },
  permissionButton: {
    width: "100%",
    maxWidth: 360,
    minHeight: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "#FFF", fontSize: 16, fontWeight: "800" },
  cancelButton: { padding: 16 },
  cancelText: { fontSize: 15, fontWeight: "700" },
});
