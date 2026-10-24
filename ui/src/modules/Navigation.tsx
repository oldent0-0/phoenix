import { IconClock, IconMoon, IconSettings, IconSun } from "@tabler/icons-react";
// Root import on purpose: core-ui shares `erxes-ui` as a Module Federation
// singleton keyed on the bare specifier, so deep imports would bundle a second
// private copy instead of reusing the host's.
import { NavigationMenuLinkItem, Sidebar } from "erxes-ui";
import manifest from "../../../erxes.json" with { type: "json" };

export const Navigation = ({
  theme,
  onThemeToggle,
}: {
  theme: "dark" | "light";
  onThemeToggle: () => void;
}) => (
  <Sidebar.Group>
    <Sidebar.GroupContent>
      <Sidebar.Menu>
        <NavigationMenuLinkItem
          name={manifest.title}
          icon={IconClock}
          path={`/${manifest.ui.path}`}
        />
        <NavigationMenuLinkItem
          name="Settings"
          icon={IconSettings}
          path={`/${manifest.ui.path}/settings`}
        />
        <li className="phoenix:mt-2 phoenix:flex phoenix:items-center phoenix:justify-between phoenix:gap-2 phoenix:rounded-md phoenix:border phoenix:border-border/80 phoenix:bg-muted/40 phoenix:px-3 phoenix:py-2 phoenix:text-sm phoenix:text-foreground">
          <span className="phoenix:flex phoenix:items-center phoenix:gap-2">
            {theme === "dark" ? <IconMoon size={16} /> : <IconSun size={16} />}
            {theme === "dark" ? "Dark" : "Light"}
          </span>
          <button
            type="button"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            onClick={onThemeToggle}
            className="phoenix:flex phoenix:h-7 phoenix:w-12 phoenix:items-center phoenix:rounded-full phoenix:border phoenix:border-border phoenix:bg-background phoenix:p-1 phoenix:transition-colors"
          >
            <span
              className={`phoenix:flex phoenix:h-5 phoenix:w-5 phoenix:items-center phoenix:justify-center phoenix:rounded-full phoenix:bg-primary phoenix:text-primary-foreground phoenix:transition-transform ${
                theme === "dark" ? "phoenix:translate-x-0" : "phoenix:translate-x-5"
              }`}
            >
              {theme === "dark" ? <IconMoon size={12} /> : <IconSun size={12} />}
            </span>
          </button>
        </li>
      </Sidebar.Menu>
    </Sidebar.GroupContent>
  </Sidebar.Group>
);
