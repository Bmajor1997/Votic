import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { DocumentCover } from "../../src/components/DocumentCover";
import { DocumentsEmptyAnimation } from "../../src/components/EmptyStateIllustrations";
import { Screen, ScrollFadeItem } from "../../src/components/Screen";
import { controlSizes, radii, spacing, typography } from "../../src/design/tokens";
import { DocumentActionsSheet } from "../../src/documents/DocumentActionsSheet";
import {
  SORTS,
  Sort,
  fileTypeLabel,
  progressLabel,
  readableTitle,
  sortDocuments,
} from "../../src/documents/documentDisplay";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import { VoticDocument } from "../../src/documents/types";
import { useDocumentImport } from "../../src/documents/useDocumentImport";
import { useDocumentTransition } from "../../src/navigation/DocumentTransitionProvider";
import { sheetStyles } from "../../src/reader/components/sheetStyles";
import { useVoticTheme } from "../../src/theme/ThemeProvider";

export default function Documents() {
  const { theme } = useVoticTheme();
  const transition = useDocumentTransition();
  const cardRefs = useRef<Record<string, View | null>>({});
  const uploadRef = useRef<View>(null);
  const { documents, collections, loaded, openDocument, addCollection } = useDocumentLibrary();
  const { importing, processingName, failure, dismissFailure, importDocument } = useDocumentImport(
    uploadRef,
    {
      inlineErrors: true,
    },
  );
  const [query, setQuery] = useState("");
  const [collection, setCollection] = useState("all");
  const [sort, setSort] = useState<Sort>("recent");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [addDocumentOpen, setAddDocumentOpen] = useState(false);
  const [collectionName, setCollectionName] = useState("");
  const [menuDocument, setMenuDocument] = useState<VoticDocument | null>(null);

  const visible = useMemo(() => {
    const scoped =
      collection === "all"
        ? documents
        : collection === "unfiled"
          ? documents.filter((document) => !document.collection)
          : documents.filter((document) => document.collection === collection);
    const search = query.trim().toLowerCase();
    const matching = search
      ? scoped.filter(
          (document) =>
            readableTitle(document.title).toLowerCase().includes(search) ||
            document.sourceName.toLowerCase().includes(search),
        )
      : scoped;
    return sortDocuments(matching, sort);
  }, [documents, collection, query, sort]);
  const filterCount = (collection !== "all" ? 1 : 0) + (sort !== "recent" ? 1 : 0);
  const collectionLabel =
    collection === "all" ? "All documents" : collection === "unfiled" ? "Unfiled" : collection;

  function open(document: VoticDocument) {
    const source = cardRefs.current[document.id];
    if (transition.transitioning) return;
    openDocument(document.id);
    if (!source) {
      router.push("/reader");
      return;
    }
    source.measureInWindow((x, y, width, height) =>
      transition.openReader({ x, y, width, height }, () => router.push("/reader")),
    );
  }
  function createCollection() {
    const clean = collectionName.trim();
    if (!clean) return;
    addCollection(clean);
    setCollection(clean);
    setCollectionName("");
    setCreateOpen(false);
  }

  const actions = (
    <View style={s.titleActions}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="New collection"
        onPress={() => setCreateOpen(true)}
        style={({ pressed }) => [s.iconButton, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Ionicons name="folder-open-outline" size={22} color={theme.text} />
      </Pressable>
      <View ref={uploadRef} collapsable={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add document"
          accessibilityState={{ busy: importing }}
          disabled={importing}
          onPress={() => setAddDocumentOpen(true)}
          style={({ pressed }) => [s.upload, { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 }]}
        >
          {importing ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Ionicons name="add" size={20} color="#FFF" />
          )}
          <Text style={s.uploadText}>Add</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <Screen title="Documents" titleAction={actions}>
      {documents.length ? (
        <View style={[s.search, { backgroundColor: theme.surfaceMuted }]}>
          <Ionicons name="search" size={19} color={theme.mutedText} />
          <TextInput
            accessibilityLabel="Search documents"
            value={query}
            onChangeText={setQuery}
            placeholder="Search documents"
            placeholderTextColor={theme.mutedText}
            style={[s.searchInput, { color: theme.text }]}
          />
          {query ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setQuery("")}
              style={s.iconButton}
            >
              <Ionicons name="close-circle" size={20} color={theme.mutedText} />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={filterCount ? `Sort and filter, ${filterCount} active` : "Sort and filter"}
            onPress={() => setFiltersOpen(true)}
            style={[
              s.filterButton,
              {
                borderColor: filterCount ? theme.accent : theme.border,
                backgroundColor: filterCount ? theme.sentenceHighlight : theme.surface,
              },
            ]}
          >
            <Ionicons name="options-outline" size={20} color={filterCount ? theme.accent : theme.text} />
          </Pressable>
        </View>
      ) : null}

      {processingName ? (
        <View
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={`Processing ${processingName}`}
          style={[s.status, { borderColor: theme.border, backgroundColor: theme.surface }]}
        >
          <ActivityIndicator color={theme.accent} />
          <View style={s.grow}>
            <Text numberOfLines={2} style={[s.statusTitle, { color: theme.text }]}>
              Processing {processingName}
            </Text>
            <Text style={[s.statusCopy, { color: theme.mutedText }]}>
              Getting the text ready. This can take a moment.
            </Text>
          </View>
        </View>
      ) : null}
      {failure ? (
        <View
          accessibilityRole="alert"
          style={[s.status, { borderColor: "#DC2626", backgroundColor: theme.surface }]}
        >
          <Ionicons name="alert-circle" size={22} color="#DC2626" />
          <View style={s.grow}>
            <Text style={[s.statusTitle, { color: theme.text }]}>
              {failure.name ? `Couldn't add ${failure.name}` : "Couldn't add that document"}
            </Text>
            <Text style={[s.statusCopy, { color: theme.text }]}>{failure.message}</Text>
            <View style={s.statusActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose another file"
                onPress={() => void importDocument()}
                style={s.textButton}
              >
                <Text style={[s.textButtonLabel, { color: theme.accent }]}>Choose another file</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={dismissFailure} style={s.textButton}>
                <Text style={[s.textButtonLabel, { color: theme.mutedText }]}>Dismiss</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {!loaded ? (
        <View accessible accessibilityLabel="Loading your documents" style={s.loading}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : documents.length ? (
        <>
          <View style={s.summaryRow}>
            <Text style={[s.summary, { color: theme.mutedText }]}>
              {visible.length} {visible.length === 1 ? "document" : "documents"}
              {collection !== "all" ? ` in ${collectionLabel}` : ""} ·{" "}
              {SORTS.find((item) => item.value === sort)?.label}
            </Text>
            {filterCount ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Reset sort and filter"
                onPress={() => {
                  setCollection("all");
                  setSort("recent");
                }}
                style={s.textButton}
              >
                <Text style={[s.textButtonLabel, { color: theme.accent }]}>Reset</Text>
              </Pressable>
            ) : null}
          </View>
          {visible.length ? (
            <View>
              {visible.map((document) => {
                const title = readableTitle(document.title);
                const percent = Math.round(document.progress * 100);
                return (
                  <ScrollFadeItem key={document.id}>
                    <View
                      ref={(node) => {
                        cardRefs.current[document.id] = node;
                      }}
                      collapsable={false}
                      style={[s.row, { borderBottomColor: theme.border }]}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${title}`}
                        accessibilityHint={`${fileTypeLabel(document.sourceName)}. ${progressLabel(document)}`}
                        onPress={() => open(document)}
                        style={({ pressed }) => [s.rowMain, { opacity: pressed ? 0.7 : 1 }]}
                      >
                        <DocumentCover document={document} size="md" />
                        <View style={s.rowCopy}>
                          <Text numberOfLines={2} style={[s.rowTitle, { color: theme.text }]}>
                            {title}
                          </Text>
                          <Text style={[s.rowMeta, { color: theme.mutedText }]}>
                            {fileTypeLabel(document.sourceName)}
                            {document.collection ? ` · ${document.collection}` : ""}
                          </Text>
                          {document.progress >= 1 ? (
                            <View style={s.finished}>
                              <Ionicons name="checkmark-circle" size={15} color={theme.accent} />
                              <Text style={[s.rowMeta, { color: theme.mutedText }]}>Finished</Text>
                            </View>
                          ) : document.progress > 0 ? (
                            <View style={s.progressRow}>
                              <View style={[s.track, { backgroundColor: theme.border }]}>
                                <View
                                  style={[
                                    s.fill,
                                    { backgroundColor: theme.accent, width: `${Math.max(3, percent)}%` },
                                  ]}
                                />
                              </View>
                              <Text style={[s.percent, { color: theme.mutedText }]}>{percent}%</Text>
                            </View>
                          ) : (
                            <Text style={[s.rowMeta, { color: theme.mutedText }]}>Not started</Text>
                          )}
                        </View>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`More options for ${title}`}
                        onPress={() => setMenuDocument(document)}
                        style={s.more}
                      >
                        <Ionicons name="ellipsis-horizontal" size={21} color={theme.mutedText} />
                      </Pressable>
                    </View>
                  </ScrollFadeItem>
                );
              })}
            </View>
          ) : (
            <View style={s.noResults}>
              <Ionicons name="search-outline" size={30} color={theme.mutedText} />
              <Text style={[s.emptyTitle, { color: theme.text }]}>
                {query ? `No documents match “${query.trim()}”` : `Nothing in ${collectionLabel} yet`}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setQuery("");
                  setCollection("all");
                }}
                style={s.textButton}
              >
                <Text style={[s.textButtonLabel, { color: theme.accent }]}>Show all documents</Text>
              </Pressable>
            </View>
          )}
        </>
      ) : (
        <View style={s.empty}>
          <DocumentsEmptyAnimation />
          <Text accessibilityRole="header" style={[s.emptyTitle, { color: theme.text }]}>
            Add your first document
          </Text>
          <Text style={[s.emptyCopy, { color: theme.mutedText }]}>
            Add a file from your device or a connected cloud storage provider to read and listen.
          </Text>
        </View>
      )}

      <DocumentActionsSheet document={menuDocument} onClose={() => setMenuDocument(null)} onOpen={open} />

      <Modal
        visible={addDocumentOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAddDocumentOpen(false)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close add document"
          onPress={() => setAddDocumentOpen(false)}
          style={sheetStyles.modalBackdrop}
        >
          <Pressable
            accessibilityViewIsModal
            onPress={(event) => event.stopPropagation()}
            style={[sheetStyles.sheet, { backgroundColor: theme.surface }]}
          >
            <View style={[sheetStyles.handle, { backgroundColor: theme.border }]} />
            <View style={s.addDocumentContent}>
              <View style={s.addDocumentHeading}>
                <Text accessibilityRole="header" style={[sheetStyles.sheetTitle, { color: theme.text }]}>
                  Add a document
                </Text>
                <Text style={[s.addDocumentCopy, { color: theme.mutedText }]}>
                  Choose a file on this device or browse a connected cloud provider. You do not need to
                  download it first.
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose file or cloud storage"
                accessibilityHint="Opens your phone's file browser, including available cloud storage providers"
                disabled={importing}
                onPress={() => {
                  setAddDocumentOpen(false);
                  void importDocument();
                }}
                style={({ pressed }) => [
                  s.importChoice,
                  {
                    borderColor: theme.border,
                    backgroundColor: theme.surface,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <View style={[s.importChoiceIcon, { backgroundColor: theme.surfaceMuted }]}>
                  <Ionicons name="folder-open-outline" size={22} color={theme.accent} />
                </View>
                <View style={s.grow}>
                  <Text style={[s.importChoiceTitle, { color: theme.text }]}>Files or cloud storage</Text>
                  <Text style={[s.importChoiceCopy, { color: theme.mutedText }]}>
                    Browse Files, Google Drive, OneDrive, Dropbox, or other providers available on your phone.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.mutedText} />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Scan with camera"
                accessibilityHint="Opens the camera to scan one or more document pages"
                onPress={() => {
                  setAddDocumentOpen(false);
                  router.push("/scan");
                }}
                style={({ pressed }) => [
                  s.importChoice,
                  {
                    borderColor: theme.border,
                    backgroundColor: theme.surface,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <View style={[s.importChoiceIcon, { backgroundColor: theme.surfaceMuted }]}>
                  <Ionicons name="scan-outline" size={22} color={theme.accent} />
                </View>
                <View style={s.grow}>
                  <Text style={[s.importChoiceTitle, { color: theme.text }]}>Scan with camera</Text>
                  <Text style={[s.importChoiceCopy, { color: theme.mutedText }]}>
                    Capture one or more pages. Votic will read the text and turn the scan into a document.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.mutedText} />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Import webpage"
                accessibilityHint="Paste a public webpage link and turn it into a clean Votic document"
                onPress={() => {
                  setAddDocumentOpen(false);
                  router.push("/import-web");
                }}
                style={({ pressed }) => [
                  s.importChoice,
                  { borderColor: theme.border, backgroundColor: theme.surface, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <View style={[s.importChoiceIcon, { backgroundColor: theme.surfaceMuted }]}>
                  <Ionicons name="link-outline" size={22} color={theme.accent} />
                </View>
                <View style={s.grow}>
                  <Text style={[s.importChoiceTitle, { color: theme.text }]}>Webpage link</Text>
                  <Text style={[s.importChoiceCopy, { color: theme.mutedText }]}>
                    Paste a public article or webpage. Votic cleans away navigation and common page clutter.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.mutedText} />
              </Pressable>

              <View style={[s.comingSoon, { backgroundColor: theme.surfaceMuted }]}>
                <Ionicons name="phone-portrait-outline" size={18} color={theme.accent} />
                <Text style={[s.comingSoonText, { color: theme.mutedText }]}>
                  You can also share a supported document from another app directly to Votic.
                </Text>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={filtersOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFiltersOpen(false)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close sort and filter"
          onPress={() => setFiltersOpen(false)}
          style={sheetStyles.modalBackdrop}
        >
          <Pressable
            accessibilityViewIsModal
            onPress={(event) => event.stopPropagation()}
            style={[sheetStyles.sheet, s.filterSheet, { backgroundColor: theme.surface }]}
          >
            <View style={[sheetStyles.handle, { backgroundColor: theme.border }]} />
            <ScrollView contentContainerStyle={s.sheetContent}>
              <Text accessibilityRole="header" style={[sheetStyles.sheetTitle, { color: theme.text }]}>
                Sort and filter
              </Text>
              <Text style={[s.groupLabel, { color: theme.mutedText }]}>SORT BY</Text>
              <View accessibilityRole="radiogroup">
                {SORTS.map((item) => (
                  <Choice
                    key={item.value}
                    label={item.label}
                    selected={sort === item.value}
                    onPress={() => setSort(item.value)}
                  />
                ))}
              </View>
              <Text style={[s.groupLabel, { color: theme.mutedText }]}>COLLECTION</Text>
              <View accessibilityRole="radiogroup">
                <Choice
                  label="All documents"
                  selected={collection === "all"}
                  onPress={() => setCollection("all")}
                />
                <Choice
                  label="Unfiled"
                  selected={collection === "unfiled"}
                  onPress={() => setCollection("unfiled")}
                />
                {collections.map((name) => (
                  <Choice
                    key={name}
                    label={name}
                    selected={collection === name}
                    onPress={() => setCollection(name)}
                  />
                ))}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="New collection"
                onPress={() => {
                  setFiltersOpen(false);
                  setCreateOpen(true);
                }}
                style={[s.newCollection, { borderColor: theme.border }]}
              >
                <Ionicons name="add" size={20} color={theme.accent} />
                <Text style={[s.textButtonLabel, { color: theme.accent }]}>New collection</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setFiltersOpen(false)}
                style={[s.done, { backgroundColor: theme.accent }]}
              >
                <Text style={s.uploadText}>
                  Show {visible.length} {visible.length === 1 ? "document" : "documents"}
                </Text>
              </Pressable>
            </ScrollView>
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
              <Text accessibilityRole="header" style={[sheetStyles.sheetTitle, { color: theme.text }]}>
                New collection
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close new collection"
                onPress={() => setCreateOpen(false)}
                style={s.iconButton}
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
              accessibilityState={{ disabled: !collectionName.trim() }}
              disabled={!collectionName.trim()}
              onPress={createCollection}
              style={[s.done, { backgroundColor: collectionName.trim() ? theme.accent : theme.surfaceMuted }]}
            >
              <Text style={[s.uploadText, { color: collectionName.trim() ? "#FFF" : theme.mutedText }]}>
                Create collection
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { theme } = useVoticTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[s.choice, { borderBottomColor: theme.border }]}
    >
      <Ionicons
        name={selected ? "radio-button-on" : "radio-button-off"}
        size={22}
        color={selected ? theme.accent : theme.mutedText}
      />
      <Text style={[s.choiceText, { color: theme.text }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  titleActions: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  iconButton: {
    width: controlSizes.minimumTouch,
    height: controlSizes.minimumTouch,
    alignItems: "center",
    justifyContent: "center",
  },
  upload: {
    minHeight: 44,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  uploadText: { color: "#FFF", fontSize: 15, fontWeight: "800" },
  search: {
    minHeight: 50,
    borderRadius: radii.md,
    paddingLeft: spacing.md,
    paddingRight: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  searchInput: { flex: 1, minHeight: 48, fontSize: 16 },
  filterButton: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  status: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  grow: { flex: 1, minWidth: 0 },
  statusTitle: { fontSize: 15, fontWeight: "800" },
  statusCopy: { fontSize: 14, lineHeight: 20, marginTop: 2 },
  statusActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  textButton: { minHeight: controlSizes.minimumTouch, justifyContent: "center" },
  textButtonLabel: { fontSize: 15, fontWeight: "800" },
  loading: { paddingVertical: spacing.xxl, alignItems: "center" },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  summary: { fontSize: 14, flexShrink: 1 },
  row: { borderBottomWidth: 1, flexDirection: "row", alignItems: "center" },
  rowMain: {
    flex: 1,
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowCopy: { flex: 1, minWidth: 0, gap: 3 },
  rowTitle: { fontSize: 16, lineHeight: 21, fontWeight: "700" },
  rowMeta: { fontSize: 13 },
  finished: { flexDirection: "row", alignItems: "center", gap: 4 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 2 },
  track: { flex: 1, maxWidth: 140, height: 4, borderRadius: 2, overflow: "hidden" },
  fill: { height: "100%" },
  percent: { fontSize: 12, fontWeight: "600" },
  more: {
    width: controlSizes.minimumTouch,
    height: controlSizes.minimumTouch,
    alignItems: "center",
    justifyContent: "center",
  },
  noResults: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  empty: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg },
  emptyTitle: { ...typography.sectionTitle, textAlign: "center" },
  emptyCopy: { fontSize: 16, lineHeight: 23, textAlign: "center" },
  addDocumentContent: { gap: spacing.lg, paddingBottom: spacing.md },
  addDocumentHeading: { gap: spacing.xs },
  addDocumentCopy: { fontSize: 15, lineHeight: 21 },
  importChoice: {
    minHeight: 84,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  importChoiceIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  importChoiceTitle: { fontSize: 16, lineHeight: 21, fontWeight: "800" },
  importChoiceCopy: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  comingSoon: {
    borderRadius: radii.md,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  comingSoonText: { flex: 1, fontSize: 13, lineHeight: 18 },
  filterSheet: { maxHeight: "80%" },
  sheetContent: { gap: spacing.xs, paddingBottom: spacing.md },
  groupLabel: { ...typography.eyebrow, marginTop: spacing.md },
  choice: {
    minHeight: 50,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  choiceText: { fontSize: 16, flex: 1 },
  newCollection: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radii.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  done: {
    minHeight: 52,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,.38)", justifyContent: "center", padding: spacing.xl },
  modalCard: { borderRadius: radii.lg, padding: spacing.lg, gap: spacing.sm },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  collectionInput: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
});
