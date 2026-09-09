"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "../store/useAuthStore";

interface NavbarProps {
  onOpenAuth?: (type: "login" | "join") => void;
  currentView?: string;
  onViewChange?: (view: string) => void;
}

export function Navbar({ onOpenAuth, onViewChange }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: "Home", href: "/", id: "home" },
    { label: "About Us", href: "/about", id: "about" },
    { label: "Pricing", href: "/pricing", id: "pricing" },
    { label: "Methodology", href: "/methodology", id: "methodology" },
    { label: "Resources", href: "/resources", id: "resources" },
    { label: "Contact", href: "/contact", id: "contact" }
  ];

  const handleNavClick = (e: React.MouseEvent, href: string, label: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);

    if (onViewChange) {
      if (label === "About Us") onViewChange("about");
      else if (label === "Programs") onViewChange("programs");
      else if (label === "Methodology") onViewChange("methodology");
      else if (label === "Resources") onViewChange("resources");
      else if (label === "Pricing") onViewChange("pricing");
      else if (label === "Contact") onViewChange("contact");
      else onViewChange("home");
    }

    if (href === "/") {
      if (pathname === "/") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        router.push("/");
      }
    } else {
      router.push(href);
    }
  };

  const getDashboardPath = () => {
    if (!user) return "/";
    // Super Admins operate from the separate Super Admin Console app.
    if (user.role === "super_admin") {
      return process.env.NEXT_PUBLIC_SUPERADMIN_URL || "http://localhost:3100";
    }
    if (user.role === "admin") return "/admin";
    return "/student";
  };

  return (
    <header className="sticky top-0 z-50 w-full max-w-full bg-[#08080c] border-b border-white/10 transition-all duration-300">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">

        {/* Left: Logo & Brand Name */}
        <Link
          href="/"
          onClick={(e) => handleNavClick(e, "/", "Home")}
          className="flex items-center gap-3 group shrink-0"
          id="nav-logo"
        >
          {/* Actual Logo from public/logo.png */}
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white p-1 shadow-md shadow-black/20 transition-transform group-hover:scale-105 shrink-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Exam Neeti Logo"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="flex flex-col text-left">
            <span className="font-sans text-[18px] font-extrabold tracking-tight text-white leading-none">
              Exam Neeti
            </span>
            <span className="text-[10.5px] font-medium tracking-wide text-slate-400 mt-1">
              Every Score Has a Strategy
            </span>
          </div>
        </Link>

        {/* Middle: Navigation Links */}
        <nav className="hidden lg:flex items-center gap-4 xl:gap-6">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={(e) => handleNavClick(e, item.href, item.label)}
                className={`relative text-[12.5px] xl:text-[13.5px] font-semibold tracking-wide transition-all duration-200 py-1 flex flex-col items-center whitespace-nowrap ${isActive ? "text-white" : "text-slate-300 hover:text-white"
                  }`}
                id={`nav-item-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <span>{item.label}</span>
                {isActive && (
                  <span className="mt-1 h-[2.5px] w-6 bg-gradient-to-r from-[#6366f1] to-[#a855f7] rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right: Auth buttons / User Profile */}
        <div className="hidden lg:flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push(getDashboardPath())}
                className="text-xs font-bold text-white px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md shadow-indigo-600/20 cursor-pointer flex items-center gap-2"
              >
                <span>Dashboard</span>
              </button>
              <button
                onClick={() => {
                  logout();
                  router.push("/");
                }}
                className="text-xs font-medium text-slate-300 hover:text-white px-3.5 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={() => onOpenAuth?.("login")}
                className="text-xs sm:text-[13px] font-medium text-slate-200 hover:text-white px-4 py-2 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
                id="nav-login-btn"
              >
                Log in
              </button>
              <button
                onClick={() => onOpenAuth?.("join")}
                className="text-xs sm:text-[13px] font-bold text-white px-4.5 py-2 rounded-lg bg-gradient-to-r from-[#4f46e5] to-[#7c3aed] hover:from-[#4338ca] hover:to-[#6d28d9] transition-all shadow-md shadow-indigo-600/30 cursor-pointer active:scale-95"
                id="nav-join-btn"
              >
                Join Now
              </button>
            </div>
          )}
        </div>

        {/* Mobile menu trigger */}
        <div className="flex lg:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-lg p-2 text-slate-300 hover:text-white hover:bg-white/10 focus:outline-none"
            aria-label="Toggle menu"
            id="mobile-menu-toggle"
          >
            {mobileMenuOpen ? (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile navigation menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-white/10 bg-[#0c0c14] px-4 py-5 shadow-2xl" id="mobile-navigation-menu">
          <div className="flex flex-col gap-4 text-left">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={(e) => handleNavClick(e, item.href, item.label)}
                className={`text-sm font-semibold py-1 transition-colors ${pathname === item.href ? "text-[#a855f7]" : "text-slate-300 hover:text-white"
                  }`}
              >
                {item.label}
              </Link>
            ))}
            <hr className="border-white/10 my-1" />
            <div className="flex flex-col gap-2.5 pt-2">
              {user ? (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    router.push(getDashboardPath());
                  }}
                  className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 py-2.5 text-center text-sm font-bold text-white hover:from-indigo-700 hover:to-purple-700 transition-colors"
                >
                  Dashboard ({user.name})
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenAuth?.("login");
                    }}
                    className="w-full rounded-lg border border-white/20 bg-white/5 py-2 text-center text-sm font-semibold text-white hover:bg-white/10 transition-colors"
                  >
                    Log in
                  </button>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenAuth?.("join");
                    }}
                    className="w-full rounded-lg bg-gradient-to-r from-[#4f46e5] to-[#7c3aed] py-2 text-center text-sm font-bold text-white hover:from-[#4338ca] hover:to-[#6d28d9] transition-colors shadow-md"
                  >
                    Join Now
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}