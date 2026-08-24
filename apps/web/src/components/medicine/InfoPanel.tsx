"use client";

import type { MedicineInfo } from "@/lib/types";

interface InfoPanelProps {
  info: MedicineInfo;
}

export default function InfoPanel({ info }: InfoPanelProps) {
  const { medicine, knowledge_chunks, sources } = info;

  const grouped = knowledge_chunks.reduce((acc, chunk) => {
    if (!acc[chunk.chunk_type]) acc[chunk.chunk_type] = [];
    acc[chunk.chunk_type].push(chunk);
    return acc;
  }, {} as Record<string, typeof knowledge_chunks>);

  const typeLabels: Record<string, string> = {
    uses: "Uses & Indications",
    side_effects: "Side Effects",
    precautions: "Precautions",
    dosage_info: "Dosage Information",
    general: "General Information",
  };

  const typeIcons: Record<string, string> = {
    uses: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    side_effects: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z",
    precautions: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    dosage_info: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  };

  return (
    <div className="animate-slide-up space-y-4">
      {/* Medicine header */}
      <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl p-5 border border-primary/10">
        <h3 className="text-lg font-bold text-foreground">{medicine.brand_name}</h3>
        <p className="text-sm text-muted">{medicine.generic_name} &bull; {medicine.strength} &bull; {medicine.dosage_form}</p>
        <p className="text-xs text-muted mt-1">by {medicine.manufacturer}</p>
      </div>

      {/* Knowledge chunks */}
      <div className="space-y-3 stagger-children">
        {Object.entries(grouped).map(([type, chunks]) => (
          <div key={type} className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 bg-surface-hover flex items-center gap-2 border-b border-border">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                <path d={typeIcons[type] || typeIcons.general} />
              </svg>
              <h4 className="text-sm font-semibold text-foreground">
                {typeLabels[type] || type.replace("_", " ")}
              </h4>
            </div>
            <div className="p-4 space-y-2">
              {chunks.map((chunk) => (
                <p key={chunk.id} className="text-sm text-foreground/80 leading-relaxed">
                  {chunk.content}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Sources */}
      {sources.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          <span className="text-xs font-medium text-muted">Sources:</span>
          {sources.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-xs bg-surface border border-border rounded-full px-2.5 py-1">
              {s.url ? (
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  {s.name}
                </a>
              ) : (
                <span className="text-muted">{s.name}</span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
