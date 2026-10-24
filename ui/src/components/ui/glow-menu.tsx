"use client";

import * as React from "react";
import { motion, type Transition, type Variants } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "erxes-ui";

interface MenuItem {
  icon: LucideIcon | React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  gradient: string;
  iconColor: string;
}

interface MenuBarProps {
  items: MenuItem[];
  activeItem?: string;
  onItemClick?: (label: string) => void;
  className?: string;
}

const itemVariants: Variants = {
  initial: { rotateX: 0, opacity: 1 },
  hover: { rotateX: -90, opacity: 0 },
};

const backVariants: Variants = {
  initial: { rotateX: 90, opacity: 0 },
  hover: { rotateX: 0, opacity: 1 },
};

const glowVariants: Variants = {
  initial: { opacity: 0, scale: 0.8 },
  hover: {
    opacity: 1,
    scale: 1.5,
    transition: {
      opacity: { duration: 0.35, ease: [0.4, 0, 0.2, 1] },
      scale: { duration: 0.5, type: "spring", stiffness: 300, damping: 25 },
    },
  },
};

const sharedTransition: Transition = {
  type: "spring",
  stiffness: 100,
  damping: 20,
  duration: 0.5,
};

const MenuContent = ({ item, active }: { item: MenuItem; active: boolean }) => {
  const Icon = item.icon;

  return (
    <>
      <span
        className={cn(
          "phoenix:flex phoenix:shrink-0 phoenix:items-center",
          active ? item.iconColor : "phoenix:text-foreground",
        )}
      >
        <Icon className="phoenix:size-5" />
      </span>
      <span className="phoenix:truncate">{item.label}</span>
    </>
  );
};

export const MenuBar = React.forwardRef<HTMLElement, MenuBarProps>(
  ({ className, items, activeItem, onItemClick }, ref) => (
    <motion.nav
      ref={ref}
      aria-label="Timer modes"
      className={cn(
        "phoenix-glass-panel phoenix:group phoenix:relative phoenix:overflow-hidden phoenix:rounded-2xl phoenix:border phoenix:border-border/40 phoenix:bg-background/80 phoenix:p-2 phoenix:shadow-lg phoenix:backdrop-blur-xl",
        className,
      )}
      initial="initial"
    >
      <motion.div
        aria-hidden="true"
        className="phoenix:pointer-events-none phoenix:absolute phoenix:-inset-2 phoenix:z-0 phoenix:rounded-3xl phoenix:opacity-0 phoenix:transition-opacity phoenix:duration-500 phoenix:group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--primary) 20%, transparent), transparent 70%)",
        }}
      />
      <ul className="phoenix:relative phoenix:z-10 phoenix:flex phoenix:items-center phoenix:justify-center phoenix:gap-1">
        {items.map((item) => {
          const isActive = item.label === activeItem;

          return (
            <motion.li key={item.label} className="phoenix:relative phoenix:min-w-0 phoenix:flex-1">
              <a
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  onItemClick?.(item.label);
                }}
                className="phoenix:block phoenix:w-full phoenix:no-underline"
              >
                <motion.div
                  className="phoenix:group phoenix:relative phoenix:overflow-visible phoenix:rounded-xl"
                  style={{ perspective: "600px" }}
                  initial="initial"
                  whileHover="hover"
                >
                  <motion.div
                    aria-hidden="true"
                    className="phoenix:pointer-events-none phoenix:absolute phoenix:inset-0 phoenix:z-0 phoenix:rounded-xl"
                    variants={glowVariants}
                    animate={isActive ? "hover" : "initial"}
                    style={{ background: item.gradient, opacity: isActive ? 1 : 0 }}
                  />
                  <motion.span
                    className={cn(
                      "phoenix:relative phoenix:z-10 phoenix:flex phoenix:items-center phoenix:justify-center phoenix:gap-2 phoenix:rounded-xl phoenix:bg-transparent phoenix:px-2 phoenix:py-2 phoenix:text-xs phoenix:transition-colors phoenix:sm:px-3 phoenix:sm:text-sm",
                      isActive
                        ? "phoenix:text-foreground"
                        : "phoenix:text-muted-foreground phoenix:group-hover:text-foreground",
                    )}
                    variants={itemVariants}
                    transition={sharedTransition}
                    style={{
                      transformStyle: "preserve-3d",
                      transformOrigin: "center bottom",
                    }}
                  >
                    <MenuContent item={item} active={isActive} />
                  </motion.span>
                  <motion.span
                    aria-hidden="true"
                    className={cn(
                      "phoenix:absolute phoenix:inset-0 phoenix:z-10 phoenix:flex phoenix:items-center phoenix:justify-center phoenix:gap-2 phoenix:rounded-xl phoenix:bg-transparent phoenix:px-2 phoenix:py-2 phoenix:text-xs phoenix:transition-colors phoenix:sm:px-3 phoenix:sm:text-sm",
                      isActive
                        ? "phoenix:text-foreground"
                        : "phoenix:text-muted-foreground phoenix:group-hover:text-foreground",
                    )}
                    variants={backVariants}
                    transition={sharedTransition}
                    style={{
                      transformStyle: "preserve-3d",
                      transformOrigin: "center top",
                    }}
                  >
                    <MenuContent item={item} active={isActive} />
                  </motion.span>
                </motion.div>
              </a>
            </motion.li>
          );
        })}
      </ul>
    </motion.nav>
  ),
);

MenuBar.displayName = "MenuBar";
