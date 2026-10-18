/**
 * "An easier-to-read font" is Atkinson Hyperlegible, designed by the Braille Institute for low-vision
 * readers. Phones don't ship an accessible font, so Votic bundles it (see readerFonts.ts).
 */
export const ACCESSIBLE_FONT = "AtkinsonHyperlegible_400Regular";
/** Custom fonts don't gain a bold weight from fontWeight on Android, so emphasis uses the bold file. */
export const ACCESSIBLE_FONT_BOLD = "AtkinsonHyperlegible_700Bold";
