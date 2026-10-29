import { RecipeArt, recipeNames } from "../RecipeArt";
import React, { useState } from "react";
import { View, ActivityIndicator, Image } from "react-native";
import { Utensils, Sparkle } from "lucide-react-native";
import { API_URL } from "../api";
import { useApp, useResource } from "../state";
import { localDay, prettyDay, shiftDay, round, Meal } from "../model";
import { Button, Notice, Row, Screen, T, Title, TextAction, C, S } from "../ui";
function MealThumbnail({ id }: { id: string }) {
  const a = useApp();
  const [failed, setFailed] = useState(false);
  return (
    <View
      style={{
        width: 56,
        height: 56,
        borderRadius: 28,
        overflow: "hidden",
        backgroundColor: C.soft,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {failed || !a.session ? (
        <Utensils color={C.green} size={23} />
      ) : (
        <Image
          source={{
            uri: `${API_URL}/v1/meals/${id}/photo`,
            headers: { Authorization: `Bearer ${a.session.accessToken}` },
            cache: "reload",
          }}
          style={{ width: 56, height: 56 }}
          resizeMode="cover"
          accessible={false}
          onError={() => setFailed(true)}
        />
      )}
    </View>
  );
}
export function Today({ journal = false }: { journal?: boolean }) {
  const a = useApp();
  const [day, setDay] = useState(localDay(a.me?.profile.timezone));
  const r = useResource(`/v1/days/${day}`);
  const drafts = useResource("/v1/drafts");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const data = r.data;
  const total = data?.totals;
  const target = data?.proteinTarget;
  const reached = data?.targetReached;
  return (
    <Screen
      back={journal ? a.back : undefined}
      profile={() => a.go("profile")}
      tabs={!journal}
      background="kitchen"
      active="today"
      onTab={a.tab}
    >
      <Title
        title={journal ? "Your food journal." : "Your food, recorded."}
        subtitle={prettyDay(day)}
      />
      {journal && (
        <View style={S.spread}>
          <Button
            secondary
            label="Previous day"
            onPress={() => setDay(shiftDay(day, -1))}
          />
          <Button
            secondary
            label="Next day"
            disabled={day >= localDay(a.me?.profile.timezone)}
            onPress={() => setDay(shiftDay(day, 1))}
          />
        </View>
      )}
      {r.loading && !data ? <ActivityIndicator color={C.green} /> : null}
      {r.error && (
        <>
          <Notice error>{r.error}</Notice>
          <Button secondary label="Try again" onPress={r.retry} />
        </>
      )}
      {a.notice && <Notice>{a.notice}</Notice>}
      {a.pending.length > 0 && (
        <View style={S.card}>
          <T bold>
            {a.pending.length} meal{a.pending.length > 1 ? "s" : ""} waiting to
            sync
          </T>
          <T size={14}>
            Saved on this device. They aren’t included in your totals yet.
          </T>
          <Button
            label="Sync meals"
            busy={busy}
            onPress={async () => {
              setBusy(true);
              try {
                await a.sync();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </View>
      )}
      {data && (
        <>
          <View style={{ alignItems: "center", paddingVertical: 12, gap: 14 }}>
            <T size={12} bold color={C.muted}>
              {journal ? "LOGGED PROTEIN" : "TODAY’S PROTEIN"}
            </T>
            <View
              style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}
            >
              <T size={72} serif color={C.green}>
                {total ? round(total.protein) : "—"}
              </T>
              <T size={23} color={C.muted}>
                {target ? `/ ${target} g` : "g logged"}
              </T>
            </View>
            <View
              style={{
                height: 3,
                width: "100%",
                backgroundColor: C.line,
                borderRadius: 8,
              }}
            >
              <View
                style={{
                  height: 3,
                  width: `${Math.min(100, target && total ? (total.protein / target) * 100 : 0)}%`,
                  backgroundColor: C.green,
                  borderRadius: 8,
                }}
              />
            </View>
            <T size={14} color={C.muted} style={{ textAlign: "center" }}>
              {!total
                ? "A fresh start. Your first meal goes here."
                : reached
                  ? "Your target, reached. Keep listening to your body."
                  : target
                    ? `${round(Math.max(0, target - total.protein))} g to go. One meal at a time.`
                    : data?.targetGuidance?.status === "needs_guidance"
                      ? "Your log is available without a numeric target."
                      : "Complete your profile to get a protein estimate."}
            </T>
          </View>
          <View
            style={[
              S.spread,
              {
                paddingVertical: 14,
                borderTopWidth: 1,
                borderBottomWidth: 1,
                borderColor: C.line,
              },
            ]}
          >
            {[
              ["calories", "kcal"],
              ["carbs", "carbs"],
              ["fat", "fat"],
            ].map(([key, label]) => (
              <View key={key}>
                <T size={20} bold>
                  {total ? round(total[key]) : "—"}
                  {key !== "calories" && total ? " g" : ""}
                </T>
                <T size={13} color={C.muted}>
                  {label}
                </T>
              </View>
            ))}
          </View>
          <View style={S.spread}>
            <T size={21} bold>
              Your journal
            </T>
            {!journal && (
              <TextAction label="History" onPress={() => a.go("journal")} />
            )}
          </View>
          {data.meals.length ? (
            data.meals.map((m: Meal) => (
              <Row
                key={m.id}
                thumbnail={
                  m.foods.every((f) => f.source === "catalog_estimate") &&
                  recipeNames.includes(m.name) ? (
                    <RecipeArt name={m.name} />
                  ) : (
                    <MealThumbnail key={m.id} id={m.id!} />
                  )
                }
                title={m.name}
                subtitle={`${m.mealType} · ${new Date(m.loggedAt).toLocaleTimeString("en", { hour: "numeric", minute: "2-digit", timeZone: a.me?.profile.timezone })}`}
                right={`${round(m.totals!.protein)} g`}
                onPress={() => a.go("meal", { meal: m })}
              />
            ))
          ) : (
            <View style={S.card}>
              <T size={21} bold>
                Start with what’s on your plate.
              </T>
              <T color={C.muted}>A photo or a quick note is all it takes.</T>
              <Button label="Log your first meal" onPress={() => a.go("log")} />
            </View>
          )}
        </>
      )}
      {!!data?.meals.length && (
        <Button secondary label="Log a meal +" onPress={() => a.go("log")} />
      )}
      {a.draft && (
        <Row
          title="Finish your saved draft"
          subtitle={a.draft.name}
          onPress={() => a.go("review")}
        />
      )}
      {drafts.data?.items
        ?.filter((d: Meal) => d.id !== a.draft?.id)
        .map((d: Meal) => (
          <Row
            key={d.id}
            title="Review saved draft"
            subtitle={d.name}
            onPress={() => a.beginMeal(d)}
          />
        ))}
      <Row
        title="Need an idea? Ask Pilot"
        icon={Sparkle}
        subtitle="Get meal ideas based on your log"
        onPress={() => a.go("coach")}
      />
      {error && <Notice error>{error}</Notice>}
    </Screen>
  );
}
export function Saved() {
  const a = useApp();
  return (
    <Screen
      footer={
        <Button
          label="Back to Today"
          onPress={() => {
            a.setNotice("");
            a.tab("today");
          }}
        />
      }
    >
      <View style={{ paddingVertical: 50, alignItems: "center", gap: 20 }}>
        <View
          style={{
            width: 100,
            height: 100,
            borderRadius: 50,
            backgroundColor: C.soft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Sparkle size={50} color={C.green} />
        </View>
        <Title
          title="Your meal is logged."
          subtitle="Return to Today to review your updated totals."
        />
      </View>
      <T>
        Your totals are up to date. You can edit this meal any time from your
        journal.
      </T>
    </Screen>
  );
}
