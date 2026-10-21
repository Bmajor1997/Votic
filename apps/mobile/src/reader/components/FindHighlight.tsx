import { Text } from "react-native";
import { literal_matches } from "../documentFind";
import { useVoticTheme } from "../../theme/ThemeProvider";

export function FindHighlight({
  text,
  query,
  ranges,
}: {
  text: string;
  query: string;
  ranges?: { offset: number; length: number }[];
}) {
  const { theme } = useVoticTheme();
  if (!query) return <>{text}</>;
  const parts = [];
  let end = 0;
  for (const match of ranges || literal_matches(text, query)) {
    parts.push(text.slice(end, match.offset));
    parts.push(
      <Text key={match.offset} style={{ backgroundColor: theme.sentenceHighlight, color: theme.accentText }}>
        {text.slice(match.offset, match.offset + match.length)}
      </Text>,
    );
    end = match.offset + match.length;
  }
  parts.push(text.slice(end));
  return <>{parts}</>;
}
