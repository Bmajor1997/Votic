import { it, expect, jest } from "@jest/globals";
import { fireEvent, screen } from "@testing-library/react-native";
import { useState } from "react";
import { FlatList, Pressable, Text } from "react-native";
import { ReadingPages } from "../../src/reader/components/ReadingPages";
import { renderWithProviders } from "../renderWithProviders";
const passages = ["Alpha beta gamma delta epsilon zeta"];
function Harness() {
  const [word, setWord] = useState(0);
  const [count, setCount] = useState(0);
  return (
    <>
      <ReadingPages
        passages={passages}
        index={0}
        wordIndex={word}
        textStyle={{ fontSize: 18 }}
        onLocation={(_, next) => setWord(next)}
        onReady={() => {}}
      />
      <Text>{`Saved word ${word}`}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Background update"
        onPress={() => setCount(count + 1)}
      >
        <Text>{count}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Seek start" onPress={() => setWord(0)}>
        <Text>Start</Text>
      </Pressable>
    </>
  );
}
it("keeps a swiped page through saved-location echoes and background renders, while allowing external seeks", async () => {
  const scroll = jest.spyOn(FlatList.prototype, "scrollToOffset");
  await renderWithProviders(<Harness />);
  await fireEvent(screen.getByTestId("reading-pages"), "layout", {
    nativeEvent: { layout: { width: 390, height: 232 } },
  });
  await fireEvent(screen.getByTestId("reading-measurement", { includeHiddenElements: true }), "textLayout", {
    nativeEvent: {
      lines: ["Alpha beta", "gamma delta", "epsilon zeta"].map((text) => ({ text, height: 200 })),
    },
  });
  scroll.mockClear();
  await fireEvent(screen.getByTestId("reading-page-list"), "momentumScrollEnd", {
    nativeEvent: { contentOffset: { x: 390 } },
  });
  expect(screen.getByText("Page 2 of 3")).toBeTruthy();
  expect(screen.getByText("Saved word 2")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Background update" }));
  expect(screen.getByText("Page 2 of 3")).toBeTruthy();
  expect(scroll).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Seek start" }));
  expect(screen.getByText("Page 1 of 3")).toBeTruthy();
  expect(scroll).toHaveBeenLastCalledWith({ offset: 0, animated: false });
});
