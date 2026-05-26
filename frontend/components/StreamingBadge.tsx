import type { StreamingProvider } from "@/lib/types";

interface Props {
  providers: StreamingProvider[];
}

export default function StreamingBadge({ providers }: Props) {
  if (!providers || providers.length === 0) {
    return <p className="text-[11px] text-white/20 italic font-medium select-none">Streaming details unavailable</p>;
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-bold tracking-wide text-white/30 uppercase select-none mr-1">Stream on</span>
      {providers.map((p) =>
        p.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p.name}
            src={p.logo_url}
            alt={p.name}
            title={p.name}
            className="w-7 h-7 rounded-lg object-cover border border-white/[0.08] shadow-md hover:scale-110 active:scale-95 transition-all duration-300 select-none cursor-pointer"
          />
        ) : (
          <span
            key={p.name}
            className="text-[10px] font-bold px-2.5 py-1 rounded-lg border uppercase tracking-wider select-none"
            style={{ 
              background: "rgba(255,255,255,0.03)", 
              borderColor: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.5)" 
            }}
          >
            {p.name}
          </span>
        )
      )}
    </div>
  );
}
