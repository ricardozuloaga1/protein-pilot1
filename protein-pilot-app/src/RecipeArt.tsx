import React from "react";
import { View, Image } from "react-native";
export const recipeNames = [
  "Yogurt, oats & berries",
  "Chicken & brown rice bowl",
  "Tofu & broccoli bowl",
  "Lentil & rice bowl",
  "Salmon & broccoli bowl",
  "Egg & rice bowl",
  "Chickpea & lentil bowl",
];
const ids = [
  "yogurt-oats",
  "chicken-rice",
  "tofu-rice",
  "lentil-bowl",
  "salmon-bowl",
  "egg-bowl",
  "chickpea-bowl",
];
export function RecipeArt({
  id,
  name,
  size = 58,
}: {
  id?: string;
  name?: string;
  size?: number;
}) {
  const found = id ? ids.indexOf(id) : recipeNames.indexOf(name || "");
  const i = found < 0 ? 7 : found;
  const scale = size / 380;
  return (
    <View
      accessible
      accessibilityLabel="Recipe illustration, not a measured portion"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
      }}
    >
      <Image
        accessible={false}
        source={require("../assets/recipes/field-notes-recipes.png")}
        style={{
          position: "absolute",
          width: 1536 * scale,
          height: 1024 * scale,
          left: -([190, 574, 959, 1344][i % 4] - 190) * scale,
          top: -([274, 713][Math.floor(i / 4)] - 190) * scale,
        }}
      />
    </View>
  );
}
