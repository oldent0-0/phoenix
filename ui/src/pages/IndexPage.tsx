import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  IconCheck,
  IconChartBar,
  IconChevronDown,
  IconClock,
  IconCoffee,
  IconMoodSmile,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerSkipForward,
  IconPlus,
  IconRefresh,
  IconTarget,
  IconTrash,
  IconUserCircle,
  IconVolume,
} from "@tabler/icons-react";
import { Coffee, Sparkles, Timer } from "lucide-react";
import { Button, Card, Separator, Sheet } from "erxes-ui";
import manifest from "../../../erxes.json" with { type: "json" };
import { MenuBar } from "~/components/ui/glow-menu";

const TIMER_STORAGE_KEY = "phoenix:pomodoro-timer";
const PROFILE_STORAGE_KEY = "phoenix:pomodoro-profile";
const TODO_STORAGE_KEY = "phoenix:pomodoro-todos";
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

const DEFAULT_TIMER: TimerState = {
  mode: "focus",
  remainingMs: DURATIONS.focus,
  endsAt: null,
  isRunning: false,
  focusSessions: 0,
  task: "",
};
const DEFAULT_PROFILE: Profile = { name: "", avatar: "🙂" };
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
      "radial-gradient(circle, rgba(117,168,139,0.2) 0%, rgba(67,117,91,0.08) 55%, transparent 100%)",
    iconColor: "phoenix:text-emerald-300",
  },
  {
    icon: Coffee,
    label: "Short break",
    href: "#short-break",
    gradient:
      "radial-gradient(circle, rgba(217,173,108,0.2) 0%, rgba(168,118,60,0.08) 55%, transparent 100%)",
    iconColor: "phoenix:text-amber-300",
  },
  {
    icon: Sparkles,
    label: "Long break",
    href: "#long-break",
    gradient:
      "radial-gradient(circle, rgba(126,158,194,0.2) 0%, rgba(77,112,151,0.08) 55%, transparent 100%)",
    iconColor: "phoenix:text-sky-300",
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

const formatTime = (milliseconds: number) => {
  const seconds = Math.ceil(milliseconds / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
};

const RestingCat = () => (
  <svg
    viewBox="0 0 520 240"
    role="img"
    aria-label="A cat resting peacefully"
    className="phoenix:h-44 phoenix:w-full phoenix:max-w-lg"
  >
    <ellipse cx="260" cy="208" rx="158" ry="16" fill="#35483b" />
    <path
      d="M119 166c0-36 37-61 83-61 18-31 63-48 118-38 51 9 85 36 89 70 31 5 50 20 50 39 0 24-34 37-79 37H205c-48 0-86-15-86-47Z"
      fill="#d9b68b"
    />
    <path d="m150 121-5-43 43 25m137-1 31-34 8 51" fill="#d9b68b" />
    <path d="m157 108-2-18 21 12m161-2 16-18 4 28" fill="#b87872" />
    <ellipse cx="192" cy="151" rx="45" ry="40" fill="#e7c9a1" />
    <path
      d="M172 150c7 8 15 8 22 0m8 0c7 8 15 8 22 0"
      fill="none"
      stroke="#665548"
      strokeWidth="4"
      strokeLinecap="round"
    />
    <path d="m207 160 6 5 6-5" fill="#b87872" />
    <path
      d="M213 165c-3 9-11 11-18 6m18-6c3 9 11 11 18 6"
      fill="none"
      stroke="#8a6753"
      strokeWidth="3"
      strokeLinecap="round"
    />
    <path
      d="M261 115c15 13 18 27 14 42m22-42c15 13 18 27 14 42m23-34c13 12 16 24 13 37"
      fill="none"
      stroke="#b98e6d"
      strokeWidth="10"
      strokeLinecap="round"
    />
    <ellipse cx="167" cy="190" rx="39" ry="13" fill="#f0d8b5" />
    <path
      d="M364 172c32-30 60-24 65-7 7 23-28 34-53 30"
      fill="none"
      stroke="#b98e6d"
      strokeWidth="18"
      strokeLinecap="round"
    />
    <path
      d="M115 108c-9-13 9-22 22-9m211-27c9-13 27-4 18 9m34 26c10-12 27-2 17 10"
      fill="#637064"
      opacity=".55"
    />
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
  const [todos, setTodos] = useState<TodoItem[]>(loadTodos);
  const [newTodo, setNewTodo] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [ambient, setAmbient] = useState("Rainy afternoon");
  const [ambientOn, setAmbientOn] = useState(true);
  const [sleepMode, setSleepMode] = useState(true);
  const [activeTab, setActiveTab] = useState<DashboardTab>("timer");
  const [now, setNow] = useState(() => Date.now());
  const remainingMs =
    timer.isRunning && timer.endsAt !== null ? Math.max(0, timer.endsAt - now) : timer.remainingMs;
  const progress = Math.min(1, Math.max(0, 1 - remainingMs / DURATIONS[timer.mode]));
  const completedInCycle = timer.focusSessions % CYCLE_LENGTH;
  const completedTodos = todos.filter((todo) => todo.completed).length;
  const currentTask =
    timer.task || todos.find((todo) => !todo.completed)?.title || "Read a chapter";

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

  const advancePhase = useCallback((countSession: boolean) => {
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
        remainingMs: DURATIONS[nextMode],
        endsAt: null,
        isRunning: false,
        focusSessions,
      };
    });
  }, []);

  useEffect(() => {
    if (timer.isRunning && remainingMs === 0) advancePhase(true);
  }, [advancePhase, remainingMs, timer.isRunning]);

  const selectMode = (mode: TimerMode) => {
    setTimer((current) => ({
      ...current,
      mode,
      remainingMs: DURATIONS[mode],
      endsAt: null,
      isRunning: false,
    }));
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

  const completedSessions = timer.focusSessions;
  const remainingToLongBreak =
    completedInCycle === 0 ? CYCLE_LENGTH : CYCLE_LENGTH - completedInCycle;

  return (
    <div className="phoenix-focus-dashboard phoenix:flex phoenix:h-full phoenix:min-h-0 phoenix:flex-col phoenix:bg-background phoenix:text-foreground">
      <header className="phoenix:flex phoenix:flex-wrap phoenix:items-center phoenix:justify-between phoenix:gap-3 phoenix:border-b phoenix:border-[#263129] phoenix:px-4 phoenix:py-3 phoenix:md:px-6">
        <div className="phoenix:flex phoenix:items-center phoenix:gap-3">
          <div className="phoenix:flex phoenix:size-9 phoenix:items-center phoenix:justify-center phoenix:rounded-xl phoenix:bg-[#1a2920] phoenix:text-[#83b495]">
            <IconTarget className="phoenix:size-5" />
          </div>
          <div>
            <p className="phoenix:text-base phoenix:font-semibold phoenix:tracking-tight">
              little by little
            </p>
            <p className="phoenix:text-[10px] phoenix:text-muted-foreground">
              Quiet focus, one step at a time
            </p>
          </div>
        </div>
        <div className="phoenix:flex phoenix:items-center phoenix:gap-2">
          <span className="phoenix:rounded-full phoenix:border phoenix:border-[#344336] phoenix:bg-[#1a241c] phoenix:px-3 phoenix:py-1.5 phoenix:text-[11px] phoenix:font-medium phoenix:text-[#b5c6b7]">
            ✦ &nbsp;Session {completedInCycle + 1} of {CYCLE_LENGTH}
          </span>
          <span className="phoenix:hidden phoenix:rounded-full phoenix:border phoenix:border-[#344336] phoenix:bg-[#1a241c] phoenix:px-3 phoenix:py-1.5 phoenix:text-[11px] phoenix:text-muted-foreground phoenix:sm:inline">
            {ambient}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="phoenix:rounded-full phoenix:border phoenix:border-[#344336] phoenix:bg-[#1a241c] phoenix:px-3"
            onClick={() => {
              setActiveTab("character");
              setProfileOpen(true);
            }}
          >
            <IconUserCircle className="phoenix:size-4" />
            <span className="phoenix:flex phoenix:size-5 phoenix:items-center phoenix:justify-center phoenix:rounded-full phoenix:bg-[#49765a] phoenix:text-[10px] phoenix:text-white">
              {profile.avatar}
            </span>
            {profile.name || manifest.title}
          </Button>
        </div>
      </header>

      <main className="phoenix:min-h-0 phoenix:flex-1 phoenix:overflow-auto">
        <div className="phoenix:mx-auto phoenix:grid phoenix:w-full phoenix:max-w-[1500px] phoenix:gap-4 phoenix:p-4 phoenix:lg:grid-cols-[14rem_minmax(0,1fr)] phoenix:xl:grid-cols-[14rem_minmax(0,1fr)_14rem]">
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

            <Card className="phoenix:border-[#29352d] phoenix:bg-[#151a16]">
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

            <Card className="phoenix:border-[#29352d] phoenix:bg-[#151a16]">
              <Card.Content className="phoenix:flex phoenix:flex-col phoenix:gap-3 phoenix:p-3">
                <p className="phoenix:text-[10px] phoenix:font-semibold phoenix:uppercase phoenix:tracking-wide phoenix:text-[#aab7aa]">
                  Session progress
                </p>
                <div className="phoenix:flex phoenix:items-center phoenix:justify-between">
                  <span className="phoenix:text-xs phoenix:text-muted-foreground">Focus time</span>
                  <span className="phoenix:text-xs phoenix:font-semibold">
                    {Math.round(progress * 100)}%
                  </span>
                </div>
                <div className="phoenix:h-1.5 phoenix:overflow-hidden phoenix:rounded-full phoenix:bg-[#263129]">
                  <div
                    className="phoenix:h-full phoenix:rounded-full phoenix:bg-[#77a88a] phoenix:transition-all"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
                <p className="phoenix:text-[11px] phoenix:text-muted-foreground">
                  {timer.isRunning
                    ? `${formatTime(remainingMs)} remaining`
                    : "Ready for your next focus block"}
                </p>
              </Card.Content>
            </Card>

            <Card className="phoenix:min-h-0 phoenix:border-[#29352d] phoenix:bg-[#151a16]">
              <Card.Content className="phoenix:flex phoenix:flex-col phoenix:gap-3 phoenix:p-3">
                <div className="phoenix:flex phoenix:items-center phoenix:justify-between phoenix:gap-2">
                  <p className="phoenix:text-[10px] phoenix:font-semibold phoenix:uppercase phoenix:tracking-wide phoenix:text-[#aab7aa]">
                    Today’s focus
                  </p>
                  <span className="phoenix:text-[10px] phoenix:text-muted-foreground">
                    {completedTodos}/{todos.length}
                  </span>
                </div>
                <form className="phoenix:flex phoenix:gap-1.5" onSubmit={addTodo}>
                  <label className="phoenix:sr-only" htmlFor="new-todo">
                    Add a focus task
                  </label>
                  <input
                    id="new-todo"
                    className="phoenix:h-8 phoenix:min-w-0 phoenix:flex-1 phoenix:rounded-lg phoenix:border phoenix:border-[#303b33] phoenix:bg-[#101411] phoenix:px-2 phoenix:text-[11px] phoenix:outline-none focus:phoenix:ring-1 focus:phoenix:ring-[#75a88b]"
                    maxLength={160}
                    placeholder="Add a task..."
                    value={newTodo}
                    onChange={(event) => setNewTodo(event.target.value)}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    variant="outline"
                    className="phoenix:size-8"
                    aria-label="Add task"
                    disabled={!newTodo.trim()}
                  >
                    <IconPlus className="phoenix:size-4" />
                  </Button>
                </form>
                <ul className="phoenix:flex phoenix:flex-col phoenix:gap-2">
                  {todos.map((todo, index) => (
                    <li key={todo.id} className="phoenix:flex phoenix:items-start phoenix:gap-2">
                      <button
                        type="button"
                        aria-label={`${todo.completed ? "Reopen" : "Complete"} ${todo.title}`}
                        className={`phoenix:mt-0.5 phoenix:flex phoenix:size-4 phoenix:shrink-0 phoenix:items-center phoenix:justify-center phoenix:rounded-full phoenix:border ${todo.completed ? "phoenix:border-[#75a88b] phoenix:bg-[#75a88b] phoenix:text-[#101411]" : "phoenix:border-[#526457] phoenix:text-transparent"}`}
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
                        className={`phoenix:min-w-0 phoenix:flex-1 phoenix:text-left phoenix:text-[11px] phoenix:leading-snug ${todo.completed ? "phoenix:text-muted-foreground phoenix:line-through" : "phoenix:text-[#e0e5df]"}`}
                        onClick={() => setTimer((current) => ({ ...current, task: todo.title }))}
                      >
                        <span className="phoenix:mr-1 phoenix:text-[#83a08d]">{index + 1}.</span>
                        {todo.title}
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${todo.title}`}
                        className="phoenix:text-muted-foreground hover:phoenix:text-foreground"
                        onClick={() =>
                          setTodos((current) => current.filter((item) => item.id !== todo.id))
                        }
                      >
                        <IconTrash className="phoenix:size-3" />
                      </button>
                    </li>
                  ))}
                  {todos.length === 0 && (
                    <li className="phoenix:py-1 phoenix:text-[11px] phoenix:text-muted-foreground">
                      Add a task to begin your list.
                    </li>
                  )}
                </ul>
              </Card.Content>
            </Card>

            <nav
              aria-label="Focus dashboard"
              className="phoenix:flex phoenix:flex-wrap phoenix:gap-1.5"
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
            <Card className="phoenix:relative phoenix:min-h-36 phoenix:overflow-hidden phoenix:border-[#29352d] phoenix:bg-[#171d19]">
              <div className="phoenix:pointer-events-none phoenix:absolute phoenix:-left-10 phoenix:-top-20 phoenix:size-56 phoenix:rounded-full phoenix:bg-[#617d6b]/10" />
              <div className="phoenix:pointer-events-none phoenix:absolute phoenix:-right-5 phoenix:-top-16 phoenix:size-56 phoenix:rounded-full phoenix:bg-[#4f7357]/10" />
              <Card.Content className="phoenix:relative phoenix:flex phoenix:min-h-36 phoenix:flex-col phoenix:justify-between phoenix:p-4">
                <div className="phoenix:flex phoenix:items-start phoenix:justify-between phoenix:gap-4">
                  <div>
                    <p className="phoenix:text-[9px] phoenix:font-semibold phoenix:uppercase phoenix:tracking-widest phoenix:text-[#9cac9e]">
                      {timer.mode === "focus" ? "Active focus" : "A moment to pause"}
                    </p>
                    <h2 className="phoenix:mt-1 phoenix:text-lg phoenix:font-semibold">
                      {timer.mode === "focus"
                        ? "Your focus is resting here"
                        : `Time for a ${MODE_LABELS[timer.mode].toLowerCase()}`}
                    </h2>
                  </div>
                  <span className="phoenix:rounded-full phoenix:border phoenix:border-[#354237] phoenix:bg-[#19211b]/80 phoenix:px-2.5 phoenix:py-1 phoenix:text-[10px] phoenix:text-[#b7c4b8]">
                    Session {completedInCycle + 1} of {CYCLE_LENGTH}
                  </span>
                </div>
                <div className="phoenix:flex phoenix:justify-center phoenix:py-1">
                  <RestingCat />
                </div>
              </Card.Content>
            </Card>

            <Card className="phoenix:flex-1 phoenix:border-[#29352d] phoenix:bg-[#151a16]">
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
                      <div className="phoenix:flex phoenix:items-center phoenix:gap-2">
                        <IconClock className="phoenix:size-4 phoenix:text-[#83a98f]" />
                        <span className="phoenix:text-xs phoenix:text-muted-foreground">
                          {MODE_LABELS[timer.mode]}
                        </span>
                      </div>
                    </div>

                    <div className="phoenix:flex phoenix:items-center phoenix:gap-2">
                      <div className="phoenix:h-1 phoenix:flex-1 phoenix:overflow-hidden phoenix:rounded-full phoenix:bg-[#263129]">
                        <div
                          className="phoenix:h-full phoenix:rounded-full phoenix:bg-[#75a88b]"
                          style={{ width: `${Math.max(3, progress * 100)}%` }}
                        />
                      </div>
                      <span className="phoenix:text-[10px] phoenix:text-muted-foreground">
                        {Math.round(progress * 100)}%
                      </span>
                    </div>

                    <div className="phoenix:grid phoenix:flex-1 phoenix:place-items-center phoenix:overflow-hidden phoenix:rounded-xl phoenix:border phoenix:border-[#29352d] phoenix:bg-[#111713] phoenix:p-2">
                      <div className="phoenix:flex phoenix:w-full phoenix:flex-col phoenix:items-center phoenix:gap-1">
                        <RestingCat />
                        <div className="phoenix:rounded-xl phoenix:border phoenix:border-[#344338] phoenix:bg-[#1a231d] phoenix:px-4 phoenix:py-2 phoenix:text-center phoenix:text-xs phoenix:text-[#dce4dc]">
                          One page at a time.
                          <br />
                          You’re doing just fine.
                        </div>
                      </div>
                    </div>

                    <div className="phoenix:flex phoenix:flex-col phoenix:items-center phoenix:gap-3">
                      <div className="phoenix:flex phoenix:items-center phoenix:gap-3">
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="Reset timer"
                          onClick={() =>
                            setTimer((current) => ({
                              ...current,
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
                          className="phoenix:min-w-40 phoenix:bg-[#47745a] phoenix:text-white hover:phoenix:bg-[#568866]"
                          onClick={toggleTimer}
                        >
                          {timer.isRunning ? <IconPlayerPause /> : <IconPlayerPlay />}
                          {timer.isRunning ? "Pause focus" : "Let’s focus"}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="Skip to next phase"
                          onClick={() => advancePhase(false)}
                        >
                          <IconPlayerSkipForward className="phoenix:size-4" />
                        </Button>
                      </div>
                      <div className="phoenix:flex phoenix:items-center phoenix:gap-2 phoenix:font-mono phoenix:text-3xl phoenix:font-semibold phoenix:tabular-nums phoenix:text-[#e9eee9]">
                        {formatTime(remainingMs)}
                        <span className="phoenix:font-sans phoenix:text-xs phoenix:font-normal phoenix:text-muted-foreground">
                          remaining
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </Card.Content>
            </Card>
          </section>

          <aside className="phoenix:flex phoenix:flex-col phoenix:gap-3">
            <Card className="phoenix:border-[#29352d] phoenix:bg-[#151a16]">
              <Card.Content className="phoenix:flex phoenix:flex-col phoenix:gap-3 phoenix:p-3">
                <div className="phoenix:flex phoenix:items-center phoenix:justify-between">
                  <p className="phoenix:text-[10px] phoenix:font-semibold phoenix:uppercase phoenix:tracking-wide phoenix:text-[#aab7aa]">
                    Ambient sound
                  </p>
                  <button
                    type="button"
                    aria-label={ambientOn ? "Mute ambient sound" : "Enable ambient sound"}
                    onClick={() => setAmbientOn((value) => !value)}
                    className="phoenix:text-[#86ac91]"
                  >
                    <IconVolume className="phoenix:size-4" />
                  </button>
                </div>
                <label className="phoenix:relative phoenix:block">
                  <span className="phoenix:sr-only">Ambient sound</span>
                  <select
                    value={ambient}
                    onChange={(event) => setAmbient(event.target.value)}
                    className="phoenix:h-9 phoenix:w-full phoenix:appearance-none phoenix:rounded-lg phoenix:border phoenix:border-[#303b33] phoenix:bg-[#111713] phoenix:px-3 phoenix:pr-8 phoenix:text-xs phoenix:outline-none focus:phoenix:ring-1 focus:phoenix:ring-[#75a88b]"
                  >
                    <option>Rainy afternoon</option>
                    <option>Forest breeze</option>
                    <option>Quiet café</option>
                    <option>Soft fireplace</option>
                    <option>Silence</option>
                  </select>
                  <IconChevronDown className="phoenix:pointer-events-none phoenix:absolute phoenix:right-2.5 phoenix:top-2.5 phoenix:size-4 phoenix:text-muted-foreground" />
                </label>
                <p className="phoenix:text-[10px] phoenix:leading-relaxed phoenix:text-muted-foreground">
                  {ambientOn
                    ? "A soft soundscape to help you settle into focus."
                    : "Ambient sound is muted for now."}
                </p>
              </Card.Content>
            </Card>

            <Card className="phoenix:border-[#29352d] phoenix:bg-[#151a16]">
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
                  className="phoenix:flex phoenix:items-center phoenix:justify-between phoenix:rounded-lg phoenix:border phoenix:border-[#303b33] phoenix:bg-[#111713] phoenix:px-2.5 phoenix:py-2 phoenix:text-[10px] phoenix:text-[#b4c1b5]"
                >
                  {sleepMode ? "Sleep mode active" : "Wake your companion"}
                  <span
                    className={`phoenix:size-2 phoenix:rounded-full ${sleepMode ? "phoenix:bg-[#75a88b]" : "phoenix:bg-[#69746b]"}`}
                  />
                </button>
              </Card.Content>
            </Card>

            <Card className="phoenix:border-[#29352d] phoenix:bg-[#151a16]">
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

            <Card className="phoenix:border-[#29352d] phoenix:bg-[#151a16]">
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

      <Sheet open={profileOpen} onOpenChange={setProfileOpen}>
        <Sheet.View side="right" className="phoenix:w-full phoenix:sm:max-w-md">
          <Sheet.Header>
            <Sheet.Title>Character customization</Sheet.Title>
            <Sheet.Description>
              Shape your focus companion and personalize your quiet space.
            </Sheet.Description>
            <Sheet.Close />
          </Sheet.Header>
          <Sheet.Content className="phoenix:flex phoenix:flex-col phoenix:gap-6">
            <div className="phoenix:flex phoenix:flex-col phoenix:items-center phoenix:gap-3 phoenix:rounded-xl phoenix:bg-muted/50 phoenix:p-6">
              <div
                className="phoenix:flex phoenix:size-24 phoenix:items-center phoenix:justify-center phoenix:rounded-full phoenix:bg-primary/10 phoenix:text-5xl"
                aria-hidden="true"
              >
                {profile.avatar}
              </div>
              <div className="phoenix:text-center">
                <p className="phoenix:font-medium">{profile.name || "Your focus companion"}</p>
                <p className="phoenix:text-sm phoenix:text-muted-foreground">A little more you.</p>
              </div>
            </div>
            <label className="phoenix:flex phoenix:flex-col phoenix:gap-2">
              <span className="phoenix:text-sm phoenix:font-medium">Display name</span>
              <input
                className="phoenix:h-10 phoenix:w-full phoenix:rounded-md phoenix:border phoenix:border-border phoenix:bg-background phoenix:px-3 phoenix:text-sm phoenix:outline-none focus:phoenix:ring-2 focus:phoenix:ring-ring"
                maxLength={40}
                placeholder="What should we call you?"
                value={profile.name}
                onChange={(event) =>
                  setProfile((current) => ({ ...current, name: event.target.value }))
                }
              />
            </label>
            <fieldset className="phoenix:flex phoenix:flex-col phoenix:gap-3">
              <legend className="phoenix:text-sm phoenix:font-medium">Choose your avatar</legend>
              <div className="phoenix:grid phoenix:grid-cols-5 phoenix:gap-2">
                {AVATAR_CHOICES.map((avatar) => (
                  <Button
                    key={avatar}
                    type="button"
                    variant={profile.avatar === avatar ? "secondary" : "outline"}
                    className="phoenix:h-12 phoenix:text-2xl"
                    aria-label={`Choose ${avatar} avatar`}
                    aria-pressed={profile.avatar === avatar}
                    onClick={() => setProfile((current) => ({ ...current, avatar }))}
                  >
                    {avatar}
                  </Button>
                ))}
              </div>
            </fieldset>
          </Sheet.Content>
        </Sheet.View>
      </Sheet>
    </div>
  );
};
