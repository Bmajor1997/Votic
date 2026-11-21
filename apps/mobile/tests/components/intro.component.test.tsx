import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import * as Speech from "expo-speech";
import Intro from "../../app/intro";
import Welcome from "../../app/welcome";
import { INTRO_KEY, parse_intro } from "../../src/onboarding/introModel";
import { PREVIEW_SAMPLES } from "../../src/onboarding/sampleDocument";
import { fakeAuth } from "../mocks/authBackend";
import { render_with_providers } from "../renderWithProviders";

jest.mock("expo-speech", () => ({
  speak: jest.fn(),
  stop: jest.fn(async () => {}),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
const speak = jest.mocked(Speech.speak);

async function saved_intro() {
  return parse_intro(await AsyncStorage.getItem(INTRO_KEY));
}
async function open_tour() {
  fakeAuth.reset(null);
  await render_with_providers(<Intro />, { onboarding: { personalized: false }, reduceMotion: true });
}
const press = (name: string) => fireEvent.press(screen.getByRole("button", { name }));

beforeEach(() => {
  speak.mockReset();
});

describe("First-launch tour", () => {
  it("goes from the welcome through every step to Create my account, keeping the answers", async () => {
    await open_tour();
    expect(screen.getByText("I already have an account")).toBeTruthy();
    await press("Get started");

    // See it work: a page read aloud, and a prepared Ask Votic answer.
    expect(screen.getByText("See it work.")).toBeTruthy();
    expect(screen.getByLabelText("Step 1 of 5")).toBeTruthy();
    await press("Play sample");
    await waitFor(() => expect(speak).toHaveBeenCalled());
    expect(speak.mock.calls.at(-1)?.[0]).toBe(PREVIEW_SAMPLES.default.text);
    await press(`Ask: ${PREVIEW_SAMPLES.default.question}`);
    expect(screen.getByText(PREVIEW_SAMPLES.default.answer)).toBeTruthy();
    await press("Continue");

    expect(screen.getByText("What should Votic help you with?")).toBeTruthy();
    await fireEvent.press(screen.getByText("Work"));
    await press("Continue");
    expect(screen.getByText("Make the page your own.")).toBeTruthy();
    await press("Continue");
    expect(screen.getByText("Find your listening rhythm.")).toBeTruthy();
    await press("Continue");

    expect(screen.getByText("Free to start.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Skip this step" })).toBeNull();
    await press("Compare Free and Plus");
    expect(screen.getByLabelText("Compare Votic Free and Votic Plus")).toBeTruthy();
    await press("Close comparison");
    await press("Create my account");
    expect(await saved_intro()).toMatchObject({ done: true, toured: true, entry: "create", purpose: "work" });
  });

  it("can skip steps and go back to the welcome", async () => {
    await open_tour();
    await press("Get started");
    await press("Skip this step");
    expect(screen.getByText("What should Votic help you with?")).toBeTruthy();
    await press("Back");
    await press("Back");
    expect(screen.getByRole("button", { name: "Get started" })).toBeTruthy();
  });

  it("sends people with an account to Sign in", async () => {
    await open_tour();
    await press("I already have an account");
    expect(await saved_intro()).toMatchObject({ done: true, toured: true, entry: "sign-in" });
  });
});

describe("Account screen after the tour", () => {
  it("asks for an account once the tour is finished", async () => {
    fakeAuth.reset(null);
    await AsyncStorage.setItem(INTRO_KEY, JSON.stringify({ done: true, toured: true, entry: "create" }));
    await render_with_providers(<Welcome />, { onboarding: { personalized: false } });
    expect(screen.getByText("Your choices from the tour are saved to it.")).toBeTruthy();
  });

  it("keeps the usual welcome for someone who signed out", async () => {
    fakeAuth.reset(null);
    await render_with_providers(<Welcome />);
    expect(screen.getByText("A place to read, listen, and keep your ideas.")).toBeTruthy();
  });
});
