import { Stack } from "expo-router";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { AccessibilityProvider } from "../src/accessibility/AccessibilityProvider";
import { DocumentLibraryProvider } from "../src/documents/DocumentLibraryProvider";
import { DocumentTransitionProvider } from "../src/navigation/DocumentTransitionProvider";

export default function RootLayout(){
  return <ThemeProvider><AccessibilityProvider><DocumentLibraryProvider><DocumentTransitionProvider>
    <Stack screenOptions={{headerShown:false}}>
      <Stack.Screen name="(tabs)"/>
      <Stack.Screen name="reader" options={{animation:"none",gestureEnabled:false}}/>
      <Stack.Screen name="assistant"/>
      <Stack.Screen name="review"/>
      <Stack.Screen name="recap"/>
    </Stack>
  </DocumentTransitionProvider></DocumentLibraryProvider></AccessibilityProvider></ThemeProvider>;
}
