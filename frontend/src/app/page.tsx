"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "../components/navbar";
import { Footer } from "../components/footer";

// Standalone Section Imports
import { Hero } from "../components/sections/hero";
import { Stats } from "../components/sections/stats";
import { About } from "../components/sections/about";
import { Programs } from "../components/sections/programs";
import { Pricing } from "../components/sections/pricing";
import { Methodology } from "../components/sections/methodology";
import { Testimonials } from "../components/sections/testimonials";
import { Resources } from "../components/sections/resources";
import { Contact } from "../components/sections/contact";

export default function Home() {
  const router = useRouter();
  const [currentView, setCurrentView] = useState("home");

  const handleOpenAuth = (type: "login" | "join", planKey?: string) => {
    const registerPath = planKey ? `/register?plan=${encodeURIComponent(planKey)}` : "/register";
    router.push(type === "login" ? "/login" : registerPath);
  };

  return (
    // overflow-x-clip (not -hidden) contains sideways overflow WITHOUT making this
    // element a scroll container — otherwise every `position: sticky` descendant
    // (the navbar, the Diagnostics rail) silently stops sticking.
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans select-none antialiased overflow-x-clip w-full max-w-full">
      {/* Navigation */}
      <Navbar
        onOpenAuth={handleOpenAuth}
        currentView={currentView}
        onViewChange={setCurrentView}
      />

      {/* Hero Section */}
      <Hero onOpenAuth={handleOpenAuth} />

      {/* Stats Counters */}
      <Stats />

      {/* About Us Section */}
      <About />

      {/* Programs Section */}
      <Programs onOpenAuth={handleOpenAuth} />

      {/* Pricing Section */}
      <Pricing onOpenAuth={handleOpenAuth} />

      {/* Methodology Section */}
      <Methodology />

      {/* Testimonials Section */}
      <Testimonials />

      {/* Resources Section */}
      <Resources onOpenAuth={handleOpenAuth} />

      {/* Contact Section */}
      <Contact />

      {/* Footer Copy */}
      <Footer />
    </div>
  );
}
