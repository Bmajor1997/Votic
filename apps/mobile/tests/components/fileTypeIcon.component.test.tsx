import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { FileTypeIcon } from "../../src/components/FileTypeIcon";
import {
  FILE_TYPE_PALETTE,
  FILE_FORMAT_PALETTE,
  file_type_palette,
  file_type_colors,
  resolve_file_type,
} from "../../src/documents/fileTypes";
import { mix, ThemeProvider } from "../../src/theme/ThemeProvider";

function luminance(hex: string) {
  const channels = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
describe("FileTypeIcon", () => {
  it.each(["light", "dark"])("renders every palette readably in %s mode", async (appearanceMode) => {
    await AsyncStorage.setItem("votic.mobile.theme.v1", JSON.stringify({ appearanceMode }));
    await render(
      <ThemeProvider>
        <FileTypeIcon filename="report.PDF" />
      </ThemeProvider>,
    );
    const tile = StyleSheet.flatten(screen.getByRole("image", { name: "PDF file" }).props.style);
    expect(tile).toMatchObject({ width: 44, height: 44, borderRadius: 11 });
    const dark = appearanceMode === "dark";
    const surface = dark ? "#121212" : "#FFFFFF";
    expect(tile.backgroundColor).toBe(mix(surface, FILE_TYPE_PALETTE.pdf.accent, 0.1));
    expect(StyleSheet.flatten(screen.getByText("PDF").props.style).color).toBe(
      file_type_colors(resolve_file_type({ extension: "pdf" }), dark).foreground,
    );
    for (const extension of Object.keys(FILE_FORMAT_PALETTE)) {
      const type = resolve_file_type({ extension });
      const palette = file_type_palette(type);
      // Check every actual format, including split image/slide/text identities.
      for (const paper of dark ? [surface, "#000000"] : [surface, "#FBF5E6"]) {
        const fg = luminance(file_type_colors(type, dark).foreground);
        const bg = luminance(mix(paper, palette.accent, 0.1));
        expect((Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it("scales four-letter extensions without clipping and supports accessible status", async () => {
    await render(
      <ThemeProvider>
        <FileTypeIcon
          extension="docx"
          size={32}
          status="processing"
          accessibilityLabel="Board report, processing"
        />
      </ThemeProvider>,
    );
    expect(screen.getByRole("image", { name: "Board report, processing" })).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByText("DOCX").props.style).fontSize).toBe(32 * 0.235);
    expect(screen.getByText("DOCX").props.numberOfLines).toBe(1);
  });
  it("keeps the monogram in every status and announces the state", async () => {
    for (const status of ["uploading", "processing", "ready", "failed"] as const) {
      const result = await render(
        <ThemeProvider>
          <FileTypeIcon mimeType="image/webp" status={status} />
        </ThemeProvider>,
      );
      expect(screen.getByRole("image", { name: `WEBP file, ${status}` })).toBeTruthy();
      expect(screen.getByText("WEBP")).toBeTruthy();
      await result.unmount();
    }
  });
  it("hides decorative identities from screen readers and handles missing metadata", async () => {
    await render(
      <ThemeProvider>
        <FileTypeIcon decorative size={NaN} />
      </ThemeProvider>,
    );
    expect(screen.queryByRole("image")).toBeNull();
    expect(screen.getByText("FILE", { includeHiddenElements: true })).toBeTruthy();
  });
});
