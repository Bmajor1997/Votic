import { describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen as rendered, waitFor } from "@testing-library/react-native";
import { Platform } from "react-native";
import HomeScreenWidgets from "../../app/home-screen-widgets";
import WidgetLink from "../../app/widget";
import WidgetsIntro from "../../app/widgets-intro";
import { WIDGET_STEPS } from "../../src/onboarding/HomeScreenWidgetsIntro";
import { loadAccountSetup } from "../../src/onboarding/onboardingStorage";
import { SettingsDetailScreen } from "../../src/settings/SettingsDetails";
import { WIDGET_PUBLISH_DELAY_MS, WidgetSync } from "../../src/widgets/WidgetSync";
import { WidgetSnapshot } from "../../src/widgets/widgetSnapshot";
import { fakeAuth } from "../mocks/authBackend";
import { router, searchParams } from "../mocks/expoRouter";
import { AppProviders, renderWithProviders, testDocument } from "../renderWithProviders";

const report = testDocument("doc-report", "Quarterly report", { progress: 0.4, lastOpenedAt: 9 });
const guide = testDocument("doc-guide", "Field Guide", { progress: 1, lastOpenedAt: 5 });

function sent(publish: jest.Mock<(snapshot: string) => void>) {
  return publish.mock.calls.map(([snapshot]) => JSON.parse(snapshot) as WidgetSnapshot);
}

describe("home-screen widget updates", () => {
  it("sends the library to the widgets once it has loaded, and not again when nothing changed", async () => {
    const publish = jest.fn<(snapshot: string) => void>();
    const screen = await renderWithProviders(<WidgetSync publish={publish} />, {
      documents: [report, guide],
    });
    // Changes are gathered for a moment first, so a burst of progress updates is sent once.
    expect(publish).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(WIDGET_PUBLISH_DELAY_MS));
    expect(sent(publish)).toHaveLength(1);
    expect(sent(publish)[0]).toMatchObject({
      signedIn: true,
      continue: {
        id: "doc-report",
        title: "Quarterly report",
        status: expect.stringMatching(/^40% · about/),
      },
      upNext: [{ id: "doc-guide", status: "Finished" }],
      documentCount: 2,
    });
    await screen.rerender(
      <AppProviders>
        <WidgetSync publish={publish} />
      </AppProviders>,
    );
    await act(async () => jest.advanceTimersByTime(WIDGET_PUBLISH_DELAY_MS * 2));
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it("clears the widgets as soon as someone signs out", async () => {
    const publish = jest.fn<(snapshot: string) => void>();
    await renderWithProviders(<WidgetSync publish={publish} />, { documents: [report] });
    await act(async () => jest.advanceTimersByTime(WIDGET_PUBLISH_DELAY_MS));
    await act(async () => fakeAuth.setUser(null));
    expect(sent(publish).at(-1)).toEqual({
      version: 1,
      signedIn: false,
      continue: null,
      upNext: [],
      documentCount: 0,
      days: [],
    });
  });
});

describe("opening Votic from a widget", () => {
  it("resumes listening, with Home underneath", async () => {
    searchParams.current = { open: "listen", id: "doc-report" };
    await renderWithProviders(<WidgetLink />, { documents: [report] });
    expect(router.replace).toHaveBeenCalledWith("/");
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/reader",
      params: { mode: "listen", autoplay: "1" },
    });
  });

  it("resumes reading without starting narration", async () => {
    searchParams.current = { open: "read", id: "doc-report" };
    await renderWithProviders(<WidgetLink />, { documents: [report] });
    expect(router.push).toHaveBeenCalledWith({ pathname: "/reader", params: { mode: "read" } });
  });

  it("goes Home when the document has been deleted since the widget updated", async () => {
    searchParams.current = { open: "listen", id: "doc-deleted" };
    await renderWithProviders(<WidgetLink />, { documents: [report] });
    expect(router.replace).toHaveBeenCalledWith("/");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("opens Statistics and Documents", async () => {
    searchParams.current = { open: "statistics" };
    const screen = await renderWithProviders(<WidgetLink />, { documents: [report] });
    expect(router.push).toHaveBeenLastCalledWith("/statistics");
    screen.unmount();
    searchParams.current = { open: "add" };
    await renderWithProviders(<WidgetLink />);
    expect(router.push).toHaveBeenLastCalledWith("/documents");
  });
});

describe("telling people about the widgets", () => {
  it("shows during setup with this phone's steps, and moves setup on", async () => {
    await renderWithProviders(<WidgetsIntro />, { accountSetup: { completedAt: null } });
    expect(rendered.getByRole("header", { name: "Votic on your Home Screen" })).toBeTruthy();
    for (const step of WIDGET_STEPS.ios) expect(rendered.getByText(step.text)).toBeTruthy();
    expect(rendered.getByText(/Continue also fits on your Lock Screen/)).toBeTruthy();
    expect((await loadAccountSetup("test-user"))?.widgetsIntroducedAt).toBeNull();
    await fireEvent.press(rendered.getByRole("button", { name: "Continue" }));
    await waitFor(async () =>
      expect((await loadAccountSetup("test-user"))?.widgetsIntroducedAt).toEqual(expect.any(Number)),
    );
  });

  it("uses Android's own steps on Android", async () => {
    jest.replaceProperty(Platform, "OS", "android");
    await renderWithProviders(<WidgetsIntro />, { accountSetup: { completedAt: null } });
    for (const step of WIDGET_STEPS.android) expect(rendered.getByText(step.text)).toBeTruthy();
    expect(rendered.queryByText(/Lock Screen/)).toBeNull();
  });

  it("can be opened again from Settings → Help", async () => {
    const screen = await renderWithProviders(<SettingsDetailScreen category="help" />);
    await fireEvent.press(rendered.getByRole("button", { name: "Home Screen widgets" }));
    expect(router.push).toHaveBeenLastCalledWith("/home-screen-widgets");
    screen.unmount();
    await renderWithProviders(<HomeScreenWidgets />);
    await fireEvent.press(rendered.getByRole("button", { name: "Done" }));
    expect(router.back).toHaveBeenCalled();
  });
});
