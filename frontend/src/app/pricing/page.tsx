"use client";

import { useRouter } from "next/navigation";
import { Navbar } from "../../components/navbar";
import { Footer } from "../../components/footer";
import { Pricing } from "../../components/sections/pricing";
import { IconArrowLeft } from "../../components/common/UIComponents";

export default function PricingPage() {
  const router = useRouter();

  const handleOpenAuth = (type: "login" | "join", planKey?: string) => {
    const registerPath = planKey ? `/register?plan=${encodeURIComponent(planKey)}` : "/register";
    router.push(type === "login" ? "/login" : registerPath);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans antialiased overflow-x-clip w-full max-w-full">
      <Navbar onOpenAuth={handleOpenAuth} />

      <Pricing onOpenAuth={handleOpenAuth} />

      {/* Back to Home */}
      <div className="bg-white py-8 px-4 sm:px-6 lg:px-8 border-t border-slate-100 text-center">
        <button
          onClick={() => router.push("/")}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
        >
          <IconArrowLeft className="w-4 h-4" />
          Back to Home
        </button>
      </div>

      <Footer />
    </div>
  );
}
