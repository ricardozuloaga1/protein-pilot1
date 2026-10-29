import { decimalValue, reconcileDecimalText } from "./profile-input";
import React, { useState, useEffect } from "react";
import { Linking } from "react-native";
import { Profile } from "./model";
import { Button, Chips, Field, Notice, T } from "./ui";
export const emptyProteinInputs = {
  age: 0,
  heightCm: 0,
  training: "none" as const,
  trainingDays: 0,
  guidance: "prefer_not_to_say" as const,
};
// Keep the editable text: converting "82." back to "82" while typing loses the decimal.
function DecimalField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const [text, setText] = useState(
    value === null || value === 0 ? "" : String(value),
  );
  useEffect(() => {
    setText((current) => reconcileDecimalText(current, value));
  }, [value]);
  return (
    <Field
      label={label}
      value={text}
      onChangeText={(next) => {
        setText(next);
        onChange(decimalValue(next));
      }}
      keyboardType="decimal-pad"
    />
  );
}
export function ProteinFields({
  profile,
  onChange,
}: {
  profile: Profile;
  onChange: (p: Profile) => void;
}) {
  const p = profile.proteinInputs || emptyProteinInputs;
  const update = (v: Partial<typeof p>) =>
    onChange({ ...profile, proteinInputs: { ...p, ...v } });
  return (
    <>
      <Field
        label="Age in years"
        value={p.age ? String(p.age) : ""}
        onChangeText={(v) => update({ age: Number(v) })}
        keyboardType="number-pad"
      />
      <DecimalField
        label="Current weight (kg)"
        value={profile.weightKg}
        onChange={(weightKg) =>
          onChange({ ...profile, proteinInputs: p, weightKg })
        }
      />
      <DecimalField
        label="Height (cm)"
        value={p.heightCm}
        onChange={(heightCm) => update({ heightCm: heightCm ?? 0 })}
      />
      <T>How do you train?</T>
      <Chips
        values={[
          { value: "none", label: "No regular training" },
          { value: "strength", label: "Strength" },
          { value: "endurance", label: "Endurance" },
          { value: "mixed", label: "Mixed" },
        ]}
        value={p.training}
        onChange={(training) =>
          update({
            training: training as typeof p.training,
            trainingDays: training === "none" ? 0 : Math.max(1, p.trainingDays),
          })
        }
      />
      {p.training !== "none" && (
        <Field
          label="Training days per week"
          value={String(p.trainingDays)}
          onChangeText={(v) => update({ trainingDays: Number(v) })}
          keyboardType="number-pad"
        />
      )}
      <T>Does your nutrition need special guidance?</T>
      <Chips
        values={[
          { value: "none", label: "None of these" },
          { value: "clinician", label: "Kidney condition or prescribed diet" },
          {
            value: "pregnancy_breastfeeding",
            label: "Pregnant or breastfeeding",
          },
          { value: "prefer_not_to_say", label: "Prefer not to say" },
        ]}
        value={p.guidance}
        onChange={(guidance) =>
          update({ guidance: guidance as typeof p.guidance })
        }
      />
      <Notice>
        Weight informs the estimate. Age, height and guidance needs help us
        check whether this general adult calculation fits. These answers are not
        sent to the AI coach.
      </Notice>
    </>
  );
}
export function ProteinResult({ value }: { value: any }) {
  if (!value) return null;
  return (
    <>
      <T size={32} bold>
        {value.protein === null
          ? "Keep logging without a target"
          : `${value.protein} g per day`}
      </T>
      {value.range && (
        <T>
          Reference range: {value.range.min}–{value.range.max} g/day
        </T>
      )}
      <Notice>{value.explanation}</Notice>
      <T>
        Update your profile whenever your weight or training changes. Changes
        apply from today.
      </T>
      <Button
        secondary
        label="About the nutrition guidance"
        onPress={() => void Linking.openURL(value.sources[0])}
      />
    </>
  );
}
