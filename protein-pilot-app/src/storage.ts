import * as SecureStore from "expo-secure-store";
import { randomUUID } from "expo-crypto";
// Versioned chunks keep private drafts inside Keychain, under individual item size limits.
type Manifest = { version: string; count: number };
export async function readPrivate<T>(name: string): Promise<T | null> {
  const raw = await SecureStore.getItemAsync(name);
  if (!raw) return null;
  const m: Manifest = JSON.parse(raw);
  let text = "";
  for (let i = 0; i < m.count; i++)
    text += (await SecureStore.getItemAsync(`${name}.${m.version}.${i}`)) || "";
  return JSON.parse(text);
}
export async function writePrivate(name: string, value: unknown) {
  const previous = await SecureStore.getItemAsync(name);
  const text = JSON.stringify(value);
  const version = randomUUID();
  const count = Math.ceil(text.length / 400);
  for (let i = 0; i < count; i++)
    await SecureStore.setItemAsync(
      `${name}.${version}.${i}`,
      text.slice(i * 400, (i + 1) * 400),
      { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
    );
  await SecureStore.setItemAsync(name, JSON.stringify({ version, count }));
  if (previous) {
    const old: Manifest = JSON.parse(previous);
    for (let i = 0; i < old.count; i++)
      await SecureStore.deleteItemAsync(`${name}.${old.version}.${i}`);
  }
}
export async function removePrivate(name: string) {
  const previous = await SecureStore.getItemAsync(name);
  await SecureStore.deleteItemAsync(name);
  if (previous) {
    const old: Manifest = JSON.parse(previous);
    for (let i = 0; i < old.count; i++)
      await SecureStore.deleteItemAsync(`${name}.${old.version}.${i}`);
  }
}
