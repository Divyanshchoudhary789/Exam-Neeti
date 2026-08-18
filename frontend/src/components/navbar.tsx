"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../store/useAuthStore";

interface NavbarProps {
  onOpenAuth?: (type: "login" | "join") => void;
  currentView?: string;
  onViewChange?: (view: string) => void;
}

export function Navbar({ onOpenAuth, currentView = "home", onViewChange }: NavbarProps) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: "Home", href: "#home", id: "home" },
    { label: "About Us", href: "#about", id: "about" },
    { label: "Programs", href: "#diagnostics", id: "programs" },
    { label: "Methodology", href: "#features", id: "methodology" },
    { label: "Resources", href: "#resources", id: "resources" },
    { label: "Contact", href: "#footer", id: "contact" }
  ];

  const handleNavClick = (e: React.MouseEvent, href: string, label: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    
    if (onViewChange) {
      if (label === "About Us") onViewChange("about");
      else if (label === "Programs") onViewChange("programs");
      else if (label === "Methodology") onViewChange("methodology");
      else if (label === "Resources") onViewChange("resources");
      else if (label === "Contact") onViewChange("contact");
      else onViewChange("home");
    }

    if (href === "#home") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      const element = document.querySelector(href);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  const getDashboardPath = () => {
    if (!user) return "/";
    if (user.role === "super_admin") return "/superadmin";
    if (user.role === "admin") return "/admin";
    return "/student";
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md transition-all duration-300 shadow-sm">
      <div className="mx-auto flex w-full items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        
        {/* Left Side: Logo & Website Name */}
        <a
          href="#home"
          onClick={(e) => handleNavClick(e, "#home", "Home")}
          className="flex items-center gap-3.5 group"
          id="nav-logo"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 border border-slate-200 p-1 shadow-sm shrink-0 transition-transform group-hover:scale-105 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://iili.io/Clw9yIj.png"
              alt="Exam Neeti Logo"
              className="h-full w-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex flex-col text-left">
            <span className="font-sans text-[20px] font-black tracking-tight text-slate-900 leading-none">
              Exam <span className="text-indigo-600">Neeti</span>
            </span>
            <span className="text-[10px] font-semibold tracking-wide text-slate-500 mt-1">
              Every Score Has a Strategy
            </span>
          </div>
        </a>

        {/* Middle: Page Links */}
        <nav className="hidden md:flex items-center gap-8">
          {navItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <a
                key={item.label}
                href={item.href}
                onClick={(e) => handleNavClick(e, item.href, item.label)}
                className={`relative text-[13px] font-extrabold tracking-wide transition-all duration-200 py-1.5 ${
                  isActive ? "text-indigo-600" : "text-slate-700 hover:text-indigo-600"
                }`}
                id={`nav-item-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <span>{item.label}</span>
                {isActive && (
                  <span className="absolute bottom-[-14px] left-0 right-0 h-[3px] bg-gradient-to-r from-indigo-600 to-violet-600 rounded-full" />
                )}
              </a>
            );
          })}
        </nav>

        {/* Right Side: Auth buttons / User Profile Badge */}
        <div className="hidden md:flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push(getDashboardPath())}
                className="text-[13px] font-extrabold text-white px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 transition-all shadow-md shadow-indigo-600/20 cursor-pointer flex items-center gap-2"
              >
                <span>Dashboard</span>
              </button>
              <button
                onClick={() => {
                  logout();
                  router.push("/");
                }}
                className="text-[13px] font-bold text-slate-700 hover:text-slate-900 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-all cursor-pointer"
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={() => onOpenAuth?.("login")}
              className="text-[13px] font-bold text-slate-700 hover:text-indigo-600 px-5 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 transition-all cursor-pointer shadow-sm"
              id="nav-login-btn"
            >
              Log in
            </button>
          )}
        </div>

        {/* Mobile menu trigger */}
        <div className="flex md:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus:outline-none"
            aria-label="Toggle menu"
            id="mobile-menu-toggle"
          >
            {mobileMenuOpen ? (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile navigation menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-5 shadow-lg" id="mobile-navigation-menu">
          <div className="flex flex-col gap-4 text-left">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={(e) => handleNavClick(e, item.href, item.label)}
                className="text-base font-semibold text-slate-700 hover:text-indigo-600 py-1 transition-colors"
              >
                {item.label}
              </a>
            ))}
            <hr className="border-slate-200 my-2" />
            <div className="flex items-center justify-between gap-4 pt-2">
              {user ? (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    router.push(getDashboardPath());
                  }}
                  className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 text-center text-sm font-bold text-white hover:from-indigo-700 hover:to-violet-700 transition-colors"
                >
                  Dashboard ({user.name})
                </button>
              ) : (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuth?.("login");
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-center text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Log in
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}