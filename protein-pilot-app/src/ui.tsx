import React from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  ChevronRight,
  Sprout,
  Settings,
  Utensils,
  Sun,
  CalendarDays,
  Plus,
  ChartNoAxesCombined,
} from "lucide-react-native";
export const C = {
  brass: "#A88A50",
  ground: "#F5F1E8",
  surface: "#FBF8F1",
  ink: "#20251F",
  muted: "#686C60",
  line: "#D9D3C5",
  green: "#244735",
  soft: "#EAEADF",
  notice: "#8A672B",
  warn: "#F0EADB",
  danger: "#9B413D",
};
export const S = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  spread: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stack: { gap: 18 },
  card: {
    backgroundColor: C.surface,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 8,
    padding: 20,
    gap: 12,
  },
  input: {
    backgroundColor: C.surface,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 6,
    padding: 16,
    minHeight: 54,
    fontFamily: "Manrope_400Regular",
    fontSize: 17,
    color: C.ink,
  },
  rule: {
    borderBottomColor: C.line,
    borderBottomWidth: 1,
    paddingVertical: 15,
  },
  grow: { flex: 1 },
});
export function T({
  children,
  size = 16,
  bold = false,
  color = C.ink,
  serif = false,
  style,
  ...rest
}: React.ComponentProps<typeof Text> & {
  size?: number;
  bold?: boolean;
  color?: string;
  serif?: boolean;
}) {
  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily:
            serif || size >= 21
              ? Platform.OS === "ios"
                ? "Georgia"
                : "serif"
              : bold
                ? "Manrope_600SemiBold"
                : "Manrope_400Regular",
          fontVariant: ["tabular-nums"],
          fontSize: size,
          lineHeight: size * 1.35,
          color,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Title({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={{ gap: 8, paddingBottom: 8 }}>
      <T size={36} serif accessibilityRole="header">
        {title}
      </T>
      {subtitle && (
        <T size={14} color={C.muted}>
          {subtitle}
        </T>
      )}
    </View>
  );
}
export function Button({
  label,
  onPress,
  secondary = false,
  busy = false,
  disabled = false,
  testID,
  destructive = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  busy?: boolean;
  disabled?: boolean;
  testID?: string;
  destructive?: boolean;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: secondary
          ? "transparent"
          : destructive
            ? C.danger
            : C.green,
        borderWidth: 1,
        borderColor: destructive ? C.danger : secondary ? C.line : C.green,
        borderRadius: 6,
        minHeight: 50,
        padding: 16,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
      })}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? C.green : "white"} />
      ) : (
        <T size={16} bold color={secondary ? C.green : "white"}>
          {label}
        </T>
      )}
    </Pressable>
  );
}
export function Field({
  label,
  error,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string; error?: string }) {
  return (
    <View style={{ gap: 8 }}>
      <T size={13} bold color={C.muted}>
        {label}
      </T>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={C.muted}
        {...props}
        style={[S.input, props.style]}
      />
      {error && (
        <T size={13} color={C.danger}>
          {error}
        </T>
      )}
    </View>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        backgroundColor: error ? "#F7E7E3" : C.warn,
        padding: 14,
        borderRadius: 4,
        borderLeftWidth: 2,
        borderLeftColor: error ? C.danger : C.brass,
      }}
    >
      <T size={14} color={error ? C.danger : C.notice}>
        {children}
      </T>
    </View>
  );
}
export function Row({
  title,
  subtitle,
  right,
  onPress,
  icon: Icon = Utensils,
  thumbnail,
  testID,
}: {
  title: string;
  subtitle?: string;
  right?: string;
  onPress?: () => void;
  icon?: any;
  thumbnail?: React.ReactNode;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={[
        S.row,
        S.rule,
        { backgroundColor: "transparent", minHeight: 76, paddingHorizontal: 0 },
      ]}
    >
      {thumbnail || (
        <View
          style={{
            width: 42,
            height: 42,
            backgroundColor: C.soft,
            borderRadius: 30,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon color={C.green} size={21} />
        </View>
      )}
      <View style={{ flex: 1, gap: 4 }}>
        <T size={17} serif>
          {title}
        </T>
        {subtitle && (
          <T size={13} color={C.muted}>
            {subtitle}
          </T>
        )}
      </View>
      {right ? (
        <T size={15} bold style={{ maxWidth: 90, textAlign: "right" }}>
          {right}
        </T>
      ) : onPress ? (
        <ChevronRight size={19} color={C.muted} />
      ) : null}
    </Pressable>
  );
}
export function Chips({
  values,
  value,
  onChange,
}: {
  values: { value: string; label: string }[];
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {values.map((v) => (
        <Pressable
          key={v.value}
          accessibilityRole="button"
          accessibilityState={{ selected: value === v.value }}
          onPress={() => onChange(v.value)}
          style={{
            borderRadius: 5,
            borderWidth: 1,
            borderColor: v.value === value ? C.green : C.line,
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: v.value === value ? C.green : C.soft,
          }}
        >
          <T size={14} bold color={v.value === value ? "white" : C.green}>
            {v.label}
          </T>
        </Pressable>
      ))}
    </View>
  );
}
export function Screen({
  children,
  back,
  profile,
  footer,
  tabs,
  active,
  onTab,
}: {
  children: React.ReactNode;
  background?: "pantry" | "fridge" | "kitchen";
  back?: () => void;
  profile?: () => void;
  footer?: React.ReactNode;
  tabs?: boolean;
  active?: string;
  onTab?: (s: string) => void;
}) {
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: C.ground }}
      edges={["top", "bottom"]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={[
            S.spread,
            {
              paddingHorizontal: 24,
              paddingTop: 8,
              paddingBottom: 18,
              backgroundColor: C.ground,
            },
          ]}
        >
          {back ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={back}
              style={[S.row, { minHeight: 44 }]}
            >
              <ArrowLeft color={C.green} size={23} />
              <T bold color={C.green}>
                Back
              </T>
            </Pressable>
          ) : (
            <View style={S.row}>
              <Sprout size={27} strokeWidth={1.2} color={C.green} />
              <T serif size={21} color={C.green}>
                protein pilot
              </T>
            </View>
          )}
          {profile && (
            <Pressable
              accessibilityLabel="Profile"
              accessibilityRole="button"
              onPress={profile}
              style={{
                backgroundColor: "transparent",
                borderRadius: 22,
                width: 44,
                height: 44,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Settings size={21} strokeWidth={1.3} color={C.green} />
            </Pressable>
          )}
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingBottom: 24,
            gap: 18,
            flexGrow: 1,
          }}
        >
          {children}
        </ScrollView>
        {footer && (
          <View
            style={{
              paddingHorizontal: 24,
              paddingTop: 12,
              paddingBottom: 12,
              backgroundColor: C.ground,
              gap: 10,
            }}
          >
            {footer}
          </View>
        )}
        {tabs && (
          <View
            style={[
              S.spread,
              {
                backgroundColor: C.ground,
                borderTopColor: C.line,
                borderTopWidth: 1,
                paddingHorizontal: 20,
                paddingTop: 12,
                paddingBottom: 8,
              },
            ]}
          >
            {[
              { id: "today", title: "Today", icon: Sun },
              { id: "plan", title: "Plan", icon: CalendarDays },
              { id: "log", title: "Log", icon: Plus },
              { id: "progress", title: "Progress", icon: ChartNoAxesCombined },
            ].map(({ id, title, icon: Icon }) => (
              <Pressable
                key={id}
                testID={`tab-${id}`}
                accessibilityLabel={title}
                accessibilityRole="tab"
                accessibilityState={{ selected: active === id }}
                onPress={() => onTab?.(id)}
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  flex: 1,
                  minHeight: 56,
                  borderBottomWidth: 1,
                  borderBottomColor: active === id ? C.green : "transparent",
                }}
              >
                <Icon
                  size={23}
                  strokeWidth={active === id ? 1.8 : 1.2}
                  color={active === id ? C.green : C.muted}
                />
                <T
                  size={11}
                  bold={active === id}
                  color={active === id ? C.green : C.muted}
                >
                  {title}
                </T>
              </Pressable>
            ))}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Plate() {
  return (
    <View
      accessible={false}
      style={{
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 28,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: C.line,
      }}
    >
      <Sprout size={64} strokeWidth={1} color={C.green} />
      <T size={11} color={C.muted} style={{ letterSpacing: 3, marginTop: 14 }}>
        FROM YOUR FIELD NOTES
      </T>
    </View>
  );
}
export function TextAction({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        justifyContent: "center",
        opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
      })}
    >
      <T size={14} color={C.green} style={{ textDecorationLine: "underline" }}>
        {label}
      </T>
    </Pressable>
  );
}
