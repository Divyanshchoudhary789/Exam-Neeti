"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { blogService, resourceService, type Blog, type ResourceItem } from "../../services/apiServices";

interface ResourcesProps {
  // kept for a stable landing-page section API; this section links out now
  onOpenAuth?: (type: "login" | "join") => void;
}

const KIND_LABEL: Record<string, string> = {
  past_paper: "Past paper", notes: "Notes", guide: "Guide", video: "Video", link: "Link",
};

const IconDoc = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

export function Resources(_props: ResourcesProps) {
  const [items, setItems] = useState<Array<{ kind: string; href: string; title: string; desc: string; meta: string; internal?: boolean }>>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      blogService.list({ limit: 3 }),
      resourceService.list({ limit: 4 }),
    ]).then(([b, r]) => {
      if (cancelled) return;
      const blogs: Blog[] = b.status === "fulfilled" ? (b.value?.data?.blogs || b.value?.blogs || []) : [];
      const res: ResourceItem[] = r.status === "fulfilled" ? (r.value?.data?.resources || r.value?.resources || []) : [];
      const merged = [
        ...blogs.map((x) => ({ kind: "Article", title: x.title, desc: x.excerpt || "", meta: `${x.readMinutes} min read`, href: `/resources/${x.slug}`, internal: true })),
        ...res.map((x) => ({
          kind: KIND_LABEL[x.kind] || "Resource",
          title: x.title,
          desc: x.description || "",
          meta: x.kind === "video" ? "YouTube" : x.file?.fileName || "Open",
          href: x.kind === "video" ? (x.youtubeUrl || "#") : (x.file?.url || x.externalUrl || "#"),
        })),
      ].slice(0, 4);
      setItems(merged);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  const showFallback = loaded && items.length === 0;

  return (
    <section id="resources" className="relative bg-white text-slate-800 w-full max-w-full overflow-hidden">
      <div className="relative bg-white py-10 px-4 sm:px-6 lg:px-8 border-t border-slate-200">
        <div className="mx-auto max-w-7xl">
          <div className="bg-slate-50 border border-slate-200 rounded-[2rem] md:rounded-[2.5rem] p-8 sm:p-12 lg:p-14 shadow-sm max-w-6xl mx-auto min-h-[500px] flex items-center">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center w-full">
              <div className="lg:col-span-4 text-left space-y-3.5">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 block">CURRICULUM ARCHIVE</span>
                <h2 className="text-[2.25rem] sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-[1.1]">
                  Free Resources to Fuel Your Preparation
                </h2>
                <p className="text-slate-500 text-xs sm:text-[13px] font-normal leading-relaxed max-w-md">
                  Articles, past papers, notes and strategy guides — published by the Exam Neeti team and free to use.
                </p>
                <Link href="/resources" className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold text-indigo-600 hover:text-indigo-800">
                  Explore the Resource Library
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </Link>
              </div>

              <div className="lg:col-span-8">
                {showFallback ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-xs font-semibold text-slate-500">
                    New resources are published regularly — check back soon.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(items.length ? items : Array.from({ length: 4 })).map((item, i) => {
                      if (!item) return <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 min-h-[220px] animate-pulse" />;
                      const it = item as { kind: string; href: string; title: string; desc: string; meta: string; internal?: boolean };
                      const inner = (
                        <>
                          <div className="text-left">
                            <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shadow-sm">
                              <IconDoc />
                            </div>
                            <span className="text-[9px] font-black uppercase tracking-wide text-indigo-500 block mt-4">{it.kind}</span>
                            <h3 className="text-[14px] font-bold text-slate-900 tracking-tight mt-1 line-clamp-2">{it.title}</h3>
                            <p className="text-[11px] text-slate-500 font-medium mt-2 leading-normal line-clamp-3">{it.desc}</p>
                          </div>
                          <div className="pt-4 mt-4 border-t border-slate-100 text-left">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 group-hover:text-indigo-800">
                              {it.meta}
                              <svg className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                            </span>
                          </div>
                        </>
                      );
                      const cls = "group bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between min-h-[220px] transition-all hover:shadow-md hover:border-slate-300";
                      return it.internal
                        ? <Link key={i} href={it.href} className={cls}>{inner}</Link>
                        : <a key={i} href={it.href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>;
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
