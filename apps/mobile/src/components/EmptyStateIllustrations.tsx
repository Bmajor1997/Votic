import { Image, ImageSourcePropType, StyleSheet } from "react-native";

const searchSource = require("../../assets/votic-search-mascot.png") as ImageSourcePropType;
const notesSource = require("../../assets/notes-empty.png") as ImageSourcePropType;
const homeSource = require("../../assets/home-empty-house.png") as ImageSourcePropType;
const documentsSource = require("../../assets/documents-empty.png") as ImageSourcePropType;

export function AskVoticEmptyAnimation() {
  return (
    <Image
      accessibilityLabel="Votic looking through a magnifying glass"
      source={searchSource}
      resizeMode="contain"
      style={s.search}
    />
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

export function HomeEmptyAnimation() {
  return (
    <Image accessibilityLabel="Welcoming house" source={homeSource} resizeMode="contain" style={s.home} />
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
  home: { width: 150, height: 126 },
  documents: { width: 140, height: 128 },
});
