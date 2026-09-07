"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Navbar } from "../../../components/navbar";
import { Footer } from "../../../components/footer";
import { blogService, type Blog } from "../../../services/apiServices";
import { StyledBlogBody, blogFontStack } from "../../../components/common/Markdown";
import { IconArrowLeft, IconClock, Spinner } from "../../../components/common/UIComponents";

export default function BlogDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const [blog, setBlog] = useState<Blog | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "notfound">("loading");

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    blogService.get(slug)
      .then((res) => {
        if (cancelled) return;
        const b = res?.data?.blog || res?.blog;
        if (b) { setBlog(b); setState("ready"); } else setState("notfound");
      })
      .catch(() => { if (!cancelled) setState("notfound"); });
    return () => { cancelled = true; };
  }, [slug]);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans">
      <Navbar currentView="home" />
      <main className="flex-grow">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <Link href="/resources" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-700 mb-6">
            <IconArrowLeft className="w-3.5 h-3.5" /> Back to resources
          </Link>

          {state === "loading" ? (
            <div className="py-24 text-center"><Spinner className="w-7 h-7 text-indigo-600 mx-auto" /></div>
          ) : state === "notfound" || !blog ? (
            <div className="py-20 text-center">
              <h1 className="text-xl font-black text-slate-900">Article not found</h1>
              <p className="text-sm text-slate-500 font-medium mt-2">It may have been unpublished or the link is wrong.</p>
            </div>
          ) : (
            <article style={{ fontFamily: blogFontStack(blog.style?.fontFamily) }}>
              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: blog.style?.accentColor || "#4338ca" }}>{blog.category}</span>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight mt-2 leading-tight" style={{ color: blog.style?.headingColor || "#111827" }}>{blog.title}</h1>
              <div className="flex items-center gap-3 text-xs font-semibold text-slate-400 mt-3">
                {blog.author?.name && <span>By {blog.author.name}</span>}
                {blog.publishedAt && <span>{new Date(blog.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span>}
                <span className="inline-flex items-center gap-1"><IconClock className="w-3.5 h-3.5" />{blog.readMinutes} min read</span>
              </div>

              {blog.coverImage?.url && (
                <img src={blog.coverImage.url} alt="" className="w-full rounded-2xl border border-slate-200 mt-6 object-cover max-h-96" />
              )}

              <div className="mt-8">
                <StyledBlogBody content={blog.content || ""} style={blog.style} />
              </div>

              {blog.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-10 pt-6 border-t border-slate-200">
                  {blog.tags.map((t) => (
                    <span key={t} className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-600">#{t}</span>
                  ))}
                </div>
              )}
            </article>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
