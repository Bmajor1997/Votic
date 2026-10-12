/* eslint-disable @typescript-eslint/no-require-imports -- each test loads a fresh copy of the module after setting the platform. */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { AppState, Platform } from "react-native";

const mockIcons = { current: null as string | null };
const mockSetIcon = jest.fn(async (name: string | null) => {
  mockIcons.current = name;
  return name;
});
jest.mock("expo-alternate-app-icons", () => ({
  supportsAlternateIcons: true,
  getAppIconName: () => mockIcons.current,
  setAlternateAppIcon: (name: string | null) => mockSetIcon(name),
}));

describe("home-screen icon follows the accent color", () => {
  beforeEach(() => {
    jest.resetModules();
    mockIcons.current = null;
    mockSetIcon.mockClear();
  });

  it("names an icon for every accent, with blue as the main icon", () => {
    const { appIconFor } = require("../../src/theme/appIcon");
    expect(appIconFor("blue")).toBeNull();
    expect(appIconFor("purple")).toBe("Purple");
    expect(appIconFor("orange")).toBe("Orange");
  });

  it("changes right away on iPhone and skips a change that's already in place", async () => {
    Platform.OS = "ios";
    const { matchAppIcon } = require("../../src/theme/appIcon");
    matchAppIcon("purple");
    await Promise.resolve();
    expect(mockSetIcon).toHaveBeenLastCalledWith("Purple");
    matchAppIcon("purple");
    await Promise.resolve();
    expect(mockSetIcon).toHaveBeenCalledTimes(1);
  });

  it("waits until Votic is in the background on Android, then uses the latest choice", async () => {
    Platform.OS = "android";
    const listeners: ((state: string) => void)[] = [];
    jest.spyOn(AppState, "addEventListener").mockImplementation(((
      _: string,
      listener: (state: string) => void,
    ) => {
      listeners.push(listener);
      return { remove: () => {} };
    }) as never);
    const { matchAppIcon } = require("../../src/theme/appIcon");
    matchAppIcon("red");
    matchAppIcon("teal");
    expect(mockSetIcon).not.toHaveBeenCalled();
    listeners.forEach((listener) => listener("background"));
    await Promise.resolve();
    expect(mockSetIcon).toHaveBeenCalledTimes(1);
    expect(mockSetIcon).toHaveBeenLastCalledWith("Teal");
  });
});

describe("Android icon aliases", () => {
  it("open widget links and shared files just like the main icon", () => {
    const { copyFilters } = require("../../plugins/iconAliasFilters");
    const filters = [
      { action: [{ $: { "android:name": "android.intent.action.MAIN" } }] },
      { data: [{ $: { "android:scheme": "votic" } }] },
      { action: [{ $: { "android:name": "android.intent.action.SEND" } }] },
    ];
    const manifest = {
      manifest: {
        application: [
          {
            $: { "android:name": ".MainApplication" },
            activity: [{ $: { "android:name": ".MainActivity" }, "intent-filter": filters }],
            "activity-alias": [
              {
                $: { "android:name": ".MainActivityPurple", "android:targetActivity": ".MainActivity" },
                "intent-filter": [filters[0]],
              },
            ],
          },
        ],
      },
    };
    const result = copyFilters(manifest);
    expect(result.manifest.application[0]["activity-alias"][0]["intent-filter"]).toEqual(filters);
  });
});
