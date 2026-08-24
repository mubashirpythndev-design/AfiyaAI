"use client";

import type { PriceComparison } from "@/lib/types";

interface PriceTableProps {
  comparison: PriceComparison;
}

export default function PriceTable({ comparison }: PriceTableProps) {
  const { medicine, prices, lowest_price, highest_price, savings } = comparison;
  const sorted = [...prices].sort((a, b) => a.price - b.price);

  return (
    <div className="animate-slide-up">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-success">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Price Comparison: {medicine.brand_name}
          </h3>
          <p className="text-xs text-muted">{medicine.generic_name} {medicine.strength}</p>
        </div>
      </div>

      {/* Savings highlight */}
      {savings > 0 && (
        <div className="bg-success/10 border border-success/20 rounded-xl p-4 mb-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-success">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-success">
              Save up to Rs. {savings.toFixed(2)}
            </p>
            <p className="text-xs text-muted">
              Between lowest (Rs. {lowest_price.toFixed(2)}) and highest (Rs. {highest_price.toFixed(2)})
            </p>
          </div>
        </div>
      )}

      {/* Price table */}
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-hover">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wider">Source</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wider">Price</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wider hidden sm:table-cell">Package</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wider hidden md:table-cell">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((entry, i) => (
              <tr key={entry.id} className={`hover:bg-surface-hover transition-colors ${i === 0 ? "bg-success/5" : ""}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {i === 0 && <span className="w-1.5 h-1.5 rounded-full bg-success" />}
                    <span className="font-medium text-foreground">{entry.source.name}</span>
                    {entry.source.url && (
                      <a href={entry.source.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                      </a>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`font-bold ${i === 0 ? "text-success" : "text-foreground"}`}>
                    Rs. {entry.price.toFixed(2)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-muted hidden sm:table-cell">{entry.package_size}</td>
                <td className="px-4 py-3 text-right text-muted hidden md:table-cell">{entry.collected_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
