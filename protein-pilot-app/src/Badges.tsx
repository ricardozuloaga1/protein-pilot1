import React, { useState } from "react";
import { Image, View, Pressable, Modal, ScrollView } from "react-native";
import { Lock, ChevronRight } from "lucide-react-native";
import { C, S, T, Title, Screen, Notice } from "./ui";
import { useApp, useResource } from "./state";
export const badgeDefinitions = [
  [
    "seedling",
    "Seedling",
    "Confirm your first meal. No minimum protein required.",
  ],
  [
    "seven-days",
    "Seven Days",
    "Log meals on 7 distinct local dates, lifetime. They need not be consecutive.",
  ],
  [
    "rhythm",
    "Rhythm",
    "Log on 5 distinct dates within any 7 consecutive local calendar days.",
  ],
  [
    "rooted",
    "Rooted",
    "Log on 20 distinct dates within any 28 consecutive local calendar days.",
  ],
  [
    "homecoming",
    "Homecoming",
    "Return to logging after at least 3 complete dates with no entries, having logged previously.",
  ],
  [
    "mise-en-place",
    "Mise en Place",
    "Save a valid 7-day plan with breakfast, lunch and dinner each day, respecting restrictions and totaling your calculated target through target + 1 g daily.",
  ],
  [
    "follow-through",
    "Follow Through",
    "Log breakfast, lunch and dinner from 3 distinct planned slots for the same date. Portion corrections are allowed.",
  ],
  [
    "explorer",
    "Explorer",
    "Log 5 distinct verified protein foods within 14 days, each contributing at least 5 g protein in one confirmed meal.",
  ],
  [
    "plant-sampler",
    "Plant Sampler",
    "Log 3 plant-protein families within 14 days, each contributing at least 5 g in one meal: lentils, chickpeas, other beans/peas, soy, nuts or seeds.",
  ],
  [
    "portion-check",
    "Portion Check",
    "Confirm 3 distinct photo meals after explicitly checking their portions. Changing the estimate is not required.",
  ],
  [
    "protein-wise",
    "Protein Wise",
    "Complete all 3 knowledge checks correctly: photo uncertainty, protein digestibility and amino acids, and the context of protein-to-calorie ratios.",
  ],
  [
    "personal-rhythm",
    "Personal Rhythm",
    "Within 7 dates, mark 5 days complete with logged protein at 90–110% of each day’s saved calculated target. Supported profiles only. This is a product tolerance, not a medical range.",
  ],
];
// Display individual approved pin illustrations from the collection artwork.
// Each viewport excludes the labels; labels remain scalable, accessible native text.
export function BadgeArt({
  index,
  size = 84,
  earned = true,
}: {
  index: number;
  size?: number;
  earned?: boolean;
}) {
  const scale = size / 384;
  const height = (1024 / 3) * scale;
  return (
    <View
      accessible={false}
      style={{
        width: size,
        height,
        overflow: "hidden",
        opacity: earned ? 1 : 0.38,
      }}
    >
      <Image
        accessible={false}
        source={require("../assets/badges/field-notes-pins.png")}
        style={{
          position: "absolute",
          width: 1536 * scale,
          height: 1024 * scale,
          left: -(index % 4) * size,
          top: -Math.floor(index / 4) * height,
        }}
      />
    </View>
  );
}

export function BadgeShelf() {
  const a = useApp();
  const r = useResource("/v1/achievements");
  return (
    <View
      style={{
        gap: 18,
        paddingVertical: 16,
        borderTopWidth: 1,
        borderColor: C.line,
      }}
    >
      <View style={S.spread}>
        <T size={25} serif>
          Your collection
        </T>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View all badges"
          onPress={() => a.go("milestones")}
          style={{
            minHeight: 44,
            minWidth: 44,
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          <ChevronRight size={20} color={C.green} />
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {badgeDefinitions.slice(0, 3).map(([id, name], i) => {
          const b = r.data?.items.find((v: any) => v.id === id);
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={`${name}, ${b?.earned ? "earned" : b ? `${b.progress} of ${b.goal}` : "loading"}`}
              onPress={() => a.go("milestones")}
              style={{
                flex: 1,
                alignItems: "center",
                gap: 8,
                paddingVertical: 12,
                borderRightWidth: i < 2 ? 1 : 0,
                borderColor: C.line,
              }}
            >
              <BadgeArt index={i} earned={!!b?.earned} />
              <T serif size={16}>
                {name}
              </T>
              <T size={12} color={C.muted}>
                {b?.earned ? "Earned" : b ? `${b.progress} / ${b.goal}` : "—"}
              </T>
            </Pressable>
          );
        })}
      </View>
      {r.error && <Notice error>{r.error}</Notice>}
    </View>
  );
}
export function BadgeCollection() {
  const a = useApp();
  const r = useResource("/v1/achievements");
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <Screen back={a.back}>
      <Title
        title={"Small steps.\nLasting roots."}
        subtitle="Your Field Notes collection"
      />
      <T color={C.muted}>
        A record of showing up. Missing a day never erases your progress.
      </T>
      {r.error && <Notice error>{r.error}</Notice>}
      {selected !== null &&
        (() => {
          const [id, name, rule] = badgeDefinitions[selected];
          const b = r.data?.items.find((v: any) => v.id === id);
          return (
            <Modal
              transparent
              visible
              animationType="none"
              onRequestClose={() => setSelected(null)}
            >
              <View
                style={{
                  flex: 1,
                  justifyContent: "center",
                  padding: 24,
                  backgroundColor: "rgba(25,35,27,0.32)",
                }}
              >
                <ScrollView
                  accessibilityViewIsModal
                  style={{
                    maxHeight: "85%",
                    backgroundColor: C.ground,
                    borderRadius: 12,
                  }}
                  contentContainerStyle={{ padding: 24, gap: 20 }}
                >
                  <View style={S.spread}>
                    <T size={26} serif>
                      {name}
                    </T>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Close badge details"
                      onPress={() => setSelected(null)}
                      style={{ minHeight: 44, justifyContent: "center" }}
                    >
                      <T>Close</T>
                    </Pressable>
                  </View>
                  <BadgeArt index={selected} size={130} earned={!!b?.earned} />
                  <T>{rule}</T>
                  <T bold color={C.green}>
                    {selected >= 6
                      ? "Coming later · not yet earnable"
                      : b?.earned
                        ? "Earned from your confirmed records"
                        : b
                          ? `${b.progress} of ${b.goal}`
                          : "Loading your progress…"}
                  </T>
                </ScrollView>
              </View>
            </Modal>
          );
        })()}
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {badgeDefinitions.map(([id, name, rule], i) => {
          const b = r.data?.items.find((v: any) => v.id === id);
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={`${name}. ${i >= 6 ? "Coming later" : b?.earned ? "Earned" : "Locked"}. ${rule}`}
              onPress={() => setSelected(i)}
              style={{
                width: "50%",
                padding: 16,
                alignItems: "center",
                gap: 10,
                borderBottomWidth: 1,
                borderColor: C.line,
              }}
            >
              <BadgeArt index={i} size={110} earned={!!b?.earned} />
              <T serif size={19}>
                {name}
              </T>
              <View style={S.row}>
                {!b?.earned && <Lock size={12} color={C.muted} />}
                <T size={12} color={C.muted}>
                  {i >= 6
                    ? "Coming later"
                    : b?.earned
                      ? "Earned"
                      : b
                        ? `${b.progress} / ${b.goal}`
                        : "—"}
                </T>
              </View>
            </Pressable>
          );
        })}
      </View>
      <T size={13} color={C.muted}>
        Confirmed meals count; drafts and plans do not count as intake. Badges
        recognize habits, not medical outcomes. Corrected or deleted records
        update your collection.
      </T>
    </Screen>
  );
}
