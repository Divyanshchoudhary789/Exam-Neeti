"use client";

import { useState } from "react";
import { Navbar } from "../components/navbar";
import { Login } from "../components/login/login";
import { Footer } from "../components/footer";

// Standalone Section Imports
import { Hero } from "../components/sections/hero";
import { Stats } from "../components/sections/stats";
import { About } from "../components/sections/about";
import { Programs } from "../components/sections/programs";
import { Methodology } from "../components/sections/methodology";
import { Testimonials } from "../components/sections/testimonials";
import { Resources } from "../components/sections/resources";
import { Contact } from "../components/sections/contact";

export default function Home() {
  const [currentView, setCurrentView] = useState("home");
  const [authModal, setAuthModal] = useState<"login" | "join" | null>(null);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans select-none antialiased">
      {/* Navigation */}
      <Navbar
        onOpenAuth={setAuthModal}
        currentView={currentView}
        onViewChange={setCurrentView}
      />

      {/* Hero Section */}
      <Hero onOpenAuth={setAuthModal} />

      {/* Stats Counters */}
      <Stats />

      {/* About Us Section */}
      <About />

      {/* Programs Section */}
      <Programs onOpenAuth={setAuthModal} />

      {/* Methodology Section */}
      <Methodology />

      {/* Testimonials Section */}
      <Testimonials />

      {/* Resources Section */}
      <Resources onOpenAuth={setAuthModal} />

      {/* Contact Section */}
      <Contact />

      {/* Footer Copy */}
      <Footer />

      {/* Auth Modals */}
      <Login
        isOpen={authModal === "login"}
        onClose={() => setAuthModal(null)}
        onSwitchToRegister={() => setAuthModal("join")}
      />
    </div>
  );
}
