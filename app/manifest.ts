import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest { return { name: "RUNLAB — Trener Biegania AI", short_name: "RUNLAB", start_url: "/", display: "standalone", background_color: "#1d1d1b", theme_color: "#fc4c02", icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }] }; }
