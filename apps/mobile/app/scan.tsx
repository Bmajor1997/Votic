import { Ionicons } from "@expo/vector-icons";
import { CameraView } from "expo-camera";
import { router } from "expo-router";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Alert,
  Image,
  Pressable,
  Platform,
  Linking,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScanAction, ScanPageReview } from "../src/documents/ScanPageReview";
import { scanStyles as s } from "../src/documents/scanStyles";
import { useScanner } from "../src/documents/useScanner";
type Scanner = ReturnType<typeof useScanner>;
export default function ScanDocumentScreen() {
  const scanner = useScanner();
  const { theme, permission, requestPermission, draft, discard } = scanner;
  if (!permission)
    return (
      <View style={[s.center, { backgroundColor: "#000" }]}>
        <ActivityIndicator color="#FFF" />
      </View>
    );
  if (!permission.granted)
    return (
      <SafeAreaView style={[s.permission, { backgroundColor: theme.background }]}>
        <Text accessibilityRole="header" style={[s.permissionTitle, { color: theme.text }]}>
          Scan with your camera
        </Text>
        <Text style={[s.permissionCopy, { color: theme.mutedText }]}>
          Take photos of every sheet, then tap Finish scan to save them together as one document.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            void (permission.canAskAgain === false ? Linking.openSettings() : requestPermission())
          }
          style={[s.permissionButton, { backgroundColor: theme.accent }]}
        >
          <Text style={{ color: theme.onAccent }}>
            {permission.canAskAgain === false ? "Open settings" : "Allow camera"}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={s.cancelButton}>
          <Text style={{ color: theme.text }}>Not now</Text>
        </Pressable>
      </SafeAreaView>
    );
  if (!draft.ready)
    return (
      <SafeAreaView style={[s.permission, { backgroundColor: theme.background }]}>
        <Text accessibilityRole={draft.error ? "alert" : "text"} style={{ color: theme.text }}>
          {draft.error || "Loading your saved scan…"}
        </Text>
        {draft.error ? (
          <ScanAction label="Discard unreadable scan" primary onPress={discard} />
        ) : (
          <ActivityIndicator />
        )}
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={s.cancelButton}>
          <Text style={{ color: theme.text }}>Close scanner</Text>
        </Pressable>
      </SafeAreaView>
    );
  return <ScannerView scanner={scanner} />;
}
function ScannerView({ scanner }: { scanner: Scanner }) {
  const {
    cameraRef,
    draft,
    cameraMode,
    setCameraReady,
    busy,
    processingPage,
    torch,
    setTorch,
    pages,
    current,
    show_problem,
    show_page,
    add_page,
    rotate,
    move,
    remove_page,
    finish_scan,
    close,
  } = scanner;
  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {current ? (
        <Image source={{ uri: current.uri }} resizeMode="contain" style={StyleSheet.absoluteFill} />
      ) : (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          animateShutter={false}
          onCameraReady={() => setCameraReady(true)}
          onMountError={() => {
            setCameraReady(false);
            Alert.alert("Camera unavailable", "Check camera access in Settings and try again.");
          }}
        />
      )}
      <SafeAreaView style={s.overlay}>
        <View style={s.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close scanner"
            disabled={busy}
            onPress={() => void close()}
            style={s.roundButton}
          >
            <Ionicons name="close" size={25} color="#FFF" />
          </Pressable>
          <View
            accessible
            accessibilityLiveRegion="polite"
            accessibilityLabel={`${pages.length} pages in one document`}
            style={s.counter}
          >
            <Text style={s.counterText}>
              {pages.length
                ? `${pages.length} ${pages.length === 1 ? "page" : "pages"} · 1 document`
                : "Scan document"}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={torch ? "Turn flash off" : "Turn flash on"}
            disabled={busy || !cameraMode}
            onPress={() => setTorch((value) => !value)}
            style={s.roundButton}
          >
            <Ionicons name={torch ? "flash" : "flash-outline"} size={23} color="#FFF" />
          </Pressable>
        </View>
        {current ? (
          <ScanPageReview
            draft={draft.draft}
            selected={current.id}
            busy={busy}
            progress={processingPage ? `Reading page ${processingPage} of ${pages.length}` : null}
            onTitle={(title) => void draft.commit({ ...draft.latest.current, title }).catch(show_problem)}
            onSelect={show_page}
            onAdd={() => add_page()}
            onRetake={() => add_page(current.id)}
            onRotate={() => void rotate()}
            onMove={(direction) => void move(direction)}
            onRemove={remove_page}
            onFinish={() => void finish_scan()}
          />
        ) : (
          <ScannerCapture scanner={scanner} />
        )}
        <ScannerFooter scanner={scanner} />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function ScannerCapture({ scanner }: { scanner: Scanner }) {
  const { pages, retakeId, busy, cameraReady, show_page, capture } = scanner;
  return (
    <View style={{ flex: 1, justifyContent: "space-between" }}>
      <View pointerEvents="none" style={s.guideWrap}>
        <View style={s.guide}>
          <View style={[s.corner, s.topLeft]} />
          <View style={[s.corner, s.topRight]} />
          <View style={[s.corner, s.bottomLeft]} />
          <View style={[s.corner, s.bottomRight]} />
        </View>
        <Text style={s.hint}>
          {retakeId
            ? "Retake this page. Your other pages are kept."
            : "Photograph each sheet. Finish them as one document."}
        </Text>
      </View>
      <View style={s.captureBar}>
        {pages.length ? (
          <ScanAction label="Review pages" onPress={() => show_page(pages.at(-1)!.id)} disabled={busy} />
        ) : (
          <View style={s.sideSlot} />
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Take photo"
          accessibilityState={{ disabled: busy || !cameraReady }}
          disabled={busy || !cameraReady}
          onPress={() => void capture()}
          style={s.shutterOuter}
        >
          <View style={[s.shutterInner, { opacity: busy || !cameraReady ? 0.5 : 1 }]} />
        </Pressable>
        <View style={s.sideSlot} />
      </View>
    </View>
  );
}
function ScannerFooter({ scanner }: { scanner: Scanner }) {
  const { draft, pages, busy, discard } = scanner;
  return (
    <View style={{ backgroundColor: "#111827", padding: 10, gap: 8 }}>
      <Text
        accessibilityLiveRegion="polite"
        accessibilityRole={draft.error ? "alert" : "text"}
        style={{ color: "#FFF", textAlign: "center" }}
      >
        {draft.error ||
          (Platform.OS === "web"
            ? "Keep this tab open. Photos aren't retained after a reload."
            : "Scan draft kept on this device until finished or discarded.")}
      </Text>
      {pages.length > 0 && !busy ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Discard scan"
          onPress={discard}
          style={{ minHeight: 48, justifyContent: "center" }}
        >
          <Text style={{ color: "#FFF", textAlign: "center" }}>Discard scan</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
