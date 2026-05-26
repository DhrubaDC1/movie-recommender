import type { StreamingProvider } from "@/lib/types";

interface Props {
  providers: StreamingProvider[];
}

export default function StreamingBadge({ providers }: Props) {
  if (!providers || providers.length === 0) {
    return <p className="text-xs text-white/25 italic">Streaming availability unavailable</p>;
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-white/40 mr-1">Stream on</span>
      {providers.map((p) =>
        p.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p.name}
            src={p.logo_url}
            alt={p.name}
            title={p.name}
            className="w-7 h-7 rounded-md object-cover"
          />
        ) : (
          <span
            key={p.name}
            className="text-xs px-2 py-1 rounded-md"
            style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}
          >
            {p.name}
          </span>
        )
      )}
    </div>
  );
}
