import { BadgeArt } from "../Badges";
import {
  ProteinFields,
  ProteinResult,
  emptyProteinInputs,
} from "../ProteinProfile";
import React, { useState } from "react";
import { View } from "react-native";
import { Target, Heart, TrendingUp, Mail } from "lucide-react-native";
import { useApp } from "../state";
import { initialProfile, Profile } from "../model";
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
export function Welcome() {
  const a = useApp();
  return (
    <Screen
      background="kitchen"
      footer={
        <>
          <Button
            label="Set up my profile"
            onPress={() => a.go("onboarding")}
          />
          <Button
            label="I already have an account"
            secondary
            onPress={() => a.go("signin")}
          />
        </>
      }
    >
      <Title
        title={"Good food.\nYour own rhythm."}
        subtitle="A thoughtful place for your everyday nutrition."
      />
      <View style={{ alignItems: "center", paddingVertical: 24 }}>
        <BadgeArt index={0} size={190} />
      </View>
      <T size={23} serif>
        Start with you.
      </T>
      <T color={C.muted}>
        A target shaped by your profile. Meals that suit your preferences. A
        journal that grows with you.
      </T>
    </Screen>
  );
}
export function Onboarding() {
  const a = useApp();
  const [step, setStep] = useState(0);
  const [p, setP] = useState<Profile>(a.staged?.profile || initialProfile);
  const [estimate, setEstimate] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [allergies, setAllergies] = useState(p.allergies.join(", "));
  const [error, setError] = useState("");
  const next = async () => {
    setError("");
    if (step === 1) {
      if (!p.name.trim()) {
        setError("Enter your name.");
        return;
      }
      setBusy(true);
      try {
        setEstimate(
          await a.request("/v1/protein-preview", "POST", {
            weightKg: p.weightKg,
            proteinInputs: p.proteinInputs || emptyProteinInputs,
          }),
        );
        setStep(2);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (step === 3) {
      a.setStaged({
        profile: {
          ...p,
          name: p.name.trim(),
          proteinInputs: p.proteinInputs || emptyProteinInputs,
          allergies: allergies
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        },
      });
      a.go("signin");
    } else setStep((n) => n + 1);
  };
  return (
    <Screen
      back={() => {
        if (!busy) {
          if (step) setStep((n) => n - 1);
          else a.back();
        }
      }}
      footer={
        <Button
          label={step === 3 ? "Continue to sign-in" : "Continue"}
          busy={busy}
          onPress={next}
        />
      }
    >
      <T size={13} bold color={C.green}>
        YOUR STARTING POINT · {step + 1} OF 4
      </T>
      {step === 0 ? (
        <>
          <Title
            title="Choose your goal"
            subtitle="Select the goal you want to track."
          />
          {[
            {
              value: "build_muscle",
              label: "Build strength",
              sub: "Support your training and recovery.",
              icon: TrendingUp,
            },
            {
              value: "maintain",
              label: "Maintain my routine",
              sub: "Make a balanced routine feel easier.",
              icon: Target,
            },
            {
              value: "feel_stronger",
              label: "Feel stronger",
              sub: "Track protein for your strength goal.",
              icon: Heart,
            },
          ].map((v) => (
            <View
              key={v.value}
              style={{
                borderRadius: 18,
                borderWidth: p.goal === v.value ? 2 : 1,
                borderColor: p.goal === v.value ? C.green : C.line,
                paddingHorizontal: 14,
              }}
            >
              <Row
                title={v.label}
                subtitle={v.sub}
                icon={v.icon}
                right={p.goal === v.value ? "Selected" : undefined}
                onPress={() => setP({ ...p, goal: v.value })}
              />
            </View>
          ))}
        </>
      ) : step === 1 ? (
        <>
          <Title
            title="Your profile"
            subtitle="We’ll use these details to estimate a starting target."
          />
          <Field
            label="Your name"
            value={p.name}
            onChangeText={(name) => setP({ ...p, name })}
            autoCapitalize="words"
          />
          <ProteinFields
            profile={p}
            onChange={(next) => {
              if (!busy) setP(next);
            }}
          />
        </>
      ) : step === 2 ? (
        <>
          <Title
            title="Your protein starting point"
            subtitle="Calculated from your profile."
          />
          <ProteinResult value={estimate} />
        </>
      ) : (
        <>
          <Title
            title="Food preferences"
            subtitle="Select your diet and list any allergies."
          />
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
            placeholder="For example, milk, soy"
          />
          <Notice>
            Always check ingredients and packaging. Recipe suggestions cannot
            guarantee allergen safety.
          </Notice>
        </>
      )}
      {error && <Notice error>{error}</Notice>}
    </Screen>
  );
}
export function SignIn() {
  const a = useApp();
  const [email, setEmail] = useState(a.me?.email || "");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const send = async () => {
    setBusy(true);
    setError("");
    try {
      await a.request("/v1/auth/request-link", "POST", { email });
      setSent(true);
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
          label={sent ? "Send a fresh link" : "Email me a sign-in link"}
          busy={busy}
          onPress={send}
        />
      }
    >
      <Title
        title={sent ? "Check your inbox." : "Sign in"}
        subtitle={
          sent
            ? `We requested a sign-in link for ${email}.`
            : "Sign in securely. No password to remember."
        }
      />
      <View style={[S.card, { alignItems: "center", padding: 45 }]}>
        <Mail size={66} strokeWidth={1.3} color={C.green} />
      </View>
      {!sent ? (
        <Field
          label="Email address"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="emailAddress"
        />
      ) : (
        <>
          <T color={C.muted}>
            Open the link on this device to continue. It expires in 15 minutes
            and works once.
          </T>
          <Button
            secondary
            label="Use a different email"
            onPress={() => setSent(false)}
          />
          {__DEV__ && (
            <Notice>
              Local test mode: email previews are saved on this Mac. Use the
              simulator sign-in helper described in the setup guide.
            </Notice>
          )}
        </>
      )}
      {(error || a.authError) && <Notice error>{error || a.authError}</Notice>}
      {__DEV__ && sent && (
        <>
          <Field
            label="Paste local sign-in link (testing)"
            value={link}
            onChangeText={setLink}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button
            secondary
            label="Open sign-in link"
            busy={busy}
            onPress={async () => {
              const token = link.match(/token=([A-Za-z0-9_-]{43})/)?.[1];
              if (!token) {
                setError("Paste a valid sign-in link.");
                return;
              }
              setBusy(true);
              await a.verify(token);
              setBusy(false);
            }}
          />
        </>
      )}
    </Screen>
  );
}
