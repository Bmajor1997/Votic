import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { extractDocument } from "../../src/api/voticApi";
import { Screen, ScrollFadeItem } from "../../src/components/Screen";
import { controlSizes, radii, spacing, typography } from "../../src/design/tokens";
import {
  canReadLocally,
  cleanLocalDocumentText,
  validateImport,
  validateLoadedBytes,
} from "../../src/documents/importDocument";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import { useVoticTheme } from "../../src/theme/ThemeProvider";
import { useDocumentTransition } from "../../src/navigation/DocumentTransitionProvider";
import { DocumentsEmptyAnimation } from "../../src/components/EmptyStateIllustrations";
import { DocumentTypeIcon } from "../../src/components/DocumentTypeIcon";
import {
  useWalkthrough,
  useWalkthroughTarget,
  useWalkthroughTrigger,
} from "../../src/walkthrough/WalkthroughProvider";

export default function Documents() {
  const { theme } = useVoticTheme();
  const transition = useDocumentTransition();
  const cardRefs = useRef<Record<string, View | null>>({});
  const uploadRef = useRef<View>(null);
  const { documents, collections, addTextDocument, openDocument, addCollection, setDocumentCollection } =
    useDocumentLibrary();
  const [importing, setImporting] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [collectionName, setCollectionName] = useState("");
  const scoped =
    filter === "all"
      ? documents
      : filter === "unfiled"
        ? documents.filter((document) => !document.collection)
        : documents.filter((document) => document.collection === filter);
  const filtered = scoped.filter((document) =>
    document.title.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const saved = useMemo(
    () =>
      documents
        .flatMap((document) => (document.savedPassages || []).map((passage) => ({ document, passage })))
        .sort((a, b) => b.passage.updatedAt - a.passage.updatedAt),
    [documents],
  );
  const assigningDocument = documents.find((document) => document.id === assigningId);
  const walkthrough = useWalkthrough();
  const uploadTarget = useWalkthroughTarget("documents.upload");
  const searchTarget = useWalkthroughTarget("documents.search");
  const newCollectionTarget = useWalkthroughTarget("documents.newCollection");
  const folderTarget = useWalkthroughTarget("documents.folderButton");
  const filtersTarget = useWalkthroughTarget("documents.filters");
  useWalkthroughTrigger([{ id: "documents" }, { id: "documents.collections", when: documents.length > 0 }], {
    hasDocuments: documents.length > 0,
  });

  async function addDocument() {
    walkthrough.pressed("documents.upload");
    setImporting(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "text/plain",
          "text/markdown",
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "application/vnd.ms-powerpoint",
          "application/epub+zip",
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      validateImport({ name: asset.name, size: asset.size, uri: asset.uri, mimeType: asset.mimeType });
      const response = await fetch(asset.uri);
      if (!response.ok)
        throw new Error("Votic could not access this file. Please choose it again from your device.");
      const bytes = await response.arrayBuffer();
      validateLoadedBytes(bytes.byteLength);
      let text: string;
      if (canReadLocally(asset.name)) text = cleanLocalDocumentText(new TextDecoder().decode(bytes));
      else text = await extractDocument(asset.name, bytes);
      if (!text.trim()) throw new Error("This document does not contain readable text.");
      addTextDocument(asset.name, text);
      uploadRef.current?.measureInWindow((x, y, width, height) =>
        transition.openReader({ x, y, width, height }, () => router.push("/reader")),
      );
    } catch (error) {
      Alert.alert(
        "Could not import document",
        error instanceof Error ? error.message : "Votic could not read this document.",
      );
    } finally {
      setImporting(false);
    }
  }
  function open(id: string, sentenceIndex?: number, sourceKey = id) {
    const source = cardRefs.current[sourceKey];
    if (!source || transition.transitioning) return;
    source.measureInWindow((x, y, width, height) => {
      openDocument(id, sentenceIndex);
      transition.openReader({ x, y, width, height }, () => router.push("/reader"));
    });
  }
  function createCollection() {
    const clean = collectionName.trim();
    if (!clean) return;
    addCollection(clean);
    setFilter(clean);
    setCollectionName("");
    setCreateOpen(false);
  }
  function assign(collection?: string) {
    if (!assigningId) return;
    setDocumentCollection(assigningId, collection);
    setAssigningId(null);
  }

  const uploadButton = (
    <Pressable
      ref={(node) => {
        uploadRef.current = node;
        uploadTarget(node);
      }}
      collapsable={false}
      accessibilityRole="button"
      accessibilityLabel="Upload document"
      disabled={importing}
      onPress={addDocument}
      style={({ pressed }) => [
        s.headerUpload,
        { backgroundColor: theme.accent, opacity: importing ? 0.6 : pressed ? 0.78 : 1 },
      ]}
    >
      {importing ? <ActivityIndicator color="#FFF" /> : <Ionicons name="add" size={20} color="#FFF" />}
      <Text style={s.headerUploadText}>Upload</Text>
    </Pressable>
  );

  return (
    <Screen title="Documents" titleAction={uploadButton}>
      <View
        ref={searchTarget}
        collapsable={false}
        style={[s.search, { backgroundColor: theme.surfaceMuted }]}
      >
        <Ionicons name="search" size={19} color={theme.mutedText} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search documents..."
          placeholderTextColor={theme.mutedText}
          style={[s.searchInput, { color: theme.text }]}
        />
        {query ? (
          <Pressable onPress={() => setQuery("")}>
            <Ionicons name="close-circle" size={19} color={theme.mutedText} />
          </Pressable>
        ) : null}
      </View>

      {documents.length ? (
        <>
          <View style={s.sectionHeader}>
            <Text style={[s.sectionTitle, { color: theme.text }]}>Library</Text>
            <Pressable
              ref={newCollectionTarget}
              accessibilityRole="button"
              accessibilityLabel="Create collection"
              onPress={() => setCreateOpen(true)}
              style={s.headerButton}
            >
              <Ionicons name="folder-open-outline" size={18} color={theme.accent} />
              <Text style={[s.headerButtonText, { color: theme.accent }]}>New collection</Text>
            </Pressable>
          </View>
          <ScrollView
            ref={filtersTarget}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.filters}
          >
            <Filter label="All" value="all" current={filter} onPress={setFilter} />
            <Filter label="Unfiled" value="unfiled" current={filter} onPress={setFilter} />
            {collections.map((collection) => (
              <Filter
                key={collection}
                label={collection}
                value={collection}
                current={filter}
                onPress={setFilter}
              />
            ))}
          </ScrollView>
          {filtered.length ? (
            <View style={s.list}>
              {filtered.map((doc, docIndex) => (
                <ScrollFadeItem key={doc.id}>
                  <View
                    ref={(node) => {
                      cardRefs.current[doc.id] = node;
                    }}
                    collapsable={false}
                    style={[s.documentRow, { borderBottomColor: theme.border }]}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={"Open " + doc.title}
                      accessibilityHint={doc.progress ? "Resume reading" : "Open in Votic reader"}
                      onPress={() => open(doc.id)}
                      style={({ pressed }) => [
                        s.documentMain,
                        {
                          backgroundColor: pressed ? theme.surfaceMuted : "transparent",
                          opacity: pressed ? 0.82 : 1,
                        },
                      ]}
                    >
                      <DocumentTypeIcon sourceName={doc.sourceName} />
                      <View style={s.documentText}>
                        <Text
                          numberOfLines={1}
                          maxFontSizeMultiplier={1.25}
                          style={[s.documentTitle, { color: theme.text }]}
                        >
                          {doc.title}
                        </Text>
                        <Text
                          numberOfLines={1}
                          maxFontSizeMultiplier={1.2}
                          style={[s.meta, { color: theme.mutedText }]}
                        >
                          {doc.progress ? Math.round(doc.progress * 100) + "% complete" : "Ready to read"} ·{" "}
                          {doc.collection || "Unfiled"}
                        </Text>
                        <View
                          accessibilityRole="progressbar"
                          accessibilityValue={{ min: 0, max: 100, now: Math.round(doc.progress * 100) }}
                          style={[s.track, { backgroundColor: theme.border }]}
                        >
                          <View
                            style={[
                              s.fill,
                              {
                                backgroundColor: theme.accent,
                                width: `${doc.progress * 100}%` as `${number}%`,
                              },
                            ]}
                          />
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={theme.mutedText} />
                    </Pressable>
                    <Pressable
                      ref={docIndex === 0 ? folderTarget : undefined}
                      accessibilityRole="button"
                      accessibilityLabel={"Choose a collection for " + doc.title}
                      onPress={() => setAssigningId(doc.id)}
                      style={({ pressed }) => [
                        s.folderButton,
                        { backgroundColor: pressed ? theme.surfaceMuted : "transparent" },
                      ]}
                    >
                      <Ionicons
                        name={doc.collection ? "folder" : "folder-outline"}
                        size={21}
                        color={doc.collection ? theme.accent : theme.mutedText}
                      />
                    </Pressable>
                  </View>
                </ScrollFadeItem>
              ))}
            </View>
          ) : (
            <View style={s.filteredEmpty}>
              <Text style={[s.body, { color: theme.mutedText }]}>
                No documents are in this collection yet.
              </Text>
            </View>
          )}
        </>
      ) : (
        <View style={s.empty}>
          <DocumentsEmptyAnimation />
          <Text style={[s.h, { color: theme.text }]}>No documents yet</Text>
          <Text style={[s.body, { color: theme.mutedText }]}>
            Add a PDF, Word, PowerPoint, EPUB, TXT, or Markdown document to begin reading and listening.
          </Text>
        </View>
      )}

      {saved.length ? (
        <View style={s.savedSection}>
          <Text style={[s.sectionTitle, { color: theme.text }]}>Saved passages</Text>
          <Text style={[s.sectionCopy, { color: theme.mutedText }]}>
            Bookmarks and notes you want to revisit.
          </Text>
          {saved.map(({ document, passage }) => {
            const sourceKey = "saved:" + document.id + passage.id;
            return (
              <ScrollFadeItem key={document.id + passage.id}>
                <Pressable
                  ref={(node) => {
                    cardRefs.current[sourceKey] = node;
                  }}
                  collapsable={false}
                  accessibilityRole="button"
                  accessibilityLabel={"Open saved passage from " + document.title}
                  onPress={() => open(document.id, passage.sentenceIndex, sourceKey)}
                  style={({ pressed }) => [
                    s.savedCard,
                    {
                      borderColor: theme.border,
                      backgroundColor: pressed ? theme.surfaceMuted : theme.surface,
                    },
                  ]}
                >
                  <View style={s.savedTop}>
                    <Ionicons name="bookmark" size={18} color={theme.accent} />
                    <Text numberOfLines={1} style={[s.savedDocument, { color: theme.mutedText }]}>
                      {document.title}
                    </Text>
                  </View>
                  <Text numberOfLines={3} style={[s.savedText, { color: theme.text }]}>
                    {passage.text}
                  </Text>
                  {passage.note ? (
                    <Text numberOfLines={2} style={[s.savedNote, { color: theme.mutedText }]}>
                      {passage.note}
                    </Text>
                  ) : null}
                </Pressable>
              </ScrollFadeItem>
            );
          })}
        </View>
      ) : null}

      <Modal
        visible={assigningId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setAssigningId(null)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close collection choices"
          onPress={() => setAssigningId(null)}
          style={s.backdrop}
        >
          <Pressable
            accessibilityRole="none"
            onPress={(event) => event.stopPropagation()}
            style={[s.modalCard, { backgroundColor: theme.surface }]}
          >
            <View style={s.modalHeader}>
              <View>
                <Text accessibilityRole="header" style={[s.modalTitle, { color: theme.text }]}>
                  Choose collection
                </Text>
                <Text numberOfLines={1} style={[s.modalSubtitle, { color: theme.mutedText }]}>
                  {assigningDocument?.title}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close collection choices"
                onPress={() => setAssigningId(null)}
                style={s.modalClose}
              >
                <Ionicons name="close" size={23} color={theme.text} />
              </Pressable>
            </View>
            <CollectionChoice
              label="Unfiled"
              selected={!assigningDocument?.collection}
              onPress={() => assign()}
            />
            {collections.map((collection) => (
              <CollectionChoice
                key={collection}
                label={collection}
                selected={assigningDocument?.collection === collection}
                onPress={() => assign(collection)}
              />
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create new collection"
              onPress={() => {
                setAssigningId(null);
                setCreateOpen(true);
              }}
              style={[s.newFromModal, { borderColor: theme.border }]}
            >
              <Ionicons name="add" size={20} color={theme.accent} />
              <Text style={[s.headerButtonText, { color: theme.accent }]}>Create collection</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={createOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateOpen(false)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close new collection"
          onPress={() => setCreateOpen(false)}
          style={s.backdrop}
        >
          <Pressable
            accessibilityRole="none"
            onPress={(event) => event.stopPropagation()}
            style={[s.modalCard, { backgroundColor: theme.surface }]}
          >
            <View style={s.modalHeader}>
              <Text accessibilityRole="header" style={[s.modalTitle, { color: theme.text }]}>
                New collection
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close new collection"
                onPress={() => setCreateOpen(false)}
                style={s.modalClose}
              >
                <Ionicons name="close" size={23} color={theme.text} />
              </Pressable>
            </View>
            <TextInput
              autoFocus
              accessibilityLabel="Collection name"
              value={collectionName}
              onChangeText={setCollectionName}
              placeholder="School, work, personal…"
              placeholderTextColor={theme.mutedText}
              maxLength={40}
              returnKeyType="done"
              onSubmitEditing={createCollection}
              style={[
                s.collectionInput,
                { borderColor: theme.border, color: theme.text, backgroundColor: theme.background },
              ]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save collection"
              disabled={!collectionName.trim()}
              onPress={createCollection}
              style={[
                s.modalSave,
                { backgroundColor: theme.accent, opacity: collectionName.trim() ? 1 : 0.4 },
              ]}
            >
              <Text style={s.addText}>Create collection</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function Filter({
  label,
  value,
  current,
  onPress,
}: {
  label: string;
  value: string;
  current: string;
  onPress: (value: string) => void;
}) {
  const { theme } = useVoticTheme();
  const active = value === current;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      onPress={() => onPress(value)}
      style={[
        s.filter,
        {
          borderColor: active ? theme.accent : theme.border,
          backgroundColor: active ? theme.sentenceHighlight : theme.surface,
        },
      ]}
    >
      <Text style={[s.filterText, { color: active ? theme.accent : theme.text }]}>{label}</Text>
    </Pressable>
  );
}
function CollectionChoice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { theme } = useVoticTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[s.collectionChoice, { borderBottomColor: theme.border }]}
    >
      <Ionicons
        name={selected ? "radio-button-on" : "radio-button-off"}
        size={21}
        color={selected ? theme.accent : theme.mutedText}
      />
      <Text style={[s.choiceLabel, { color: theme.text }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  addText: { color: "#FFF", ...typography.control },
  headerUpload: {
    minHeight: 42,
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
  },
  headerUploadText: { color: "#FFF", fontSize: 14, fontWeight: "800" },
  search: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: { flex: 1, minHeight: 46, fontSize: 14 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  sectionTitle: { ...typography.sectionTitle },
  sectionCopy: { fontSize: 14 },
  headerButton: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.xs },
  headerButtonText: { fontSize: 14, fontWeight: "700" },
  filters: { gap: spacing.sm, paddingRight: spacing.lg },
  filter: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  filterText: { fontSize: 14, fontWeight: "700" },
  empty: { alignItems: "center", paddingVertical: spacing.lg, gap: spacing.sm },
  emptyImage: { width: 220, height: 200 },
  filteredEmpty: { paddingVertical: spacing.xl },
  h: { ...typography.sectionTitle },
  body: { ...typography.body, textAlign: "center" },
  documentTitle: { fontSize: 14, fontWeight: "800" },
  meta: { fontSize: 12 },
  list: { marginTop: -spacing.xs },
  documentRow: { borderBottomWidth: 1, flexDirection: "row", alignItems: "stretch" },
  documentMain: {
    minHeight: 72,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.xs,
  },
  documentText: { flex: 1, gap: spacing.xs },
  folderButton: { width: controlSizes.minimumTouch, alignItems: "center", justifyContent: "center" },
  track: { height: 3, borderRadius: 2, overflow: "hidden" },
  fill: { height: "100%" },
  savedSection: { gap: spacing.md, marginTop: spacing.lg },
  savedCard: { borderWidth: 1, borderRadius: radii.md, padding: spacing.md, gap: spacing.sm },
  savedTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  savedDocument: { flex: 1, fontSize: 13, fontWeight: "700" },
  savedText: { fontSize: 16, lineHeight: 23 },
  savedNote: { fontSize: 14, lineHeight: 20, fontStyle: "italic" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,.38)", justifyContent: "center", padding: spacing.xl },
  modalCard: { borderRadius: radii.lg, padding: spacing.lg, gap: spacing.sm },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  modalTitle: { ...typography.sheetTitle },
  modalSubtitle: { fontSize: 13, maxWidth: 270, marginTop: 2 },
  modalClose: {
    width: controlSizes.minimumTouch,
    height: controlSizes.minimumTouch,
    alignItems: "center",
    justifyContent: "center",
  },
  collectionChoice: {
    minHeight: 52,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  choiceLabel: { fontSize: 16, fontWeight: "600" },
  newFromModal: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: radii.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  collectionInput: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
  modalSave: {
    minHeight: 50,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
});
