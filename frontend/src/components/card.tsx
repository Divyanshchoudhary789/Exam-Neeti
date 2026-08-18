"use client";

interface CardProps {
  id: string;
  title: string;
  description: string;
  tags: string[];
  tagBg: string;
  tagText: string;
  img: string;
  color: string;
  linkText: string;
  onClick: () => void;
  icon?: React.ComponentType<{ className?: string }>;
}

export function Card({
  id,
  title,
  description,
  tags,
  tagBg,
  tagText,
  img,
  color,
  linkText,
  onClick,
  icon: _Icon
}: CardProps) {
  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col justify-between rounded-3xl border border-slate-200 bg-slate-50 overflow-hidden shadow-sm hover:shadow-xl hover:shadow-indigo-500/[0.06] transition-all cursor-pointer hover:translate-y-[-2px]"
      id={`module-card-${id}`}
    >
      <div className="h-[180px] bg-slate-200 flex items-center justify-center relative overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img}
          alt={title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-b from-transparent to-slate-50 pointer-events-none z-20" />
      </div>
      
      <div className="p-6 flex flex-col justify-between flex-grow text-left">
        <div>
          <h3 className="font-sans text-[17px] font-bold text-slate-900 tracking-tight leading-snug mb-2 group-hover:text-indigo-600 transition-colors">
            {title}
          </h3>
          <p className="text-xs sm:text-[13px] text-slate-500 leading-relaxed font-normal mb-4">
            {description}
          </p>
          <div className="flex flex-wrap gap-1.5 mb-5">
            {tags.map((t) => (
              <span key={t} className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${tagBg} ${tagText}`}>
                {t}
              </span>
            ))}
          </div>
        </div>
        
        <div className={`flex items-center gap-1.5 text-xs font-bold ${color} pt-3 border-t border-slate-200 mt-auto`}>
          <span>{linkText}</span>
          <svg className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </div>
  );
}
