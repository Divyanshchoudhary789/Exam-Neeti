"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Navbar } from "../../components/navbar";
import { Footer } from "../../components/footer";
import { blogService, resourceService, type Blog, type ResourceItem } from "../../services/apiServices";
import {
  IconFileText, IconDownload, IconArrowRight, IconBook, IconClock, Spinner,
} from "../../components/common/UIComponents";

type Tab = "all" | "articles" | "past_paper" | "notes" | "guide" | "video" | "link";

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "articles", label: "Articles" },
  { id: "past_paper", label: "Past Papers" },
  { id: "notes", label: "Notes" },
  { id: "guide", label: "Guides" },
  { id: "video", label: "Videos" },
  { id: "link", label: "Links" },
];

const KIND_LABEL: Record<string, string> = {
  past_paper: "Past paper", notes: "Notes", guide: "Guide", video: "Video", link: "Link",
};

function ytId(url?: string | null) {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export default function ResourcesPage() {
  const [tab, setTab] = useState<Tab>("all");
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.allSettled([
      blogService.list({ limit: 50 }),
      resourceService.list({ limit: 100 }),
    ]).then(([b, r]) => {
      if (cancelled) return;
      if (b.status === "fulfilled") setBlogs(b.value?.data?.blogs || b.value?.blogs || []);
      if (r.status === "fulfilled") setResources(r.value?.data?.resources || r.value?.resources || []);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const showArticles = tab === "all" || tab === "articles";
  const filteredResources = useMemo(() => {
    if (tab === "all") return resources;
    if (tab === "articles") return [];
    return resources.filter((r) => r.kind === tab);
  }, [resources, tab]);

  const isEmpty = !loading && (showArticles ? blogs.length : 0) + filteredResources.length === 0;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans">
      <Navbar currentView="home" />

      <main className="flex-grow">
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 block">Resource Library</span>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mt-2">Free resources to fuel your preparation</h1>
          <p className="text-sm text-slate-500 font-medium mt-3 max-w-2xl">
            Articles, past papers, notes, strategy guides and reference videos — published by the Exam Neeti team.
          </p>

          <div className="mt-6 flex flex-wrap gap-1.5">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${tab === t.id ? "bg-indigo-600 text-white shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:border-indigo-300"}`}>
                {t.label}
              </button>
            ))}
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
          {loading ? (
            <div className="py-20 text-center"><Spinner className="w-7 h-7 text-indigo-600 mx-auto" /></div>
          ) : isEmpty ? (
            <div className="py-16 text-center text-sm font-semibold text-slate-500 bg-white rounded-2xl border border-slate-200">
              Nothing here yet — new resources are added regularly.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {showArticles && blogs.map((b) => (
                <Link key={b._id} href={`/resources/${b.slug}`}
                  className="group bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden hover:shadow-md hover:border-indigo-200 transition-all flex flex-col">
                  {b.coverImage?.url && <img src={b.coverImage.url} alt="" className="h-40 w-full object-cover" />}
                  <div className="p-4 flex flex-col gap-2 flex-grow">
                    <span className="text-[10px] font-black uppercase tracking-wide text-indigo-600">{b.category} · Article</span>
                    <h3 className="text-sm font-black text-slate-900 leading-snug group-hover:text-indigo-700">{b.title}</h3>
                    {b.excerpt && <p className="text-xs text-slate-500 font-medium line-clamp-3">{b.excerpt}</p>}
                    <div className="mt-auto flex items-center gap-2 text-[11px] font-semibold text-slate-400 pt-2">
                      <IconClock className="w-3.5 h-3.5" /> {b.readMinutes} min read
                      <span className="ml-auto inline-flex items-center gap-1 text-indigo-600">Read <IconArrowRight className="w-3.5 h-3.5" /></span>
                    </div>
                  </div>
                </Link>
              ))}

              {filteredResources.map((r) => {
                const vid = ytId(r.youtubeUrl);
                const href = r.kind === "video" ? (r.youtubeUrl || "#")
                  : r.file?.url || r.externalUrl || "#";
                return (
                  <a key={r._id} href={href} target="_blank" rel="noopener noreferrer"
                    className="group bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden hover:shadow-md hover:border-indigo-200 transition-all flex flex-col">
                    {vid ? (
                      <img src={`https://i.ytimg.com/vi/${vid}/hqdefault.jpg`} alt="" className="h-40 w-full object-cover" />
                    ) : r.coverImage?.url ? (
                      <img src={r.coverImage.url} alt="" className="h-40 w-full object-cover" />
                    ) : null}
                    <div className="p-4 flex flex-col gap-2 flex-grow">
                      <span className="text-[10px] font-black uppercase tracking-wide text-indigo-600">
                        {KIND_LABEL[r.kind]}{r.subject ? ` · ${r.subject}` : ""}{r.classLevel ? ` · ${r.classLevel}` : ""}
                      </span>
                      <h3 className="text-sm font-black text-slate-900 leading-snug group-hover:text-indigo-700">{r.title}</h3>
                      {r.description && <p className="text-xs text-slate-500 font-medium line-clamp-3">{r.description}</p>}
                      <div className="mt-auto flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 pt-2">
                        {r.kind === "video" ? "Watch on YouTube" : r.file?.url ? "Download" : "Open"}
                        {r.kind === "video" ? <IconArrowRight className="w-3.5 h-3.5" /> : <IconDownload className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
