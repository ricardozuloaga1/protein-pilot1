import React from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  Manrope_400Regular,
  Manrope_600SemiBold,
  Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";
import Root from "./src/Root";
export default function App() {
  const [loaded, error] = useFonts({
    Manrope_400Regular,
    Manrope_600SemiBold,
    Manrope_800ExtraBold,
  });
  if (!loaded && !error)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#F5F1E8",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color="#244735" />
      </View>
    );
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Root />
    </SafeAreaProvider>
  );
}
