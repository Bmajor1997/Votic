import { Image, ImageSourcePropType, StyleSheet, View } from "react-native";
import { useVoticTheme } from "../theme/ThemeProvider";

// The Ask Votic mascot in three layers, so its wings take the accent color chosen in Settings while keeping
// their hand-drawn texture: the drawing without its wings, the wings as a shape to tint, and their shading.
const searchBase = require("../../assets/votic-search-mascot-base.png") as ImageSourcePropType;
const searchWings = require("../../assets/votic-search-mascot-wings.png") as ImageSourcePropType;
const searchShading = require("../../assets/votic-search-mascot-shading.png") as ImageSourcePropType;
const notesSource = require("../../assets/notes-empty.png") as ImageSourcePropType;
const documentsSource = require("../../assets/documents-empty.png") as ImageSourcePropType;

export function AskVoticEmptyAnimation() {
  const { theme } = useVoticTheme();
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Votic looking through a magnifying glass"
      style={s.search}
    >
      <Image source={searchBase} resizeMode="contain" style={StyleSheet.absoluteFill} />
      <Image
        testID="ask-mascot-wings"
        source={searchWings}
        resizeMode="contain"
        tintColor={theme.logoWing}
        style={StyleSheet.absoluteFill}
      />
      <Image source={searchShading} resizeMode="contain" style={StyleSheet.absoluteFill} />
    </View>
  );
}

export function NotesEmptyAnimation() {
  return (
    <Image
      accessibilityLabel="Illustrated notebook and pencil"
      source={notesSource}
      resizeMode="contain"
      style={s.notes}
    />
  );
}

export function DocumentsEmptyAnimation() {
  return (
    <Image
      accessibilityLabel="Person organizing documents"
      source={documentsSource}
      resizeMode="contain"
      style={s.documents}
    />
  );
}

const s = StyleSheet.create({
  search: { width: 150, height: 126, marginBottom: 8 },
  notes: { width: 132, height: 120 },
  documents: { width: 140, height: 128 },
});
