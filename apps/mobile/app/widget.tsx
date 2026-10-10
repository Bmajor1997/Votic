import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useDocumentLibrary } from "../src/documents/DocumentLibraryProvider";
import { useVoticTheme } from "../src/theme/ThemeProvider";
import { widgetLinkTarget } from "../src/widgets/widgetLinks";

/**
 * Opened by a tap on a home-screen widget (votic://widget?...). Puts Home underneath, then shows what the
 * widget pointed at, so Back always returns to Home.
 */
export default function WidgetLink() {
  const { theme } = useVoticTheme();
  const params = useLocalSearchParams<{ open?: string; id?: string }>();
  const { documents, loaded, openDocument } = useDocumentLibrary();
  const handled = useRef(false);

  useEffect(() => {
    if (!loaded || handled.current) return;
    handled.current = true;
    const target = widgetLinkTarget(params, documents);
    router.replace("/");
    if (target.kind === "document") {
      openDocument(target.id);
      // Listen opens with narration controls and starts playing; Read opens without audio controls.
      router.push({
        pathname: "/reader",
        params: target.mode === "listen" ? { mode: "listen", autoplay: "1" } : { mode: "read" },
      });
    } else if (target.kind === "statistics") router.push("/statistics");
    else if (target.kind === "documents") router.push("/documents");
  }, [loaded, documents, params, openDocument]);

  return (
    <View
      accessible
      accessibilityLabel="Opening Votic"
      style={[s.container, { backgroundColor: theme.background }]}
    >
      <ActivityIndicator color={theme.accentText} />
    </View>
  );
}

const s = StyleSheet.create({ container: { flex: 1, alignItems: "center", justifyContent: "center" } });
