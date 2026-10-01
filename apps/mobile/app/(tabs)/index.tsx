import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen, ScrollFadeItem } from "../../src/components/Screen";
import { radii, typography } from "../../src/design/tokens";
import { mostRecentIncomplete } from "../../src/documents/insights";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import { useVoticTheme } from "../../src/theme/ThemeProvider";
import { useDocumentTransition } from "../../src/navigation/DocumentTransitionProvider";
import { DocumentTypeIcon } from "../../src/components/DocumentTypeIcon";
import { useWalkthroughTarget, useWalkthroughTrigger } from "../../src/walkthrough/WalkthroughProvider";

export default function Home() {
  const { theme } = useVoticTheme();
  const { documents, collections, openDocument, setDocumentCollection, removeDocument } =
    useDocumentLibrary();
  const transition = useDocumentTransition();
  const cardRefs = useRef<Record<string, View | null>>({});
  const [menuId, setMenuId] = useState<string | null>(null);
  const recent = mostRecentIncomplete(documents);
  const visible = [...documents]
    .sort((a, b) => (b.lastOpenedAt || b.updatedAt) - (a.lastOpenedAt || a.updatedAt))
    .slice(0, 3);
  const menuDocument = documents.find((document) => document.id === menuId);
  const continueTarget = useWalkthroughTarget("home.continue");
  const recentTarget = useWalkthroughTarget("home.recent");
  const optionsTarget = useWalkthroughTarget("home.documentOptions");
  useWalkthroughTrigger(
    [{ id: "intro" }, { id: "home" }, { id: "home.documentOptions", when: visible.length > 0 }],
    {
      hasDocuments: documents.length > 0,
      hasContinue: Boolean(recent),
    },
  );
  function open(id: string, sourceKey = id) {
    if (transition.transitioning) return;
    const source = cardRefs.current[sourceKey];
    // Without a visible card to animate from, open the Reader directly rather than doing nothing.
    if (!source) {
      openDocument(id);
      router.push("/reader");
      return;
    }
    source.measureInWindow((x, y, width, height) => {
      openDocument(id);
      transition.openReader({ x, y, width, height }, () => router.push("/reader"));
    });
  }
  function remove() {
    if (!menuDocument) return;
    const selected = menuDocument;
    setMenuId(null);
    Alert.alert("Delete document?", `Remove ${selected.title} from Votic? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => removeDocument(selected.id) },
    ]);
  }
  return (
    <Screen title="Home" hideTitle>
      {recent ? (
        <>
          <SectionHeader title="Continue Reading" />
          <ScrollFadeItem>
            <Pressable
              ref={(node) => {
                cardRefs.current["recent:" + recent.id] = node;
                continueTarget(node);
              }}
              collapsable={false}
              onPress={() => open(recent.id, "recent:" + recent.id)}
              style={({ pressed }) => [
                s.continueCard,
                { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.82 : 1 },
              ]}
            >
              <DocumentTypeIcon sourceName={recent.sourceName} />
              <View style={s.flex}>
                <Text numberOfLines={1} style={[s.docTitle, { color: theme.text }]}>
                  {recent.title}
                </Text>
                <Text style={[s.meta, { color: theme.mutedText }]}>
                  Passage {recent.sentenceIndex + 1} · {Math.round(recent.progress * 100)}% read
                </Text>
                <View style={[s.track, { backgroundColor: theme.border }]}>
                  <View
                    style={[
                      s.progress,
                      { backgroundColor: theme.accent, width: `${recent.progress * 100}%` as `${number}%` },
                    ]}
                  />
                </View>
              </View>
              <View style={[s.play, { backgroundColor: theme.accent }]}>
                <Ionicons name="play" size={20} color="#FFF" />
              </View>
            </Pressable>
          </ScrollFadeItem>
        </>
      ) : null}
      <SectionHeader title="Recent Documents" onPress={() => router.push("/documents")} />
      <View
        ref={recentTarget}
        collapsable={false}
        style={[s.documentList, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        {visible.length ? (
          visible.map((doc, i) => (
            <ScrollFadeItem key={doc.id}>
              <View
                ref={(node) => {
                  cardRefs.current[doc.id] = node;
                }}
                collapsable={false}
                style={[
                  s.documentRow,
                  i < visible.length - 1 && { borderBottomColor: theme.border, borderBottomWidth: 1 },
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${doc.title}`}
                  onPress={() => open(doc.id)}
                  style={({ pressed }) => [
                    s.documentMain,
                    {
                      opacity: pressed ? 0.82 : 1,
                      backgroundColor: pressed ? theme.surfaceMuted : "transparent",
                    },
                  ]}
                >
                  <DocumentTypeIcon sourceName={doc.sourceName} />
                  <View style={s.flex}>
                    <Text numberOfLines={1} style={[s.docTitle, { color: theme.text }]}>
                      {doc.title}
                    </Text>
                    <Text style={[s.meta, { color: theme.mutedText }]}>
                      {doc.progress ? `${Math.round(doc.progress * 100)}% read` : "Ready to read"}
                    </Text>
                  </View>
                </Pressable>
                <Pressable
                  ref={i === 0 ? optionsTarget : undefined}
                  accessibilityRole="button"
                  accessibilityLabel={`More options for ${doc.title}`}
                  onPress={() => setMenuId(doc.id)}
                  style={s.moreButton}
                >
                  <Ionicons name="ellipsis-horizontal" size={21} color={theme.mutedText} />
                </Pressable>
              </View>
            </ScrollFadeItem>
          ))
        ) : (
          <Text style={[s.noDocs, { color: theme.mutedText }]}>Your recent documents will appear here.</Text>
        )}
      </View>
      <Modal
        visible={menuId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuId(null)}
      >
        <Pressable onPress={() => setMenuId(null)} style={s.backdrop}>
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[s.menu, { backgroundColor: theme.surface }]}
          >
            <View style={s.menuHeader}>
              <View style={s.flex}>
                <Text style={[s.menuTitle, { color: theme.text }]}>Document options</Text>
                <Text numberOfLines={1} style={[s.menuSubtitle, { color: theme.mutedText }]}>
                  {menuDocument?.title}
                </Text>
              </View>
              <Pressable onPress={() => setMenuId(null)} style={s.close}>
                <Ionicons name="close" size={22} color={theme.text} />
              </Pressable>
            </View>
            <MenuAction
              icon="book-outline"
              label="Open in Reader"
              onPress={() => {
                if (menuId) open(menuId);
                setMenuId(null);
              }}
            />
            <Text style={[s.moveLabel, { color: theme.mutedText }]}>MOVE TO</Text>
            <MenuAction
              icon="folder-outline"
              label="Unfiled"
              selected={!menuDocument?.collection}
              onPress={() => {
                if (menuId) setDocumentCollection(menuId);
                setMenuId(null);
              }}
            />
            {collections.map((collection) => (
              <MenuAction
                key={collection}
                icon="folder-outline"
                label={collection}
                selected={menuDocument?.collection === collection}
                onPress={() => {
                  if (menuId) setDocumentCollection(menuId, collection);
                  setMenuId(null);
                }}
              />
            ))}
            <MenuAction icon="trash-outline" label="Delete document" destructive onPress={remove} />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}
function SectionHeader({ title, onPress }: { title: string; onPress?: () => void }) {
  const { theme } = useVoticTheme();
  return (
    <View style={s.sectionHeader}>
      <Text style={[s.sectionTitle, { color: theme.text }]}>{title}</Text>
      {onPress ? (
        <Pressable onPress={onPress}>
          <Text style={[s.action, { color: theme.accent }]}>See All</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
function MenuAction({
  icon,
  label,
  onPress,
  selected = false,
  destructive = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  selected?: boolean;
  destructive?: boolean;
}) {
  const { theme } = useVoticTheme();
  const color = destructive ? "#DC2626" : theme.text;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.menuAction,
        { backgroundColor: pressed ? theme.surfaceMuted : "transparent" },
      ]}
    >
      <Ionicons name={icon} size={21} color={color} />
      <Text style={[s.menuActionText, { color }]}>{label}</Text>
      {selected ? <Ionicons name="checkmark" size={20} color={theme.accent} /> : null}
    </Pressable>
  );
}
const s = StyleSheet.create({
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  sectionTitle: { ...typography.sectionTitle, fontSize: 18 },
  action: { fontSize: 13, fontWeight: "800" },
  continueCard: {
    minHeight: 82,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  docIcon: { width: 46, height: 46, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
  docTitle: { fontSize: 14, fontWeight: "800" },
  meta: { fontSize: 12, marginTop: 4 },
  track: { height: 4, borderRadius: 2, overflow: "hidden", marginTop: 8 },
  progress: { height: "100%" },
  play: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  documentList: { borderWidth: 1, borderRadius: radii.md, overflow: "hidden" },
  documentRow: { minHeight: 70, flexDirection: "row", alignItems: "stretch" },
  documentMain: { flex: 1, padding: 10, flexDirection: "row", alignItems: "center", gap: 12 },
  moreButton: { width: 52, alignItems: "center", justifyContent: "center" },
  noDocs: { padding: 20, textAlign: "center", fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,.38)", justifyContent: "center", padding: 24 },
  menu: { borderRadius: 20, padding: 16, gap: 2 },
  menuHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  menuTitle: { fontSize: 20, fontWeight: "800" },
  menuSubtitle: { fontSize: 13, marginTop: 2 },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  moveLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.7, marginTop: 10, marginBottom: 2 },
  menuAction: {
    minHeight: 50,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuActionText: { fontSize: 15, fontWeight: "700", flex: 1 },
});
