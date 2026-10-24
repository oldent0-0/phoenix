import { useCallback, useEffect, useState } from "react";
import {
  IconCheck,
  IconClock,
  IconCoffee,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerSkipForward,
  IconRefresh,
  IconTarget,
} from "@tabler/icons-react";
import { Breadcrumb, Button, Card, Separator } from "erxes-ui";
import { PageHeader } from "ui-modules";
import { Link } from "react-router";
import manifest from "../../../erxes.json" with { type: "json" };

const { path } = manifest.ui;
const STORAGE_KEY = "phoenix:pomodoro-timer";
const CYCLE_LENGTH = 4;

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
      !(value.mode === "focus" ||
        value.mode === "shortBreak" ||
        value.mode === "longBreak") ||
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

const formatTime = (milliseconds: number) => {
  const totalSeconds = Math.ceil(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const TimerModeButton = ({
  mode,
  active,
  onClick,
}: {
  mode: TimerMode;
  active: boolean;
  onClick: () => void;
}) => (
  <Button
    variant={active ? "secondary" : "ghost"}
    aria-pressed={active}
    onClick={onClick}
  >
    {MODE_LABELS[mode]}
  </Button>
);

export const IndexPage = () => {
  const [timer, setTimer] = useState<TimerState>(loadTimer);
  const [now, setNow] = useState(() => Date.now());
  const remainingMs =
    timer.isRunning && timer.endsAt !== null
      ? Math.max(0, timer.endsAt - now)
      : timer.remainingMs;
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
    if (!timer.isRunning) {
      return;
    }

    const interval = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(interval);
  }, [timer.isRunning]);

  const advancePhase = useCallback((countFocusSession: boolean) => {
    setTimer((current) => {
      const focusSessions =
        current.focusSessions +
        Number(countFocusSession && current.mode === "focus");
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
        timer.endsAt === null
          ? timer.remainingMs
          : Math.max(0, timer.endsAt - Date.now());
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

  const completedInCycle = timer.focusSessions % CYCLE_LENGTH;

  return (
    <div className="phoenix:flex phoenix:h-full phoenix:flex-col">
      <PageHeader>
        <PageHeader.Start>
          <Breadcrumb>
            <Breadcrumb.List className="phoenix:gap-1">
              <Breadcrumb.Item>
                <Button variant="ghost" asChild>
                  <Link to={`/${path}`}>
                    <IconClock />
                    {manifest.title}
                  </Link>
                </Button>
              </Breadcrumb.Item>
            </Breadcrumb.List>
          </Breadcrumb>
          <Separator.Inline />
          <PageHeader.FavoriteToggleButton
            breadcrumb={[manifest.title]}
            icon="IconClock"
          />
        </PageHeader.Start>
      </PageHeader>

      <main className="phoenix:flex-1 phoenix:overflow-auto">
        <div className="phoenix:mx-auto phoenix:grid phoenix:w-full phoenix:max-w-5xl phoenix:gap-6 phoenix:p-6 phoenix:lg:grid-cols-[minmax(0,1fr)_18rem]">
          <Card className="phoenix:overflow-hidden">
            <Card.Header className="phoenix:items-center">
              <div className="phoenix:flex phoenix:size-10 phoenix:items-center phoenix:justify-center phoenix:rounded-xl phoenix:bg-primary/10 phoenix:text-primary">
                <IconTarget className="phoenix:size-5" />
              </div>
              <Card.Title>Pomodoro timer</Card.Title>
              <Card.Description>
                Focus on one thing at a time. Your timer is saved on this
                device.
              </Card.Description>
            </Card.Header>
            <Card.Content className="phoenix:flex phoenix:flex-col phoenix:items-center phoenix:gap-7 phoenix:pb-8">
              <div
                className="phoenix:flex phoenix:flex-wrap phoenix:justify-center phoenix:gap-1 phoenix:rounded-lg phoenix:bg-muted phoenix:p-1"
                aria-label="Timer mode"
              >
                {(["focus", "shortBreak", "longBreak"] as const).map((mode) => (
                  <TimerModeButton
                    key={mode}
                    mode={mode}
                    active={timer.mode === mode}
                    onClick={() => selectMode(mode)}
                  />
                ))}
              </div>

              <div
                className="phoenix:relative phoenix:flex phoenix:size-64 phoenix:items-center phoenix:justify-center"
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
                  <span className="phoenix:font-mono phoenix:text-6xl phoenix:font-semibold phoenix:tracking-tight phoenix:tabular-nums">
                    {formatTime(remainingMs)}
                  </span>
                </div>
              </div>

              <div className="phoenix:flex phoenix:items-center phoenix:gap-3">
                <Button size="lg" onClick={toggleTimer}>
                  {timer.isRunning ? <IconPlayerPause /> : <IconPlayerPlay />}
                  {timer.isRunning ? "Pause" : "Start focus"}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  aria-label="Reset timer"
                  onClick={resetTimer}
                >
                  <IconRefresh />
                  Reset
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  aria-label="Skip to the next timer phase"
                  onClick={() => advancePhase(false)}
                >
                  <IconPlayerSkipForward />
                  Skip
                </Button>
              </div>

              <label className="phoenix:flex phoenix:w-full phoenix:max-w-md phoenix:flex-col phoenix:gap-2">
                <span className="phoenix:text-sm phoenix:font-medium">
                  What are you working on?
                </span>
                <input
                  className="phoenix:h-10 phoenix:w-full phoenix:rounded-md phoenix:border phoenix:border-border phoenix:bg-background phoenix:px-3 phoenix:text-sm phoenix:outline-none focus:phoenix:ring-2 focus:phoenix:ring-ring"
                  type="text"
                  maxLength={120}
                  placeholder="e.g. Prepare tomorrow's lesson"
                  value={timer.task}
                  onChange={(event) =>
                    setTimer((current) => ({
                      ...current,
                      task: event.target.value,
                    }))
                  }
                />
              </label>
            </Card.Content>
          </Card>

          <aside className="phoenix:flex phoenix:flex-col phoenix:gap-4">
            <Card>
              <Card.Header>
                <Card.Title>Your progress</Card.Title>
                <Card.Description>
                  Focus sessions completed on this device
                </Card.Description>
              </Card.Header>
              <Card.Content className="phoenix:flex phoenix:flex-col phoenix:gap-5">
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
                          CYCLE_LENGTH - completedInCycle === 1
                            ? "session"
                            : "sessions"
                        }`}
                  </span>
                </div>
              </Card.Content>
            </Card>

            <Card>
              <Card.Header>
                <Card.Title>A gentle rhythm</Card.Title>
                <Card.Description>
                  Work in focused intervals, then give your mind a moment to
                  reset.
                </Card.Description>
              </Card.Header>
              <Card.Content>
                <ol className="phoenix:flex phoenix:flex-col phoenix:gap-3 phoenix:text-sm">
                  <li className="phoenix:flex phoenix:items-center phoenix:justify-between phoenix:gap-2">
                    <span className="phoenix:text-muted-foreground">
                      Focus
                    </span>
                    <span className="phoenix:font-medium">25 min</span>
                  </li>
                  <li className="phoenix:flex phoenix:items-center phoenix:justify-between phoenix:gap-2">
                    <span className="phoenix:text-muted-foreground">
                      Short break
                    </span>
                    <span className="phoenix:font-medium">5 min</span>
                  </li>
                  <li className="phoenix:flex phoenix:items-center phoenix:justify-between phoenix:gap-2">
                    <span className="phoenix:text-muted-foreground">
                      Every 4 sessions
                    </span>
                    <span className="phoenix:font-medium">15 min break</span>
                  </li>
                </ol>
              </Card.Content>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
};
