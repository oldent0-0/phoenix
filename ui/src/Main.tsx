import "./styles.css";
import { lazy, Suspense, useEffect, useState } from "react";
import { Route, Routes } from "react-router";
import { AppLayout } from "erxes-ui";
import manifest from "../../erxes.json" with { type: "json" };
import { Navigation } from "./modules/Navigation";

const THEME_STORAGE_KEY = "phoenix-theme";
type ThemeMode = "dark" | "light";

const getStoredTheme = (): ThemeMode => {
  if (typeof window === "undefined") {
    return "dark";
  }

  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  return saved === "light" ? "light" : "dark";
};

const IndexPage = lazy(() =>
  import("./pages/IndexPage").then((module) => ({
    default: module.IndexPage,
  })),
);
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((module) => ({ default: module.SettingsPage })),
);

// core-ui mounts this component at `/<path>/*`; routes below are relative to
// it. It resolves the component by the PascalCase expose name.
export const Phoenix = () => {
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  };

  return (
    <div
      className={theme === "light" ? "phoenix-theme-light" : "phoenix-theme-dark"}
      data-theme={theme}
    >
      <AppLayout
        id={manifest.name}
        title={manifest.title}
        sidebar={<Navigation theme={theme} onThemeToggle={toggleTheme} />}
      >
        <Suspense fallback={<div role="status">Loading…</div>}>
          <Routes>
            <Route index element={<IndexPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Routes>
        </Suspense>
      </AppLayout>
    </div>
  );
};
