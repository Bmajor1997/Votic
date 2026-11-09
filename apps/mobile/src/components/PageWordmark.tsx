import { useState } from "react";
import { View } from "react-native";
import { shownProgress, useWordmarkEntrance, useWordmarkEntranceActive } from "../home/WordmarkEntrance";
import { VoticLogo } from "./VoticLogo";
import { VoticWordmark } from "./VoticWordmark";

/**
 * The wordmark in a page header (Documents, Notes, Settings and settings pages). A page that opens while the shared
 * sign-in entrance is unfinished shows that same entrance at the same moment and lets it carry on; otherwise it is
 * the usual logo with its one-time wing pulse. The choice is made once when the page opens, so the header never
 * swaps components (or pulses) when the entrance ends.
 */
export function PageWordmark() {
  const entrance = useWordmarkEntrance();
  const [joined] = useState(useWordmarkEntranceActive());
  if (!joined) return <VoticLogo />;
  return (
    <View testID="page-wordmark-entrance" pointerEvents="none">
      <VoticWordmark entrance={shownProgress(entrance)} robotEntrance live={entrance.live} />
    </View>
  );
}
