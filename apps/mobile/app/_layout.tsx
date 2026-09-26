import { Stack } from "expo-router";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { AccessibilityProvider } from "../src/accessibility/AccessibilityProvider";
import { DocumentLibraryProvider } from "../src/documents/DocumentLibraryProvider";
import { DocumentTransitionProvider } from "../src/navigation/DocumentTransitionProvider";
import { useVoticTheme } from "../src/theme/ThemeProvider";
import { useAccessibilityPreferences } from "../src/accessibility/AccessibilityProvider";

function ThemedStack(){
  const {theme}=useVoticTheme();
  const {reduceMotion}=useAccessibilityPreferences();
  return <DocumentLibraryProvider><DocumentTransitionProvider>
    <Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:theme.background},animation:reduceMotion?"none":"fade"}}>
      <Stack.Screen name="(tabs)"/>
      <Stack.Screen name="reader" options={{animation:"none",gestureEnabled:false,contentStyle:{backgroundColor:theme.background}}}/>
      <Stack.Screen name="assistant"/>
      <Stack.Screen name="review"/>
      <Stack.Screen name="recap"/>
    </Stack>
  </DocumentTransitionProvider></DocumentLibraryProvider>;
}

export default function RootLayout(){
  return <ThemeProvider><AccessibilityProvider><ThemedStack/></AccessibilityProvider></ThemeProvider>;
}
