import { BadgeShelf, BadgeCollection } from "../Badges";
import { RecipeArt } from "../RecipeArt";
import React, { useRef, useState } from "react";
import { View, ActivityIndicator, ScrollView, Pressable } from "react-native";
import { BookOpen, Sparkle, Award, Leaf } from "lucide-react-native";
import { randomUUID } from "expo-crypto";
import { useApp, useResource } from "../state";
import { blankMeal, localDay, prettyDay, shiftDay, sum, round } from "../model";
import {
  Button,
  TextAction,
  Chips,
  Field,
  Notice,
  Row,
  Screen,
  T,
  Title,
  C,
  S,
} from "../ui";
export function Plan() {
  const a = useApp();
  const r = useResource("/v1/plans");
  const recipes = useResource("/v1/recipes");
  const [day, setDay] = useState(localDay(a.me?.profile.timezone));
  const targetDay = useResource(`/v1/days/${day}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState(false);
  const key = useRef(randomUUID());
  const plan = r.data?.items?.find((p: any) =>
    p.slots.some((s: any) => s.day === day),
  );
  const slots = plan?.slots.filter((s: any) => s.day === day) || [];
  const available = recipes.data?.items || [];
  const days = Array.from({ length: 7 }, (_, i) =>
    shiftDay(localDay(a.me?.profile.timezone), i),
  );
  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      if (plan)
        await a.request(
          `/v1/plans/${plan.id}/regenerate`,
          "POST",
          { version: plan.version },
          key.current,
        );
      else await a.request("/v1/plans", "POST", { week: day }, key.current);
      key.current = randomUUID();
      a.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const protein = round(
    sum(
      slots.flatMap(
        (s: any) =>
          s.foods ||
          available.find((v: any) => v.id === s.recipeId)?.foods ||
          [],
      ),
    ).protein,
  );
  return (
    <Screen profile={() => a.go("profile")} tabs active="plan" onTab={a.tab}>
      <Title
        title="Your week, considered."
        subtitle={[
          a.me?.profile.diet,
          ...(a.me?.profile.allergies || []).map(
            (v: string) => `excludes ${v}`,
          ),
        ].join(" · ")}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
      >
        {days.map((d) => (
          <Pressable
            key={d}
            accessibilityRole="button"
            accessibilityLabel={prettyDay(d)}
            accessibilityState={{ selected: d === day }}
            onPress={() => setDay(d)}
            style={{ width: 44, minHeight: 72, alignItems: "center", gap: 9 }}
          >
            <T size={10} style={{ letterSpacing: 1 }} color={C.muted}>
              {new Date(d + "T12:00:00")
                .toLocaleDateString("en", { weekday: "short" })
                .toUpperCase()}
            </T>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: d === day ? C.green : C.line,
                backgroundColor: d === day ? C.green : "transparent",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <T serif size={18} color={d === day ? C.surface : C.ink}>
                {Number(d.slice(8))}
              </T>
            </View>
          </Pressable>
        ))}
      </ScrollView>
      <View
        style={{
          paddingVertical: 16,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: C.line,
          gap: 7,
        }}
      >
        <T serif size={21}>
          {plan ? `${protein} g planned` : "Your daily starting point"} /{" "}
          {targetDay.data?.proteinTarget ?? "—"} g target
        </T>
        <T size={13} color={C.muted}>
          Planned meals count after you log them.
        </T>
      </View>
      {(busy || r.loading) && <ActivityIndicator color={C.green} />}
      {(error || r.error || targetDay.error) && (
        <Notice error>{error || r.error || targetDay.error}</Notice>
      )}
      {plan?.needsRebuild && (
        <Notice>
          Your profile changed. Rebuild to match your current target and
          restrictions.
        </Notice>
      )}
      {slots.map((slot: any) => (
        <View
          key={slot.mealType}
          style={{
            gap: 8,
            paddingVertical: 4,
            borderBottomWidth: 1,
            borderColor: C.line,
          }}
        >
          <T size={11} style={{ letterSpacing: 2 }} color={C.muted}>
            {slot.mealType.toUpperCase()}
          </T>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingVertical: 8,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${slot.name || "Saved recipe"}, ${slot.mealType}`}
              disabled={plan.needsRebuild}
              onPress={() =>
                a.go("recipe", {
                  id: slot.recipeId,
                  planId: plan.id,
                  day,
                  mealType: slot.mealType,
                })
              }
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                minHeight: 80,
              }}
            >
              <RecipeArt id={slot.recipeId} size={58} />
              <View style={{ flex: 1, gap: 6 }}>
                <T serif size={17}>
                  {slot.name ||
                    available.find((v: any) => v.id === slot.recipeId)?.name ||
                    "Saved recipe"}
                </T>
                <T size={12} color={C.muted}>
                  {slot.foods
                    ? `${slot.foods[0].grams} g ${slot.foods[0].name.toLowerCase()} + sides`
                    : "Review ingredients"}
                </T>
              </View>
            </Pressable>
            <View style={{ alignItems: "flex-end" }}>
              <T serif size={21}>
                {round(
                  sum(
                    slot.foods ||
                      available.find((v: any) => v.id === slot.recipeId)
                        ?.foods ||
                      [],
                  ).protein,
                )}{" "}
                g
              </T>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Swap ${slot.mealType}`}
                disabled={plan.needsRebuild || busy}
                onPress={() =>
                  a.go("recipes", { plan, day, mealType: slot.mealType })
                }
                style={{
                  minHeight: 44,
                  minWidth: 48,
                  alignItems: "flex-end",
                  justifyContent: "center",
                  opacity: plan.needsRebuild ? 0.4 : 1,
                }}
              >
                <T size={13} color={C.green}>
                  Swap ›
                </T>
              </Pressable>
            </View>
          </View>
        </View>
      ))}
      {!plan && (
        <>
          <T size={25} serif>
            A little preparation.
          </T>
          <T color={C.muted}>
            Breakfast, lunch and dinner, portioned to your protein target and
            preferences.
          </T>
          <Button label="Plan my week" busy={busy} onPress={generate} />
        </>
      )}
      {plan && (
        <>
          <TextAction
            label={
              notes ? "Hide planning notes" : "Ingredients & planning notes"
            }
            onPress={() => setNotes(!notes)}
          />
          {notes && (
            <>
              <T size={13} color={C.muted}>
                {plan.notice}
              </T>
              <T size={13} color={C.muted}>
                Swapping a recipe adjusts the other portions for that day.
                Recipe images are illustrations, not portion measurements.
              </T>
              <Button
                secondary
                label="Add a planned meal"
                disabled={plan.needsRebuild || slots.length >= 4 || busy}
                onPress={() => a.go("recipes", { plan, day, adding: true })}
              />
            </>
          )}
          <Button
            secondary
            label={
              plan.needsRebuild
                ? "Rebuild for my current profile"
                : "Rebuild this week"
            }
            busy={busy}
            onPress={generate}
          />
        </>
      )}
      <Row
        title="Food preferences"
        subtitle="Diet, allergies and foods to avoid"
        icon={Leaf}
        onPress={() => a.go("diet")}
      />
      <Row
        title="Browse recipes"
        subtitle="Find something you’ll enjoy"
        icon={BookOpen}
        onPress={() => a.go("recipes")}
      />
    </Screen>
  );
}
export function Recipes() {
  const a = useApp();
  const r = useResource("/v1/recipes");
  const params = a.route.params;
  const [q, setQ] = useState("");
  const [type, setType] = useState(params?.mealType || "dinner");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const choose = async (recipe: any) => {
    if (!params?.plan) {
      a.go("recipe", { id: recipe.id });
      return;
    }
    setBusy(true);
    try {
      const slots = params.plan.slots.filter(
        (s: any) => !(s.day === params.day && s.mealType === type),
      );
      slots.push({ day: params.day, mealType: type, recipeId: recipe.id });
      await a.request(`/v1/plans/${params.plan.id}`, "PATCH", {
        version: params.plan.version,
        slots,
      });
      a.refresh();
      a.tab("plan");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen back={a.back} background="fridge">
      <Title
        title={params?.plan ? "Choose a recipe" : "Recipes"}
        subtitle={
          params?.plan
            ? "Choose a recipe. All portions for that day will be rebalanced to your target."
            : "Search recipes or select one to view ingredients."
        }
      />
      {params?.adding && (
        <Chips
          values={["breakfast", "lunch", "dinner", "snack"].map((value) => ({
            value,
            label: value,
          }))}
          value={type}
          onChange={setType}
        />
      )}
      <Field label="Search recipes" value={q} onChangeText={setQ} />
      {r.loading || busy ? <ActivityIndicator color={C.green} /> : null}
      {r.data?.items
        .filter((r: any) => r.name.toLowerCase().includes(q.toLowerCase()))
        .map((r: any) => (
          <Row
            key={r.id}
            thumbnail={<RecipeArt id={r.id} />}
            title={r.name}
            subtitle={`${r.minutes} min · ${round(sum(r.foods).protein)} g protein`}
            onPress={busy ? undefined : () => void choose(r)}
          />
        ))}
      {!r.loading && !r.data?.items.length && (
        <Notice>
          No recipes match yet. Adjust your preferences or log a meal manually.
        </Notice>
      )}
      <T size={13} color={C.muted}>
        {r.data?.notice}
      </T>
      {(error || r.error) && <Notice error>{error || r.error}</Notice>}
    </Screen>
  );
}
export function Recipe() {
  const a = useApp();
  const r = useResource(`/v1/recipes/${a.route.params.id}`);
  const plans = useResource("/v1/plans");
  const params = a.route.params;
  const plan = params.planId
    ? plans.data?.items?.find((p: any) => p.id === params.planId)
    : null;
  const slot = plan?.slots.find(
    (s: any) => s.day === params.day && s.mealType === params.mealType,
  );
  const blocked =
    !!params.planId &&
    (!plan || plan.needsRebuild || !slot || slot.recipeId !== params.id);
  const recipe = r.data && { ...r.data, foods: slot?.foods || r.data.foods };
  return (
    <Screen
      back={a.back}
      footer={
        recipe && (
          <Button
            label="I ate this · review & log"
            disabled={blocked}
            onPress={() =>
              a.beginMeal({
                ...blankMeal(),
                name: recipe.name,
                mealType: slot?.mealType || "lunch",
                foods: recipe.foods,
              })
            }
          />
        )
      }
    >
      <Title
        title={recipe?.name || "Recipe"}
        subtitle={
          recipe
            ? `${recipe.minutes} minutes · ${round(sum(recipe.foods).protein)} g protein`
            : "Loading recipe…"
        }
      />
      {r.loading && <ActivityIndicator color={C.green} />}
      {blocked && (
        <Notice>
          Reopen or rebuild your plan before logging; the saved profile or meal
          has changed.
        </Notice>
      )}
      {slot && (
        <T>
          Planned portion: {slot.servings} recipe servings. Review what you
          actually ate before saving.
        </T>
      )}
      <View style={{ alignItems: "center" }}>
        <RecipeArt id={a.route.params.id} size={210} />
        <T size={11} color={C.muted}>
          Recipe illustration · use the ingredient weights below
        </T>
      </View>
      {recipe && (
        <>
          <Notice>{recipe.notice}</Notice>
          <T size={21} bold>
            What you’ll need
          </T>
          {recipe.foods.map((f: any) => (
            <Row key={f.name} title={f.name} right={`${f.grams} g`} />
          ))}
          <T size={21} bold>
            Instructions
          </T>
          {recipe.instructions.map((text: string, i: number) => (
            <View key={i} style={S.row}>
              <T bold color={C.green}>
                {i + 1}.
              </T>
              <T style={{ flex: 1 }}>{text}</T>
            </View>
          ))}
        </>
      )}
      {r.error && <Notice error>{r.error}</Notice>}
    </Screen>
  );
}
export function Progress() {
  const a = useApp();
  const [range, setRange] = useState("week");
  const to = localDay(a.me?.profile.timezone);
  const r = useResource(
    `/v1/progress?from=${shiftDay(to, range === "week" ? -6 : -29)}&to=${to}`,
  );
  const known = r.data?.days.filter((d: any) => d.totals) || [];
  const average = known.length
    ? round(
        known.reduce((n: number, d: any) => n + d.totals.protein, 0) /
          known.length,
      )
    : null;
  return (
    <Screen
      profile={() => a.go("profile")}
      tabs
      active="progress"
      onTab={a.tab}
    >
      <Title title="Your rhythm." />
      <Chips
        values={[
          { value: "week", label: "This week" },
          { value: "month", label: "Month" },
        ]}
        value={range}
        onChange={setRange}
      />
      <View style={{ paddingVertical: 8, gap: 4 }}>
        <T serif size={46} color={C.green}>
          {r.data?.daysWithEntries ?? "—"}{" "}
          <T serif size={23}>
            days logged
          </T>
        </T>
        <T color={C.muted}>
          {r.data?.daysAtTarget ?? "—"}{" "}
          {r.data?.daysAtTarget === 1 ? "day" : "days"} at target
        </T>
      </View>
      {r.loading && <ActivityIndicator color={C.green} />}
      <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 16 }}>
        {r.data?.days.map((d: any) => (
          <View
            key={d.day}
            accessible
            accessibilityLabel={`${d.day}, ${d.totals ? `${round(d.totals.protein)} grams logged` : "no entries"}`}
            style={{ width: "14.28%", alignItems: "center", gap: 10 }}
          >
            <T size={10} color={C.muted}>
              {new Date(d.day + "T12:00:00")
                .toLocaleDateString("en", { weekday: "short" })
                .toUpperCase()}
            </T>
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                borderWidth: 1,
                borderColor: d.totals ? C.green : C.line,
                backgroundColor: d.totals ? C.green : "transparent",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {range === "month" && (
                <T size={10} color={d.totals ? C.surface : C.muted}>
                  {Number(d.day.slice(8))}
                </T>
              )}
            </View>
          </View>
        ))}
      </View>
      <T size={13} color={C.muted}>
        Blank days mean no entries, not zero intake.
      </T>
      <BadgeShelf />
      <View
        style={[
          S.spread,
          { borderTopWidth: 1, borderColor: C.line, paddingVertical: 14 },
        ]}
      >
        <T color={C.muted}>Average on logged days</T>
        <T serif size={25}>
          {average ?? "—"} g
        </T>
      </View>
      <Row
        title="Protein sources"
        subtitle="There’s more to food than a number"
        icon={Leaf}
        onPress={() => a.go("quality")}
      />
      {r.error && (
        <>
          <Notice error>{r.error}</Notice>
          <Button secondary label="Try again" onPress={r.retry} />
        </>
      )}
    </Screen>
  );
}
export function Insight() {
  const a = useApp();
  const quality = a.route.name === "quality";
  if (!quality) return <BadgeCollection />;
  return (
    <Screen back={a.back}>
      <Title
        title={quality ? "Protein sources" : "Milestones"}
        subtitle={
          quality
            ? "Learn about variety in protein foods."
            : "Review logged days and targets reached."
        }
      />
      <View style={[S.card, { paddingVertical: 38, alignItems: "center" }]}>
        {quality ? (
          <Leaf size={64} color={C.green} />
        ) : (
          <Award size={64} color={C.green} />
        )}
      </View>
      {quality ? (
        <>
          <T size={24} bold>
            There’s more to food than a number.
          </T>
          <T>
            A variety of protein foods can support a balanced routine. Your food
            sources offer context, but a photo can’t measure protein quality.
          </T>
          <Notice>
            We don’t invent quality scores or confidence percentages. Estimates
            are a starting point for your review.
          </Notice>
          <Button
            label="Ask Pilot about food variety"
            secondary
            onPress={() => a.go("coach")}
          />
        </>
      ) : (
        <>
          <Row
            title="Days logged"
            right={String(a.route.params.days)}
            subtitle="Days with a logged meal in this period"
          />
          <Row
            title="Targets reached"
            right={String(a.route.params.hits)}
            subtitle="Based on your saved daily targets"
          />
          <T color={C.muted}>
            Missing a day doesn’t erase your progress. Pick up where you are.
          </T>
        </>
      )}
    </Screen>
  );
}
export function Coach() {
  const a = useApp();
  const r = useResource("/v1/coach/messages");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    try {
      await a.request("/v1/coach/messages", "POST", { text: text.trim() });
      setText("");
      a.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen
      back={a.back}
      footer={
        <>
          <Field
            label="Ask Pilot"
            value={text}
            onChangeText={setText}
            placeholder="What could I make for dinner?"
            multiline
          />
          <Button
            label="Send to Pilot"
            busy={busy}
            disabled={!text.trim()}
            onPress={send}
          />
        </>
      }
    >
      <Title
        title="Ask Pilot"
        subtitle="Ask for meal ideas based on your log and preferences."
      />
      {!r.data?.items.length && (
        <>
          <View style={S.card}>
            <Sparkle size={40} color={C.green} />
            <T size={21} bold>
              Ask a food or meal-planning question
            </T>
            <T color={C.muted}>Try “What could I make in 20 minutes?”</T>
          </View>
          <Notice>
            When you send a message, your profile, today’s log and recent
            conversation go to OpenAI. Pilot offers general food ideas, not
            medical advice.
          </Notice>
        </>
      )}
      {r.data?.items.map((m: any) => (
        <View
          key={m.id}
          style={{
            padding: 18,
            borderRadius: 20,
            borderBottomRightRadius: m.role === "user" ? 4 : 20,
            backgroundColor: m.role === "user" ? C.green : C.surface,
            alignSelf: m.role === "user" ? "flex-end" : "stretch",
            maxWidth: "94%",
          }}
        >
          <T color={m.role === "user" ? "white" : C.ink}>
            {m.role === "user"
              ? m.text
              : m.text
                  .split(/(\*\*[^*]+\*\*)/g)
                  .map((part: string, index: number) =>
                    part.startsWith("**") && part.endsWith("**") ? (
                      <T key={index} bold>
                        {part.slice(2, -2)}
                      </T>
                    ) : (
                      part
                    ),
                  )}
          </T>
        </View>
      ))}
      {busy && (
        <View style={S.row}>
          <ActivityIndicator color={C.green} />
          <T color={C.muted}>Pilot is thinking…</T>
        </View>
      )}
      {(error || r.error) && (
        <Notice error>
          {error || r.error} Your message is still in the composer.
        </Notice>
      )}
    </Screen>
  );
}
