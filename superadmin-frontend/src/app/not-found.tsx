import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <p className="text-xs font-extrabold uppercase tracking-widest text-indigo-600 mb-3">404</p>
      <h1 className="text-2xl font-black text-slate-900 mb-2">Page not found</h1>
      <p className="text-sm text-slate-500 mb-6 max-w-sm">
        This page doesn&apos;t exist in the Super Admin console.
      </p>
      <Link
        href="/dashboard"
        className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-colors"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
