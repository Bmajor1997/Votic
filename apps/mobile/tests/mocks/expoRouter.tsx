import { jest } from "@jest/globals";
import { ReactNode } from "react";

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

export const stackScreens: { name: string; options?: Record<string, unknown> }[] = [];
function StackScreen(props: { name: string; options?: Record<string, unknown> }) {
  stackScreens.push(props);
  return null;
}
export function Stack({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}
Stack.Screen = StackScreen;

export function resetExpoRouterMock() {
  router.push.mockReset();
  router.back.mockReset();
  router.replace.mockReset();
  searchParams.current = {};
  stackScreens.length = 0;
}
