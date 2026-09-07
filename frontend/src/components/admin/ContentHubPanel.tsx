"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { blogService, resourceService, type Blog, type ResourceItem, type BlogStyle } from "../../services/apiServices";
import { CustomSelect } from "../common/CustomSelect";
import { StyledBlogBody, BLOG_FONTS, blogFontStack } from "../common/Markdown";
import { BlogBlockEditor } from "./BlogBlockEditor";
import { confirmDialog } from "../common/feedback";
import {
  CommonModal, Spinner, IconPlus, IconEdit, IconTrash, IconEye, IconFileText, IconDownload,
} from "../common/UIComponents";

interface Props {
  showToast: (msg: string, type?: "success" | "error") => void;
}

const DEFAULT_STYLE: BlogStyle = {
  fontFamily: "sans", fontSizePx: 16, lineHeight: 1.7,
  textColor: "#1f2937", headingColor: "#111827", accentColor: "#4338ca", align: "left",
};

const KIND_LABEL: Record<string, string> = {
  past_paper: "Past paper", notes: "Notes", guide: "Guide", video: "YouTube video", link: "External link",
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const ytThumb = (url?: string | null) => {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` : null;
};

// ── typography presets & curated palette ────────────────────────────────────
const STYLE_PRESETS: { name: string; style: BlogStyle }[] = [
  { name: "Clean", style: { fontFamily: "inter", fontSizePx: 16, lineHeight: 1.7, textColor: "#1f2937", headingColor: "#111827", accentColor: "#4338ca", align: "left" } },
  { name: "Editorial", style: { fontFamily: "lora", fontSizePx: 18, lineHeight: 1.8, textColor: "#374151", headingColor: "#111827", accentColor: "#b91c1c", align: "left" } },
  { name: "Modern", style: { fontFamily: "poppins", fontSizePx: 17, lineHeight: 1.75, textColor: "#111827", headingColor: "#0f172a", accentColor: "#0d9488", align: "left" } },
  { name: "Focus", style: { fontFamily: "serif", fontSizePx: 19, lineHeight: 1.85, textColor: "#292524", headingColor: "#1c1917", accentColor: "#7c3aed", align: "left" } },
];

const COLOR_SWATCHES = ["#0f172a", "#1f2937", "#374151", "#4338ca", "#1d4ed8", "#0d9488", "#059669", "#b91c1c", "#c2410c", "#7c3aed", "#be185d", "#0891b2"];

const stylesEqual = (a: BlogStyle, b: BlogStyle) =>
  (Object.keys(a) as (keyof BlogStyle)[]).every((k) => a[k] === b[k]);

/* small local glyphs for alignment control */
const AlignIcon = ({ dir }: { dir: BlogStyle["align"] }) => {
  const lines = dir === "left" ? ["M3 6h18", "M3 12h12", "M3 18h15"]
    : dir === "center" ? ["M3 6h18", "M6 12h12", "M5 18h14"]
    : ["M3 6h18", "M3 12h18", "M3 18h18"];
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      {lines.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
};

export function ContentHubPanel({ showToast }: Props) {
  const [tab, setTab] = useState<"blogs" | "resources">("blogs");
  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div>
        <h2 className="text-xl font-black text-slate-900">Content Hub</h2>
        <p className="text-xs text-slate-500 font-semibold">Blogs and downloadable resources shown publicly in the landing-page Resources section.</p>
      </div>
      <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1 w-fit">
        {(["blogs", "resources"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer capitalize ${tab === t ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:text-indigo-700"}`}>
            {t}
          </button>
        ))}
      </div>
      {tab === "blogs" ? <BlogsTab showToast={showToast} /> : <ResourcesTab showToast={showToast} />}
    </div>
  );
}

// ═══════════════════════════ BLOGS ═══════════════════════════════════════════

function BlogsTab({ showToast }: Props) {
  const [list, setList] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Blog | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await blogService.list({ status: "all", limit: 50 });
      setList(res?.data?.blogs || res?.blogs || []);
    } catch { showToast("Failed to load blogs", "error"); }
    finally { setLoading(false); }
  }, [showToast]);
  useEffect(() => { load(); }, [load]);

  const del = async (b: Blog) => {
    if (!(await confirmDialog({
      title: "Delete blog?",
      message: `"${b.title}" will be permanently removed. This cannot be undone.`,
      confirmText: "Delete blog",
      tone: "danger",
    }))) return;
    try { await blogService.remove(b._id); showToast("Blog deleted"); load(); }
    catch (e: unknown) { showToast((e as { message?: string }).message || "Delete failed", "error"); }
  };
  const togglePublish = async (b: Blog) => {
    try {
      const fd = new FormData();
      fd.append("status", b.status === "published" ? "draft" : "published");
      await blogService.update(b._id, fd);
      showToast(b.status === "published" ? "Moved to draft" : "Published"); load();
    } catch (e: unknown) { showToast((e as { message?: string }).message || "Update failed", "error"); }
  };

  return (
    <div className="space-y-4">
      <button onClick={() => setCreating(true)} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer">
        <IconPlus className="w-4 h-4" /><span>New Blog</span>
      </button>

      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200"><Spinner className="w-6 h-6 text-indigo-600 mx-auto" /></div>
      ) : list.length === 0 ? (
        <div className="p-10 text-center bg-white rounded-2xl border border-dashed border-slate-300 text-xs text-slate-500 font-semibold space-y-1">
          <IconFileText className="w-7 h-7 mx-auto text-slate-300" />
          <p>No blogs yet — publish your first article for the Resources page.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {list.map((b) => (
            <div key={b._id} className="group bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col hover:border-indigo-200 hover:shadow-md transition-all">
              <div className="h-28 bg-slate-100 relative shrink-0">
                {b.coverImage?.url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={b.coverImage.url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-slate-300"><IconFileText className="w-8 h-8" /></div>}
                <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-full border text-[10px] font-black uppercase shadow-sm ${b.status === "published" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>{b.status}</span>
              </div>
              <div className="p-4 flex flex-col gap-1.5 flex-grow">
                <h4 className="text-sm font-black text-slate-900 leading-snug line-clamp-2">{b.title}</h4>
                {b.excerpt && <p className="text-xs text-slate-500 font-medium line-clamp-2">{b.excerpt}</p>}
                <p className="text-[10px] text-slate-400 font-semibold mt-auto pt-1">{b.category} · {b.readMinutes} min read{typeof b.views === "number" ? ` · ${b.views} views` : ""}</p>
                <div className="flex items-center gap-1.5 pt-2">
                  <button onClick={() => togglePublish(b)} className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer transition-colors">
                    {b.status === "published" ? "Unpublish" : "Publish"}
                  </button>
                  {b.status === "published" && (
                    <a href={`${SITE_URL}/resources/${b.slug}`} target="_blank" rel="noopener noreferrer" title="View public page"
                      className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer transition-colors"><IconEye className="w-4 h-4" /></a>
                  )}
                  <button onClick={() => setEditing(b)} title="Edit" className="p-2 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-100 cursor-pointer ml-auto"><IconEdit className="w-4 h-4" /></button>
                  <button onClick={() => del(b)} title="Delete" className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 cursor-pointer"><IconTrash className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <BlogEditor
          blog={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); load(); }}
          showToast={showToast}
        />
      )}
    </div>
  );
}

function BlogEditor({ blog, onClose, onSaved, showToast }: { blog: Blog | null; onClose: () => void; onSaved: () => void; showToast: Props["showToast"] }) {
  const [title, setTitle] = useState(blog?.title || "");
  const [category, setCategory] = useState(blog?.category || "General");
  const [excerpt, setExcerpt] = useState(blog?.excerpt || "");
  const [tags, setTags] = useState((blog?.tags || []).join(", "));
  const [content, setContent] = useState("");
  const [style, setStyle] = useState<BlogStyle>({ ...DEFAULT_STYLE, ...(blog?.style || {}) });
  const [status, setStatus] = useState<"draft" | "published">(blog?.status || "draft");
  const [cover, setCover] = useState<File | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingBody, setLoadingBody] = useState(Boolean(blog));

  useEffect(() => {
    if (!blog) return;
    blogService.get(blog.slug).then((res) => {
      setContent((res?.data?.blog || res?.blog)?.content || "");
    }).catch(() => showToast("Could not load blog body", "error")).finally(() => setLoadingBody(false));
  }, [blog, showToast]);

  const setS = (k: keyof BlogStyle, v: string | number) => setStyle((p) => ({ ...p, [k]: v }));

  const coverUrl = useMemo(() => (cover ? URL.createObjectURL(cover) : null), [cover]);
  useEffect(() => () => { if (coverUrl) URL.revokeObjectURL(coverUrl); }, [coverUrl]);
  const previewCover = coverUrl || (blog?.coverImage?.url && !removeCover ? blog.coverImage.url : null);
  const activePreset = STYLE_PRESETS.find((p) => stylesEqual(p.style, style))?.name;

  const save = async () => {
    if (!title.trim() || !content.trim()) { showToast("Title and content are required", "error"); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("category", category.trim() || "General");
      fd.append("excerpt", excerpt.trim());
      fd.append("content", content);
      fd.append("status", status);
      fd.append("tags", JSON.stringify(tags.split(",").map((t) => t.trim()).filter(Boolean)));
      fd.append("style", JSON.stringify(style));
      if (cover) fd.append("coverImage", cover);
      if (removeCover) fd.append("removeCoverImage", "true");
      if (blog) await blogService.update(blog._id, fd);
      else await blogService.create(fd);
      showToast(blog ? "Blog updated" : "Blog created");
      onSaved();
    } catch (e: unknown) {
      showToast((e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (e as { message?: string }).message || "Save failed", "error");
    } finally { setSaving(false); }
  };

  return (
    <CommonModal
      isOpen
      onClose={onClose}
      title={blog ? "Edit blog" : "New blog"}
      maxWidth="max-w-5xl"
      footer={
        <div className="flex items-center gap-3">
          <p className="text-[11px] font-semibold text-slate-400 hidden sm:block">Saved to the public Resources page</p>
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={onClose} className="px-4 py-2.5 text-slate-500 hover:text-slate-800 text-xs font-bold cursor-pointer">Cancel</button>
            <button onClick={save} disabled={saving}
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 flex items-center gap-2 cursor-pointer transition-colors">
              {saving ? <Spinner className="w-4 h-4 text-white" /> : blog ? "Save changes" : "Create blog"}
            </button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
        {/* ── form ── */}
        <div className="space-y-4 min-w-0">
          <EditorSection title="Article" icon={SecIco.article}>
            <Field label="Title">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. How to plan your NEET revision" className={`${inp} text-sm font-bold`} />
            </Field>
            <Field label="Excerpt — the one-liner shown on cards">
              <textarea rows={2} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} className={inp} placeholder="A short hook, ~140 characters." />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category"><input value={category} onChange={(e) => setCategory(e.target.value)} className={inp} placeholder="General" /></Field>
              <Field label="Tags — comma separated"><input value={tags} onChange={(e) => setTags(e.target.value)} className={inp} placeholder="strategy, revision" /></Field>
            </div>
          </EditorSection>

          <EditorSection title="Cover image" icon={SecIco.image}>
            <CoverDropzone
              url={previewCover}
              onFile={(f) => { setCover(f); setRemoveCover(false); }}
              onRemove={() => { setCover(null); setRemoveCover(true); }}
            />
          </EditorSection>

          <EditorSection title="Content" icon={SecIco.blocks} bodyClass="!p-2.5">
            {loadingBody ? (
              <div className="py-8 text-center"><Spinner className="w-5 h-5 text-indigo-600 mx-auto" /></div>
            ) : (
              <BlogBlockEditor
                value={content}
                onChange={setContent}
                onUploadImage={async (file) => (await blogService.uploadImage(file)).url}
              />
            )}
          </EditorSection>

          <EditorSection title="Reader typography & colours" icon={SecIco.type} subtitle="How the article body renders on the public page">
            <div className="flex flex-wrap items-center gap-1.5">
              {STYLE_PRESETS.map((p) => (
                <button key={p.name} type="button" onClick={() => setStyle({ ...p.style })}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${activePreset === p.name ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"}`}>
                  {p.name}
                </button>
              ))}
              <button type="button" onClick={() => setStyle({ ...DEFAULT_STYLE })}
                className="ml-auto px-2 py-1.5 rounded-lg text-[11px] font-bold text-slate-400 hover:text-slate-700 cursor-pointer">
                Reset
              </button>
            </div>

            <FontPicker value={style.fontFamily} onChange={(v) => setS("fontFamily", v)} />

            <SegField label="Alignment" value={style.align} onChange={(v) => setS("align", v)}
              options={(["left", "center", "justify"] as const).map((a) => ({ value: a, node: <AlignIcon dir={a} /> }))} />

            <RangeField label="Text size" value={style.fontSizePx} min={13} max={22} step={1} unit="px" onChange={(v) => setS("fontSizePx", v)} />
            <RangeField label="Line spacing" value={style.lineHeight} min={1.3} max={2.2} step={0.05} unit="" fmt={(n) => n.toFixed(2)} onChange={(v) => setS("lineHeight", v)} />

            <div className="space-y-2.5 pt-0.5">
              <ColorField label="Body text" value={style.textColor} onChange={(v) => setS("textColor", v)} />
              <ColorField label="Headings" value={style.headingColor} onChange={(v) => setS("headingColor", v)} />
              <ColorField label="Accent — links & category" value={style.accentColor} onChange={(v) => setS("accentColor", v)} />
            </div>
          </EditorSection>
        </div>

        {/* ── sticky preview ── */}
        <div className="lg:sticky lg:top-0 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Live preview</p>
            <StatusToggle value={status} onChange={setStatus} />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            {previewCover && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewCover} alt="" className="w-full h-40 object-cover" />
            )}
            <div className="p-5 max-h-[58vh] overflow-y-auto" style={{ fontFamily: blogFontStack(style.fontFamily) }}>
              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: style.accentColor }}>{category || "General"}</span>
              <h1 className="text-2xl font-black mt-1 mb-3 leading-tight" style={{ color: style.headingColor }}>{title || "Untitled blog"}</h1>
              <StyledBlogBody content={content || "_Add blocks on the left to see them here…_"} style={style} />
            </div>
          </div>
        </div>
      </div>
    </CommonModal>
  );
}

/* ── blog-editor building blocks ─────────────────────────────────────────── */
const SecIco = {
  article: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h10" /></svg>,
  image: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 15l5-5 4 4 3-3 6 6" /></svg>,
  blocks: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="6" rx="1" /><rect x="3" y="14" width="18" height="6" rx="1" /></svg>,
  type: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7V5h16v2M9 5v14M7 19h4" /></svg>,
};

function EditorSection({ title, subtitle, icon, children, bodyClass = "" }: {
  title: string; subtitle?: string; icon?: React.ReactNode; children: React.ReactNode; bodyClass?: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <header className="flex items-center gap-2 px-3.5 py-2.5 border-b border-slate-100 bg-slate-50/70">
        {icon && <span className="text-slate-400 shrink-0">{icon}</span>}
        <div className="min-w-0">
          <h4 className="text-[11px] font-black uppercase tracking-wide text-slate-600 leading-tight">{title}</h4>
          {subtitle && <p className="text-[10px] font-semibold text-slate-400 leading-tight">{subtitle}</p>}
        </div>
      </header>
      <div className={`p-3.5 space-y-3 ${bodyClass}`}>{children}</div>
    </section>
  );
}

function FontPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500 block mb-1">Typeface</label>
      <div className="grid grid-cols-3 gap-1.5">
        {BLOG_FONTS.map((f) => (
          <button key={f.key} type="button" onClick={() => onChange(f.key)}
            className={`flex flex-col items-center gap-0.5 py-2 rounded-lg border transition-all cursor-pointer ${
              value === f.key ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500/20" : "border-slate-200 bg-white hover:border-indigo-300"
            }`}>
            <span style={{ fontFamily: f.stack }} className="text-lg leading-none text-slate-800">Ag</span>
            <span className="text-[9px] font-bold text-slate-500">{f.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SegField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; node: React.ReactNode }[];
}) {
  return (
    <div>
      <label className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500 block mb-1">{label}</label>
      <div className="flex gap-1 p-0.5 rounded-lg bg-slate-100">
        {options.map((o) => (
          <button key={o.value} type="button" onClick={() => onChange(o.value)}
            className={`flex-1 flex items-center justify-center py-1.5 rounded-md transition-all cursor-pointer ${value === o.value ? "bg-white shadow-sm text-indigo-700" : "text-slate-400 hover:text-slate-600"}`}>
            {o.node}
          </button>
        ))}
      </div>
    </div>
  );
}

function RangeField({ label, value, min, max, step, unit, fmt, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string;
  fmt?: (n: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">{label}</label>
        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-black tabular-nums text-slate-700">
          {fmt ? fmt(value) : value}{unit}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-slate-200 accent-indigo-600 cursor-pointer" />
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500 block mb-1">{label}</label>
      <div className="flex items-center gap-2 flex-wrap">
        <label className="relative w-8 h-8 rounded-lg border border-slate-300 shadow-sm cursor-pointer overflow-hidden shrink-0" style={{ background: value }} title="Pick a custom colour">
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute -inset-2 opacity-0 cursor-pointer" />
        </label>
        <input value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false}
          className="w-[76px] font-mono text-[11px] px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200 uppercase text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-400" />
        <div className="flex gap-1 flex-wrap">
          {COLOR_SWATCHES.map((c) => (
            <button key={c} type="button" onClick={() => onChange(c)} title={c}
              className={`w-5 h-5 rounded-md cursor-pointer transition-transform hover:scale-110 ${value.toLowerCase() === c ? "ring-2 ring-offset-1 ring-slate-900" : "ring-1 ring-black/5"}`}
              style={{ background: c }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CoverDropzone({ url, onFile, onRemove }: { url: string | null; onFile: (f: File) => void; onRemove: () => void }) {
  const [drag, setDrag] = useState(false);
  const pick = (f?: File | null) => { if (f && f.type.startsWith("image/")) onFile(f); };
  return url ? (
    <div className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="w-full h-32 object-cover rounded-xl border border-slate-200" />
      <button type="button" onClick={onRemove}
        className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-white/90 border border-slate-200 text-[11px] font-bold text-red-600 hover:bg-white cursor-pointer shadow-sm">
        Remove
      </button>
    </div>
  ) : (
    <label
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
      className={`flex flex-col items-center justify-center gap-1 py-6 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${drag ? "border-indigo-400 bg-indigo-50/60" : "border-slate-300 bg-slate-50 hover:border-indigo-300"}`}>
      <span className="text-[11px] font-bold text-slate-500">Drop or click to add a cover image</span>
      <span className="text-[10px] text-slate-400">Shown on cards & at the top of the article</span>
      <input type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
    </label>
  );
}

function StatusToggle({ value, onChange }: { value: "draft" | "published"; onChange: (v: "draft" | "published") => void }) {
  return (
    <div className="flex gap-0.5 p-0.5 rounded-lg bg-slate-100 text-[10px] font-black uppercase tracking-wide">
      {(["draft", "published"] as const).map((s) => (
        <button key={s} type="button" onClick={() => onChange(s)}
          className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${value === s ? (s === "published" ? "bg-emerald-600 text-white shadow-sm" : "bg-white text-slate-700 shadow-sm") : "text-slate-400 hover:text-slate-600"}`}>
          {s}
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════ RESOURCES ═══════════════════════════════════════

function ResourcesTab({ showToast }: Props) {
  const [list, setList] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ResourceItem | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await resourceService.list({ status: "all", limit: 50 });
      setList(res?.data?.resources || res?.resources || []);
    } catch { showToast("Failed to load resources", "error"); }
    finally { setLoading(false); }
  }, [showToast]);
  useEffect(() => { load(); }, [load]);

  const del = async (r: ResourceItem) => {
    if (!(await confirmDialog({
      title: "Delete resource?",
      message: `"${r.title}" will be permanently removed. This cannot be undone.`,
      confirmText: "Delete resource",
      tone: "danger",
    }))) return;
    try { await resourceService.remove(r._id); showToast("Resource deleted"); load(); }
    catch (e: unknown) { showToast((e as { message?: string }).message || "Delete failed", "error"); }
  };
  const togglePublish = async (r: ResourceItem) => {
    try {
      const fd = new FormData();
      fd.append("status", r.status === "published" ? "draft" : "published");
      await resourceService.update(r._id, fd);
      showToast(r.status === "published" ? "Moved to draft" : "Published"); load();
    } catch (e: unknown) { showToast((e as { message?: string }).message || "Update failed", "error"); }
  };

  return (
    <div className="space-y-4">
      <button onClick={() => setCreating(true)} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer">
        <IconPlus className="w-4 h-4" /><span>New Resource</span>
      </button>

      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200"><Spinner className="w-6 h-6 text-indigo-600 mx-auto" /></div>
      ) : list.length === 0 ? (
        <div className="p-10 text-center bg-white rounded-2xl border border-dashed border-slate-300 text-xs text-slate-500 font-semibold space-y-1">
          <IconDownload className="w-7 h-7 mx-auto text-slate-300" />
          <p>No resources yet — add past papers, notes, guides or videos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {list.map((r) => {
            const thumb = ytThumb(r.youtubeUrl) || r.coverImage?.url || null;
            return (
            <div key={r._id} className="group bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col hover:border-indigo-200 hover:shadow-md transition-all">
              {thumb && (
                <div className="h-28 bg-slate-100 relative shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumb} alt="" className="w-full h-full object-cover" />
                  <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-full border text-[10px] font-black uppercase shadow-sm ${r.status === "published" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>{r.status}</span>
                </div>
              )}
              <div className="p-4 flex flex-col gap-1.5 flex-grow">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-black text-slate-900 leading-snug line-clamp-2">{r.title}</h4>
                  {!thumb && <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black uppercase shrink-0 ${r.status === "published" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>{r.status}</span>}
                </div>
                {r.description && <p className="text-xs text-slate-500 font-medium line-clamp-2">{r.description}</p>}
                <div className="flex flex-wrap gap-1.5 mt-1">
                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-black uppercase">{KIND_LABEL[r.kind]}</span>
                  {r.subject && <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold capitalize">{r.subject}</span>}
                  {r.classLevel && <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">{r.classLevel}</span>}
                  {r.file?.url && <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold">file</span>}
                </div>
                <div className="flex items-center gap-1.5 pt-2 mt-auto">
                  <button onClick={() => togglePublish(r)} className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer transition-colors">
                    {r.status === "published" ? "Unpublish" : "Publish"}
                  </button>
                  {(r.file?.url || r.youtubeUrl || r.externalUrl) && (
                    <a href={r.youtubeUrl || r.file?.url || r.externalUrl || "#"} target="_blank" rel="noopener noreferrer" title="Open resource"
                      className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer transition-colors"><IconEye className="w-4 h-4" /></a>
                  )}
                  <button onClick={() => setEditing(r)} title="Edit" className="p-2 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-100 cursor-pointer ml-auto"><IconEdit className="w-4 h-4" /></button>
                  <button onClick={() => del(r)} title="Delete" className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 cursor-pointer"><IconTrash className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {(creating || editing) && (
        <ResourceEditor resource={editing} onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); load(); }} showToast={showToast} />
      )}
    </div>
  );
}

function ResourceEditor({ resource, onClose, onSaved, showToast }: { resource: ResourceItem | null; onClose: () => void; onSaved: () => void; showToast: Props["showToast"] }) {
  const [title, setTitle] = useState(resource?.title || "");
  const [description, setDescription] = useState(resource?.description || "");
  const [detail, setDetail] = useState(resource?.detail || "");
  const [kind, setKind] = useState<ResourceItem["kind"]>(resource?.kind || "past_paper");
  const [youtubeUrl, setYoutubeUrl] = useState(resource?.youtubeUrl || "");
  const [externalUrl, setExternalUrl] = useState(resource?.externalUrl || "");
  const [subject, setSubject] = useState(resource?.subject || "");
  const [classLevel, setClassLevel] = useState(resource?.classLevel || "");
  const [tags, setTags] = useState((resource?.tags || []).join(", "));
  const [status, setStatus] = useState<"draft" | "published">(resource?.status || "draft");
  const [file, setFile] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const needsFile = ["past_paper", "notes", "guide"].includes(kind);

  const save = async () => {
    if (!title.trim()) { showToast("Title is required", "error"); return; }
    if (kind === "video" && !youtubeUrl.trim()) { showToast("YouTube URL is required for a video", "error"); return; }
    if (kind === "link" && !externalUrl.trim()) { showToast("External URL is required for a link", "error"); return; }
    if (needsFile && !file && !resource?.file?.url && !externalUrl.trim()) { showToast("Attach a file or provide an external link", "error"); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("description", description.trim());
      fd.append("detail", detail.trim());
      fd.append("kind", kind);
      fd.append("status", status);
      fd.append("tags", JSON.stringify(tags.split(",").map((t) => t.trim()).filter(Boolean)));
      if (youtubeUrl.trim()) fd.append("youtubeUrl", youtubeUrl.trim());
      if (externalUrl.trim()) fd.append("externalUrl", externalUrl.trim());
      if (subject) fd.append("subject", subject);
      if (classLevel) fd.append("classLevel", classLevel);
      if (file) fd.append("file", file);
      if (cover) fd.append("coverImage", cover);
      if (resource) await resourceService.update(resource._id, fd);
      else await resourceService.create(fd);
      showToast(resource ? "Resource updated" : "Resource created");
      onSaved();
    } catch (e: unknown) {
      showToast((e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (e as { message?: string }).message || "Save failed", "error");
    } finally { setSaving(false); }
  };

  const coverUrl = useMemo(() => (cover ? URL.createObjectURL(cover) : null), [cover]);
  useEffect(() => () => { if (coverUrl) URL.revokeObjectURL(coverUrl); }, [coverUrl]);
  const previewCover = coverUrl || resource?.coverImage?.url || null;

  return (
    <CommonModal
      isOpen
      onClose={onClose}
      title={resource ? "Edit resource" : "New resource"}
      maxWidth="max-w-2xl"
      footer={
        <div className="flex items-center gap-3">
          <StatusToggle value={status} onChange={setStatus} />
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={onClose} className="px-4 py-2.5 text-slate-500 hover:text-slate-800 text-xs font-bold cursor-pointer">Cancel</button>
            <button onClick={save} disabled={saving}
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 flex items-center gap-2 cursor-pointer transition-colors">
              {saving ? <Spinner className="w-4 h-4 text-white" /> : resource ? "Save changes" : "Create resource"}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <EditorSection title="What is it?" icon={SecIco.article}>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3">
            <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} className={`${inp} font-bold`} placeholder="e.g. NEET 2024 Physics Paper" /></Field>
            <Field label="Type">
              <CustomSelect value={kind} onChange={(v) => setKind(v as ResourceItem["kind"])}
                options={Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))} buttonClassName="py-2.5" />
            </Field>
          </div>
          <Field label="Short description — shown on cards"><textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={inp} placeholder="One line explaining what this is." /></Field>
          <Field label="Detail — optional instructions / what's inside"><textarea rows={2} value={detail} onChange={(e) => setDetail(e.target.value)} className={inp} /></Field>
        </EditorSection>

        <EditorSection title="Where does it live?" icon={SecIco.blocks}>
          {kind === "video" && (
            <Field label="YouTube URL">
              <input value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/watch?v=…" className={inp} />
              {ytThumb(youtubeUrl) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ytThumb(youtubeUrl)!} alt="" className="mt-2 h-24 rounded-lg border border-slate-200 object-cover" />
              )}
            </Field>
          )}
          {kind === "link" && (
            <Field label="External URL"><input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://…" className={inp} /></Field>
          )}
          {needsFile && (
            <>
              <Field label={`File — PDF, image or document${resource?.file?.url ? " (leave blank to keep current)" : ""}`}>
                {resource?.file?.url && <p className="text-[11px] font-semibold text-slate-500 mb-1">Current: {resource.file.fileName || "file"}</p>}
                <label className="flex items-center justify-center gap-1.5 py-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:border-indigo-300 cursor-pointer transition-colors text-[11px] font-bold text-slate-500">
                  {file ? file.name : "Drop or click to attach a file"}
                  <input type="file" accept=".pdf,.doc,.docx,.xlsx,.pptx,.txt,image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                </label>
              </Field>
              <Field label="…or link to it externally instead"><input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://…" className={inp} /></Field>
            </>
          )}
          {!needsFile && kind !== "video" && kind !== "link" && (
            <p className="text-[11px] font-semibold text-slate-400">Select a type above.</p>
          )}
        </EditorSection>

        <EditorSection title="Categorise & present" icon={SecIco.type}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Subject">
              <CustomSelect value={subject} onChange={setSubject}
                options={[{ value: "", label: "Any" }, { value: "physics", label: "Physics" }, { value: "chemistry", label: "Chemistry" }, { value: "biology", label: "Biology" }]} buttonClassName="py-2.5" />
            </Field>
            <Field label="Class">
              <CustomSelect value={classLevel} onChange={setClassLevel}
                options={[{ value: "", label: "Any" }, { value: "XI", label: "Class XI" }, { value: "XII", label: "Class XII" }, { value: "dropper", label: "Dropper" }]} buttonClassName="py-2.5" />
            </Field>
          </div>
          <Field label="Tags — comma separated"><input value={tags} onChange={(e) => setTags(e.target.value)} className={inp} placeholder="mechanics, 2024" /></Field>
          <Field label="Cover image — optional"><CoverDropzone url={previewCover} onFile={setCover} onRemove={() => setCover(null)} /></Field>
        </EditorSection>
      </div>
    </CommonModal>
  );
}

// ── shared bits ─────────────────────────────────────────────────────────────
const inp = "w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs px-3 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500 block mb-1">{label}</label>
      {children}
    </div>
  );
}
