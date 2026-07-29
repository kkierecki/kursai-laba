"use client";

import { useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AppIcon, type AppIconName } from "./app-icon";

const leadingIcon = /^\s*[\p{Extended_Pictographic}\uFE0F\u200D]+\s*/u;
const pictographs = /[\p{Extended_Pictographic}\uFE0F\u200D]/gu;

function iconForPath(pathname: string): AppIconName | null {
  if (pathname === "/") return null;
  const paths: Array<[string, AppIconName]> = [
    ["/chat", "chat"], ["/history", "history"], ["/trainings", "activity"],
    ["/race-plan", "target"], ["/briefings", "briefing"], ["/think", "brain"],
    ["/fewshot", "book"], ["/format", "align"], ["/search", "search"],
    ["/generate", "image"], ["/vision", "eye"], ["/agent", "bot"],
    ["/react", "refresh"], ["/travel", "plane"], ["/extract", "chart"],
    ["/email-triage", "mail"], ["/report", "report"], ["/competitor", "buildings"],
    ["/upload", "library"],
  ];
  return paths.find(([path]) => pathname.startsWith(path))?.[1] ?? null;
}

export function LegacyHeadingIcons() {
  useEffect(() => {
    const iconRoots = new Map<HTMLSpanElement, Root>();
    const clean = () => {
      document.querySelectorAll("main h1, main button").forEach((element) => {
        const isHeading = element.tagName === "H1";
        if (isHeading && element.classList.contains("briefings-title")) return;
        if (!isHeading && element.textContent?.trim().length === 0) return;

        for (const node of element.childNodes) {
          if (node.nodeType !== Node.TEXT_NODE || !node.textContent) continue;
          const cleaned = node.textContent.replace(leadingIcon, "").replace(pictographs, "");
          if (cleaned !== node.textContent) {
            node.textContent = cleaned;
            if (!isHeading) element.classList.add("legacy-button-icon");
          }
          break;
        }
      });

      const heading = document.querySelector<HTMLElement>("main h1");
      const icon = iconForPath(window.location.pathname);
      if (!heading || !icon || heading.classList.contains("briefings-title") || heading.querySelector(".page-title-icon")) return;

      const mount = document.createElement("span");
      mount.className = "page-title-icon";
      mount.setAttribute("aria-hidden", "true");
      heading.prepend(mount);
      const root = createRoot(mount);
      root.render(<AppIcon className="page-title-icon-svg" name={icon} />);
      iconRoots.set(mount, root);
    };

    clean();
    const observer = new MutationObserver(clean);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      iconRoots.forEach((root) => root.unmount());
    };
  }, []);

  return null;
}
