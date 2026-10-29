import React from "react";
import { ActivityIndicator, View } from "react-native";
import { AppProvider, useApp } from "./state";
import { Welcome, Onboarding, SignIn } from "./screens/Auth";
import { Today, Saved } from "./screens/Today";
import {
  Log,
  Photo,
  Review,
  FoodEditor,
  SearchFood,
  MealDetail,
} from "./screens/Meals";
import {
  Plan,
  Recipes,
  Recipe,
  Progress,
  Insight,
  Coach,
} from "./screens/Explore";
import {
  ProfileScreen,
  Preferences,
  Reminders,
  Privacy,
  PhotoPrivacy,
  ExportData,
  Support,
  DeleteAccount,
} from "./screens/Settings";
import { C } from "./ui";
function Router() {
  const a = useApp();
  if (a.booting)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: C.ground,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={C.green} />
      </View>
    );
  const screens: Record<string, React.ReactNode> = {
    welcome: <Welcome />,
    onboarding: <Onboarding />,
    signin: <SignIn />,
    today: <Today />,
    journal: <Today journal />,
    saved: <Saved />,
    log: <Log />,
    photo: <Photo />,
    review: <Review />,
    food: <FoodEditor />,
    search: <SearchFood />,
    meal: <MealDetail />,
    plan: <Plan />,
    recipes: <Recipes />,
    recipe: <Recipe />,
    progress: <Progress />,
    quality: <Insight />,
    milestones: <Insight />,
    coach: <Coach />,
    profile: <ProfileScreen />,
    target: <Preferences />,
    diet: <Preferences />,
    editProfile: <Preferences />,
    reminders: <Reminders />,
    privacy: <Privacy />,
    photoPrivacy: <PhotoPrivacy />,
    export: <ExportData />,
    support: <Support />,
    delete: <DeleteAccount />,
  };
  if (!a.session && !["welcome", "signin", "onboarding"].includes(a.route.name))
    return <SignIn />;
  return (
    <React.Fragment key={a.route.name}>
      {screens[a.route.name] || <Welcome />}
    </React.Fragment>
  );
}
export default function Root() {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  );
}
