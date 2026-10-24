import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ScanDraft } from "./scanDraftModel";

type Props = {
  draft: ScanDraft;
  selected: string;
  busy: boolean;
  progress: string | null;
  onSelect: (id: string) => void;
  onTitle: (text: string) => void;
  onAdd: () => void;
  onRetake: () => void;
  onRotate: () => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onFinish: () => void;
};
/** A compact, scrollable page collection. The numbered strip is the document's reading order. */
export function ScanPageReview(props: Props) {
  const index = props.draft.pages.findIndex((p) => p.id === props.selected);
  return (
    <ScrollView style={s.panel} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={s.title}>
        One scan. One document.
      </Text>
      <Text style={s.copy}>
        Page {index + 1} of {props.draft.pages.length}. Add all your sheets before finishing.
      </Text>
      <ScrollView
        horizontal
        contentContainerStyle={s.thumbnails}
        accessibilityLabel="Scanned pages in reading order"
      >
        {props.draft.pages.map((page, at) => (
          <Pressable
            key={page.id}
            accessibilityRole="button"
            accessibilityLabel={`Select page ${at + 1}`}
            accessibilityState={{ selected: props.selected === page.id, disabled: props.busy }}
            disabled={props.busy}
            onPress={() => props.onSelect(page.id)}
            style={[s.thumbnail, props.selected === page.id && s.selected]}
          >
            <Image source={{ uri: page.uri }} style={s.photo} resizeMode="contain" />
            <Text style={s.copy}>Page {at + 1}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={s.label}>Document title</Text>
      <TextInput
        accessibilityLabel="Scanned document title"
        value={props.draft.title}
        maxLength={120}
        editable={!props.busy}
        onChangeText={props.onTitle}
        style={s.input}
        placeholder="Name this document"
        placeholderTextColor="#CBD5E1"
      />
      <View style={s.actions}>
        <ScanAction label="Retake page" onPress={props.onRetake} disabled={props.busy} />
        <ScanAction label="Rotate page" onPress={props.onRotate} disabled={props.busy} />
        <ScanAction label="Remove page" onPress={props.onRemove} disabled={props.busy} />
        <ScanAction
          label="Move page earlier"
          onPress={() => props.onMove(-1)}
          disabled={props.busy || index < 1}
        />
        <ScanAction
          label="Move page later"
          onPress={() => props.onMove(1)}
          disabled={props.busy || index >= props.draft.pages.length - 1}
        />
      </View>
      <View style={s.actions}>
        <ScanAction label="Add another page" onPress={props.onAdd} disabled={props.busy} />
        <ScanAction
          label={props.progress || "Finish scan"}
          onPress={props.onFinish}
          disabled={props.busy}
          primary
        />
      </View>
      <Text accessibilityLiveRegion="polite" style={s.copy}>
        {props.progress || "Finish scan checks the text from every page before saving one document."}
      </Text>
    </ScrollView>
  );
}
export function ScanAction({
  label,
  onPress,
  disabled,
  primary = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[s.action, primary && s.primary, disabled && { opacity: 0.5 }]}
    >
      <Text style={[s.actionText, primary && { color: "#111827" }]}>{label}</Text>
    </Pressable>
  );
}
const s = StyleSheet.create({
  panel: { flexGrow: 0, maxHeight: "62%", backgroundColor: "rgba(0,0,0,0.92)" },
  content: { padding: 16, gap: 12 },
  title: { color: "#FFF", fontSize: 21, fontWeight: "800" },
  copy: { color: "#E2E8F0", fontSize: 14, lineHeight: 21 },
  label: { color: "#FFF", fontSize: 15, fontWeight: "700" },
  input: {
    color: "#FFF",
    borderWidth: 1,
    borderColor: "#94A3B8",
    borderRadius: 12,
    padding: 12,
    minHeight: 48,
    fontSize: 16,
  },
  thumbnails: { gap: 10 },
  thumbnail: { padding: 6, borderWidth: 2, borderColor: "#64748B", borderRadius: 10, gap: 4 },
  selected: { borderColor: "#FFF", backgroundColor: "#334155" },
  photo: { width: 64, height: 70 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  action: {
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#94A3B8",
    justifyContent: "center",
    flexGrow: 1,
  },
  primary: { backgroundColor: "#FFF", borderColor: "#FFF" },
  actionText: { color: "#FFF", fontSize: 15, fontWeight: "700", textAlign: "center" },
});
