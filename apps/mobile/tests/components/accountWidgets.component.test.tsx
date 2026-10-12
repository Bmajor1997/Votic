import { describe, expect, it, jest } from "@jest/globals";
import { act } from "@testing-library/react-native";
import { Text } from "react-native";
import { publishWidgetSnapshot } from "../../src/widgets/widgetBridge";
import { fakeAuth } from "../mocks/authBackend";
import { renderWithProviders } from "../renderWithProviders";

jest.mock("../../src/widgets/widgetBridge", () => ({ publishWidgetSnapshot: jest.fn() }));
const publish = jest.mocked(publishWidgetSnapshot);
const signedOut = (snapshot: unknown) => JSON.parse(String(snapshot)).signedIn === false;

describe("Phone widgets and accounts", () => {
  it("doesn't blank the phone's widgets each time Votic opens", async () => {
    publish.mockClear();
    await renderWithProviders(<Text>Home</Text>);
    expect(publish.mock.calls.some(([snapshot]) => signedOut(snapshot))).toBe(false);
  });

  it("clears them when the account signs out", async () => {
    await renderWithProviders(<Text>Home</Text>);
    publish.mockClear();
    await act(async () => fakeAuth.setUser(null));
    expect(publish.mock.calls.some(([snapshot]) => signedOut(snapshot))).toBe(true);
  });
});
