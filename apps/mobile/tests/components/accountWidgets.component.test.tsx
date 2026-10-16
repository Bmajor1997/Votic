import { describe, expect, it, jest } from "@jest/globals";
import { act } from "@testing-library/react-native";
import { Text } from "react-native";
import { publish_widget_snapshot } from "../../src/widgets/widgetBridge";
import { fakeAuth } from "../mocks/authBackend";
import { render_with_providers } from "../renderWithProviders";

jest.mock("../../src/widgets/widgetBridge", () => ({ publish_widget_snapshot: jest.fn() }));
const publish = jest.mocked(publish_widget_snapshot);
const signed_out = (snapshot: unknown) => JSON.parse(String(snapshot)).signedIn === false;

describe("Phone widgets and accounts", () => {
  it("doesn't blank the phone's widgets each time Votic opens", async () => {
    publish.mockClear();
    await render_with_providers(<Text>Home</Text>);
    expect(publish.mock.calls.some(([snapshot]) => signed_out(snapshot))).toBe(false);
  });

  it("clears them when the account signs out", async () => {
    await render_with_providers(<Text>Home</Text>);
    publish.mockClear();
    await act(async () => fakeAuth.setUser(null));
    expect(publish.mock.calls.some(([snapshot]) => signed_out(snapshot))).toBe(true);
  });
});
