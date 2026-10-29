import {
  ProteinFields,
  ProteinResult,
  emptyProteinInputs,
} from "../ProteinProfile";
import { appClock } from "../clock";
import React, { useRef, useState } from "react";
import { View, Switch, Alert } from "react-native";
import {
  Target,
  Leaf,
  Bell,
  ShieldCheck,
  HelpCircle,
  LogOut,
  Camera,
  Download,
  User,
} from "lucide-react-native";
import * as Notifications from "expo-notifications";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { randomUUID } from "expo-crypto";
import { useApp, useResource } from "../state";
import { localDay } from "../model";
import {
  Button,
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
async function clearReminders() {
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  for (const p of pending)
    if (p.content.data?.app === "proteinpilot")
      await Notifications.cancelScheduledNotificationAsync(p.identifier);
}
export function ProfileScreen() {
  const a = useApp();
  const day = useResource(`/v1/days/${localDay(a.me?.profile.timezone)}`);
  const [error, setError] = useState("");
  return (
    <Screen back={a.back}>
      <Title
        title="Settings"
        subtitle={`${a.me?.profile.name} · ${a.me?.email}`}
      />
      <View style={S.card}>
        <T bold color={C.green}>
          Your current focus
        </T>
        <T color={C.muted}>
          {a.me?.profile.goal.replaceAll("_", " ")} ·{" "}
          {day.data?.proteinTarget ?? "No"} g daily target
        </T>
      </View>
      <Row
        title="Your profile"
        subtitle="Name, timezone and your focus"
        icon={User}
        onPress={() => a.go("editProfile")}
      />
      <Row
        title="Goals & targets"
        subtitle="Calculate from your profile and training"
        icon={Target}
        onPress={() => a.go("target", { target: day.data?.proteinTarget })}
      />
      <Row
        title="Food preferences"
        subtitle="Diet, allergies and preferences"
        icon={Leaf}
        onPress={() => a.go("diet")}
      />
      <Row
        title="Reminders"
        subtitle="Set a time to log meals"
        icon={Bell}
        onPress={() => a.go("reminders")}
      />
      <Row
        title="Account & privacy"
        subtitle="Manage photo analysis, export, and account deletion"
        icon={ShieldCheck}
        onPress={() => a.go("privacy")}
      />
      <Row
        title="Support"
        subtitle="Send a support message"
        icon={HelpCircle}
        onPress={() => a.go("support")}
      />
      <Row
        title="Sign out"
        icon={LogOut}
        onPress={() =>
          Alert.alert(
            "Sign out?",
            "Finish your drafts and sync queued meals first.",
            [
              { text: "Stay here", style: "cancel" },
              {
                text: "Sign out",
                onPress: async () => {
                  try {
                    await a.signOut();
                    await clearReminders();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                },
              },
            ],
          )
        }
      />
      {error && <Notice error>{error}</Notice>}
    </Screen>
  );
}
export function Preferences() {
  const a = useApp();
  const name = a.route.name;
  const [p, setP] = useState({ ...a.me.profile });
  const [allergies, setAllergies] = useState(p.allergies.join(", "));
  const [exclusions, setExclusions] = useState(p.exclusions.join(", "));
  const [estimate, setEstimate] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      if (name === "target" && !estimate) {
        const result = await a.request("/v1/protein-preview", "POST", {
          weightKg: p.weightKg,
          proteinInputs: p.proteinInputs || emptyProteinInputs,
        });
        setEstimate(result);
        return;
      }
      await a.request("/v1/me/profile", "PUT", {
        ...p,
        ...(name === "target"
          ? { proteinInputs: p.proteinInputs || emptyProteinInputs }
          : {}),
        allergies: allergies
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean),
        exclusions: exclusions
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean),
      });
      await a.reload();
      a.refresh();
      a.back();
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
        <Button
          label={
            name === "target"
              ? estimate
                ? "Use this profile"
                : "Calculate my target"
              : "Save changes"
          }
          busy={busy}
          onPress={save}
        />
      }
    >
      <Title
        title={
          name === "target"
            ? "Protein target"
            : name === "diet"
              ? "Food preferences"
              : "Profile"
        }
        subtitle="Update your details, then save your changes."
      />
      {name === "target" ? (
        <>
          <ProteinFields
            profile={p}
            onChange={(next) => {
              if (!busy) {
                setP(next);
                setEstimate(null);
              }
            }}
          />
          <ProteinResult value={estimate} />
        </>
      ) : name === "diet" ? (
        <>
          <Chips
            values={["omnivore", "vegetarian", "vegan", "pescatarian"].map(
              (value) => ({
                value,
                label: value[0].toUpperCase() + value.slice(1),
              }),
            )}
            value={p.diet}
            onChange={(diet) => setP({ ...p, diet })}
          />
          <Field
            label="Allergies (comma separated)"
            value={allergies}
            onChangeText={setAllergies}
          />
          <Field
            label="Foods to avoid (comma separated)"
            value={exclusions}
            onChangeText={setExclusions}
          />
          <Notice>
            Check every ingredient. Suggestions can’t guarantee allergen safety
            or account for cross-contact.
          </Notice>
        </>
      ) : (
        <>
          <Field
            label="Your name"
            value={p.name}
            onChangeText={(name) => setP({ ...p, name })}
          />
          <Field
            label="Timezone"
            value={p.timezone}
            onChangeText={(timezone) => setP({ ...p, timezone })}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Chips
            values={[
              { value: "build_muscle", label: "Build strength" },
              { value: "maintain", label: "Maintain my routine" },
              { value: "feel_stronger", label: "Feel stronger" },
            ]}
            value={p.goal}
            onChange={(goal) => setP({ ...p, goal })}
          />
          <Notice>
            Your timezone determines the day when new meals are logged. Existing
            journal entries won’t move automatically.
          </Notice>
        </>
      )}
      {error && <Notice error>{error}</Notice>}
    </Screen>
  );
}
export function Reminders() {
  const a = useApp();
  const [enabled, setEnabled] = useState(a.me.reminders.enabled || false);
  const [times, setTimes] = useState(
    a.me.reminders.times?.join(", ") || "12:30, 19:00",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const list = times
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
      if (
        list.length > 5 ||
        list.some((s: string) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(s))
      )
        throw new Error(
          "Use up to five times in 24-hour format, for example 12:30, 19:00.",
        );
      if (enabled) {
        const permission = await Notifications.requestPermissionsAsync();
        if (!permission.granted)
          throw new Error(
            "Notifications are off. Enable them in device settings, then try again.",
          );
      }
      await a.request("/v1/me/reminders", "PUT", { enabled, times: list });
      await clearReminders();
      if (enabled)
        for (const time of list) {
          const [hour, minute] = time.split(":").map(Number);
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "Meal logging reminder",
              body: "Ready to log your next meal?",
              data: { app: "proteinpilot" },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DAILY,
              hour,
              minute,
            },
          });
        }
      await a.reload();
      a.back();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen
      back={a.back}
      footer={<Button label="Save reminders" busy={busy} onPress={save} />}
    >
      <Title
        title="Meal reminders"
        subtitle="Choose when to receive a meal reminder."
      />
      <View style={[S.card, S.spread]}>
        <T bold>Meal reminders</T>
        <Switch
          value={enabled}
          onValueChange={setEnabled}
          accessibilityLabel="Meal reminders"
          trackColor={{ true: C.green }}
        />
      </View>
      <Field
        label="Reminder times"
        value={times}
        onChangeText={setTimes}
        placeholder="12:30, 19:00"
      />
      <T color={C.muted}>
        Times follow your device’s local clock. Notifications are scheduled on
        this device only.
      </T>
      {error && <Notice error>{error}</Notice>}
    </Screen>
  );
}
export function Privacy() {
  const a = useApp();
  return (
    <Screen back={a.back}>
      <Title
        title="Account & privacy"
        subtitle="Manage your data and account settings."
      />
      <Row
        title="Your photos & AI"
        subtitle={
          a.me.profile.photoConsent
            ? "Photo analysis is enabled"
            : "Photo analysis is off"
        }
        icon={Camera}
        onPress={() => a.go("photoPrivacy")}
      />
      <Row
        title="Export my data"
        subtitle="Download a private copy of your journal"
        icon={Download}
        onPress={() => a.go("export")}
      />
      <Row
        title="Delete my account"
        subtitle="Permanently remove your active account data"
        icon={ShieldCheck}
        onPress={() => a.go("delete")}
      />
      <Notice>
        Your data is private to your account. Never share your sign-in links.
      </Notice>
    </Screen>
  );
}
export function PhotoPrivacy() {
  const a = useApp();
  const [enabled, setEnabled] = useState(a.me.profile.photoConsent);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Screen
      back={a.back}
      footer={
        <Button
          label="Save preference"
          busy={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await a.request("/v1/me/profile", "PUT", {
                ...a.me.profile,
                photoConsent: enabled,
              });
              await a.reload();
              a.back();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      }
    >
      <Title
        title="Your photos & AI."
        subtitle="Review how food photos are processed."
      />
      <View style={S.spread}>
        <T style={{ flex: 1 }} bold>
          Allow photo analysis
        </T>
        <Switch
          accessibilityLabel="Allow photo analysis"
          value={enabled}
          onValueChange={setEnabled}
          trackColor={{ true: C.green }}
        />
      </View>
      <T>
        Your selected photo is sent to OpenAI to identify visible foods and
        estimate portions. You review every estimate before logging.
      </T>
      <T>
        Analysis uploads are deleted after processing, failure or cancellation.
        Queued uploads expire after 24 hours. A private thumbnail stays with
        your saved meal. Unlogged thumbnails expire after seven days. Deleting
        the meal removes its thumbnail after the 30-second undo window.
      </T>
      <Notice>
        OpenAI may retain abuse-monitoring data according to its API policy.
        Turning this off cancels pending analyses; it cannot undo a photo
        already sent to OpenAI.
      </Notice>
      <T>
        Manual logging remains available. Coach messages separately send your
        profile, today’s log and recent conversation to OpenAI when you press
        Send.
      </T>
      {error && <Notice error>{error}</Notice>}
    </Screen>
  );
}
export function ExportData() {
  const a = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const download = async () => {
    setBusy(true);
    setError("");
    let file: File | undefined;
    try {
      const job = await a.request("/v1/exports", "POST", {});
      const data = await a.request(job.downloadUrl);
      file = new File(
        Paths.cache,
        `protein-pilot-export-${appClock.now()}.json`,
      );
      file.write(JSON.stringify(data, null, 2));
      if (!(await Sharing.isAvailableAsync()))
        throw new Error("Sharing is unavailable on this device.");
      await Sharing.shareAsync(file.uri, {
        mimeType: "application/json",
        UTI: "public.json",
        dialogTitle: "Your Protein Pilot data",
      });
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      file?.delete();
      setBusy(false);
    }
  };
  return (
    <Screen
      back={a.back}
      footer={
        <Button
          label={done ? "Export again" : "Prepare & share my data"}
          busy={busy}
          onPress={download}
        />
      }
    >
      <Title
        title="Export data"
        subtitle="Your journal, goals and preferences."
      />
      <View style={[S.card, { alignItems: "center", padding: 40 }]}>
        <Download size={60} color={C.green} />
      </View>
      <T>
        Prepare a JSON export and choose where to save it using the system share
        sheet. No email is sent.
      </T>
      {done && (
        <Notice>
          The share sheet was opened. Your chosen destination controls whether
          the file was saved.
        </Notice>
      )}
      {error && <Notice error>{error}</Notice>}
    </Screen>
  );
}
export function Support() {
  const a = useApp();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const key = useRef(randomUUID());
  return (
    <Screen
      back={a.back}
      footer={
        done ? (
          <Button label="Back to profile" onPress={a.back} />
        ) : (
          <Button
            label="Send support message"
            busy={busy}
            onPress={async () => {
              setBusy(true);
              try {
                await a.request("/v1/support", "POST", { text }, key.current);
                setDone(true);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        )
      }
    >
      <Title
        title={done ? "Message recorded." : "Contact support"}
        subtitle={
          done
            ? "Your message is saved in the support queue."
            : "Tell us what’s on your mind."
        }
      />
      {done ? (
        <Notice>
          This local test build records support messages. It does not send email
          or promise a response time.
        </Notice>
      ) : (
        <Field
          label="Your message"
          value={text}
          onChangeText={(v) => {
            setText(v);
            key.current = randomUUID();
          }}
          multiline
          style={{ minHeight: 180, textAlignVertical: "top" }}
        />
      )}
      {error && <Notice error>{error}</Notice>}
    </Screen>
  );
}
export function DeleteAccount() {
  const a = useApp();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Screen
      back={a.back}
      footer={
        <Button
          label="Delete my account"
          destructive
          disabled={text !== "DELETE MY ACCOUNT"}
          busy={busy}
          onPress={() =>
            Alert.alert(
              "Permanently delete your account?",
              "This removes your journal, preferences and active account data.",
              [
                { text: "Keep my account", style: "cancel" },
                {
                  text: "Delete account",
                  style: "destructive",
                  onPress: async () => {
                    setBusy(true);
                    try {
                      await a.request("/v1/me", "DELETE", {
                        confirmation: text,
                      });
                      await clearReminders();
                      await a.clearLocal();
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  },
                },
              ],
            )
          }
        />
      }
    >
      <Title
        title="Delete your account?"
        subtitle="Take a moment. This can’t be undone."
      />
      <Notice>
        Export anything you want to keep first. Deletion removes active account
        data, but cannot erase provider retention or independent backups.
      </Notice>
      <T>
        For your security, sign in with a fresh email link within the last 10
        minutes.
      </T>
      <Button
        secondary
        label="Verify my identity again"
        onPress={() => a.go("signin")}
      />
      <Field
        label="Type DELETE MY ACCOUNT"
        value={text}
        onChangeText={setText}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      {error && <Notice error>{error}</Notice>}
    </Screen>
  );
}
