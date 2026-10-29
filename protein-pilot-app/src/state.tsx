import { appClock } from "./clock";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Alert, AppState, BackHandler } from "react-native";
import * as Linking from "expo-linking";
import * as Crypto from "expo-crypto";
import { api, APIError } from "./api";
import { readPrivate, writePrivate, removePrivate } from "./storage";
import { Meal, Profile, initialProfile, blankMeal } from "./model";
import { saveRemoteMeal } from "./meal-save";
type Route = { name: string; params?: any };
type Session = { accessToken: string; expiresAt: number; userId: string };
type Pending = { key: string; meal: Meal };
type Context = {
  route: Route;
  go: (name: string, params?: any) => void;
  back: () => void;
  tab: (name: string) => void;
  session: Session | null;
  me: any;
  reload: () => Promise<void>;
  request: <T = any>(
    path: string,
    method?: string,
    body?: unknown,
    key?: string,
  ) => Promise<T>;
  verify: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  booting: boolean;
  authError: string;
  staged: { profile: Profile; target?: number } | null;
  setStaged: (v: { profile: Profile; target?: number } | null) => void;
  draft: Meal | null;
  setDraft: (v: Meal | null) => void;
  beginMeal: (v?: Meal) => void;
  saveMeal: () => Promise<boolean>;
  pending: Pending[];
  sync: () => Promise<void>;
  notice: string;
  setNotice: (s: string) => void;
  revision: number;
  refresh: () => void;
  clearLocal: () => Promise<void>;
};
const Ctx = createContext<Context>(null!);
export const useApp = () => useContext(Ctx);
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = useState<Route[]>([{ name: "welcome" }]);
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<any>(null);
  const [booting, setBooting] = useState(true);
  const [authError, setAuthError] = useState("");
  const [staged, setStaged] = useState<{
    profile: Profile;
    target?: number;
  } | null>(null);
  const [draft, setDraftState] = useState<Meal | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const stagedRef = useRef(staged);
  stagedRef.current = staged;
  const tokenRef = useRef<Session | null>(null);
  tokenRef.current = session;
  const verifying = useRef(false);
  const syncLock = useRef(false);
  const saveKey = useRef<string>("");
  const savedFingerprint = useRef("");
  const persist = useRef(Promise.resolve());
  const route = stack[stack.length - 1];
  const go = (name: string, params?: any) =>
    setStack((s) => [...s, { name, params }]);
  const back = () =>
    setStack((s) =>
      s.length > 1
        ? s.slice(0, -1)
        : [{ name: tokenRef.current ? "today" : "welcome" }],
    );
  const tab = (name: string) => setStack([{ name }]);
  const refresh = () => setRevision((n) => n + 1);
  async function request<T = any>(
    path: string,
    method = "GET",
    body?: unknown,
    key?: string,
  ): Promise<T> {
    try {
      return await api<T>(
        path,
        tokenRef.current?.accessToken || null,
        method,
        body,
        key,
      );
    } catch (e) {
      if (e instanceof APIError && e.status === 401) {
        setAuthError(e.message);
        go("signin");
      }
      throw e;
    }
  }
  async function reload() {
    const value = await request("/v1/me");
    setMe(value);
    if (tokenRef.current)
      await writePrivate(`me.${tokenRef.current.userId}`, value);
    return value;
  }
  function setDraft(value: Meal | null) {
    setDraftState(value);
    const uid = tokenRef.current?.userId;
    if (uid) {
      persist.current = persist.current
        .catch(() => {})
        .then(() =>
          value
            ? writePrivate(`draft.${uid}`, value)
            : removePrivate(`draft.${uid}`),
        );
      void persist.current.catch(() => {
        setNotice(
          "Could not save this draft on your device. Keep the app open and retry.",
        );
      });
    }
  }
  function beginMeal(value?: Meal) {
    const start = () => {
      setDraft({ ...(value || blankMeal()) });
      go("review");
    };
    if (draft?.foods.length) {
      Alert.alert("Replace your draft?", "You have a meal in progress.", [
        { text: "Keep draft", style: "cancel" },
        { text: "Replace", style: "destructive", onPress: start },
      ]);
    } else start();
  }
  async function verify(token: string) {
    if (verifying.current) return;
    verifying.current = true;
    setAuthError("");
    try {
      const digest = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        token,
      );
      if ((await readPrivate<string>("last-link")) === digest) return;
      const next = await api<Session>("/v1/auth/verify", null, "POST", {
        token,
      });
      await writePrivate("session", next);
      await writePrivate("last-link", digest);
      tokenRef.current = next;
      setSession(next);
      const setup =
        stagedRef.current ||
        (await readPrivate<{ profile: Profile; target?: number }>(
          "onboarding",
        ));
      if (setup) {
        await api("/v1/me/profile", next.accessToken, "PUT", setup.profile);
        setStaged(null);
        await removePrivate("onboarding");
      }
      const user = await api("/v1/me", next.accessToken);
      setMe(user);
      await writePrivate(`me.${next.userId}`, user);
      setPending(
        (await readPrivate<Pending[]>(`pending.${next.userId}`)) || [],
      );
      setDraftState(await readPrivate<Meal>(`draft.${next.userId}`));
      tab("today");
      refresh();
    } catch (e) {
      setAuthError((e as Error).message);
      go("signin");
    } finally {
      verifying.current = false;
    }
  }
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const savedSetup = await readPrivate<{
          profile: Profile;
          target?: number;
        }>("onboarding");
        if (savedSetup) setStaged(savedSetup);
        const s = await readPrivate<Session>("session");
        if (s && s.expiresAt > appClock.now()) {
          tokenRef.current = s;
          let u;
          try {
            u = await api("/v1/me", s.accessToken);
            await writePrivate(`me.${s.userId}`, u);
          } catch (e) {
            if (!(e instanceof APIError) || e.status !== 0) throw e;
            u = await readPrivate(`me.${s.userId}`);
            if (!u) throw e;
            setNotice(
              "You’re offline. New manual meals can be saved on this device.",
            );
          }
          if (live) {
            setSession(s);
            setMe(u);
            setDraftState(await readPrivate(`draft.${s.userId}`));
            setPending(
              (await readPrivate<Pending[]>(`pending.${s.userId}`)) || [],
            );
            tab("today");
          }
        }
      } catch {
        setAuthError(
          "Sign in to reconnect. Your saved drafts remain on this device.",
        );
      } finally {
        if (live) setBooting(false);
      }
    })();
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (staged) void writePrivate("onboarding", staged).catch(() => {});
  }, [staged]);
  useEffect(() => {
    const handle = (url: string) => {
      const match = url.match(/[#?&]token=([A-Za-z0-9_-]{43})(?:&|$)/);
      if (match) void verify(match[1]);
    };
    const subscription = Linking.addEventListener("url", ({ url }) =>
      handle(url),
    );
    void Linking.getInitialURL().then((url) => {
      if (url) handle(url);
    });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (stack.length > 1) {
        back();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [stack.length]);
  async function saveMeal() {
    if (!draft || !session) throw new Error("No meal to save.");
    const value = {
      name: draft.name,
      mealType: draft.mealType,
      loggedAt: draft.loggedAt,
      foods: draft.foods,
      notes: draft.notes,
    };
    const fingerprint = JSON.stringify(value);
    saveKey.current =
      draft.requestFingerprint === fingerprint && draft.requestKey
        ? draft.requestKey
        : Crypto.randomUUID();
    setDraft({
      ...draft,
      requestKey: saveKey.current,
      requestFingerprint: fingerprint,
    });
    await persist.current;
    try {
      await saveRemoteMeal(request, draft, saveKey.current);
      setDraft(null);
      refresh();
      tab("saved");
      return true;
    } catch (e) {
      if (
        e instanceof APIError &&
        e.status === 0 &&
        !draft.id &&
        !draft.editId
      ) {
        const queue = pending.some((p) => p.key === saveKey.current)
          ? pending
          : [...pending, { key: saveKey.current, meal: value }];
        await writePrivate(`pending.${session.userId}`, queue);
        setPending(queue);
        setDraft(null);
        setNotice("Saved on this device. Sync when you’re back online.");
        tab("today");
        return false;
      }
      throw e;
    }
  }
  async function sync() {
    if (!session || syncLock.current) return;
    syncLock.current = true;
    let queue = [...pending];
    try {
      while (queue.length) {
        await request("/v1/meals", "POST", queue[0].meal, queue[0].key);
        queue = queue.slice(1);
        await writePrivate(`pending.${session.userId}`, queue);
        setPending(queue);
      }
      setNotice("Your meals are up to date.");
      refresh();
    } finally {
      syncLock.current = false;
    }
  }
  async function clearLocal() {
    const uid = session?.userId;
    await persist.current;
    if (uid) {
      await removePrivate(`draft.${uid}`);
      await removePrivate(`pending.${uid}`);
      await removePrivate(`me.${uid}`);
    }
    await removePrivate("session");
    tokenRef.current = null;
    setSession(null);
    setMe(null);
    setDraftState(null);
    setPending([]);
    tab("welcome");
  }
  async function signOut() {
    if (pending.length || draft)
      throw new Error(
        "Sync queued meals and finish or discard your draft before signing out.",
      );
    await request("/v1/auth/sign-out", "POST", {});
    await clearLocal();
  }
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && tokenRef.current) refresh();
    });
    return () => sub.remove();
  }, []);
  return (
    <Ctx.Provider
      value={{
        route,
        go,
        back,
        tab,
        session,
        me,
        reload,
        request,
        verify,
        signOut,
        booting,
        authError,
        staged,
        setStaged,
        draft,
        setDraft,
        beginMeal,
        saveMeal,
        pending,
        sync,
        notice,
        setNotice,
        revision,
        refresh,
        clearLocal,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
export function useResource<T = any>(path: string) {
  const { request, revision } = useApp();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const previousPath = useRef(path);
  useEffect(() => {
    let live = true;
    if (previousPath.current !== path) {
      setData(null);
      previousPath.current = path;
    }
    setLoading(true);
    setError("");
    request<T>(path)
      .then((v) => {
        if (live) setData(v);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [path, revision, retry]);
  return { data, error, loading, retry: () => setRetry((n) => n + 1) };
}
