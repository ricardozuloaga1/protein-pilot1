import { appClock } from "../clock";
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Image,
  Alert,
  ActivityIndicator,
  Linking,
  Switch,
} from "react-native";
import {
  Camera,
  Image as ImageIcon,
  Search,
  PenLine,
  Heart,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import * as Manipulator from "expo-image-manipulator";
import { randomUUID } from "expo-crypto";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useApp, useResource } from "../state";
import { blankMeal, Food, Meal, sum, round, validateMeal } from "../model";
import {
  Button,
  Chips,
  Field,
  Notice,
  Plate,
  Row,
  Screen,
  T,
  Title,
  C,
  S,
} from "../ui";

export function Log() {
  const a = useApp();
  const openPhoto = (mode: string) => {
    const start = () => {
      a.setDraft(null);
      a.go("photo", { mode });
    };
    if (a.draft?.foods.length) {
      Alert.alert("Replace your draft?", "You have a meal in progress.", [
        { text: "Keep draft", style: "cancel" },
        { text: "Replace", style: "destructive", onPress: start },
      ]);
    } else start();
  };
  return (
    <Screen back={a.back} background="fridge">
      <Title
        title="Log a meal"
        subtitle="Take a photo, search foods, or enter a meal manually."
      />
      <View style={[S.card, { padding: 26, gap: 16 }]}>
        <Camera size={42} color={C.green} strokeWidth={1} />
        <T size={28} serif color={C.green}>
          Snap your meal
        </T>
        <T color={C.muted}>Take a photo, then check the foods and portions.</T>
        <Button
          label="Open camera"
          secondary
          onPress={() => openPhoto("camera")}
        />
      </View>
      <Row
        title="Choose a photo"
        subtitle="Use a photo from your library"
        icon={ImageIcon}
        onPress={() => openPhoto("library")}
      />
      <Row
        title="Find your food"
        subtitle="Search foods and favorites"
        icon={Search}
        onPress={() => {
          if (!a.draft) a.setDraft(blankMeal());
          a.go("search");
        }}
      />
      <Row
        title="Enter manually"
        subtitle="Enter food and portions manually"
        icon={PenLine}
        onPress={() => {
          if (!a.draft) a.setDraft(blankMeal());
          a.go("food", { index: -1 });
        }}
      />
      {a.draft && (
        <Row
          title="Continue your draft"
          subtitle={a.draft.name}
          onPress={() => a.go("review")}
        />
      )}
      <Notice>
        Photos provide estimates, not measurements. You’ll always review before
        saving.
      </Notice>
    </Screen>
  );
}

export function Photo() {
  const a = useApp();
  const mode = a.route.params?.mode || "library";
  const [uri, setUri] = useState("");
  const [job, setJob] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [denied, setDenied] = useState(false);
  const [consent, setConsent] = useState(!!a.me?.profile.photoConsent);
  const [finished, setFinished] = useState(false);
  const key = useRef(randomUUID());
  const timestamp = useRef(new Date(appClock.now()).toISOString());
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaving = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  async function choose(which = mode) {
    setError("");
    setDenied(false);
    setFinished(false);
    try {
      if (which === "camera") {
        const p = await ImagePicker.requestCameraPermissionsAsync();
        if (!p.granted) {
          setDenied(true);
          return;
        }
      }
      const result =
        which === "camera"
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ["images"],
              quality: 0.85,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              quality: 0.85,
              allowsMultipleSelection: false,
            });
      if (result.canceled) return;
      const converted = await Manipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1536 } }],
        { compress: 0.8, format: Manipulator.SaveFormat.JPEG },
      );
      setUri(converted.uri);
      key.current = randomUUID();
      timestamp.current = new Date(appClock.now()).toISOString();
      setJob(null);
    } catch {
      setError(
        "The camera is unavailable here. Choose a photo from your library instead.",
      );
    }
  }
  async function poll(id: string) {
    if (!mounted.current || leaving.current) return;
    try {
      const value = await a.request(`/v1/analysis/${id}`);
      if (!mounted.current || leaving.current) return;
      setJob(value);
      if (value.state === "succeeded") {
        if (value.draftId) {
          const draft = await a.request(`/v1/drafts/${value.draftId}`);
          if (mounted.current && !leaving.current) {
            a.setDraft(draft);
            a.go("review", { photoUri: uri });
            setFinished(true);
          }
        } else {
          setError(
            value.result?.status === "no_food"
              ? "No recognizable food in this photo. Try another photo or log manually."
              : "This photo is unclear. Try a brighter photo with the whole plate visible.",
          );
          setFinished(true);
        }
      } else if (value.state === "failed" || value.state === "cancelled") {
        setError(
          value.state === "cancelled"
            ? "This analysis was cancelled."
            : `Couldn’t read this one. ${value.error === "daily_ai_limit" ? "Your daily limit is reached." : "You can try again or log manually."}`,
        );
        setFinished(true);
      } else timer.current = setTimeout(() => void poll(id), 1500);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function upload() {
    if (!uri) return;
    setBusy(true);
    setError("");
    try {
      if (!a.me.profile.photoConsent) {
        await a.request("/v1/me/profile", "PUT", {
          ...a.me.profile,
          photoConsent: true,
        });
        await a.reload();
      }
      const form = new FormData();
      form.append("photo", new File(uri), "meal.jpg");
      const value = await a.request(
        `/v1/analysis?mealType=lunch&loggedAt=${encodeURIComponent(timestamp.current)}`,
        "POST",
        form,
        key.current,
      );
      setJob(value);
      void poll(value.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function leave() {
    if (busy) return;
    if (job && !finished) {
      leaving.current = true;
      setBusy(true);
      try {
        const result = await a.request(
          `/v1/analysis/${job.id}/cancel`,
          "POST",
          {},
        );
        if (result.draftId) {
          const d = await a.request(`/v1/drafts/${result.draftId}`);
          await a.request(`/v1/drafts/${d.id}`, "DELETE", {
            version: d.version,
          });
        }
        a.back();
      } catch (e) {
        leaving.current = false;
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    } else a.back();
  }
  const active =
    job && !finished && !["failed", "cancelled"].includes(job.state);
  return (
    <Screen
      back={() => {
        if (active)
          Alert.alert(
            "Leave this analysis?",
            "The photo will be removed and this analysis will be cancelled.",
            [
              { text: "Keep analyzing", style: "cancel" },
              {
                text: "Cancel analysis",
                style: "destructive",
                onPress: () => void leave(),
              },
            ],
          );
        else void leave();
      }}
      footer={
        active ? (
          <Button
            label="Cancel analysis"
            secondary
            busy={busy}
            onPress={() => void leave()}
          />
        ) : uri && !finished ? (
          <Button
            label="Analyze this photo"
            busy={busy}
            disabled={!consent}
            onPress={upload}
          />
        ) : (
          <Button
            label={
              uri
                ? "Choose another photo"
                : mode === "camera"
                  ? "Take a photo"
                  : "Choose a photo"
            }
            onPress={() => choose()}
          />
        )
      }
    >
      <Title
        title={
          active
            ? "Analyzing photo"
            : denied
              ? "Camera access is off."
              : "Add a food photo"
        }
        subtitle={
          active
            ? "Finding the foods. Estimating portions."
            : "Get the whole plate in good light."
        }
      />
      {uri ? (
        <Image
          source={{ uri }}
          accessibilityLabel="Selected meal photo"
          resizeMode="contain"
          style={{ height: 230, width: "100%", borderRadius: 24 }}
        />
      ) : (
        <Plate />
      )}
      {active ? (
        <View style={S.card}>
          <ActivityIndicator color={C.green} />
          <T bold>Preparing your editable estimate</T>
          <T size={14} color={C.muted}>
            This may take a moment. Nothing is logged until you review and
            confirm it.
          </T>
        </View>
      ) : (
        <>
          <Notice>
            Your photo goes to OpenAI for analysis. The analysis upload is
            deleted after processing. A small private thumbnail stays with your
            saved meal; unlogged thumbnails expire after seven days. OpenAI may
            retain abuse-monitoring data. Portions and nutrients are estimates.
          </Notice>
          <View style={S.spread}>
            <T style={{ flex: 1 }} size={14}>
              Allow OpenAI photo analysis
            </T>
            <Switch
              accessibilityLabel="Allow OpenAI photo analysis"
              value={consent}
              onValueChange={setConsent}
              trackColor={{ true: C.green }}
            />
          </View>
        </>
      )}
      {denied && (
        <Button
          secondary
          label="Open device settings"
          onPress={() => void Linking.openSettings()}
        />
      )}
      {error && <Notice error>{error}</Notice>}
      {error && job && !finished && (
        <Button
          secondary
          label="Check analysis again"
          onPress={() => {
            setError("");
            void poll(job.id);
          }}
        />
      )}
      {(!active || error) && (
        <>
          <Button
            secondary
            label="Choose from library"
            onPress={() => choose("library")}
          />
          <Button
            secondary
            label="Log manually instead"
            onPress={() => {
              if (active) {
                Alert.alert("Cancel the current analysis first.");
                return;
              }
              a.setDraft(blankMeal());
              a.go("food", { index: -1 });
            }}
          />
        </>
      )}
    </Screen>
  );
}

export function Review() {
  const a = useApp();
  const d = a.draft;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dateMode, setDateMode] = useState<"date" | "time" | null>(null);
  if (!d)
    return (
      <Screen back={a.back}>
        <Title
          title="Your draft is safe."
          subtitle="Choose a meal to continue."
        />
        <Button label="Back to Today" onPress={() => a.tab("today")} />
      </Screen>
    );
  const n = sum(d.foods);
  const edit = !!d.editId;
  const update = (patch: Partial<Meal>) => a.setDraft({ ...d, ...patch });
  const save = async () => {
    const invalid = validateMeal(d);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await a.saveMeal();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const discard = () =>
    Alert.alert(
      "Leave this meal?",
      "Keep your draft for later, or discard it.",
      [
        { text: "Keep editing", style: "cancel" },
        { text: "Save for later", onPress: () => a.tab("today") },
        {
          text: "Discard draft",
          style: "destructive",
          onPress: async () => {
            try {
              if (d.id && !edit)
                await a.request(`/v1/drafts/${d.id}`, "DELETE", {
                  version: d.version,
                });
              a.setDraft(null);
              a.tab("today");
            } catch (e) {
              setError((e as Error).message);
            }
          },
        },
      ],
    );
  return (
    <Screen
      back={discard}
      footer={
        <Button
          label={edit ? "Save changes" : "Confirm & log meal"}
          busy={busy}
          onPress={save}
        />
      }
    >
      <Title
        title={
          edit
            ? "Edit food and portions"
            : d.foods.some((f) => f.source === "photo_estimate")
              ? "Review detected foods"
              : "Ready for your log."
        }
        subtitle="Review the foods and portions below."
      />
      {a.route.params?.photoUri && (
        <Image
          source={{ uri: a.route.params.photoUri }}
          resizeMode="contain"
          style={{ height: 145, borderRadius: 24 }}
        />
      )}
      <View style={S.spread}>
        <T size={44} bold color={C.green}>
          {round(n.protein)} g
        </T>
        <T size={14} color={C.muted}>
          estimated protein
        </T>
      </View>
      {d.foods.some((f) => f.source === "photo_estimate") && (
        <Notice>
          Check the portion size—this makes the biggest difference.{" "}
          {d.warnings?.join(" ")}
        </Notice>
      )}
      <Field
        label="Meal name"
        value={d.name}
        onChangeText={(name) => update({ name })}
      />
      {d.foods.map((f, index) => (
        <Row
          key={index}
          title={f.name}
          subtitle={`${round(f.grams)} g · ${round(sum([f]).calories)} kcal`}
          right={`${round(sum([f]).protein)} g`}
          onPress={() => a.go("food", { index })}
        />
      ))}
      <Button
        label="Add another food"
        secondary
        onPress={() => a.go("search")}
      />
      <T size={13} bold color={C.muted}>
        Which meal?
      </T>
      <Chips
        values={["breakfast", "lunch", "dinner", "snack"].map((value) => ({
          value,
          label: value[0].toUpperCase() + value.slice(1),
        }))}
        value={d.mealType}
        onChange={(mealType) =>
          update({ mealType: mealType as Meal["mealType"] })
        }
      />
      <Row
        title="When did you eat?"
        subtitle={new Date(d.loggedAt).toLocaleString()}
        onPress={() => setDateMode(dateMode ? null : "date")}
      />
      {dateMode && (
        <>
          <DateTimePicker
            value={new Date(d.loggedAt)}
            mode={dateMode}
            display="spinner"
            maximumDate={new Date(appClock.now())}
            onChange={(_, value) => {
              if (value) update({ loggedAt: value.toISOString() });
            }}
          />
          <Button
            secondary
            label={dateMode === "date" ? "Set time" : "Done"}
            onPress={() => setDateMode(dateMode === "date" ? "time" : null)}
          />
        </>
      )}
      <Field
        label="Notes (optional)"
        value={d.notes}
        onChangeText={(notes) => update({ notes })}
        multiline
      />
      <View style={S.spread}>
        {[
          ["Energy", `${round(n.calories)} kcal`],
          ["Carbs", `${round(n.carbs)} g`],
          ["Fat", `${round(n.fat)} g`],
        ].map(([label, value]) => (
          <View key={label}>
            <T bold>{value}</T>
            <T size={13} color={C.muted}>
              {label}
            </T>
          </View>
        ))}
      </View>
      {error && <Notice error>{error} Your draft is still here.</Notice>}
    </Screen>
  );
}

export function FoodEditor() {
  const a = useApp();
  const index = a.route.params?.index ?? -1;
  const original = a.draft?.foods[index];
  const [name, setName] = useState(original?.name || "");
  const [grams, setGrams] = useState(String(original?.grams || 100));
  const [values, setValues] = useState<Record<string, string>>({
    calories: String(original?.per100g.calories ?? ""),
    protein: String(original?.per100g.protein ?? ""),
    carbs: String(original?.per100g.carbs ?? ""),
    fat: String(original?.per100g.fat ?? ""),
  });
  const [error, setError] = useState("");
  function save() {
    if (
      !name.trim() ||
      !grams.trim() ||
      Object.values(values).some((v) => v.trim() === "")
    ) {
      setError("Complete every field. Enter 0 when a nutrient is absent.");
      return;
    }
    const f: Food = {
      name: name.trim(),
      grams: Number(grams),
      per100g: Object.fromEntries(
        Object.entries(values).map(([k, v]) => [k, Number(v)]),
      ) as Food["per100g"],
      source: original?.source || "user",
    };
    const issue = validateMeal({ ...blankMeal(), foods: [f] });
    if (issue) {
      setError(issue);
      return;
    }
    const d = a.draft || blankMeal();
    const foods = [...d.foods];
    if (index < 0) foods.push(f);
    else foods[index] = f;
    a.setDraft({ ...d, name: d.name === "My meal" ? name : d.name, foods });
    if (index < 0) a.go("review");
    else a.back();
  }
  return (
    <Screen back={a.back} footer={<Button label="Save food" onPress={save} />}>
      <Title
        title={original ? "Edit food and portions" : "Add food"}
        subtitle="Use the food label or your best estimate."
      />
      <Field label="Food name" value={name} onChangeText={setName} />
      <Field
        label="Portion weight (g)"
        value={grams}
        keyboardType="decimal-pad"
        onChangeText={setGrams}
      />
      <T size={21} bold>
        Nutrition per 100 g
      </T>
      <Notice>
        Enter values per 100 g. We’ll calculate the total for your portion.
      </Notice>
      {Object.entries({
        calories: "Calories (kcal)",
        protein: "Protein (g)",
        carbs: "Carbs (g)",
        fat: "Fat (g)",
      }).map(([key, label]) => (
        <Field
          key={key}
          label={label}
          value={values[key]}
          keyboardType="decimal-pad"
          onChangeText={(v) => setValues({ ...values, [key]: v })}
        />
      ))}
      {index >= 0 && (
        <Button
          secondary
          label="Remove this food"
          onPress={() => {
            if (a.draft) {
              a.setDraft({
                ...a.draft,
                foods: a.draft.foods.filter((_, i) => i !== index),
              });
              a.back();
            }
          }}
        />
      )}
      {error && <Notice error>{error}</Notice>}
    </Screen>
  );
}

export function SearchFood() {
  const a = useApp();
  const [q, setQ] = useState("");
  const r = useResource(`/v1/foods?q=${encodeURIComponent(q)}`);
  const fav = useResource("/v1/favorites");
  const [tab, setTab] = useState("foods");
  const add = (foods: Food[]) => {
    const d = a.draft || blankMeal();
    a.setDraft({ ...d, foods: [...d.foods, ...foods] });
    a.go("review");
  };
  return (
    <Screen back={a.back}>
      <Title
        title="Search foods"
        subtitle="Search by food name or choose a saved favorite."
      />
      <Field
        label="Search foods"
        value={q}
        onChangeText={setQ}
        placeholder="Try tofu, eggs or yogurt"
      />
      <Chips
        values={[
          { value: "foods", label: "Foods" },
          { value: "favorites", label: "Favorites" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {r.loading && <ActivityIndicator color={C.green} />}
      {(r.error || fav.error) && <Notice error>{r.error || fav.error}</Notice>}
      {tab === "foods"
        ? r.data?.items?.map((f: Food) => (
            <Row
              key={f.name}
              title={f.name}
              subtitle={`${round(f.per100g.protein)} g protein per 100 g`}
              right="Add"
              onPress={() => add([f])}
            />
          ))
        : fav.data?.items?.map((f: any) => (
            <Row
              key={f.id}
              title={f.name}
              subtitle={`${round(sum(f.foods).protein)} g protein`}
              icon={Heart}
              onPress={() => add(f.foods)}
            />
          ))}
      {!(tab === "foods" ? r.data?.items?.length : fav.data?.items?.length) &&
        !r.loading && <T color={C.muted}>No matches yet. Add food</T>}
      <Button
        secondary
        label="Add food manually"
        onPress={() => a.go("food", { index: -1 })}
      />
      <T size={13} color={C.muted}>
        {r.data?.notice}
      </T>
    </Screen>
  );
}

export function MealDetail() {
  const a = useApp();
  const m: Meal = a.route.params.meal;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [removed, setRemoved] = useState<any>(null);
  const favKey = useRef(randomUUID());
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen back={a.back}>
      <Title
        title={removed ? "Meal removed." : m.name}
        subtitle={new Date(m.loggedAt).toLocaleString()}
      />
      {removed ? (
        <>
          <Notice>
            This meal no longer counts toward your totals. Undo is available for
            30 seconds.
          </Notice>
          <Button
            label="Undo removal"
            busy={busy}
            onPress={() =>
              run(async () => {
                await a.request(`/v1/meals/${m.id}/restore`, "POST", {
                  version: removed.version,
                });
                setRemoved(null);
                a.refresh();
                a.tab("today");
              })
            }
          />
        </>
      ) : (
        <>
          <View style={S.card}>
            <T size={44} bold color={C.green}>
              {round(sum(m.foods).protein)} g
            </T>
            <T>logged protein</T>
          </View>
          {m.foods.map((f, i) => (
            <Row
              key={i}
              title={f.name}
              subtitle={`${f.grams} g`}
              right={`${round(sum([f]).protein)} g`}
            />
          ))}
          {m.notes && <T color={C.muted}>{m.notes}</T>}
          <Button
            label="Edit meal"
            onPress={() => {
              a.setDraft({
                ...m,
                id: undefined,
                editId: m.id,
                editVersion: m.version,
              });
              a.go("review", { editId: m.id, version: m.version });
            }}
          />
          <Button
            label="Log this meal again"
            secondary
            onPress={() =>
              a.beginMeal({
                ...m,
                id: undefined,
                version: undefined,
                loggedAt: new Date(appClock.now()).toISOString(),
              })
            }
          />
          <Button
            label="Save to favorites"
            secondary
            busy={busy}
            onPress={() =>
              run(async () => {
                await a.request(
                  "/v1/favorites",
                  "POST",
                  { name: m.name, foods: m.foods },
                  favKey.current,
                );
                Alert.alert(
                  "Saved to favorites",
                  "Find it next time under Log → Find your food → Favorites.",
                );
              })
            }
          />
          <Button
            label="Remove meal"
            secondary
            busy={busy}
            onPress={() =>
              Alert.alert(
                "Remove this meal?",
                "It will be removed from your daily totals.",
                [
                  { text: "Keep meal", style: "cancel" },
                  {
                    text: "Remove",
                    style: "destructive",
                    onPress: () =>
                      void run(async () => {
                        const value = await a.request(
                          `/v1/meals/${m.id}`,
                          "DELETE",
                          { version: m.version },
                        );
                        setRemoved(value);
                        a.refresh();
                      }),
                  },
                ],
              )
            }
          />
        </>
      )}
      {error && <Notice error>{error}</Notice>}
    </Screen>
  );
}
