import { expect, it } from "@jest/globals";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import { fakeSubscriptions, entitlement_of } from "../mocks/subscriptionService";
import { router } from "../mocks/expoRouter";
import { render_with_providers } from "../renderWithProviders";

it("allows five new Free documents and rejects a sixth", async () => {
  fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("none") });
  let library: ReturnType<typeof useDocumentLibrary>;
  function Probe() {
    library = useDocumentLibrary();
    return <Text>{library.loaded ? `Documents: ${library.documents.length}` : "Loading"}</Text>;
  }
  await render_with_providers(<Probe />);
  await waitFor(() => expect(screen.getByText("Documents: 0")).toBeTruthy());
  await act(() => {
    for (let n = 0; n < 5; n++) library.addTextDocument(`Document ${n}.txt`, "Example text");
  });
  expect(screen.getByText("Documents: 5")).toBeTruthy();
  await act(() => {
    expect(() => library.addTextDocument("Six.txt", "Example text")).toThrow(/five saved documents/i);
  });
  expect(screen.getByText("Your Free library is full")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Compare Votic Plus" }));
  expect(router.push).toHaveBeenCalledWith("/paywall");
  expect(screen.getByText("Documents: 5")).toBeTruthy();
});
