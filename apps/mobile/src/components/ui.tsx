import {
  Text,
  View,
  Pressable,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  type TextInputProps,
} from "react-native";
import type { ReactNode } from "react";
export const C = {
  green: "#145c48",
  ink: "#213a30",
  muted: "#7d8e7e",
  bg: "#f7f8f3",
  line: "#e3e8dd",
  soft: "#eaf1df",
  white: "#ffffff",
};
export function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        (disabled || pressed) && { opacity: 0.6 },
      ]}
    >
      <Text style={[s.buttonText, secondary && { color: C.green }]}>
        {title}
      </Text>
    </Pressable>
  );
}
export function Input({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#a2ad99"
        style={[
          s.input,
          props.multiline && { height: 90, textAlignVertical: "top" },
        ]}
        {...props}
      />
    </View>
  );
}
export function Badge({ value }: { value: string }) {
  return (
    <View style={s.badge}>
      <Text style={s.badgeText}>{value.replaceAll("_", " ")}</Text>
    </View>
  );
}
export function Card({ children }: { children: ReactNode }) {
  return <View style={s.card}>{children}</View>;
}
export function Empty({ text }: { text: string }) {
  return (
    <View style={s.empty}>
      <Text style={s.emptyText}>{text}</Text>
    </View>
  );
}
export function Loading() {
  return (
    <View style={s.empty}>
      <ActivityIndicator color={C.green} />
      <Text style={s.emptyText}>Loading…</Text>
    </View>
  );
}
export const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },
  body: { padding: 20, paddingBottom: 35 },
  h1: {
    fontSize: 29,
    lineHeight: 35,
    fontWeight: "700",
    color: C.ink,
    letterSpacing: -1,
  },
  h2: { fontSize: 20, fontWeight: "600", color: C.ink, marginBottom: 12 },
  h3: { fontSize: 15, fontWeight: "600", color: C.ink },
  p: { fontSize: 13, lineHeight: 21, color: C.muted },
  eyebrow: {
    fontSize: 9,
    letterSpacing: 1.7,
    fontWeight: "700",
    color: "#829676",
    marginBottom: 8,
  },
  card: {
    backgroundColor: C.white,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    marginBottom: 15,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  button: {
    backgroundColor: C.green,
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    minHeight: 48,
  },
  secondary: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line },
  buttonText: { color: C.white, fontSize: 13, fontWeight: "600" },
  field: { marginTop: 13 },
  label: { fontSize: 12, color: "#607655", marginBottom: 7, fontWeight: "500" },
  input: {
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 9,
    padding: 12,
    fontSize: 14,
    color: C.ink,
    backgroundColor: "#fff",
    minHeight: 46,
  },
  badge: {
    alignSelf: "flex-start",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: "#eaf0df",
  },
  badgeText: { fontSize: 10, color: "#6b8459", textTransform: "capitalize" },
  empty: { padding: 38, alignItems: "center", gap: 15 },
  emptyText: {
    fontSize: 13,
    lineHeight: 21,
    color: C.muted,
    textAlign: "center",
  },
  error: {
    backgroundColor: "#fff0e9",
    borderRadius: 9,
    padding: 12,
    marginVertical: 10,
  },
  errorText: { color: "#a7644a", fontSize: 12, lineHeight: 19 },
  line: { height: 1, backgroundColor: C.line, marginVertical: 15 },
  price: { fontSize: 18, fontWeight: "700", color: C.ink },
  small: { fontSize: 11, color: C.muted, lineHeight: 17 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: C.white,
  },
  tabActive: { backgroundColor: C.green, borderColor: C.green },
  tabText: { fontSize: 11, color: C.muted },
  tabTextActive: { color: C.white },
  hero: {
    backgroundColor: C.soft,
    borderRadius: 18,
    padding: 24,
    marginBottom: 20,
  },
  thumb: {
    width: 65,
    height: 65,
    resizeMode: "contain",
    borderRadius: 8,
    backgroundColor: "#f3f6ed",
  },
  sectionGap: { marginTop: 22 },
  nav: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: C.line,
    paddingVertical: 12,
    backgroundColor: C.white,
  },
  navItem: { flex: 1, alignItems: "center", paddingVertical: 5 },
  navText: { fontSize: 10, color: C.muted },
  navActive: { color: C.green, fontWeight: "700" },
  qty: { flexDirection: "row", alignItems: "center", gap: 15, marginTop: 10 },
  qtyButton: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 8,
    padding: 7,
    minWidth: 32,
    alignItems: "center",
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderColor: C.line,
  },
  brand: { fontSize: 25, fontWeight: "700", letterSpacing: -1, color: C.green },
});
