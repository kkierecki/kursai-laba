"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin/dashboard", label: "Dashboard użycia" },
  { href: "/admin/security", label: "Bezpieczeństwo" },
];

export function AdminNavigation() {
  const pathname = usePathname();

  return <nav className="admin-navigation" aria-label="Nawigacja administratora">
    {links.map((link) => <Link aria-current={pathname === link.href ? "page" : undefined} className={pathname === link.href ? "active" : ""} href={link.href} key={link.href}>{link.label}</Link>)}
  </nav>;
}
