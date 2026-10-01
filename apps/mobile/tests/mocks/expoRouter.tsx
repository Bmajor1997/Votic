import { jest } from "@jest/globals";
import { ReactNode, useEffect } from "react";

/** A stand-in for expo-router: records navigation and the Stack screens a layout declares. */
export const router = {
  push: jest.fn(),
  back: jest.fn(),
  replace: jest.fn(),
};
export const searchParams: { current: Record<string, string> } = { current: {} };
export function useLocalSearchParams() {
  return searchParams.current;
}

/** Screens rendered in a test count as focused while mounted; unmounting is leaving them. */
export function useFocusEffect(effect: () => void | (() => void)) {
  useEffect(() => effect(), [effect]);
}

export const stackScreens: { name: string; options?: Record<string, unknown> }[] = [];
function StackScreen(props: { name: string; options?: Record<string, unknown> }) {
  stackScreens.push(props);
  return null;
}
export function Stack({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}
Stack.Screen = StackScreen;
/** Like expo-router, screens inside a group whose guard is false do not exist. */
Stack.Protected = function StackProtected({ guard, children }: { guard: boolean; children?: ReactNode }) {
  return guard ? <>{children}</> : null;
};

export function resetExpoRouterMock() {
  router.push.mockReset();
  router.back.mockReset();
  router.replace.mockReset();
  searchParams.current = {};
  stackScreens.length = 0;
}
