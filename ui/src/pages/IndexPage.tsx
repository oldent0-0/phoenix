import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  IconCheck,
  IconChartBar,
  IconChevronDown,
  IconClock,
  IconCoffee,
  IconMenu2,
  IconMoodSmile,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerSkipForward,
  IconPlus,
  IconRefresh,
  IconRepeat,
  IconTarget,
  IconTrash,
  IconVolume,
  IconX,
} from "@tabler/icons-react";
import { Coffee, Sparkles, Timer } from "lucide-react";
import { Button, Card, Dialog, Separator } from "erxes-ui";
import manifest from "../../../erxes.json" with { type: "json" };
import { MenuBar } from "~/components/ui/glow-menu";

const TIMER_STORAGE_KEY = "phoenix:pomodoro-timer";
const PROFILE_STORAGE_KEY = "phoenix:pomodoro-profile";
const TODO_STORAGE_KEY = "phoenix:pomodoro-todos";
const COLLECTION_STORAGE_KEY = "phoenix:pomodoro-collection";
const CYCLE_LENGTH = 4;
const AVATAR_CHOICES = ["🙂", "🧑‍🎓", "👩‍🎓", "👨‍🎓", "🦊", "🐼", "🐸", "🐱", "🌱"];
const DURATIONS = {
  focus: 25 * 60 * 1000,
  shortBreak: 5 * 60 * 1000,
  longBreak: 15 * 60 * 1000,
} as const;

type TimerMode = keyof typeof DURATIONS;
type DashboardTab = "timer" | "progress" | "character";

interface TimerState {
  mode: TimerMode;
  durationMs: number;
  remainingMs: number;
  endsAt: number | null;
  isRunning: boolean;
  focusSessions: number;
  task: string;
}

interface Profile {
  name: string;
  avatar: string;
}

interface TodoItem {
  id: string;
  title: string;
  completed: boolean;
}

interface AvatarCollection {
  coins: number;
  owned: string[];
  equippedClothing: string | null;
  equippedTheme: string | null;
  welcomeCoinsGranted: boolean;
}

type ShopCategory = "clothing" | "themes";
type ShopItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: ShopCategory;
  icon: string;
};

const DEFAULT_TIMER_DURATIONS = {
  focus: 25,
  shortBreak: 5,
  longBreak: 15,
} as const;

const DEFAULT_TIMER: TimerState = {
  mode: "focus",
  durationMs: DEFAULT_TIMER_DURATIONS.focus * 60 * 1000,
  remainingMs: DEFAULT_TIMER_DURATIONS.focus * 60 * 1000,
  endsAt: null,
  isRunning: false,
  focusSessions: 0,
  task: "",
};
const DEFAULT_PROFILE: Profile = { name: "", avatar: "🙂" };
const DEFAULT_COLLECTION: AvatarCollection = {
  coins: 1000,
  owned: [],
  equippedClothing: null,
  equippedTheme: null,
  welcomeCoinsGranted: true,
};
const SHOP_ITEMS: ShopItem[] = [
  {
    id: "sage-scarf",
    name: "Sage scarf",
    description: "A soft green scarf for chilly focus sessions.",
    price: 30,
    category: "clothing",
    icon: "🧣",
  },
  {
    id: "little-crown",
    name: "Little crown",
    description: "A tiny golden crown for a job well done.",
    price: 60,
    category: "clothing",
    icon: "👑",
  },
  {
    id: "explorer-cape",
    name: "Explorer cape",
    description: "For brave journeys through your to-do list.",
    price: 45,
    category: "clothing",
    icon: "🧥",
  },
  {
    id: "meadow-theme",
    name: "Quiet meadow",
    description: "Soft moss, wildflowers, and a little sunlight.",
    price: 80,
    category: "themes",
    icon: "🌿",
  },
  {
    id: "moonlit-theme",
    name: "Moonlit den",
    description: "A peaceful blue night for evening focus.",
    price: 80,
    category: "themes",
    icon: "🌙",
  },
  {
    id: "autumn-theme",
    name: "Autumn hideaway",
    description: "Warm amber colors and cozy leaves.",
    price: 80,
    category: "themes",
    icon: "🍂",
  },
];
const MODE_LABELS: Record<TimerMode, string> = {
  focus: "Focus",
  shortBreak: "Short break",
  longBreak: "Long break",
};
const TIMER_MENU_ITEMS = [
  {
    icon: Timer,
    label: "Focus",
    href: "#focus",
    gradient:
      "radial-gradient(circle, rgba(102,163,255,0.24) 0%, rgba(51,133,255,0.1) 55%, transparent 100%)",
    iconColor: "phoenix:text-primary",
  },
  {
    icon: Coffee,
    label: "Short break",
    href: "#short-break",
    gradient:
      "radial-gradient(circle, rgba(153,194,255,0.24) 0%, rgba(102,163,255,0.1) 55%, transparent 100%)",
    iconColor: "phoenix:text-primary",
  },
  {
    icon: Sparkles,
    label: "Long break",
    href: "#long-break",
    gradient:
      "radial-gradient(circle, rgba(204,224,255,0.24) 0%, rgba(153,194,255,0.1) 55%, transparent 100%)",
    iconColor: "phoenix:text-primary",
  },
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readStorage = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.error(`Unable to read ${key}`, error);
    return null;
  }
};

const loadTimer = (): TimerState => {
  if (typeof window === "undefined") return DEFAULT_TIMER;
  const saved = readStorage(TIMER_STORAGE_KEY);
  if (!saved) return DEFAULT_TIMER;

  try {
    const value: unknown = JSON.parse(saved);
    if (
      !isRecord(value) ||
      !(value.mode === "focus" || value.mode === "shortBreak" || value.mode === "longBreak") ||
      typeof value.remainingMs !== "number" ||
      !Number.isFinite(value.remainingMs) ||
      value.remainingMs < 0 ||
      (value.durationMs !== undefined &&
        (typeof value.durationMs !== "number" ||
          !Number.isFinite(value.durationMs) ||
          value.durationMs <= 0)) ||
      !(
        value.endsAt === null ||
        (typeof value.endsAt === "number" && Number.isFinite(value.endsAt))
      ) ||
      typeof value.isRunning !== "boolean" ||
      (value.isRunning && value.endsAt === null) ||
      typeof value.focusSessions !== "number" ||
      !Number.isInteger(value.focusSessions) ||
      value.focusSessions < 0 ||
      typeof value.task !== "string"
    ) {
      throw new Error("Saved timer state has an invalid format");
    }
    return {
      mode: value.mode,
      durationMs: typeof value.durationMs === "number" ? value.durationMs : DURATIONS[value.mode],
      remainingMs: value.remainingMs,
      endsAt: value.endsAt,
      isRunning: value.isRunning,
      focusSessions: value.focusSessions,
      task: value.task,
    };
  } catch (error) {
    console.error("Unable to restore Phoenix timer state", error);
    return DEFAULT_TIMER;
  }
};

const loadProfile = (): Profile => {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  const saved = readStorage(PROFILE_STORAGE_KEY);
  if (!saved) return DEFAULT_PROFILE;

  try {
    const value: unknown = JSON.parse(saved);
    if (
      !isRecord(value) ||
      typeof value.name !== "string" ||
      typeof value.avatar !== "string" ||
      !AVATAR_CHOICES.includes(value.avatar)
    ) {
      throw new Error("Saved profile has an invalid format");
    }
    return { name: value.name.slice(0, 40), avatar: value.avatar };
  } catch (error) {
    console.error("Unable to restore Phoenix profile", error);
    return DEFAULT_PROFILE;
  }
};

const loadTodos = (): TodoItem[] => {
  if (typeof window === "undefined") return [];
  const saved = readStorage(TODO_STORAGE_KEY);
  if (!saved) return [];

  try {
    const value: unknown = JSON.parse(saved);
    if (
      !Array.isArray(value) ||
      !value.every(
        (item) =>
          isRecord(item) &&
          typeof item.id === "string" &&
          typeof item.title === "string" &&
          typeof item.completed === "boolean",
      )
    ) {
      throw new Error("Saved to-do list has an invalid format");
    }
    return value;
  } catch (error) {
    console.error("Unable to restore Phoenix to-do list", error);
    return [];
  }
};

const loadCollection = (): AvatarCollection => {
  if (typeof window === "undefined") return DEFAULT_COLLECTION;
  const saved = readStorage(COLLECTION_STORAGE_KEY);
  if (!saved) return DEFAULT_COLLECTION;

  try {
    const value: unknown = JSON.parse(saved);
    if (
      !isRecord(value) ||
      typeof value.coins !== "number" ||
      !Number.isInteger(value.coins) ||
      value.coins < 0 ||
      !Array.isArray(value.owned) ||
      !value.owned.every(
        (id) => typeof id === "string" && SHOP_ITEMS.some((item) => item.id === id),
      ) ||
      !(value.equippedClothing === null || typeof value.equippedClothing === "string") ||
      !(value.equippedTheme === null || typeof value.equippedTheme === "string") ||
      (value.welcomeCoinsGranted !== undefined && typeof value.welcomeCoinsGranted !== "boolean")
    ) {
      throw new Error("Saved avatar collection has an invalid format");
    }
    return {
      coins: value.coins + (value.welcomeCoinsGranted === true ? 0 : 1000),
      owned: value.owned,
      equippedClothing: value.equippedClothing,
      equippedTheme: value.equippedTheme,
      welcomeCoinsGranted: true,
    };
  } catch (error) {
    console.error("Unable to restore Phoenix avatar collection", error);
    return DEFAULT_COLLECTION;
  }
};

const formatTime = (milliseconds: number) => {
  const seconds = Math.ceil(milliseconds / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
};

const PallasCat = ({ awake, clothing }: { awake: boolean; clothing: string | null }) => (
  <svg
    viewBox="0 0 200 200"
    role="img"
    aria-label={awake ? "A Pallas's cat awake and cheering you on" : "A Pallas's cat resting"}
    className={`phoenix:size-44 phoenix:transition-transform phoenix:duration-700 hover:phoenix:scale-105 ${awake ? "phoenix:translate-y-0 phoenix-pallas-awake" : "phoenix:translate-y-1"}`}
  >
    <circle
      cx="100"
      cy="100"
      r="90"
      fill={awake ? "#E8F1F5" : "#EAEAEF"}
      stroke="#2D3134"
      strokeWidth="6"
    />
    {awake ? (
      <>
        <path
          d="M140 120c25 0 35 25 10 35-20 5-40-5-50-5"
          fill="#7D8489"
          stroke="#2D3134"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M145 130c10 5 10 15 0 20"
          fill="none"
          stroke="#2D3134"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M45 110c-10-40 20-65 55-65s65 25 55 65c-10 35-40 45-55 45s-45-10-55-45Z"
          fill="#99A1A6"
          stroke="#2D3134"
          strokeWidth="6"
          strokeLinejoin="round"
        />
        <path
          d="m55 52-15-12c2 15 10 20 15 20Zm90 0 15-12c-2 15-10 20-15 20Z"
          fill="#7D8489"
          stroke="#2D3134"
          strokeWidth="5"
          strokeLinejoin="round"
        />
        <path
          d="M45 105c-5 20 20 30 30 20m80-20c5 20-20 30-30 20"
          fill="#fff"
          stroke="#2D3134"
          strokeWidth="5"
          strokeLinejoin="round"
        />
        <path d="M70 135c15 10 45 10 60 0" fill="#fff" />
        <circle cx="100" cy="55" r="3" fill="#2D3134" />
        <circle cx="90" cy="58" r="2.5" fill="#2D3134" />
        <circle cx="110" cy="58" r="2.5" fill="#2D3134" />
        <path
          d="M75 55c-5 10-10 20-13 30m63-30c5 10 10 20 13 30"
          fill="none"
          stroke="#2D3134"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <ellipse cx="78" cy="88" rx="14" ry="12" fill="#F4D03F" stroke="#2D3134" strokeWidth="5" />
        <ellipse cx="122" cy="88" rx="14" ry="12" fill="#F4D03F" stroke="#2D3134" strokeWidth="5" />
        <path
          d="M78 78v18m44-18v18"
          fill="none"
          stroke="#2D3134"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <circle cx="82" cy="84" r="2" fill="#fff" />
        <circle cx="126" cy="84" r="2" fill="#fff" />
        <path
          d="M62 74c8-2 20 2 26 6m50-6c-8-2-20 2-26 6m-15 18h6m-3 0v4m-3 3c1-2 3-2 3 0 0-2 2-2 3 0"
          fill="none"
          stroke="#2D3134"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle cx="50" cy="130" r="10" fill="#99A1A6" stroke="#2D3134" strokeWidth="4" />
        <circle cx="50" cy="130" r="5" fill="#2D3134" />
        <circle cx="44" cy="122" r="2" fill="#2D3134" />
        <circle cx="50" cy="119" r="2" fill="#2D3134" />
        <circle cx="56" cy="122" r="2" fill="#2D3134" />
      </>
    ) : (
      <>
        <path
          d="M45 115c-10-40 20-65 55-65s65 25 55 65c-10 33-40 40-55 40s-45-7-55-40Z"
          fill="#99A1A6"
          stroke="#2D3134"
          strokeWidth="6"
          strokeLinejoin="round"
        />
        <path
          d="m52 58-14-8c4 12 10 16 14 16Zm96 0 14-8c-4 12-10 16-14 16Z"
          fill="#7D8489"
          stroke="#2D3134"
          strokeWidth="5"
          strokeLinejoin="round"
        />
        <path
          d="M60 145c-20-5-15-35 20-35 40 0 70 10 70 35 0 15-30 15-60 10"
          fill="#7D8489"
          stroke="#2D3134"
          strokeWidth="6"
          strokeLinejoin="round"
        />
        <path
          d="M65 118c-3 10 0 20 5 24m20-28c0 11 2 26 2 34m23-32c3 10 5 24 0 32"
          fill="none"
          stroke="#2D3134"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M46 105c-4 13 12 17 22 13m86-13c4 13-12 17-22 13"
          fill="#fff"
          stroke="#2D3134"
          strokeWidth="4"
        />
        <path
          d="M65 92c5 6 15 6 20 0m30 0c5 6 15 6 20 0m-37 4h4l-2 3Z"
          fill="none"
          stroke="#2D3134"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="m140 50 10 0-10 10 10 0m5-30 7 0-7 7 7 0"
          fill="none"
          stroke="#2D3134"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    )}
    {clothing === "sage-scarf" && (
      <path d="M66 132c10 8 24 8 34 0l-3 13c-10 7-20 7-30 0Z" fill="#66a3ff" />
    )}
    {clothing === "explorer-cape" && (
      <path d="M68 126c10 5 20 5 30 0l-2 22c-9 7-19 7-27 0Z" fill="#3385ff" />
    )}
    {clothing === "little-crown" && (
      <path
        d="m75 54 4-13 10 8 11-14 11 14 10-8 4 13Z"
        fill="#e8bf58"
        stroke="#aa8232"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    )}
  </svg>
);

const TabButton = ({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof IconClock;
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    aria-current={active ? "page" : undefined}
    onClick={onClick}
    className={`phoenix:flex phoenix:items-center phoenix:gap-2 phoenix:rounded-xl phoenix:border phoenix:px-3 phoenix:py-2 phoenix:text-xs phoenix:transition-colors ${
      active
        ? "phoenix:border-[#344b3c] phoenix:bg-[#1b2920] phoenix:text-[#91c5a5]"
        : "phoenix:border-[#29332c] phoenix:text-muted-foreground hover:phoenix:bg-[#1b211d]"
    }`}
  >
    <Icon className="phoenix:size-4" />
    {label}
  </button>
);

export const IndexPage = () => {
  const [timer, setTimer] = useState<TimerState>(loadTimer);
  const [profile, setProfile] = useState<Profile>(loadProfile);
  const [collection, setCollection] = useState<AvatarCollection>(loadCollection);
  const [todos, setTodos] = useState<TodoItem[]>(loadTodos);
  const [newTodo, setNewTodo] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [profileSection, setProfileSection] = useState<"customize" | "marketplace">("customize");
  const [shopCategory, setShopCategory] = useState<ShopCategory>("clothing");
  const [ambient, setAmbient] = useState("Rainy afternoon");
  const [ambientOn, setAmbientOn] = useState(true);
  const [sleepMode, setSleepMode] = useState(true);
  const [activeTab, setActiveTab] = useState<DashboardTab>("timer");
  const [timerEditOpen, setTimerEditOpen] = useState(false);
  const [timerEditMinutes, setTimerEditMinutes] = useState(
    String(Math.round(DURATIONS.focus / 60000)),
  );
  const [now, setNow] = useState(() => Date.now());
  const rewardedSessionRef = useRef<number | null>(null);
  const currentDate = new Date(now);
  const localTime = currentDate.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
  const localDate = currentDate.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const remainingMs =
    timer.isRunning && timer.endsAt !== null ? Math.max(0, timer.endsAt - now) : timer.remainingMs;
  const progress = Math.min(1, Math.max(0, 1 - remainingMs / timer.durationMs));
  const completedInCycle = timer.focusSessions % CYCLE_LENGTH;
  const completedTodos = todos.filter((todo) => todo.completed).length;
  const currentTask =
    timer.task || todos.find((todo) => !todo.completed)?.title || "Read a chapter";
  const isLightTheme =
    typeof document !== "undefined" && document.querySelector(".phoenix-theme-light") !== null;

  useEffect(() => {
    try {
      window.localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(timer));
    } catch (error) {
      console.error("Unable to save Phoenix timer state", error);
    }
  }, [timer]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch (error) {
      console.error("Unable to save Phoenix profile", error);
    }
  }, [profile]);

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLECTION_STORAGE_KEY, JSON.stringify(collection));
    } catch (error) {
      console.error("Unable to save Phoenix avatar collection", error);
    }
  }, [collection]);

  useEffect(() => {
    try {
      window.localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todos));
    } catch (error) {
      console.error("Unable to save Phoenix to-do list", error);
    }
  }, [todos]);

  useEffect(() => {
    if (!timer.isRunning) return;
    const interval = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(interval);
  }, [timer.isRunning]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const advancePhase = useCallback(
    (countSession: boolean) => {
      if (
        countSession &&
        timer.mode === "focus" &&
        timer.endsAt !== null &&
        rewardedSessionRef.current !== timer.endsAt
      ) {
        rewardedSessionRef.current = timer.endsAt;
        setCollection((items) => ({ ...items, coins: items.coins + 10 }));
      }

      setTimer((current) => {
        const focusSessions =
          current.focusSessions + Number(countSession && current.mode === "focus");
        const nextMode: TimerMode =
          current.mode !== "focus"
            ? "focus"
            : focusSessions > 0 && focusSessions % CYCLE_LENGTH === 0
              ? "longBreak"
              : "shortBreak";
        return {
          ...current,
          mode: nextMode,
          durationMs: DURATIONS[nextMode],
          remainingMs: DURATIONS[nextMode],
          endsAt: null,
          isRunning: false,
          focusSessions,
        };
      });
    },
    [timer.endsAt, timer.mode],
  );

  useEffect(() => {
    if (timer.isRunning && remainingMs === 0) advancePhase(true);
  }, [advancePhase, remainingMs, timer.isRunning]);

  const selectMode = (mode: TimerMode) => {
    setTimer((current) => ({
      ...current,
      mode,
      durationMs: DURATIONS[mode],
      remainingMs: DURATIONS[mode],
      endsAt: null,
      isRunning: false,
    }));
    setTimerEditMinutes(String(Math.round(DURATIONS[mode] / 60000)));
  };

  useEffect(() => {
    setTimerEditMinutes(String(Math.round(DURATIONS[timer.mode] / 60000)));
  }, [timer.mode]);

  const applyTimerEdit = () => {
    const minutes = Number.parseInt(timerEditMinutes, 10);
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    const nextMs = minutes * 60 * 1000;
    setTimer((current) => ({
      ...current,
      mode: current.mode,
      durationMs: nextMs,
      remainingMs: nextMs,
      endsAt: null,
      isRunning: false,
    }));
    setTimerEditOpen(false);
  };

  const toggleTimer = () => {
    if (timer.isRunning) {
      const remaining =
        timer.endsAt === null ? timer.remainingMs : Math.max(0, timer.endsAt - Date.now());
      if (remaining === 0) {
        advancePhase(true);
        return;
      }
      setTimer((current) => ({
        ...current,
        remainingMs: remaining,
        endsAt: null,
        isRunning: false,
      }));
      return;
    }
    setNow(Date.now());
    setTimer((current) => ({
      ...current,
      task: current.task || currentTask,
      endsAt: Date.now() + current.remainingMs,
      isRunning: true,
    }));
  };

  const addTodo = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = newTodo.trim();
    if (!title) return;
    const todo = { id: window.crypto.randomUUID(), title, completed: false };
    setTodos((current) => [...current, todo]);
    setTimer((current) => ({ ...current, task: title }));
    setNewTodo("");
  };

  const buyOrEquipItem = (item: ShopItem) => {
    setCollection((current) => {
      const alreadyOwned = current.owned.includes(item.id);
      if (!alreadyOwned && current.coins < item.price) return current;
      const owned = alreadyOwned ? current.owned : [...current.owned, item.id];
      const next = alreadyOwned
        ? current
        : { ...current, coins: current.coins - item.price, owned };
      return item.category === "clothing"
        ? { ...next, equippedClothing: item.id }
        : { ...next, equippedTheme: item.id };
    });
  };

  const completedSessions = timer.focusSessions;
  const remainingToLongBreak =
    completedInCycle === 0 ? CYCLE_LENGTH : CYCLE_LENGTH - completedInCycle;

  return (
    <div
      className={`phoenix-focus-dashboard phoenix:flex phoenix:h-full phoenix:min-h-0 phoenix:flex-col phoenix:bg-background phoenix:text-foreground phoenix:xl:flex-row ${
        typeof document !== "undefined" && document.documentElement.dataset.theme === "light"
          ? "phoenix-theme-light"
          : ""
      }`}
    >
      <header
        onMouseEnter={() => setSidebarCollapsed(false)}
        onMouseLeave={() => setSidebarCollapsed(true)}
        onFocusCapture={() => setSidebarCollapsed(false)}
        className={`phoenix-glass-panel phoenix:z-20 phoenix:flex phoenix:flex-wrap phoenix:items-center phoenix:justify-between phoenix:gap-3 phoenix:border phoenix:border-x-0 phoenix:border-t-0 phoenix:px-4 phoenix:py-3 phoenix:md:px-6 phoenix:xl:sticky phoenix:xl:top-0 phoenix:xl:h-full phoenix:xl:shrink-0 phoenix:xl:flex-col phoenix:xl:justify-between phoenix:xl:gap-8 phoenix:xl:border-b-0 phoenix:xl:border-r phoenix:xl:py-6 phoenix:transition-[width,padding] phoenix:duration-200 ${
          sidebarCollapsed
            ? "phoenix:xl:w-[4.75rem] phoenix:xl:items-center phoenix:xl:px-2"
            : "phoenix:xl:w-56 phoenix:xl:items-stretch phoenix:xl:px-4"
        }`}
      >
        <div
          className={`phoenix:flex phoenix:items-center phoenix:gap-3 ${
            sidebarCollapsed ? "phoenix:xl:justify-center" : "phoenix:xl:items-start"
          }`}
        >
          <div className="phoenix:flex phoenix:size-9 phoenix:items-center phoenix:justify-center phoenix:rounded-xl phoenix:bg-[#1a2920] phoenix:text-[#83b495]">
            <IconTarget className="phoenix:size-5" />
          </div>
          <div className={sidebarCollapsed ? "phoenix:xl:hidden" : ""}>
            <p className="phoenix:text-base phoenix:font-semibold phoenix:tracking-tight">
              little by little
            </p>
            <p className="phoenix:text-[10px] phoenix:text-muted-foreground">
              Quiet focus, one step at a time
            </p>
          </div>
        </div>
        <div
          className={`phoenix:hidden phoenix:items-center phoenix:gap-2 phoenix:xl:flex phoenix:xl:flex-col ${
            sidebarCollapsed ? "phoenix:xl:items-center" : "phoenix:xl:items-stretch"
          }`}
        >
          <div
            className={`phoenix-glass-control phoenix:flex phoenix:items-center phoenix:justify-center phoenix:rounded-full phoenix:border ${
              sidebarCollapsed
                ? "phoenix:size-11 phoenix:xl:size-12"
                : "phoenix:flex-col phoenix:items-start phoenix:gap-0.5 phoenix:rounded-xl phoenix:px-3 phoenix:py-2 phoenix:xl:w-full"
            }`}
            aria-label={`Local time ${localTime}, ${localDate}`}
            title={`Local time: ${localTime} · ${localDate}`}
          >
            {sidebarCollapsed ? (
              <IconClock className="phoenix:size-4 phoenix:text-muted-foreground" />
            ) : (
              <>
                <time
                  dateTime={currentDate.toISOString()}
                  className="phoenix:text-base phoenix:font-semibold phoenix:tracking-wide phoenix:tabular-nums"
                >
                  {localTime}
                </time>
                <span className="phoenix:text-[10px] phoenix:text-muted-foreground">
                  {localDate} · Local time
                </span>
              </>
            )}
          </div>
          <button
            type="button"
            className={`phoenix-glass-control phoenix:flex phoenix:items-center phoenix:justify-center phoenix:rounded-full phoenix:border phoenix:text-[11px] phoenix:font-semibold phoenix:text-[#d9c57b] phoenix:transition-[width,height] ${
              sidebarCollapsed
                ? "phoenix:size-11 phoenix:xl:size-12"
                : "phoenix:px-3 phoenix:py-1.5 phoenix:xl:h-11 phoenix:xl:justify-start phoenix:xl:rounded-lg"
            }`}
            onClick={() => {
              setProfileSection("marketplace");
              setProfileOpen(true);
            }}
            aria-label={`Open marketplace. ${collection.coins} coins available`}
            title={sidebarCollapsed ? `${collection.coins} coins · Marketplace` : undefined}
          >
            <span aria-hidden="true">◈</span>
            {!sidebarCollapsed && <span className="phoenix:ml-1">{collection.coins}</span>}
          </button>
          <span
            className={`phoenix-glass-control phoenix:flex phoenix:items-center phoenix:justify-center phoenix:rounded-full phoenix:border phoenix:text-[11px] phoenix:font-medium phoenix:text-[#b5c6b7] ${
              sidebarCollapsed
                ? "phoenix:size-11 phoenix:xl:size-12"
                : "phoenix:px-3 phoenix:py-1.5 phoenix:xl:h-11 phoenix:xl:justify-start phoenix:xl:rounded-lg"
            }`}
            title={`Session ${completedInCycle + 1} of ${CYCLE_LENGTH}`}
          >
            <IconRepeat className="phoenix:size-4" />
            {!sidebarCollapsed && (
              <span className="phoenix:ml-2">
                Session {completedInCycle + 1} of {CYCLE_LENGTH}
              </span>
            )}
          </span>
          <div
            className={`phoenix:hidden phoenix:sm:flex ${
              sidebarCollapsed ? "phoenix:xl:w-12 phoenix:xl:justify-center" : "phoenix:xl:w-full"
            }`}
          >
            {sidebarCollapsed ? (
              <button
                type="button"
                className="phoenix-glass-control phoenix:flex phoenix:size-11 phoenix:items-center phoenix:justify-center phoenix:rounded-full phoenix:border phoenix:text-muted-foreground phoenix:xl:size-12"
                aria-label={
                  ambientOn ? `Mute ambient sound: ${ambient}` : `Enable ambient sound: ${ambient}`
                }
                title={`Ambient sound: ${ambient}`}
                onClick={() => setAmbientOn((value) => !value)}
              >
                <IconVolume className={`phoenix:size-4 ${ambientOn ? "" : "phoenix:opacity-40"}`} />
              </button>
            ) : (
              <div className="phoenix-glass-control phoenix:flex phoenix:w-full phoenix:flex-col phoenix:gap-2 phoenix:rounded-xl phoenix:border phoenix:p-2.5">
                <div className="phoenix:flex phoenix:items-center phoenix:justify-between phoenix:gap-2">
                  <span className="phoenix:text-[10px] phoenix:font-semibold phoenix:uppercase phoenix:tracking-wide phoenix:text-muted-foreground">
                    Ambient sound
                  </span>
                  <button
                    type="button"
                    aria-label={ambientOn ? "Mute ambient sound" : "Enable ambient sound"}
                    aria-pressed={ambientOn}
                    onClick={() => setAmbientOn((value) => !value)}
                    className="phoenix:text-[#86ac91]"
                  >
                    <IconVolume
                      className={`phoenix:size-4 ${ambientOn ? "" : "phoenix:opacity-40"}`}
                    />
                  </button>
                </div>
                <label className="phoenix:relative phoenix:block">
                  <span className="phoenix:sr-only">Ambient sound</span>
                  <select
                    value={ambient}
                    onChange={(event) => setAmbient(event.target.value)}
                    className="phoenix-glass-inset phoenix:h-9 phoenix:w-full phoenix:appearance-none phoenix:rounded-lg phoenix:border phoenix:px-2 phoenix:pr-7 phoenix:text-[11px] phoenix:outline-none focus:phoenix:ring-1 focus:phoenix:ring-[#75a88b]"
                  >
                    <option>Rainy afternoon</option>
                    <option>Forest breeze</option>
                    <option>Quiet café</option>
                    <option>Soft fireplace</option>
                    <option>Silence</option>
                  </select>
                  <IconChevronDown className="phoenix:pointer-events-none phoenix:absolute phoenix:right-2 phoenix:top-2.5 phoenix:size-4 phoenix:text-muted-foreground" />
                </label>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className={`phoenix-glass-control phoenix:flex phoenix:items-center phoenix:justify-center phoenix:rounded-full phoenix:border ${
              sidebarCollapsed
                ? "phoenix:size-11 phoenix:px-0 phoenix:xl:size-12"
                : "phoenix:px-3 phoenix:xl:h-11 phoenix:xl:w-full phoenix:xl:justify-start phoenix:xl:rounded-lg"
            }`}
            onClick={() => {
              setActiveTab("character");
              setProfileOpen(true);
            }}
            title={sidebarCollapsed ? profile.name || manifest.title : undefined}
          >
            <span className="phoenix:flex phoenix:size-5 phoenix:items-center phoenix:justify-center phoenix:rounded-full phoenix:bg-[#49765a] phoenix:text-[10px] phoenix:text-white">
              {profile.avatar}
            </span>
            {!sidebarCollapsed && (
              <span className="phoenix:xl:ml-2 phoenix:xl:truncate">
                {profile.name || manifest.title}
              </span>
            )}
          </Button>
        </div>
        <button
          type="button"
          className="phoenix-glass-control phoenix:flex phoenix:size-10 phoenix:items-center phoenix:justify-center phoenix:rounded-full phoenix:border phoenix:text-muted-foreground hover:phoenix:text-foreground phoenix:xl:hidden"
          onClick={() => setMobileSidebarOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={mobileSidebarOpen}
        >
          <IconMenu2 className="phoenix:size-5" />
        </button>
      </header>

      {mobileSidebarOpen && (
        <div className="phoenix:fixed phoenix:inset-0 phoenix:z-50 phoenix:flex phoenix:xl:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            className="phoenix:absolute phoenix:inset-0 phoenix:bg-black/50 phoenix:backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <nav className="phoenix-glass-panel phoenix:relative phoenix:flex phoenix:h-full phoenix:w-[min(19rem,85vw)] phoenix:flex-col phoenix:gap-6 phoenix:border-y-0 phoenix:border-l-0 phoenix:p-5">
            <div className="phoenix:flex phoenix:items-center phoenix:justify-between">
              <div className="phoenix:flex phoenix:items-center phoenix:gap-3">
                <span className="phoenix:flex phoenix:size-9 phoenix:items-center phoenix:justify-center phoenix:rounded-xl phoenix:bg-[#1a2920] phoenix:text-[#83b495]">
                  <IconTarget className="phoenix:size-5" />
                </span>
                <div>
                  <p className="phoenix:text-sm phoenix:font-semibold">little by little</p>
                  <p className="phoenix:text-[10px] phoenix:text-muted-foreground">
                    Quiet focus, one step at a time
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close navigation menu"
                className="phoenix:flex phoenix:size-9 phoenix:items-center phoenix:justify-center phoenix:rounded-full phoenix:border phoenix:border-border"
                onClick={() => setMobileSidebarOpen(false)}
              >
                <IconX className="phoenix:size-4" />
              </button>
            </div>
            <div className="phoenix:flex phoenix:flex-col phoenix:gap-3">
              <div className="phoenix-glass-control phoenix:flex phoenix:flex-col phoenix:gap-0.5 phoenix:rounded-xl phoenix:border phoenix:px-3 phoenix:py-2">
                <time
                  dateTime={currentDate.toISOString()}
                  className="phoenix:text-lg phoenix:font-semibold phoenix:tracking-wide phoenix:tabular-nums"
                >
                  {localTime}
                </time>
                <span className="phoenix:text-xs phoenix:text-muted-foreground">
                  {localDate} · Local time
                </span>
              </div>
              <button
                type="button"
                className="phoenix-glass-control phoenix:flex phoenix:items-center phoenix:gap-3 phoenix:rounded-xl phoenix:border phoenix:p-3 phoenix:text-left phoenix:text-sm"
                onClick={() => {
                  setProfileSection("marketplace");
                  setProfileOpen(true);
                  setMobileSidebarOpen(false);
                }}
              >
                <span className="phoenix:text-lg phoenix:text-[#d9c57b]">◈</span>
                Marketplace <span className="phoenix:ml-auto">{collection.coins} coins</span>
              </button>
              <div className="phoenix-glass-control phoenix:flex phoenix:items-center phoenix:gap-3 phoenix:rounded-xl phoenix:border phoenix:p-3 phoenix:text-sm">
                <IconRepeat className="phoenix:size-4" />
                Session {completedInCycle + 1} of {CYCLE_LENGTH}
              </div>
              <div className="phoenix-glass-control phoenix:flex phoenix:flex-col phoenix:gap-2 phoenix:rounded-xl phoenix:border phoenix:p-3 phoenix:text-sm">
                <div className="phoenix:flex phoenix:items-center phoenix:justify-between">
                  <span className="phoenix:flex phoenix:items-center phoenix:gap-2">
                    <IconVolume
                      className={`phoenix:size-4 ${ambientOn ? "" : "phoenix:opacity-40"}`}
                    />
                    Ambient sound
                  </span>
                  <button
                    type="button"
                    aria-label={ambientOn ? "Mute ambient sound" : "Enable ambient sound"}
                    aria-pressed={ambientOn}
                    onClick={() => setAmbientOn((value) => !value)}
                    className="phoenix:text-[#86ac91]"
                  >
                    <IconVolume
                      className={`phoenix:size-4 ${ambientOn ? "" : "phoenix:opacity-40"}`}
                    />
                  </button>
                </div>
                <label className="phoenix:relative phoenix:block">
                  <span className="phoenix:sr-only">Ambient sound</span>
                  <select
                    value={ambient}
                    onChange={(event) => setAmbient(event.target.value)}
                    className="phoenix-glass-inset phoenix:h-9 phoenix:w-full phoenix:appearance-none phoenix:rounded-lg phoenix:border phoenix:px-3 phoenix:pr-8 phoenix:text-xs phoenix:outline-none focus:phoenix:ring-1 focus:phoenix:ring-[#75a88b]"
                  >
                    <option>Rainy afternoon</option>
                    <option>Forest breeze</option>
                    <option>Quiet café</option>
                    <option>Soft fireplace</option>
                    <option>Silence</option>
                  </select>
                  <IconChevronDown className="phoenix:pointer-events-none phoenix:absolute phoenix:right-2.5 phoenix:top-2.5 phoenix:size-4 phoenix:text-muted-foreground" />
                </label>
              </div>
              <button
                type="button"
                className="phoenix-glass-control phoenix:flex phoenix:items-center phoenix:gap-3 phoenix:rounded-xl phoenix:border phoenix:p-3 phoenix:text-left phoenix:text-sm"
                onClick={() => {
                  setActiveTab("character");
                  setProfileOpen(true);
                  setMobileSidebarOpen(false);
                }}
              >
                <span className="phoenix:flex phoenix:size-7 phoenix:items-center phoenix:justify-center phoenix:rounded-full phoenix:bg-[#49765a] phoenix:text-xs">
                  {profile.avatar}
                </span>
                {profile.name || manifest.title}
              </button>
            </div>
          </nav>
        </div>
      )}

      <main className="phoenix:min-h-0 phoenix:flex-1 phoenix:overflow-auto">
        <div className="phoenix:mx-auto phoenix:grid phoenix:w-full phoenix:max-w-[1500px] phoenix:gap-4 phoenix:p-4 phoenix:lg:grid-cols-[14rem_minmax(0,1fr)] phoenix:xl:grid-cols-[13rem_minmax(0,1fr)_13rem]">
          <aside className="phoenix:flex phoenix:flex-col phoenix:gap-3">
            <div className="phoenix:px-1 phoenix:py-1">
              <p className="phoenix:mb-2 phoenix:text-[10px] phoenix:font-semibold phoenix:uppercase phoenix:tracking-widest phoenix:text-[#8da594]">
                Home
              </p>
              <h1 className="phoenix:text-[21px] phoenix:font-semibold phoenix:leading-tight">
                A little focus,
                <br />
                {profile.name || "friend"}?
              </h1>
              <p className="phoenix:mt-2 phoenix:text-xs phoenix:leading-relaxed phoenix:text-muted-foreground">
                Start with a quiet block, a clear task, and a reminder that progress is built in
                small, steady moments.
              </p>
            </div>

            <Card className="phoenix-glass-panel phoenix:border-[#29352d] phoenix:bg-[#151a16]">
              <Card.Content className="phoenix:flex phoenix:flex-col phoenix:gap-2 phoenix:p-3">
                <p className="phoenix:text-[10px] phoenix:font-semibold phoenix:uppercase phoenix:tracking-wide phoenix:text-[#aab7aa]">
                  A quiet reminder
                </p>
                <p className="phoenix:text-sm phoenix:font-semibold phoenix:leading-snug">
                  One page at a time. One breath at a time.
                </p>
                <p className="phoenix:text-[11px] phoenix:leading-relaxed phoenix:text-muted-foreground">
                  No pressure, no rush. Just one small step at a time.
                </p>
              </Card.Content>
            </Card>

            <Card className="phoenix-glass-panel phoenix-todo-card phoenix:min-h-0 phoenix:border-[#29352d] phoenix:bg-[#151a16]">
              <Card.Content className="phoenix:flex phoenix:flex-col phoenix:gap-3 phoenix:p-4">
                <div className="phoenix:flex phoenix:items-center phoenix:justify-between phoenix:gap-2">
                  <p className="phoenix-todo-heading phoenix:text-[10px] phoenix:font-semibold phoenix:uppercase phoenix:tracking-wide phoenix:text-[#aab7aa]">
                    Today’s focus
                  </p>
                  <span className="phoenix-todo-count phoenix:text-[10px] phoenix:text-muted-foreground">
                    {completedTodos}/{todos.length}
                  </span>
                </div>
                <form className="phoenix:flex phoenix:gap-2" onSubmit={addTodo}>
                  <label className="phoenix:sr-only" htmlFor="new-todo">
                    Add a focus task
                  </label>
                  <input
                    id="new-todo"
                    className="phoenix-todo-input phoenix-glass-inset phoenix:h-12 phoenix:min-w-0 phoenix:flex-1 phoenix:rounded-xl phoenix:border phoenix:px-3 phoenix:text-sm phoenix:outline-none focus:phoenix:ring-1 focus:phoenix:ring-[#75a88b]"
                    maxLength={160}
                    placeholder="Add a task..."
                    value={newTodo}
                    onChange={(event) => setNewTodo(event.target.value)}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    variant="outline"
                    className="phoenix-todo-add phoenix:size-12 phoenix:shrink-0 phoenix:rounded-xl"
                    aria-label="Add task"
                    disabled={!newTodo.trim()}
                  >
                    <IconPlus className="phoenix-todo-plus phoenix:size-4" />
                  </Button>
                </form>
                <ul className="phoenix:flex phoenix:flex-col phoenix:gap-1">
                  {todos.map((todo, index) => (
                    <li
                      key={todo.id}
                      className="phoenix-todo-row phoenix:flex phoenix:items-center phoenix:gap-3 phoenix:py-1.5"
                    >
                      <button
                        type="button"
                        aria-label={`${todo.completed ? "Reopen" : "Complete"} ${todo.title}`}
                        className={`phoenix-todo-check phoenix:flex phoenix:size-5 phoenix:shrink-0 phoenix:items-center phoenix:justify-center phoenix:rounded-full phoenix:border ${todo.completed ? "phoenix:border-[#75a88b] phoenix:bg-[#75a88b] phoenix:text-[#101411]" : "phoenix:border-[#526457] phoenix:text-transparent"}`}
                        onClick={() =>
                          setTodos((current) =>
                            current.map((item) =>
                              item.id === todo.id ? { ...item, completed: !item.completed } : item,
                            ),
                          )
                        }
                      >
                        {todo.completed && <IconCheck className="phoenix:size-3" />}
                      </button>
                      <button
                        type="button"
                        className={`phoenix-todo-task phoenix:min-w-0 phoenix:flex-1 phoenix:text-left phoenix:text-sm phoenix:leading-snug ${todo.completed ? "phoenix:text-muted-foreground phoenix:line-through" : "phoenix:text-[#e0e5df]"}`}
                        onClick={() => setTimer((current) => ({ ...current, task: todo.title }))}
                      >
                        <span className="phoenix-todo-number phoenix:mr-1 phoenix:text-[#83a08d]">
                          {index + 1}.
                        </span>
                        {todo.title}
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${todo.title}`}
                        className="phoenix-todo-delete phoenix:text-muted-foreground hover:phoenix:text-foreground"
                        onClick={() =>
                          setTodos((current) => current.filter((item) => item.id !== todo.id))
                        }
                      >
                        <IconTrash className="phoenix:size-3" />
                      </button>
                    </li>
                  ))}
                  {todos.length === 0 && (
                    <li className="phoenix-todo-empty phoenix:py-1 phoenix:text-[11px] phoenix:text-muted-foreground">
                      Add a task to begin your list.
                    </li>
                  )}
                </ul>
              </Card.Content>
            </Card>

            <nav
              aria-label="Focus dashboard"
              className="phoenix-glass-panel phoenix:flex phoenix:flex-wrap phoenix:gap-1.5 phoenix:self-start phoenix:rounded-2xl phoenix:border phoenix:p-1.5"
            >
              <TabButton
                active={activeTab === "timer"}
                icon={IconClock}
                label="Timer"
                onClick={() => setActiveTab("timer")}
              />
              <TabButton
                active={activeTab === "progress"}
                icon={IconChartBar}
                label="Progress"
                onClick={() => setActiveTab("progress")}
              />
              <TabButton
                active={activeTab === "character"}
                icon={IconMoodSmile}
                label="Character"
                onClick={() => {
                  setActiveTab("character");
                  setProfileOpen(true);
                }}
              />
            </nav>
          </aside>

          <section className="phoenix:flex phoenix:min-h-[36rem] phoenix:flex-col phoenix:gap-3">
            <Card className="phoenix-glass-panel phoenix:relative phoenix:min-h-36 phoenix:overflow-hidden phoenix:border-[#29352d] phoenix:bg-[#171d19]">
              <div className="phoenix:pointer-events-none phoenix:absolute phoenix:-left-10 phoenix:-top-20 phoenix:size-56 phoenix:rounded-full phoenix:bg-[#617d6b]/10" />
              <div className="phoenix:pointer-events-none phoenix:absolute phoenix:-right-5 phoenix:-top-16 phoenix:size-56 phoenix:rounded-full phoenix:bg-[#4f7357]/10" />
              <Card.Content className="phoenix:relative phoenix:flex phoenix:min-h-36 phoenix:flex-col phoenix:justify-between phoenix:p-4">
                <div className="phoenix:flex phoenix:items-start phoenix:justify-between phoenix:gap-4">
                  <div>
                    <p className="phoenix:text-[9px] phoenix:font-semibold phoenix:uppercase phoenix:tracking-widest phoenix:text-[#9cac9e]">
                      {timer.mode === "focus" ? "Active focus" : "A moment to pause"}
                    </p>
                    <h2 className="phoenix:mt-1 phoenix:text-lg phoenix:font-semibold">
                      {timer.isRunning
                        ? "Your Pallas’s cat is cheering you on"
                        : timer.mode === "focus"
                          ? "Your focus is resting here"
                          : `Time for a ${MODE_LABELS[timer.mode].toLowerCase()}`}
                    </h2>
                  </div>
                  <span className="phoenix:rounded-full phoenix:border phoenix:border-[#354237] phoenix:bg-[#19211b]/80 phoenix:px-2.5 phoenix:py-1 phoenix:text-[10px] phoenix:text-[#b7c4b8]">
                    Session {completedInCycle + 1} of {CYCLE_LENGTH}
                  </span>
                </div>
                <div className="phoenix:flex phoenix:justify-center phoenix:py-1">
                  <PallasCat awake={timer.isRunning} clothing={collection.equippedClothing} />
                </div>
              </Card.Content>
            </Card>

            <Card className="phoenix-glass-panel phoenix:flex-1 phoenix:border-[#29352d] phoenix:bg-[#151a16]">
              <Card.Content className="phoenix:flex phoenix:h-full phoenix:flex-col phoenix:gap-4 phoenix:p-4 phoenix:md:p-5">
                {activeTab === "progress" ? (
                  <>
                    <div>
                      <p className="phoenix:text-[9px] phoenix:font-semibold phoenix:uppercase phoenix:tracking-widest phoenix:text-[#9cac9e]">
                        Your journey
                      </p>
                      <h2 className="phoenix:mt-1 phoenix:text-xl phoenix:font-semibold">
                        Today’s progress
                      </h2>
                    </div>
                    <div className="phoenix:grid phoenix:grid-cols-2 phoenix:gap-3">
                      <div className="phoenix:rounded-xl phoenix:border phoenix:border-[#29352d] phoenix:bg-[#171d19] phoenix:p-4">
                        <p className="phoenix:text-xs phoenix:text-muted-foreground">
                          Focus sessions
                        </p>
                        <p className="phoenix:mt-2 phoenix:text-3xl phoenix:font-semibold">
                          {completedSessions}
                        </p>
                      </div>
                      <div className="phoenix:rounded-xl phoenix:border phoenix:border-[#29352d] phoenix:bg-[#171d19] phoenix:p-4">
                        <p className="phoenix:text-xs phoenix:text-muted-foreground">
                          Tasks complete
                        </p>
                        <p className="phoenix:mt-2 phoenix:text-3xl phoenix:font-semibold">
                          {completedTodos}/{todos.length}
                        </p>
                      </div>
                    </div>
                    <Separator />
                    <p className="phoenix:text-sm phoenix:text-muted-foreground">
                      {CYCLE_LENGTH - completedInCycle} focus{" "}
                      {CYCLE_LENGTH - completedInCycle === 1 ? "session" : "sessions"} until your
                      next long break. Keep going at your own pace.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="phoenix:self-start"
                      onClick={() => setActiveTab("timer")}
                    >
                      <IconClock />
                      Back to timer
                    </Button>
                  </>
                ) : (
                  <>
                    <MenuBar
                      items={[...TIMER_MENU_ITEMS]}
                      activeItem={MODE_LABELS[timer.mode]}
                      onItemClick={(label) => {
                        const mode: TimerMode =
                          label === "Focus"
                            ? "focus"
                            : label === "Short break"
                              ? "shortBreak"
                              : "longBreak";
                        selectMode(mode);
                      }}
                      className="phoenix:w-full"
                    />
                    <div className="phoenix:flex phoenix:flex-wrap phoenix:items-start phoenix:justify-between phoenix:gap-3">
                      <div>
                        <p className="phoenix:text-[9px] phoenix:font-semibold phoenix:uppercase phoenix:tracking-widest phoenix:text-[#9cac9e]">
                          Current task
                        </p>
                        <h2 className="phoenix:mt-1 phoenix:break-words phoenix:text-lg phoenix:font-semibold">
                          {currentTask}
                        </h2>
                      </div>
                      <div className="phoenix:relative phoenix:flex phoenix:items-center phoenix:gap-2">
                        <button
                          type="button"
                          onClick={() => setTimerEditOpen((value) => !value)}
                          className="phoenix-glass-control phoenix:flex phoenix:items-center phoenix:gap-2 phoenix:rounded-full phoenix:border phoenix:px-2.5 phoenix:py-1.5 phoenix:text-xs phoenix:text-muted-foreground hover:phoenix:text-foreground"
                          aria-label="Edit timer duration"
                        >
                          <IconClock className="phoenix:size-4 phoenix:text-[#83a98f]" />
                          <span>Edit timer</span>
                        </button>
                        {timerEditOpen && (
                          <div className="phoenix-glass-panel phoenix:absolute phoenix:right-0 phoenix:top-full phoenix:z-20 phoenix:mt-2 phoenix:w-56 phoenix:rounded-2xl phoenix:border phoenix:p-3 phoenix:text-left">
                            <div className="phoenix:mb-3 phoenix:flex phoenix:items-center phoenix:justify-between phoenix:gap-2">
                              <p className="phoenix:text-[10px] phoenix:font-semibold phoenix:uppercase phoenix:tracking-wide phoenix:text-muted-foreground">
                                Edit timer
                              </p>
                              <button
                                type="button"
                                aria-label="Close timer edit"
                                className="phoenix:flex phoenix:size-7 phoenix:items-center phoenix:justify-center phoenix:rounded-full phoenix:border phoenix:text-muted-foreground"
                                onClick={() => setTimerEditOpen(false)}
                              >
                                <IconX className="phoenix:size-4" />
                              </button>
                            </div>
                            <label className="phoenix:mb-2 phoenix:block phoenix:text-[11px] phoenix:text-muted-foreground">
                              Duration in minutes
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={180}
                              step={1}
                              value={timerEditMinutes}
                              onChange={(event) => setTimerEditMinutes(event.target.value)}
                              className="phoenix-glass-inset phoenix:h-10 phoenix:w-full phoenix:rounded-lg phoenix:border phoenix:px-3 phoenix:text-sm phoenix:outline-none focus:phoenix:ring-1 focus:phoenix:ring-[#75a88b]"
                            />
                            <div className="phoenix:mt-3 phoenix:flex phoenix:items-center phoenix:justify-between">
                              <button
                                type="button"
                                className="phoenix-glass-control phoenix:rounded-lg phoenix:border phoenix:px-3 phoenix:py-2 phoenix:text-[11px] phoenix:text-muted-foreground"
                                onClick={() => setTimerEditOpen(false)}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="phoenix-glass-control phoenix:rounded-lg phoenix:border phoenix:bg-[#1d2e26] phoenix:px-3 phoenix:py-2 phoenix:text-[11px] phoenix:font-medium phoenix:text-[#dcefe0]"
                                onClick={applyTimerEdit}
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div
                      className={`phoenix-glass-inset phoenix:grid phoenix:min-h-[28rem] phoenix:flex-1 phoenix:place-items-center phoenix:overflow-hidden phoenix:rounded-xl phoenix:border phoenix:p-2 ${
                        collection.equippedTheme === "meadow-theme"
                          ? "phoenix-scene-meadow"
                          : collection.equippedTheme === "moonlit-theme"
                            ? "phoenix-scene-moonlit"
                            : collection.equippedTheme === "autumn-theme"
                              ? "phoenix-scene-autumn"
                              : ""
                      }`}
                    >
                      <div className="phoenix:flex phoenix:w-full phoenix:flex-col phoenix:items-center phoenix:justify-center">
                        <div
                          className="phoenix:relative phoenix:flex phoenix:size-80 phoenix:items-center phoenix:justify-center"
                          role="timer"
                          aria-label={`${MODE_LABELS[timer.mode]} timer, ${formatTime(remainingMs)} remaining`}
                        >
                          <svg
                            className="phoenix:absolute phoenix:inset-0 phoenix:size-full phoenix:-rotate-90"
                            viewBox="0 0 140 140"
                            aria-hidden="true"
                          >
                            <circle
                              cx="70"
                              cy="70"
                              r="58"
                              fill="none"
                              stroke="var(--phoenix-timer-track)"
                              strokeWidth="7"
                            />
                            <circle
                              cx="70"
                              cy="70"
                              r="58"
                              fill="none"
                              stroke="var(--phoenix-timer-progress)"
                              strokeWidth="7"
                              strokeLinecap="round"
                              strokeDasharray={`${2 * Math.PI * 58 * (1 - progress)} ${2 * Math.PI * 58}`}
                              strokeDashoffset={-2 * Math.PI * 58 * progress}
                              className="phoenix:transition-[stroke-dashoffset] phoenix:duration-300"
                            />
                          </svg>
                          <div className="phoenix:flex phoenix:flex-col phoenix:items-center phoenix:gap-1">
                            <span className="phoenix:font-mono phoenix:text-[3.5rem] phoenix:leading-none phoenix:font-semibold phoenix:tabular-nums phoenix:tracking-tight">
                              {formatTime(remainingMs)}
                            </span>
                            <span className="phoenix:text-xs phoenix:font-medium phoenix:uppercase phoenix:tracking-[0.18em] phoenix:text-muted-foreground">
                              {MODE_LABELS[timer.mode]}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="phoenix:flex phoenix:flex-col phoenix:items-center phoenix:gap-3">
                      <div className="phoenix:flex phoenix:items-center phoenix:gap-3">
                        <Button
                          variant="outline"
                          size="icon"
                          className="phoenix-timer-control"
                          aria-label="Reset timer"
                          onClick={() =>
                            setTimer((current) => ({
                              ...current,
                              durationMs: DURATIONS[current.mode],
                              remainingMs: DURATIONS[current.mode],
                              endsAt: null,
                              isRunning: false,
                            }))
                          }
                        >
                          <IconRefresh className="phoenix:size-4" />
                        </Button>
                        <Button
                          size="lg"
                          className="phoenix-timer-control phoenix:min-w-40"
                          onClick={toggleTimer}
                        >
                          {timer.isRunning ? <IconPlayerPause /> : <IconPlayerPlay />}
                          {timer.isRunning ? "Pause focus" : "Let’s focus"}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="phoenix-timer-control"
                          aria-label="Skip to next phase"
                          onClick={() => advancePhase(false)}
                        >
                          <IconPlayerSkipForward className="phoenix:size-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </Card.Content>
            </Card>
          </section>

          <aside className="phoenix:flex phoenix:flex-col phoenix:gap-3">
            <Card className="phoenix-glass-panel phoenix:border-[#29352d] phoenix:bg-[#151a16]">
              <Card.Content className="phoenix:flex phoenix:flex-col phoenix:gap-2 phoenix:p-3">
                <p className="phoenix:text-[10px] phoenix:font-semibold phoenix:uppercase phoenix:tracking-wide phoenix:text-[#aab7aa]">
                  A little pet care
                </p>
                <div className="phoenix:flex phoenix:items-center phoenix:gap-2">
                  <span className="phoenix:flex phoenix:size-8 phoenix:items-center phoenix:justify-center phoenix:rounded-full phoenix:bg-[#1e2a21] phoenix:text-[#8bb497]">
                    <IconMoodSmile className="phoenix:size-4" />
                  </span>
                  <p className="phoenix:text-xs phoenix:font-medium">
                    Your pet is resting peacefully.
                  </p>
                </div>
                <p className="phoenix:text-[10px] phoenix:leading-relaxed phoenix:text-muted-foreground">
                  {sleepMode
                    ? "A calm space keeps your focus companion cozy."
                    : "Your companion is ready for a little attention."}
                </p>
                <button
                  type="button"
                  aria-pressed={sleepMode}
                  onClick={() => setSleepMode((value) => !value)}
                  className="phoenix-glass-inset phoenix:flex phoenix:items-center phoenix:justify-between phoenix:rounded-lg phoenix:border phoenix:px-2.5 phoenix:py-2 phoenix:text-[10px] phoenix:text-[#b4c1b5]"
                >
                  {sleepMode ? "Sleep mode active" : "Wake your companion"}
                  <span
                    className={`phoenix:size-2 phoenix:rounded-full ${sleepMode ? "phoenix:bg-[#75a88b]" : "phoenix:bg-[#69746b]"}`}
                  />
                </button>
              </Card.Content>
            </Card>

            <Card className="phoenix-glass-panel phoenix:border-[#29352d] phoenix:bg-[#151a16]">
              <Card.Content className="phoenix:flex phoenix:flex-col phoenix:gap-2 phoenix:p-3">
                <p className="phoenix:text-[10px] phoenix:font-semibold phoenix:uppercase phoenix:tracking-wide phoenix:text-[#aab7aa]">
                  Next break
                </p>
                <div className="phoenix:flex phoenix:items-center phoenix:gap-2">
                  <IconCoffee className="phoenix:size-4 phoenix:text-[#83a98f]" />
                  <p className="phoenix:text-xs phoenix:font-semibold">
                    {timer.mode === "longBreak"
                      ? "Long break is next"
                      : `${remainingToLongBreak} ${remainingToLongBreak === 1 ? "session" : "sessions"} until a long break`}
                  </p>
                </div>
                <p className="phoenix:text-[10px] phoenix:text-muted-foreground">
                  Take a five-minute breather after this session.
                </p>
                <span className="phoenix:w-fit phoenix:rounded-full phoenix:bg-[#1e2a21] phoenix:px-2.5 phoenix:py-1 phoenix:text-[10px] phoenix:text-[#9cbea4]">
                  5-minute reset
                </span>
              </Card.Content>
            </Card>

            <Card className="phoenix-glass-panel phoenix:border-[#29352d] phoenix:bg-[#151a16]">
              <Card.Content className="phoenix:flex phoenix:items-center phoenix:gap-2 phoenix:p-3">
                <IconCheck className="phoenix:size-4 phoenix:text-[#83a98f]" />
                <p className="phoenix:text-xs phoenix:text-muted-foreground">
                  {completedSessions} focus {completedSessions === 1 ? "session" : "sessions"}{" "}
                  completed
                </p>
              </Card.Content>
            </Card>
          </aside>
        </div>
      </main>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <Dialog.Content
          className={`phoenix-avatar-dialog phoenix-theme-${isLightTheme ? "light" : "dark"} phoenix:max-h-[90vh] phoenix:w-[calc(100%-2rem)] phoenix:max-w-2xl phoenix:gap-4 phoenix:rounded-2xl phoenix:border phoenix:p-5`}
        >
          <Dialog.Header className="phoenix:flex phoenix:flex-row phoenix:items-start phoenix:justify-between phoenix:gap-4 phoenix:text-left">
            <div className="phoenix:flex phoenix:min-w-0 phoenix:flex-col phoenix:gap-1">
              <Dialog.Title>Make your companion yours</Dialog.Title>
              <Dialog.Description className="phoenix:text-xs phoenix:text-muted-foreground">
                Customize your Pallas’s cat and browse its little shop.
              </Dialog.Description>
              <p className="phoenix:text-[11px] phoenix:text-muted-foreground">
                Earn 10 coins each time you complete a focus session.
              </p>
            </div>
            <div className="phoenix:flex phoenix:shrink-0 phoenix:items-center phoenix:gap-2">
              <span className="phoenix-coin-pill phoenix:rounded-full phoenix:border phoenix:border-[#4b604e] phoenix:bg-[#243428] phoenix:px-3 phoenix:py-1 phoenix:text-xs phoenix:font-semibold phoenix:text-[#d9c57b]">
                ◈ {collection.coins}
              </span>
              <Dialog.Close asChild>
                <Button type="button" variant="ghost" size="icon" aria-label="Close avatar menu">
                  <IconX className="phoenix:size-4" />
                </Button>
              </Dialog.Close>
            </div>
          </Dialog.Header>
          <div className="phoenix:flex phoenix:min-h-0 phoenix:flex-1 phoenix:flex-col phoenix:gap-4 phoenix:overflow-hidden">
            <div className="phoenix-glass-control phoenix:flex phoenix:gap-2 phoenix:rounded-xl phoenix:border phoenix:p-1">
              <Button
                type="button"
                size="sm"
                variant={profileSection === "customize" ? "secondary" : "ghost"}
                className={`phoenix:flex-1 ${profileSection === "customize" ? "phoenix-avatar-selected" : ""}`}
                onClick={() => setProfileSection("customize")}
              >
                <IconMoodSmile className="phoenix:size-4" />
                Customize
              </Button>
              <Button
                type="button"
                size="sm"
                variant={profileSection === "marketplace" ? "secondary" : "ghost"}
                className={`phoenix:flex-1 ${profileSection === "marketplace" ? "phoenix-avatar-selected" : ""}`}
                onClick={() => setProfileSection("marketplace")}
              >
                Marketplace
              </Button>
            </div>

            {profileSection === "customize" ? (
              <div className="phoenix:flex phoenix:min-h-0 phoenix:flex-1 phoenix:flex-col phoenix:gap-3 phoenix:overflow-hidden">
                <div className="phoenix-glass-panel phoenix:flex phoenix:shrink-0 phoenix:flex-col phoenix:items-center phoenix:gap-2 phoenix:rounded-2xl phoenix:border phoenix:p-4">
                  <PallasCat awake={timer.isRunning} clothing={collection.equippedClothing} />
                  <p className="phoenix:text-sm phoenix:font-medium">
                    {profile.name || "Your Pallas’s cat"}
                  </p>
                  <p className="phoenix:text-xs phoenix:text-muted-foreground">
                    {collection.equippedClothing
                      ? SHOP_ITEMS.find((item) => item.id === collection.equippedClothing)?.name
                      : "A cozy companion for your focus journey"}
                  </p>
                  {collection.equippedTheme && (
                    <p className="phoenix:text-xs phoenix:text-muted-foreground">
                      Theme: {SHOP_ITEMS.find((item) => item.id === collection.equippedTheme)?.name}
                    </p>
                  )}
                  <label className="phoenix:flex phoenix:w-full phoenix:flex-col phoenix:gap-1">
                    <span className="phoenix:text-xs phoenix:font-medium">Your name</span>
                    <input
                      className="phoenix-glass-inset phoenix:h-9 phoenix:w-full phoenix:rounded-lg phoenix:border phoenix:px-3 phoenix:text-sm phoenix:outline-none focus:phoenix:ring-2 focus:phoenix:ring-ring"
                      maxLength={40}
                      placeholder="What should we call you?"
                      value={profile.name}
                      onChange={(event) =>
                        setProfile((current) => ({ ...current, name: event.target.value }))
                      }
                    />
                  </label>
                  <div className="phoenix:grid phoenix:w-full phoenix:grid-cols-9 phoenix:gap-1">
                    {AVATAR_CHOICES.map((avatar) => (
                      <Button
                        key={avatar}
                        type="button"
                        size="sm"
                        variant={profile.avatar === avatar ? "secondary" : "outline"}
                        className={`phoenix-glass-control phoenix:size-8 phoenix:p-0 phoenix:text-lg ${profile.avatar === avatar ? "phoenix-avatar-selected" : ""}`}
                        aria-label={`Choose ${avatar} avatar`}
                        aria-pressed={profile.avatar === avatar}
                        onClick={() => setProfile((current) => ({ ...current, avatar }))}
                      >
                        {avatar}
                      </Button>
                    ))}
                  </div>
                </div>
                <section className="phoenix:flex phoenix:min-h-0 phoenix:flex-1 phoenix:flex-col phoenix:gap-2">
                  <div className="phoenix:flex phoenix:items-center phoenix:justify-between">
                    <h3 className="phoenix:text-sm phoenix:font-semibold">Inventory</h3>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setProfileSection("marketplace")}
                    >
                      Browse shop
                    </Button>
                  </div>
                  <div className="phoenix-glass-control phoenix:flex phoenix:shrink-0 phoenix:gap-2 phoenix:rounded-xl phoenix:border phoenix:p-1">
                    {(["clothing", "themes"] as const).map((category) => (
                      <Button
                        key={category}
                        type="button"
                        size="sm"
                        variant={shopCategory === category ? "secondary" : "ghost"}
                        className={`phoenix:flex-1 phoenix:capitalize ${shopCategory === category ? "phoenix-avatar-selected" : ""}`}
                        onClick={() => setShopCategory(category)}
                      >
                        {category}
                      </Button>
                    ))}
                  </div>
                  <ul className="phoenix:flex phoenix:min-h-0 phoenix:flex-1 phoenix:flex-col phoenix:gap-2 phoenix:overflow-y-auto phoenix:pb-2">
                    {SHOP_ITEMS.filter(
                      (item) =>
                        item.category === shopCategory && collection.owned.includes(item.id),
                    ).map((item) => {
                      const equipped =
                        item.category === "clothing"
                          ? collection.equippedClothing === item.id
                          : collection.equippedTheme === item.id;
                      return (
                        <li
                          key={item.id}
                          className="phoenix-glass-panel phoenix:flex phoenix:shrink-0 phoenix:items-center phoenix:gap-3 phoenix:rounded-xl phoenix:border phoenix:p-3"
                        >
                          <span className="phoenix-avatar-icon-tile phoenix:flex phoenix:size-10 phoenix:shrink-0 phoenix:items-center phoenix:justify-center phoenix:rounded-xl phoenix:bg-[#26352a] phoenix:text-2xl">
                            {item.icon}
                          </span>
                          <span className="phoenix:min-w-0 phoenix:flex-1 phoenix:text-sm phoenix:font-medium">
                            {item.name}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant={equipped ? "secondary" : "outline"}
                            disabled={equipped}
                            onClick={() => buyOrEquipItem(item)}
                          >
                            {equipped ? "Equipped" : "Equip"}
                          </Button>
                        </li>
                      );
                    })}
                    {SHOP_ITEMS.every(
                      (item) =>
                        item.category !== shopCategory || !collection.owned.includes(item.id),
                    ) && (
                      <li className="phoenix:rounded-xl phoenix:border phoenix:border-dashed phoenix:border-[#526457] phoenix:p-4 phoenix:text-center phoenix:text-xs phoenix:text-muted-foreground">
                        No {shopCategory} in your inventory yet.
                      </li>
                    )}
                  </ul>
                </section>
              </div>
            ) : (
              <div className="phoenix:flex phoenix:min-h-0 phoenix:flex-col phoenix:gap-4">
                <div className="phoenix:flex phoenix:items-center phoenix:justify-between">
                  <div>
                    <h3 className="phoenix:text-lg phoenix:font-semibold">Companion market</h3>
                    <p className="phoenix:text-xs phoenix:text-muted-foreground">
                      Earn coins by completing focus sessions.
                    </p>
                  </div>
                  <span className="phoenix-coin-pill phoenix:rounded-full phoenix:border phoenix:border-[#4b604e] phoenix:bg-[#243428] phoenix:px-3 phoenix:py-1 phoenix:text-xs phoenix:font-semibold phoenix:text-[#d9c57b]">
                    ◈ {collection.coins}
                  </span>
                </div>
                <div className="phoenix-glass-control phoenix:flex phoenix:gap-2 phoenix:rounded-xl phoenix:border phoenix:p-1">
                  {(["clothing", "themes"] as const).map((category) => (
                    <Button
                      key={category}
                      type="button"
                      size="sm"
                      variant={shopCategory === category ? "secondary" : "ghost"}
                      className="phoenix:flex-1 phoenix:capitalize"
                      onClick={() => setShopCategory(category)}
                    >
                      {category}
                    </Button>
                  ))}
                </div>
                <ul className="phoenix:flex phoenix:flex-col phoenix:gap-3 phoenix:overflow-auto phoenix:pb-2">
                  {SHOP_ITEMS.filter((item) => item.category === shopCategory).map((item) => {
                    const owned = collection.owned.includes(item.id);
                    const equipped =
                      item.category === "clothing"
                        ? collection.equippedClothing === item.id
                        : collection.equippedTheme === item.id;
                    return (
                      <li
                        key={item.id}
                        className="phoenix-glass-panel phoenix:flex phoenix:items-center phoenix:gap-3 phoenix:rounded-xl phoenix:border phoenix:p-3"
                      >
                        <span className="phoenix-avatar-icon-tile phoenix:flex phoenix:size-11 phoenix:shrink-0 phoenix:items-center phoenix:justify-center phoenix:rounded-xl phoenix:bg-[#26352a] phoenix:text-2xl">
                          {item.icon}
                        </span>
                        <div className="phoenix:min-w-0 phoenix:flex-1">
                          <p className="phoenix:text-sm phoenix:font-semibold">{item.name}</p>
                          <p className="phoenix:text-[11px] phoenix:leading-snug phoenix:text-muted-foreground">
                            {item.description}
                          </p>
                          <p className="phoenix:mt-1 phoenix:text-[11px] phoenix:text-[#d9c57b]">
                            ◈ {item.price}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant={equipped ? "secondary" : "outline"}
                          disabled={equipped || (!owned && collection.coins < item.price)}
                          onClick={() => buyOrEquipItem(item)}
                        >
                          {equipped ? "Wearing" : owned ? "Equip" : "Buy"}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog>
    </div>
  );
};
