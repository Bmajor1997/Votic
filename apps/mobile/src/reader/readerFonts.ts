import { useFonts } from "expo-font";
import { ACCESSIBLE_FONT, ACCESSIBLE_FONT_BOLD } from "./readerFontNames";

const READER_FONTS = {
  [ACCESSIBLE_FONT]: require("@expo-google-fonts/atkinson-hyperlegible/400Regular/AtkinsonHyperlegible_400Regular.ttf"),
  [ACCESSIBLE_FONT_BOLD]: require("@expo-google-fonts/atkinson-hyperlegible/700Bold/AtkinsonHyperlegible_700Bold.ttf"),
};

/** Loads the reader fonts in the background; text uses the system font until they're ready. */
export function useReaderFonts() {
  useFonts(READER_FONTS);
}
