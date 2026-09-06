"use client";

import React, { useCallback, useEffect, useState } from "react";
import { blogService, resourceService, type Blog, type ResourceItem, type BlogStyle } from "../../services/apiServices";
import { CustomSelect } from "../common/CustomSelect";
import { StyledBlogBody } from "../common/Markdown";
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
    if (!window.confirm(`Delete "${b.title}"?`)) return;
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
        <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-500 font-semibold">No blogs yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {list.map((b) => (
            <div key={b._id} className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-black text-slate-900 leading-snug">{b.title}</h4>
                <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black uppercase shrink-0 ${b.status === "published" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>{b.status}</span>
              </div>
              {b.excerpt && <p className="text-xs text-slate-500 font-medium line-clamp-2">{b.excerpt}</p>}
              <p className="text-[10px] text-slate-400 font-semibold">{b.category} · {b.readMinutes} min{typeof b.views === "number" ? ` · ${b.views} views` : ""}</p>
              <div className="flex items-center gap-1.5 pt-1">
                <button onClick={() => togglePublish(b)} className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer">
                  {b.status === "published" ? "Unpublish" : "Publish"}
                </button>
                <button onClick={() => setEditing(b)} className="p-2 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-100 cursor-pointer"><IconEdit className="w-4 h-4" /></button>
                <button onClick={() => del(b)} className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 cursor-pointer"><IconTrash className="w-4 h-4" /></button>
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
    <CommonModal isOpen onClose={onClose} title={blog ? "Edit Blog" : "New Blog"} maxWidth="max-w-4xl">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* editor */}
        <div className="space-y-3">
          <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} className={inp} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category"><input value={category} onChange={(e) => setCategory(e.target.value)} className={inp} /></Field>
            <Field label="Status">
              <CustomSelect value={status} onChange={(v) => setStatus(v as "draft" | "published")}
                options={[{ value: "draft", label: "Draft" }, { value: "published", label: "Published" }]} buttonClassName="py-2.5" />
            </Field>
          </div>
          <Field label="Excerpt (shown on cards)"><textarea rows={2} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} className={inp} /></Field>
          <Field label="Tags (comma-separated)"><input value={tags} onChange={(e) => setTags(e.target.value)} className={inp} /></Field>
          <Field label="Cover image">
            {blog?.coverImage?.url && !removeCover && !cover && (
              <div className="flex items-center gap-2 mb-1.5">
                <img src={blog.coverImage.url} alt="" className="h-12 rounded-lg border border-slate-200 object-cover" />
                <button type="button" onClick={() => setRemoveCover(true)} className="text-[11px] font-bold text-red-600 cursor-pointer">Remove</button>
              </div>
            )}
            <input type="file" accept="image/*" onChange={(e) => { setCover(e.target.files?.[0] || null); setRemoveCover(false); }}
              className="w-full text-xs text-slate-600 file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 cursor-pointer" />
          </Field>
          <Field label="Content (Markdown: # heading, **bold**, - list, [link](url), ![img](url))">
            {loadingBody ? <div className="py-6 text-center"><Spinner className="w-5 h-5 text-indigo-600 mx-auto" /></div> : (
              <textarea rows={12} value={content} onChange={(e) => setContent(e.target.value)} className={`${inp} font-mono resize-y`} placeholder="## Introduction&#10;&#10;Your article…" />
            )}
          </Field>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Typography</p>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Font">
                <CustomSelect value={style.fontFamily} onChange={(v) => setS("fontFamily", v)}
                  options={[{ value: "sans", label: "Sans" }, { value: "serif", label: "Serif" }, { value: "mono", label: "Mono" }]} buttonClassName="py-2" />
              </Field>
              <Field label="Align">
                <CustomSelect value={style.align} onChange={(v) => setS("align", v)}
                  options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "justify", label: "Justify" }]} buttonClassName="py-2" />
              </Field>
            </div>
            <label className="block text-[10px] font-extrabold uppercase text-slate-500">Font size {style.fontSizePx}px
              <input type="range" min={12} max={24} value={style.fontSizePx} onChange={(e) => setS("fontSizePx", Number(e.target.value))} className="w-full accent-indigo-600" />
            </label>
            <label className="block text-[10px] font-extrabold uppercase text-slate-500">Line height {style.lineHeight}
              <input type="range" min={1.2} max={2.4} step={0.1} value={style.lineHeight} onChange={(e) => setS("lineHeight", Number(e.target.value))} className="w-full accent-indigo-600" />
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["textColor", "headingColor", "accentColor"] as const).map((k) => (
                <label key={k} className="text-[9px] font-extrabold uppercase text-slate-500">
                  {k.replace("Color", "")}
                  <input type="color" value={style[k]} onChange={(e) => setS(k, e.target.value)} className="w-full h-7 rounded cursor-pointer border border-slate-200" />
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* live preview */}
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Live preview</p>
          <div className="border border-slate-200 rounded-2xl p-5 bg-white max-h-[70vh] overflow-y-auto">
            <h1 className="text-2xl font-black mb-3" style={{ color: style.headingColor }}>{title || "Untitled blog"}</h1>
            <StyledBlogBody content={content || "_Start writing to see a preview…_"} style={style} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-slate-200">
        <button onClick={onClose} className="px-4 py-2.5 text-slate-500 hover:text-slate-800 text-xs font-bold cursor-pointer">Cancel</button>
        <button onClick={save} disabled={saving} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 cursor-pointer">
          {saving ? <Spinner className="w-4 h-4 text-white" /> : blog ? "Save Changes" : "Create Blog"}
        </button>
      </div>
    </CommonModal>
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
    if (!window.confirm(`Delete "${r.title}"?`)) return;
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
        <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-500 font-semibold">No resources yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {list.map((r) => (
            <div key={r._id} className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-black text-slate-900 leading-snug">{r.title}</h4>
                <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black uppercase shrink-0 ${r.status === "published" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>{r.status}</span>
              </div>
              {r.description && <p className="text-xs text-slate-500 font-medium line-clamp-2">{r.description}</p>}
              <div className="flex flex-wrap gap-1.5">
                <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-black uppercase">{KIND_LABEL[r.kind]}</span>
                {r.subject && <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold capitalize">{r.subject}</span>}
                {r.classLevel && <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">{r.classLevel}</span>}
                {r.file?.url && <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold">file</span>}
                {r.youtubeUrl && <span className="px-2 py-0.5 rounded-md bg-red-50 text-red-600 text-[10px] font-bold">YouTube</span>}
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <button onClick={() => togglePublish(r)} className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer">
                  {r.status === "published" ? "Unpublish" : "Publish"}
                </button>
                <button onClick={() => setEditing(r)} className="p-2 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-100 cursor-pointer"><IconEdit className="w-4 h-4" /></button>
                <button onClick={() => del(r)} className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 cursor-pointer"><IconTrash className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
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

  return (
    <CommonModal isOpen onClose={onClose} title={resource ? "Edit Resource" : "New Resource"} maxWidth="max-w-2xl">
      <div className="space-y-3">
        <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} className={inp} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <CustomSelect value={kind} onChange={(v) => setKind(v as ResourceItem["kind"])}
              options={Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))} buttonClassName="py-2.5" />
          </Field>
          <Field label="Status">
            <CustomSelect value={status} onChange={(v) => setStatus(v as "draft" | "published")}
              options={[{ value: "draft", label: "Draft" }, { value: "published", label: "Published" }]} buttonClassName="py-2.5" />
          </Field>
        </div>
        <Field label="Short description (shown on cards)"><textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={inp} /></Field>
        <Field label="Detail (optional — instructions / what's inside)"><textarea rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} className={inp} /></Field>

        {kind === "video" && (
          <Field label="YouTube URL"><input value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/watch?v=…" className={inp} /></Field>
        )}
        {kind === "link" && (
          <Field label="External URL"><input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://…" className={inp} /></Field>
        )}
        {needsFile && (
          <>
            <Field label={`Attachment (PDF / image / doc)${resource?.file?.url ? " — leave blank to keep current" : ""}`}>
              {resource?.file?.url && <p className="text-[11px] text-slate-500 mb-1">Current: {resource.file.fileName || "file"}</p>}
              <input type="file" accept=".pdf,.doc,.docx,.xlsx,.pptx,.txt,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-600 file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 cursor-pointer" />
            </Field>
            <Field label="…or an external link instead"><input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://…" className={inp} /></Field>
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Subject (optional)">
            <CustomSelect value={subject} onChange={setSubject}
              options={[{ value: "", label: "Any" }, { value: "physics", label: "Physics" }, { value: "chemistry", label: "Chemistry" }, { value: "biology", label: "Biology" }]} buttonClassName="py-2.5" />
          </Field>
          <Field label="Class (optional)">
            <CustomSelect value={classLevel} onChange={setClassLevel}
              options={[{ value: "", label: "Any" }, { value: "XI", label: "Class XI" }, { value: "XII", label: "Class XII" }, { value: "dropper", label: "Dropper" }]} buttonClassName="py-2.5" />
          </Field>
        </div>
        <Field label="Tags (comma-separated)"><input value={tags} onChange={(e) => setTags(e.target.value)} className={inp} /></Field>
        <Field label="Cover image (optional)">
          <input type="file" accept="image/*" onChange={(e) => setCover(e.target.files?.[0] || null)}
            className="w-full text-xs text-slate-600 file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 cursor-pointer" />
        </Field>
      </div>

      <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-slate-200">
        <button onClick={onClose} className="px-4 py-2.5 text-slate-500 hover:text-slate-800 text-xs font-bold cursor-pointer">Cancel</button>
        <button onClick={save} disabled={saving} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 cursor-pointer">
          {saving ? <Spinner className="w-4 h-4 text-white" /> : resource ? "Save Changes" : "Create Resource"}
        </button>
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
