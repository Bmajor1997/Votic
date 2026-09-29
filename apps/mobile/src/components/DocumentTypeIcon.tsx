import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

export function documentTypeColor(sourceName: string) {
  const name = sourceName.toLowerCase();
  if (name.endsWith(".pdf")) return "#DC2626";
  if (/\.(doc|docx)$/.test(name)) return "#2563EB";
  if (/\.(ppt|pptx)$/.test(name)) return "#EA580C";
  if (name.endsWith(".epub")) return "#7C3AED";
  return "#059669";
}

export function DocumentTypeIcon({ sourceName, size = 44 }: { sourceName: string; size?: number }) {
  const color = documentTypeColor(sourceName);
  return (
    <View
      style={[
        s.icon,
        { width: size, height: size, borderRadius: Math.round(size * 0.23), backgroundColor: color + "18" },
      ]}
    >
      <Ionicons name="document-text-outline" size={Math.round(size * 0.53)} color={color} />
    </View>
  );
}

const s = StyleSheet.create({ icon: { alignItems: "center", justifyContent: "center", flexShrink: 0 } });
