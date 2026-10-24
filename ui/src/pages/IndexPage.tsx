import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  IconCheck,
  IconClock,
  IconCoffee,
  IconListCheck,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerSkipForward,
  IconPlus,
  IconRefresh,
  IconTarget,
  IconTrash,
  IconUserCircle,
} from "@tabler/icons-react";
import { Coffee, Sparkles, Timer } from "lucide-react";
import { Breadcrumb, Button, Card, Separator, Sheet } from "erxes-ui";
import { PageHeader } from "ui-modules";
import { Link } from "react-router";
import manifest from "../../../erxes.json" with { type: "json" };
import { MenuBar } from "~/components/ui/glow-menu";

const { path } = manifest.ui;
const STORAGE_KEY = "phoenix:pomodoro-timer";
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

const DEFAULT_PROFILE: Profile = { name: "", avatar: "🙂" };

const DEFAULT_TIMER: TimerState = {
  mode: "focus",
  remainingMs: DURATIONS.focus,
  endsAt: null,
  isRunning: false,
  focusSessions: 0,
  task: "",
};

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
      "radial-gradient(circle, rgba(59,130,246,0.18) 0%, rgba(37,99,235,0.06) 55%, transparent 100%)",
    iconColor: "phoenix:text-blue-500",
  },
  {
    icon: Coffee,
    label: "Short break",
    href: "#short-break",
    gradient:
      "radial-gradient(circle, rgba(249,115,22,0.18) 0%, rgba(234,88,12,0.06) 55%, transparent 100%)",
    iconColor: "phoenix:text-orange-500",
  },
  {
    icon: Sparkles,
    label: "Long break",
    href: "#long-break",
    gradient:
      "radial-gradient(circle, rgba(34,197,94,0.18) 0%, rgba(22,163,74,0.06) 55%, transparent 100%)",
    iconColor: "phoenix:text-green-500",
  },
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const loadTimer = (): TimerState => {
  if (typeof window === "undefined") {
    return DEFAULT_TIMER;
  }

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return DEFAULT_TIMER;
    }

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
  if (typeof window === "undefined") {
    return DEFAULT_PROFILE;
  }

  try {
    const saved = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!saved) {
      return DEFAULT_PROFILE;
    }

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
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const saved = window.localStorage.getItem(TODO_STORAGE_KEY);
    if (!saved) {
      return [];
    }

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
  const totalSeconds = Math.ceil(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

export const IndexPage = () => {
  const [timer, setTimer] = useState<TimerState>(loadTimer);
  const [profile, setProfile] = useState<Profile>(loadProfile);
  const [todos, setTodos] = useState<TodoItem[]>(loadTodos);
  const [newTodo, setNewTodo] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const remainingMs =
    timer.isRunning && timer.endsAt !== null ? Math.max(0, timer.endsAt - now) : timer.remainingMs;
  const duration = DURATIONS[timer.mode];
  const progress = Math.min(1, Math.max(0, 1 - remainingMs / duration));

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(timer));
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
    if (!timer.isRunning) {
      return;
    }

    const interval = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(interval);
  }, [timer.isRunning]);

  const advancePhase = useCallback((countFocusSession: boolean) => {
    setTimer((current) => {
      const focusSessions =
        current.focusSessions + Number(countFocusSession && current.mode === "focus");
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
    if (timer.isRunning && remainingMs === 0) {
      advancePhase(true);
    }
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
      endsAt: Date.now() + current.remainingMs,
      isRunning: true,
    }));
  };

  const resetTimer = () => {
    setTimer((current) => ({
      ...current,
      remainingMs: DURATIONS[current.mode],
      endsAt: null,
      isRunning: false,
    }));
  };

  const addTodo = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = newTodo.trim();
    if (!title) {
      return;
    }

    setTodos((current) => [
      ...current,
      { id: window.crypto.randomUUID(), title, completed: false },
    ]);
    setNewTodo("");
  };

  const toggleTodo = (id: string) => {
    setTodos((current) =>
      current.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item,
      ),
    );
  };

  const removeTodo = (id: string) => {
    setTodos((current) => current.filter((item) => item.id !== id));
  };

  const completedInCycle = timer.focusSessions % CYCLE_LENGTH;
  const completedTodos = todos.filter((item) => item.completed).length;
  const openTodos = todos.filter((item) => !item.completed);

  return (
    <div className="phoenix:flex phoenix:h-full phoenix:flex-col">
      <PageHeader>
        <PageHeader.Start>
          <Button
            variant="outline"
            size="icon"
            aria-label="Open profile and avatar customization"
            aria-expanded={profileOpen}
            onClick={() => setProfileOpen(true)}
          >
            <IconUserCircle />
          </Button>
          <Separator.Inline />
          <Breadcrumb>
            <Breadcrumb.List className="phoenix:gap-1">
              <Breadcrumb.Item>
                <Button variant="ghost" asChild>
                  <Link to={`/${path}`}>{manifest.title}</Link>
                </Button>
              </Breadcrumb.Item>
            </Breadcrumb.List>
          </Breadcrumb>
          <Separator.Inline />
          <PageHeader.FavoriteToggleButton breadcrumb={[manifest.title]} icon="IconClock" />
        </PageHeader.Start>
      </PageHeader>

      <main className="phoenix-focus-dashboard phoenix:flex-1 phoenix:overflow-auto phoenix:bg-background phoenix:text-foreground">
        <div className="phoenix:mx-auto phoenix:grid phoenix:w-full phoenix:max-w-7xl phoenix:gap-4 phoenix:p-4 phoenix:md:gap-5 phoenix:md:p-6 phoenix:xl:grid-cols-[minmax(0,1fr)_18rem]">
          <aside className="phoenix:grid phoenix:grid-cols-1 phoenix:gap-4 phoenix:lg:grid-cols-[14rem_minmax(0,1fr)] phoenix:lg:content-start">
            <div className="phoenix:flex phoenix:items-center phoenix:gap-3 phoenix:px-1 phoenix:py-2 phoenix:lg:col-start-1 phoenix:lg:row-start-1">
              <div className="phoenix:flex phoenix:size-10 phoenix:shrink-0 phoenix:items-center phoenix:justify-center phoenix:rounded-xl phoenix:bg-primary/10 phoenix:text-primary">
                <IconTarget className="phoenix:size-5" />
              </div>
              <div className="phoenix:min-w-0">
                <p className="phoenix:truncate phoenix:text-lg phoenix:font-semibold phoenix:tracking-tight">
                  little by little
                </p>
                <p className="phoenix:text-xs phoenix:text-muted-foreground">
                  A quiet space to focus
                </p>
              </div>
            </div>

            <div className="phoenix:flex phoenix:flex-col phoenix:gap-2 phoenix:px-1 phoenix:py-1 phoenix:lg:col-start-1 phoenix:lg:row-start-2">
              <p className="phoenix:text-xs phoenix:font-medium phoenix:uppercase phoenix:tracking-wider phoenix:text-muted-foreground">
                Your focus space
              </p>
              <h1 className="phoenix:text-xl phoenix:font-semibold phoenix:leading-tight phoenix:tracking-tight">
                {profile.name ? `A little focus, ${profile.name}?` : "A little focus?"}
              </h1>
              <p className="phoenix:text-sm phoenix:leading-relaxed phoenix:text-muted-foreground">
                Start with a clear task and a quiet block. Small, steady moments
                add up.
              </p>
            </div>

            <Card className="phoenix:border-[#2a352e] phoenix:bg-[#171d19] phoenix:lg:col-start-1 phoenix:lg:row-start-3">
              <Card.Content className="phoenix:flex phoenix:flex-col phoenix:gap-2 phoenix:p-4">
                <p className="phoenix:text-xs phoenix:font-semibold phoenix:uppercase phoenix:tracking-wide phoenix:text-primary">
                  A gentle reminder
                </p>
                <p className="phoenix:text-sm phoenix:font-medium">
                  No rush. One task, one breath, one focused interval at a time.
                </p>
              </Card.Content>
            </Card>

            <Card className="phoenix:overflow-hidden phoenix:border-[#29352d] phoenix:bg-[#151a16] phoenix:lg:col-start-2 phoenix:lg:row-span-4 phoenix:lg:row-start-1">
              <Card.Header className="phoenix:items-center">
                <div className="phoenix:flex phoenix:size-9 phoenix:items-center phoenix:justify-center phoenix:rounded-xl phoenix:bg-primary/10 phoenix:text-primary">
                  <IconTarget className="phoenix:size-5" />
                </div>
                <Card.Title>Pomodoro timer</Card.Title>
                <Card.Description>Focus on one thing at a time.</Card.Description>
              </Card.Header>
              <Card.Content className="phoenix:flex phoenix:flex-col phoenix:items-center phoenix:gap-5">
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

                <div
                  className="phoenix:relative phoenix:flex phoenix:size-52 phoenix:items-center phoenix:justify-center"
                  role="timer"
                  aria-label={`${MODE_LABELS[timer.mode]} timer, ${formatTime(remainingMs)} remaining`}
                >
                  <svg
                    className="phoenix:absolute phoenix:inset-0 phoenix:size-full phoenix:-rotate-90"
                    viewBox="0 0 220 220"
                    aria-hidden="true"
                  >
                    <circle
                      cx="110"
                      cy="110"
                      r="96"
                      fill="none"
                      strokeWidth="8"
                      className="phoenix:stroke-muted"
                    />
                    <circle
                      cx="110"
                      cy="110"
                      r="96"
                      fill="none"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 96}
                      strokeDashoffset={2 * Math.PI * 96 * (1 - progress)}
                      className="phoenix:stroke-primary phoenix:transition-[stroke-dashoffset] phoenix:duration-300"
                    />
                  </svg>
                  <div className="phoenix:flex phoenix:flex-col phoenix:items-center phoenix:gap-2">
                    <span className="phoenix:text-sm phoenix:font-medium phoenix:text-muted-foreground">
                      {timer.isRunning ? "In progress" : MODE_LABELS[timer.mode]}
                    </span>
                    <span className="phoenix:font-mono phoenix:text-5xl phoenix:font-semibold phoenix:tracking-tight phoenix:tabular-nums">
                      {formatTime(remainingMs)}
                    </span>
                  </div>
                </div>

                <div className="phoenix:flex phoenix:w-full phoenix:items-center phoenix:justify-center phoenix:gap-2">
                  <Button size="lg" onClick={toggleTimer}>
                    {timer.isRunning ? <IconPlayerPause /> : <IconPlayerPlay />}
                    {timer.isRunning ? "Pause" : "Start"}
                  </Button>
                  <Button variant="outline" size="lg" aria-label="Reset timer" onClick={resetTimer}>
                    <IconRefresh />
                  </Button>
                  <Button
                    variant="ghost"
                    size="lg"
                    aria-label="Skip to the next timer phase"
                    onClick={() => advancePhase(false)}
                  >
                    <IconPlayerSkipForward />
                  </Button>
                </div>
              </Card.Content>
            </Card>

            <Card className="phoenix:border-[#2a352e] phoenix:bg-[#171d19] phoenix:lg:col-start-1 phoenix:lg:row-start-4">
              <Card.Header>
                <Card.Title>Your progress</Card.Title>
                <Card.Description>Completed focus sessions</Card.Description>
              </Card.Header>
              <Card.Content className="phoenix:flex phoenix:flex-col phoenix:gap-4">
                <div className="phoenix:flex phoenix:items-center phoenix:gap-3">
                  <div className="phoenix:flex phoenix:size-10 phoenix:items-center phoenix:justify-center phoenix:rounded-lg phoenix:bg-primary/10 phoenix:text-primary">
                    <IconCheck className="phoenix:size-5" />
                  </div>
                  <div>
                    <p className="phoenix:text-2xl phoenix:font-semibold phoenix:tabular-nums">
                      {timer.focusSessions}
                    </p>
                    <p className="phoenix:text-sm phoenix:text-muted-foreground">
                      focus {timer.focusSessions === 1 ? "session" : "sessions"}
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="phoenix:flex phoenix:items-center phoenix:justify-between phoenix:text-sm">
                  <span className="phoenix:flex phoenix:items-center phoenix:gap-2 phoenix:text-muted-foreground">
                    <IconCoffee className="phoenix:size-4" />
                    Next long break
                  </span>
                  <span className="phoenix:font-medium">
                    {timer.mode === "longBreak"
                      ? "Now"
                      : `${CYCLE_LENGTH - completedInCycle} ${
                          CYCLE_LENGTH - completedInCycle === 1 ? "session" : "sessions"
                        }`}
                  </span>
                </div>
              </Card.Content>
            </Card>
          </aside>

          <section className="phoenix:flex phoenix:min-h-[32rem] phoenix:flex-col">
            <Card className="phoenix:flex-1 phoenix:overflow-hidden phoenix:border-[#29352d] phoenix:bg-[#151a16]">
              <Card.Header>
                <div className="phoenix:flex phoenix:size-10 phoenix:items-center phoenix:justify-center phoenix:rounded-xl phoenix:bg-primary/10 phoenix:text-primary">
                  <IconListCheck className="phoenix:size-5" />
                </div>
                <Card.Title>To-do list</Card.Title>
                <Card.Description>
                  {openTodos.length === 0
                    ? "Plan a small step for your next focus session."
                    : `${openTodos.length} ${openTodos.length === 1 ? "task" : "tasks"} to do · ${completedTodos} completed`}
                </Card.Description>
              </Card.Header>
              <Card.Content className="phoenix:flex phoenix:flex-col phoenix:gap-5">
                <form
                  className="phoenix:flex phoenix:gap-2"
                  onSubmit={addTodo}
                >
                  <label className="phoenix:sr-only" htmlFor="new-todo">
                    Add a task
                  </label>
                  <input
                    id="new-todo"
                    className="phoenix:h-11 phoenix:min-w-0 phoenix:flex-1 phoenix:rounded-md phoenix:border phoenix:border-border phoenix:bg-background phoenix:px-3 phoenix:text-sm phoenix:outline-none focus:phoenix:ring-2 focus:phoenix:ring-ring"
                    type="text"
                    maxLength={160}
                    placeholder="What needs to get done?"
                    value={newTodo}
                    onChange={(event) => setNewTodo(event.target.value)}
                  />
                  <Button type="submit" disabled={!newTodo.trim()}>
                    <IconPlus />
                    Add task
                  </Button>
                </form>

                {todos.length === 0 ? (
                  <div className="phoenix:flex phoenix:min-h-56 phoenix:flex-col phoenix:items-center phoenix:justify-center phoenix:gap-2 phoenix:rounded-xl phoenix:border phoenix:border-dashed phoenix:border-border phoenix:p-6 phoenix:text-center">
                    <IconListCheck className="phoenix:size-8 phoenix:text-muted-foreground" />
                    <p className="phoenix:font-medium">Your list is clear</p>
                    <p className="phoenix:text-sm phoenix:text-muted-foreground">
                      Add a task above to get started.
                    </p>
                  </div>
                ) : (
                  <ul className="phoenix:flex phoenix:flex-col phoenix:divide-y phoenix:divide-border">
                    {[...openTodos, ...todos.filter((item) => item.completed)].map((item) => (
                      <li
                        key={item.id}
                        className="phoenix:flex phoenix:items-center phoenix:gap-3 phoenix:py-3"
                      >
                        <input
                          id={`todo-${item.id}`}
                          className="phoenix:size-4 phoenix:shrink-0 phoenix:accent-primary"
                          type="checkbox"
                          checked={item.completed}
                          onChange={() => toggleTodo(item.id)}
                          aria-label={`Mark ${item.title} ${item.completed ? "incomplete" : "complete"}`}
                        />
                        <label
                          htmlFor={`todo-${item.id}`}
                          className={`phoenix:min-w-0 phoenix:flex-1 phoenix:cursor-pointer phoenix:text-sm ${
                            item.completed
                              ? "phoenix:text-muted-foreground phoenix:line-through"
                              : "phoenix:font-medium"
                          }`}
                        >
                          {item.title}
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${item.title}`}
                          onClick={() => removeTodo(item.id)}
                        >
                          <IconTrash className="phoenix:size-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}

                {todos.length > 0 && (
                  <div className="phoenix:flex phoenix:items-center phoenix:justify-between phoenix:border-t phoenix:border-border phoenix:pt-4 phoenix:text-sm phoenix:text-muted-foreground">
                    <span>
                      {completedTodos} of {todos.length} completed
                    </span>
                    {completedTodos > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setTodos((current) => current.filter((item) => !item.completed))}
                      >
                        Clear completed
                      </Button>
                    )}
                  </div>
                )}
              </Card.Content>
            </Card>
          </section>
        </div>
      </main>

      <nav
        aria-label="Pomodoro sections"
        className="phoenix:flex phoenix:justify-center phoenix:border-t phoenix:border-border phoenix:bg-background/95 phoenix:px-4 phoenix:py-3 phoenix:backdrop-blur"
      >
        <div className="phoenix:flex phoenix:w-full phoenix:max-w-md phoenix:gap-2">
          <Button
            type="button"
            variant={profileOpen ? "ghost" : "secondary"}
            className="phoenix:flex-1"
            aria-current={profileOpen ? undefined : "page"}
            onClick={() => setProfileOpen(false)}
          >
            <IconClock />
            Timer
          </Button>
          <Button
            type="button"
            variant={profileOpen ? "secondary" : "ghost"}
            className="phoenix:flex-1"
            aria-current={profileOpen ? "page" : undefined}
            onClick={() => setProfileOpen(true)}
          >
            <IconUserCircle />
            Avatar
          </Button>
        </div>
      </nav>

      <Sheet open={profileOpen} onOpenChange={setProfileOpen}>
        <Sheet.View side="right" className="phoenix:w-full phoenix:sm:max-w-md">
          <Sheet.Header>
            <Sheet.Title>Customize your profile</Sheet.Title>
            <Sheet.Description>
              Choose an avatar and name for your focus space. These settings stay on this device.
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
                <p className="phoenix:font-medium">{profile.name || "Your focus profile"}</p>
                <p className="phoenix:text-sm phoenix:text-muted-foreground">
                  Your personal Pomodoro space
                </p>
              </div>
            </div>

            <label className="phoenix:flex phoenix:flex-col phoenix:gap-2">
              <span className="phoenix:text-sm phoenix:font-medium">Display name</span>
              <input
                className="phoenix:h-10 phoenix:w-full phoenix:rounded-md phoenix:border phoenix:border-border phoenix:bg-background phoenix:px-3 phoenix:text-sm phoenix:outline-none focus:phoenix:ring-2 focus:phoenix:ring-ring"
                type="text"
                maxLength={40}
                placeholder="What should we call you?"
                value={profile.name}
                onChange={(event) =>
                  setProfile((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
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
