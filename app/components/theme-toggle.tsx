"use client";
import { useEffect, useState } from "react";
export function ThemeToggle() { const [dark, setDark] = useState(false); useEffect(() => { const value = localStorage.getItem("runlab-theme") === "dark"; setDark(value); document.documentElement.dataset.theme = value ? "dark" : "light"; }, []); return <button aria-label="Zmień motyw" className="theme-toggle" onClick={() => { const next = !dark; setDark(next); localStorage.setItem("runlab-theme", next ? "dark" : "light"); document.documentElement.dataset.theme = next ? "dark" : "light"; }} type="button">{dark ? "☀" : "◐"}</button>; }
