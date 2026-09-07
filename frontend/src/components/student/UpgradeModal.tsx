"use client";

import { useEffect, useMemo, useState } from "react";
import { paymentService, Plan, planService } from "../../services/apiServices";
import {
  IconAlertTriangle,
  IconArrowRight,
  IconCheck,
  IconCross,
  IconShield,
} from "../common/UIComponents";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const RAZORPAY_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

function getErrorMessage(err: unknown) {
  const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
  return errorObj?.response?.data?.message || errorObj?.message || "Payment could not be started. Please try again.";
}

function loadRazorpayScript() {
  return new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("Checkout is available only in the browser."));
    if (window.Razorpay) return resolve();

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${RAZORPAY_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Unable to load Razorpay checkout.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load Razorpay checkout."));
    document.body.appendChild(script);
  });
}

export function UpgradeModal({
  open,
  initialPlanKey,
  onClose,
  onActivated,
}: {
  open: boolean;
  initialPlanKey?: string;
  onClose: () => void;
  onActivated: () => void;
}) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>(initialPlanKey || "prime");
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [payingKey, setPayingKey] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && initialPlanKey) setSelectedKey(initialPlanKey);
  }, [initialPlanKey, open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingPlans(true);
    setError("");
    planService.listPlans()
      .then((res) => {
        if (cancelled) return;
        const raw = res?.data?.plans || res?.plans || [];
        const list = Array.isArray(raw) ? raw as Plan[] : [];
        setPlans(list.filter((plan) => plan.key !== "trial"));
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoadingPlans(false);
      });
    return () => { cancelled = true; };
  }, [open]);

  const orderedPlans = useMemo(() => {
    // Trial isn't a purchasable upgrade; order the rest by the catalog's
    // sortOrder, then price — works for any admin-defined plan.
    return [...plans]
      .filter((p) => p.priceRupees > 0)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.priceRupees - b.priceRupees);
  }, [plans]);

  const selectedPlan = orderedPlans.find((plan) => plan.key === selectedKey) || orderedPlans[0];

  const startPayment = async (plan: Plan) => {
    setPayingKey(plan.key);
    setError("");

    try {
      await loadRazorpayScript();
      const res = await paymentService.createOrder(plan.key);
      const order = res?.data || res;
      const key = order?.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

      if (!key) throw new Error("Razorpay key is missing. Please configure NEXT_PUBLIC_RAZORPAY_KEY_ID.");

      const checkout = new window.Razorpay!({
        key,
        amount: order.amount,
        currency: order.currency || "INR",
        name: "Exam Neeti",
        description: `${plan.name} plan`,
        order_id: order.orderId,
        theme: { color: "#4338ca" },
        handler: async (payment: Record<string, string>) => {
          await paymentService.verifyPayment({
            razorpay_order_id: payment.razorpay_order_id,
            razorpay_payment_id: payment.razorpay_payment_id,
            razorpay_signature: payment.razorpay_signature,
          });
          onActivated();
          onClose();
        },
        modal: {
          ondismiss: () => setPayingKey(""),
        },
      });

      checkout.open();
    } catch (err) {
      setError(getErrorMessage(err));
      setPayingKey("");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6" role="dialog" aria-modal="true" aria-label="Upgrade plan">
      <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-200">
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-100 px-5 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600">Upgrade</p>
            <h2 className="text-lg sm:text-xl font-black text-slate-900">Choose your SIGNATURE plan</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer" aria-label="Close upgrade modal">
            <IconCross className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs font-semibold text-red-700 flex items-start gap-2">
              <IconAlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {loadingPlans ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="h-56 rounded-2xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {orderedPlans.map((plan) => {
                const selected = selectedPlan?.key === plan.key;
                return (
                  <button
                    key={plan.key}
                    type="button"
                    onClick={() => setSelectedKey(plan.key)}
                    className={`text-left rounded-2xl border p-4 transition-all cursor-pointer ${selected ? "border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/60" : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Signature</p>
                        <h3 className="text-xl font-black text-slate-900 mt-1">{plan.name}</h3>
                      </div>
                      {selected && <IconCheck className="w-5 h-5 text-indigo-600 shrink-0" />}
                    </div>
                    <div className="mt-5">
                      <span className="text-2xl font-black text-slate-900">₹{plan.priceRupees.toLocaleString("en-IN")}</span>
                      {plan.durationDays ? <span className="text-xs font-semibold text-slate-400 ml-1">/year</span> : null}
                    </div>
                    <p className="text-xs font-semibold text-slate-500 mt-3 leading-relaxed min-h-12">{plan.description || `${plan.testsIncluded} tests included.`}</p>
                    <div className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-extrabold text-indigo-700">
                      <IconShield className="w-3.5 h-3.5" />
                      {plan.testsIncluded} test{plan.testsIncluded === 1 ? "" : "s"} included
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-slate-50 border border-slate-200 p-4">
            <div>
              <p className="text-sm font-black text-slate-900">{selectedPlan ? `${selectedPlan.name} selected` : "Select a plan"}</p>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">Payment is processed securely by Razorpay.</p>
            </div>
            <button
              type="button"
              disabled={!selectedPlan || Boolean(payingKey)}
              onClick={() => selectedPlan && startPayment(selectedPlan)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-bold px-5 py-3 shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              {payingKey ? "Opening checkout..." : "Proceed to Pay"}
              {!payingKey && <IconArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
