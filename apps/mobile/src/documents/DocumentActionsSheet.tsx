import { Ionicons } from "@expo/vector-icons";
import { ComponentProps, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { DocumentCover } from "../components/DocumentCover";
import { controlSizes, radii, spacing } from "../design/tokens";
import { sheetStyles } from "../reader/components/sheetStyles";
import { useVoticTheme } from "../theme/ThemeProvider";
import { fileTypeLabel, positionLabel, progressLabel, readableTitle } from "./documentDisplay";
import { useDocumentLibrary } from "./DocumentLibraryProvider";
import { VoticDocument } from "./types";

type View_ = "menu" | "rename" | "move" | "details";
type IconName = ComponentProps<typeof Ionicons>["name"];

/** Every secondary action for one document, in one place: open, rename, move, details, delete. */
export function DocumentActionsSheet({
  document,
  onClose,
  onOpen,
}: {
  document: VoticDocument | null;
  onClose: () => void;
  onOpen: (document: VoticDocument) => void;
}) {
  const { theme } = useVoticTheme();
  const { collections, renameDocument, setDocumentCollection, addCollection, removeDocument } =
    useDocumentLibrary();
  const [view, setView] = useState<View_>("menu");
  const [title, setTitle] = useState("");
  const [newCollection, setNewCollection] = useState("");

  function close() {
    setView("menu");
    setNewCollection("");
    onClose();
  }
  function confirmDelete(target: VoticDocument) {
    close();
    Alert.alert(
      "Delete document?",
      `Remove “${readableTitle(target.title)}” and its notes from Votic? This can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => removeDocument(target.id) },
      ],
    );
  }
  function move(collection?: string) {
    if (!document) return;
    setDocumentCollection(document.id, collection);
    close();
  }
  function createAndMove() {
    const clean = newCollection.trim();
    if (!clean || !document) return;
    addCollection(clean);
    move(clean);
  }

  const heading =
    view === "rename"
      ? "Rename"
      : view === "move"
        ? "Move to collection"
        : view === "details"
          ? "Details"
          : null;
  return (
    <Modal visible={document !== null} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close document options"
          onPress={close}
          style={sheetStyles.modalBackdrop}
        >
          <Pressable
            accessibilityViewIsModal
            onPress={(event) => event.stopPropagation()}
            style={[sheetStyles.sheet, s.sheet, { backgroundColor: theme.surface }]}
          >
            <View style={[sheetStyles.handle, { backgroundColor: theme.border }]} />
            {document ? (
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
                <View style={s.header}>
                  {view === "menu" ? (
                    <DocumentCover document={document} size="sm" />
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Back to document options"
                      onPress={() => setView("menu")}
                      style={s.iconButton}
                    >
                      <Ionicons name="chevron-back" size={24} color={theme.text} />
                    </Pressable>
                  )}
                  <View style={s.headerCopy}>
                    <Text accessibilityRole="header" style={[s.title, { color: theme.text }]}>
                      {heading ?? readableTitle(document.title)}
                    </Text>
                    {heading ? (
                      <Text numberOfLines={2} style={[s.subtitle, { color: theme.mutedText }]}>
                        {readableTitle(document.title)}
                      </Text>
                    ) : (
                      <Text style={[s.subtitle, { color: theme.mutedText }]}>{progressLabel(document)}</Text>
                    )}
                  </View>
                </View>

                {view === "menu" ? (
                  <View>
                    <Action
                      icon="book-outline"
                      label="Open"
                      onPress={() => {
                        close();
                        onOpen(document);
                      }}
                    />
                    <Action
                      icon="create-outline"
                      label="Rename"
                      onPress={() => {
                        setTitle(readableTitle(document.title));
                        setView("rename");
                      }}
                    />
                    <Action
                      icon="folder-outline"
                      label="Move to collection"
                      detail={document.collection || "Unfiled"}
                      onPress={() => setView("move")}
                    />
                    <Action
                      icon="information-circle-outline"
                      label="Details"
                      onPress={() => setView("details")}
                    />
                    <Action
                      icon="trash-outline"
                      label="Delete"
                      destructive
                      onPress={() => confirmDelete(document)}
                    />
                  </View>
                ) : null}

                {view === "rename" ? (
                  <View style={s.form}>
                    <TextInput
                      autoFocus
                      accessibilityLabel="Document title"
                      value={title}
                      onChangeText={setTitle}
                      maxLength={200}
                      returnKeyType="done"
                      onSubmitEditing={() => {
                        renameDocument(document.id, title);
                        close();
                      }}
                      style={[
                        s.input,
                        { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
                      ]}
                    />
                    <Text style={[s.hint, { color: theme.mutedText }]}>
                      The original file name, {document.sourceName}, stays in Details.
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ disabled: !title.trim() }}
                      disabled={!title.trim()}
                      onPress={() => {
                        renameDocument(document.id, title);
                        close();
                      }}
                      style={[
                        s.primary,
                        { backgroundColor: title.trim() ? theme.accent : theme.surfaceMuted },
                      ]}
                    >
                      <Text style={[s.primaryText, { color: title.trim() ? "#FFF" : theme.mutedText }]}>
                        Save title
                      </Text>
                    </Pressable>
                  </View>
                ) : null}

                {view === "move" ? (
                  <View accessibilityRole="radiogroup">
                    {[undefined, ...collections].map((collection) => {
                      const selected = (document.collection || undefined) === collection;
                      return (
                        <Pressable
                          key={collection ?? "unfiled"}
                          accessibilityRole="radio"
                          accessibilityLabel={collection ?? "Unfiled"}
                          accessibilityState={{ checked: selected }}
                          onPress={() => move(collection)}
                          style={[s.choice, { borderBottomColor: theme.border }]}
                        >
                          <Ionicons
                            name={selected ? "radio-button-on" : "radio-button-off"}
                            size={22}
                            color={selected ? theme.accent : theme.mutedText}
                          />
                          <Text style={[s.choiceText, { color: theme.text }]}>{collection ?? "Unfiled"}</Text>
                        </Pressable>
                      );
                    })}
                    <View style={s.newRow}>
                      <TextInput
                        accessibilityLabel="New collection name"
                        value={newCollection}
                        onChangeText={setNewCollection}
                        placeholder="New collection"
                        placeholderTextColor={theme.mutedText}
                        maxLength={40}
                        returnKeyType="done"
                        onSubmitEditing={createAndMove}
                        style={[
                          s.input,
                          s.newInput,
                          { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
                        ]}
                      />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Create collection and move document"
                        accessibilityState={{ disabled: !newCollection.trim() }}
                        disabled={!newCollection.trim()}
                        onPress={createAndMove}
                        style={[
                          s.addButton,
                          { borderColor: theme.border, opacity: newCollection.trim() ? 1 : 0.5 },
                        ]}
                      >
                        <Ionicons name="add" size={22} color={theme.accent} />
                      </Pressable>
                    </View>
                  </View>
                ) : null}

                {view === "details" ? (
                  <View style={s.details}>
                    <Detail label="File name" value={document.sourceName} />
                    <Detail label="Type" value={fileTypeLabel(document.sourceName)} />
                    <Detail label="Position" value={positionLabel(document)} />
                    <Detail label="Progress" value={progressLabel(document)} />
                    <Detail label="Added" value={new Date(document.importedAt).toLocaleDateString()} />
                    <Detail label="Collection" value={document.collection || "Unfiled"} />
                    <Detail
                      label="Length"
                      value={`${(document.plainText.match(/\S+/g)?.length ?? 0).toLocaleString()} words`}
                    />
                  </View>
                ) : null}
              </ScrollView>
            ) : null}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Action({
  icon,
  label,
  detail,
  destructive = false,
  onPress,
}: {
  icon: IconName;
  label: string;
  detail?: string;
  destructive?: boolean;
  onPress: () => void;
}) {
  const { theme } = useVoticTheme();
  const color = destructive ? "#DC2626" : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}, currently ${detail}` : label}
      onPress={onPress}
      style={({ pressed }) => [s.action, { backgroundColor: pressed ? theme.surfaceMuted : "transparent" }]}
    >
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[s.actionText, { color }]}>{label}</Text>
      {detail ? (
        <Text numberOfLines={1} style={[s.actionDetail, { color: theme.mutedText }]}>
          {detail}
        </Text>
      ) : null}
    </Pressable>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  const { theme } = useVoticTheme();
  return (
    <View accessible style={[s.detail, { borderBottomColor: theme.border }]}>
      <Text style={[s.detailLabel, { color: theme.mutedText }]}>{label}</Text>
      <Text selectable style={[s.detailValue, { color: theme.text }]}>
        {value}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  sheet: { maxHeight: "80%" },
  content: { gap: spacing.md, paddingBottom: spacing.md },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  headerCopy: { flex: 1, gap: 2 },
  title: { fontSize: 19, fontWeight: "800", lineHeight: 24 },
  subtitle: { fontSize: 14, lineHeight: 19 },
  iconButton: {
    width: controlSizes.minimumTouch,
    height: controlSizes.minimumTouch,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -spacing.sm,
  },
  action: {
    minHeight: 54,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  actionText: { fontSize: 16, fontWeight: "700" },
  actionDetail: { flex: 1, textAlign: "right", fontSize: 14 },
  form: { gap: spacing.sm },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
  hint: { fontSize: 13, lineHeight: 18 },
  primary: {
    minHeight: 52,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xs,
  },
  primaryText: { fontSize: 16, fontWeight: "800" },
  choice: {
    minHeight: 52,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  choiceText: { fontSize: 16, fontWeight: "600", flex: 1 },
  newRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  newInput: { flex: 1 },
  addButton: {
    width: 52,
    height: 52,
    borderWidth: 1,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  details: {},
  detail: { minHeight: 52, borderBottomWidth: 1, paddingVertical: spacing.sm, gap: 2 },
  detailLabel: { fontSize: 13, fontWeight: "700" },
  detailValue: { fontSize: 16 },
});
