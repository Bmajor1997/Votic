import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { FileTypeInput, file_type_colors, resolve_file_type } from "../documents/fileTypes";
import { mix, useVoticTheme } from "../theme/ThemeProvider";

export type FileTypeIconProps = FileTypeInput & {
  size?: number;
  accessibilityLabel?: string;
  decorative?: boolean;
  status?: "uploading" | "processing" | "ready" | "failed";
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
      <Text
        numberOfLines={1}
        allowFontScaling={false}
        style={[s.monogram, { color: colors.foreground, fontSize }]}
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
                status === "failed"
                  ? theme.isDark
                    ? "#F3A6A6"
                    : "#A23D3D"
                  : status === "ready"
                    ? theme.isDark
                      ? "#83BA9B"
                      : "#3B6750"
                    : theme.accentText,
            },
          ]}
        />
      ) : null}
    </View>
  );
});
const s = StyleSheet.create({
  icon: { alignItems: "center", justifyContent: "center", flexShrink: 0 },
  monogram: { fontWeight: "600", letterSpacing: 0.2, textAlign: "center", includeFontPadding: false },
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
