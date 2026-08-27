# Feature Specification: Afiya Smart Pharmacy Finder & Deep-Linking Hub

## Overview
The **Afiya Smart Pharmacy Finder** enables users to instantly check live online inventory and purchase verified medicines from top nationwide Pakistani pharmacies (Dvago, Servaid, D-Watson, Sehat.com.pk) directly from Afiya AI's medicine card and price comparison screens.

It operates with **zero maintenance**, **zero scraping infrastructure**, **zero backend load**, and **zero LLM API quota consumption** by constructing dynamic, pre-formatted search URL deep links on the client side.

---

## Technical Architecture & URL Patterns

### 1. Direct Search Deep Links
Pharmacies are queried using client-side URL parameters formatted with `encodeURIComponent(brand_name + ' ' + strength)`:

| Pharmacy Chain | Regional Focus | Base Search URL Pattern |
| :--- | :--- | :--- |
| **Dvago** | Sindh / Karachi / Nationwide | `https://dvago.pk/search?q={query}` |
| **Servaid** | Punjab / Lahore | `https://servaid.com.pk/search?q={query}` |
| **D-Watson** | Islamabad / Rawalpindi / North | `https://dwatson.pk/search?q={query}` |
| **Sehat.com.pk** | E-Commerce Nationwide | `https://sehat.com.pk/search.php?search_query={query}` |

### 2. Dual-Query Strategy (Brand + Generic Fallback)
To handle cases where a specific brand is out of stock at a store:
- **Primary Deep Link**: `brand_name + " " + strength` (e.g., `Panadol 500mg`)
- **Generic Fallback Link**: `generic_name + " " + strength` (e.g., `Paracetamol 500mg`)

*Benefit:* If a store is out of stock on *Panadol*, the generic search link immediately surfaces in-stock alternatives like *Calpol* or *Disprol* on the pharmacy site.

---

## Consumer Safety & Protection Features

1. **Official DRAP Price Cap Reminder**:
   - Displays the official DRAP MRP next to pharmacy links:
     `"Official DRAP MRP: PKR {notified_mrp} — Verify price before purchasing."`
2. **One-Click Clipboard Copy**:
   - Includes a **"📋 Copy Drug Name"** helper button so users can paste `Panadol 500mg (Paracetamol)` into WhatsApp pharmacy ordering lines.

---

## Proposed Frontend Implementation Code

### File: `apps/web/src/components/medicine/PharmacyDeepLinks.tsx`

```tsx
"use client";

import { useState } from "react";
import type { MedicineDetail } from "@/lib/types";

interface PharmacyDeepLinksProps {
  medicine: MedicineDetail;
  notifiedMrp?: number | null;
}

export default function PharmacyDeepLinks({ medicine, notifiedMrp }: PharmacyDeepLinksProps) {
  const [copied, setCopied] = useState(false);

  const brandQuery = encodeURIComponent(`${medicine.brand_name} ${medicine.strength}`);
  const genericQuery = encodeURIComponent(`${medicine.generic_name} ${medicine.strength}`);

  const pharmacies = [
    {
      name: "Dvago",
      region: "Karachi / Sindh",
      url: `https://dvago.pk/search?q=${brandQuery}`,
      color: "bg-primary/10 hover:bg-primary/20 text-primary border-primary/20",
    },
    {
      name: "Servaid",
      region: "Lahore / Punjab",
      url: `https://servaid.com.pk/search?q=${brandQuery}`,
      color: "bg-success/10 hover:bg-success/20 text-success border-success/20",
    },
    {
      name: "D-Watson",
      region: "Islamabad / Pindi",
      url: `https://dwatson.pk/search?q=${brandQuery}`,
      color: "bg-accent/10 hover:bg-accent/20 text-accent border-accent/20",
    },
    {
      name: "Generic Alt",
      region: "All Generic Brands",
      url: `https://dvago.pk/search?q=${genericQuery}`,
      color: "bg-surface-hover hover:bg-border text-muted hover:text-foreground border-border",
      isGeneric: true,
    },
  ];

  const handleCopy = () => {
    navigator.clipboard.writeText(`${medicine.brand_name} ${medicine.strength} (${medicine.generic_name})`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-surface rounded-2xl border border-border p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            🛒 Check Live Pharmacy Stock
          </h3>
          <p className="text-xs text-muted mt-0.5">
            Instant search on verified Pakistani online pharmacies
          </p>
        </div>
        <button
          onClick={handleCopy}
          className="text-xs bg-background hover:bg-surface-hover border border-border rounded-lg px-3 py-1.5 font-medium text-foreground transition-all flex items-center gap-1.5"
        >
          <span>{copied ? "✓ Copied!" : "📋 Copy Name"}</span>
        </button>
      </div>

      {notifiedMrp && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-2.5 text-xs text-foreground flex items-center justify-between">
          <span className="text-muted font-medium">Official DRAP Pack Price Cap:</span>
          <span className="font-bold text-primary">PKR {notifiedMrp}</span>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {pharmacies.map((pharm) => (
          <a
            key={pharm.name}
            href={pharm.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center justify-between border rounded-xl p-3 text-xs font-semibold transition-all duration-200 hover:shadow-sm ${pharm.color}`}
          >
            <div>
              <span className="block font-bold">{pharm.name}</span>
              <span className="text-[10px] opacity-75 font-normal block">{pharm.region}</span>
            </div>
            <span className="text-sm">{pharm.isGeneric ? "🔍" : "↗"}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
```

---

## Step-by-Step Implementation Guide (When Ready)

1. **Git Isolation**:
   ```bash
   git tag before-pharmacy-links
   git checkout -b feature/pharmacy-deep-links
   ```
2. **Create Component**:
   Save code above into `apps/web/src/components/medicine/PharmacyDeepLinks.tsx`.
3. **Include Component**:
   Embed `<PharmacyDeepLinks medicine={medicine} notifiedMrp={mrp} />` in `PriceTable.tsx` and `MedicineCard.tsx`.
4. **Verification**:
   Run `npm run build` in `apps/web` to confirm clean compilation.
5. **Commit & Tag**:
   ```bash
   git add apps/web
   git commit -m "feat(pharmacy): Instant Search Deep-Linking Hub"
   git tag after-pharmacy-links
   git checkout main && git merge --no-ff feature/pharmacy-deep-links
   ```
