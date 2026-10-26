import { Ionicons } from "@expo/vector-icons";
import { memo, type ComponentProps } from "react";
import { StyleSheet, Text, View } from "react-native";
import { FileTypeInput, file_type_colors, resolve_file_type } from "../documents/fileTypes";
import { mix, useVoticTheme } from "../theme/ThemeProvider";

export type FileTypeIconProps = FileTypeInput & {
  size?: number;
  accessibilityLabel?: string;
  decorative?: boolean;
  status?: "uploading" | "processing" | "ready" | "failed";
};

const STATUS_COLORS: Record<
  "light" | "dark",
  Partial<Record<NonNullable<FileTypeIconProps["status"]>, string>>
> = {
  light: { failed: "#A23D3D", ready: "#3B6750" },
  dark: { failed: "#F3A6A6", ready: "#83BA9B" },
};

const FILE_GLYPHS: Partial<
  Record<ReturnType<typeof resolve_file_type>["family"], ComponentProps<typeof Ionicons>["name"]>
> = {
  html: "code-slash-outline",
  image: "image-outline",
  photo: "image-outline",
  epub: "book-outline",
  slides: "albums-outline",
};

/** A single, static identity; status sits outside the monogram and never hides the extension. */
export const FileTypeIcon = memo(function FileTypeIcon({
  filename,
  mimeType,
  extension,
  size = 44,
  accessibilityLabel,
  decorative = false,
  status,
}: FileTypeIconProps) {
  const { theme } = useVoticTheme();
  const type = resolve_file_type({ filename, mimeType, extension });
  const colors = file_type_colors(type, theme.isDark);
  const dimension = Number.isFinite(size) && size > 0 ? Math.max(24, size) : 44;
  const fontSize = dimension * (type.monogram.length > 3 ? 0.235 : 0.28);
  const label = accessibilityLabel ?? `${type.monogram} file${status ? `, ${status}` : ""}`;
  return (
    <View
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : "image"}
      accessibilityLabel={decorative ? undefined : label}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? "no-hide-descendants" : "auto"}
      style={[
        s.icon,
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension * 0.25,
          backgroundColor: mix(theme.surface, colors.accent, 0.1),
        },
      ]}
    >
      <View
        pointerEvents="none"
        style={[
          s.paper,
          {
            width: dimension * 0.68,
            height: dimension * 0.78,
            borderRadius: dimension * 0.09,
            top: dimension * 0.08,
            backgroundColor: theme.surface,
            borderColor: mix(theme.surface, colors.accent, 0.35),
          },
        ]}
      >
        <View
          style={[
            s.fold,
            {
              width: dimension * 0.18,
              height: dimension * 0.18,
              borderBottomLeftRadius: dimension * 0.06,
              backgroundColor: mix(theme.surface, colors.accent, 0.32),
            },
          ]}
        />
        {dimension >= 48 ? (
          <Ionicons
            name={FILE_GLYPHS[type.family] ?? "reorder-two-outline"}
            size={dimension * 0.25}
            color={colors.foreground}
            style={{ position: "absolute", left: dimension * 0.09, top: dimension * 0.12 }}
            accessible={false}
          />
        ) : (
          <View
            style={{
              width: dimension * 0.28,
              height: 2,
              borderRadius: 1,
              backgroundColor: colors.accent,
              marginLeft: dimension * 0.08,
              marginTop: dimension * 0.22,
            }}
          />
        )}
      </View>
      <Text
        numberOfLines={1}
        allowFontScaling={false}
        style={[
          s.monogram,
          {
            color: colors.foreground,
            fontSize,
            backgroundColor: mix(theme.surface, colors.accent, 0.1),
            borderRadius: dimension * 0.07,
            paddingHorizontal: dimension * 0.045,
            bottom: dimension * 0.07,
          },
        ]}
      >
        {type.monogram}
      </Text>
      {status ? (
        <View
          style={[
            s.status,
            {
              borderColor: theme.surface,
              backgroundColor:
                (theme.isDark ? STATUS_COLORS.dark : STATUS_COLORS.light)[status] ?? theme.accentText,
            },
          ]}
        />
      ) : null}
    </View>
  );
});
const s = StyleSheet.create({
  icon: { alignItems: "center", justifyContent: "center", flexShrink: 0 },
  paper: {
    position: "absolute",
    borderWidth: 1,
    shadowColor: "#17243D",
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    shadowOpacity: 0.08,
  },
  fold: { position: "absolute", right: -1, top: -1 },
  monogram: {
    position: "absolute",
    fontWeight: "700",
    letterSpacing: 0.2,
    textAlign: "center",
    includeFontPadding: false,
  },
  status: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
});
