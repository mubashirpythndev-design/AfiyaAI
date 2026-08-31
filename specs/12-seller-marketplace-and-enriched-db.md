# 12 Seller Marketplace & Enriched Zero-LLM Database Guide

## 1. Executive Summary & Vision

This specification defines the transformation of **Afiya AI** from an informational medicine assistant into a **two-sided hyperlocal pharmacy platform**.

The system seamlessly supports two primary user personas:
1. **User (Patient / Buyer):** Uses prescription OCR, DRAP price protection, zero-LLM structured medicine guidance (Urdu & English), and live local pharmacy stock finder.
2. **Seller (Pharmacy / Store Owner):** Manages real-time inventory for verified DRAP medicines using a 1-click stock portal, gains zero-cost local customer leads, and builds trust with verified pharmacy badges.

### Core Strategic Objectives
- **Zero API Quota Wasted:** 90%+ of medicine queries (side effects, usage, dosage, precautions) are served in **<10ms** directly from PostgreSQL JSON without touching Gemini LLM quotas.
- **Zero Regression:** 100% of existing features (OCR, DRAP MRP checks, safety alert scanning, user cabinet, overcharge reports) remain untouched and operational.
- **Hyperlocal Utility:** Connects prescription scans directly to nearby verified pharmacy stock via 1-click WhatsApp/Call reservation links.

---

## 2. Architecture & Data Flow

```mermaid
flowchart TD
    subgraph Frontend (Next.js)
        UserRole[User Persona] --> RxScan[Scan Rx / Search Med]
        SellerRole[Seller Persona] --> SellerPortal[1-Click Inventory Dashboard]

        RxScan --> MedCard[Medicine Card + Enriched Tabs]
        RxScan --> StockBadge[Live Nearby Pharmacy Stock]
        RxScan --> FAQChips[Zero-LLM Chat FAQ Chips]
    end

    subgraph Backend (FastAPI)
        AuthRoute[/api/v1/auth - Role-Based JWT]
        MedRoute[/api/v1/medicines - Enriched DB Details]
        SellerRoute[/api/v1/sellers - Inventory Toggle]
    end

    subgraph Database (PostgreSQL + pgvector)
        UsersTable[(users: id, role, email)]
        PharmaciesTable[(pharmacies: license_no, address, lat, lng)]
        MedicinesTable[(medicines: DRAP_40 + medical_info JSONB)]
        InventoryTable[(seller_inventory: pharmacy_id, medicine_id, in_stock, price)]
    end

    SellerPortal --> SellerRoute --> InventoryTable
    MedCard --> MedRoute --> MedicinesTable
    StockBadge --> MedRoute --> InventoryTable
```

---

## 3. Database Schema Enhancements

### 3.1. Extend `users` table
```sql
-- Role enum addition
CREATE TYPE user_role AS ENUM ('user', 'seller', 'admin');

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'user',
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);
```

### 3.2. New `pharmacies` table
```sql
CREATE TABLE IF NOT EXISTS pharmacies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    store_name VARCHAR(255) NOT NULL,
    license_number VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) DEFAULT 'Karachi',
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3.3. New `seller_inventory` table
```sql
CREATE TABLE IF NOT EXISTS seller_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id UUID REFERENCES pharmacies(id) ON DELETE CASCADE,
    medicine_id UUID REFERENCES medicines(id) ON DELETE CASCADE,
    in_stock BOOLEAN DEFAULT TRUE,
    custom_price DECIMAL(10, 2), -- Optional discount price
    stock_count INT DEFAULT 10,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_pharmacy_medicine UNIQUE(pharmacy_id, medicine_id)
);
```

### 3.4. Update `medicines` table with Enriched JSONB
```sql
ALTER TABLE medicines 
ADD COLUMN IF NOT EXISTS medical_info JSONB;
```

---

## 4. Zero-LLM Enriched Knowledge Engine

Using `Afiya_Ai_medicine_data.json`, the `medical_info` column holds pre-verified structured facts in English and Roman Urdu:

```json
{
  "when_to_use": {
    "en": "Relief of mild to moderate pain and fever reduction.",
    "roman_urdu": "Bukhar, sar dard, daant dard, aur jism ke dard mein istemaal hoti hai."
  },
  "side_effects": {
    "en": "Rare at recommended doses. Overdose can cause severe liver damage.",
    "roman_urdu": "Aam taur par koi nuksan nahi hota. Zyada madaar lene se jigar ko nuksan pahunch sakta hai."
  },
  "precautions": {
    "en": "Do not exceed 4000mg (8 tablets) in 24 hours. Avoid alcohol.",
    "roman_urdu": "24 ghante mein 8 golion se zyada na lein."
  },
  "dosage_instructions": {
    "en": "Take every 4 to 6 hours as needed.",
    "roman_urdu": "Zaroorat padne par har 4 se 6 ghante baad lein."
  },
  "food_interactions": {
    "en": "Can be taken with or without food.",
    "roman_urdu": "Khane ke sath ya khane ke baghair li ja sakti hai."
  }
}
```

### How the Frontend Renders This Without LLM Calls
1. **Medicine Details Modal/Page:** Renders tabbed UI cards (`[When to Use]`, `[Side Effects]`, `[Precautions]`) directly reading `medicine.medical_info`.
2. **Chat FAQ Quick Chips:** When the user clicks `[Kab istemaal karein?]` in chat, the frontend displays `medical_info.when_to_use.roman_urdu` immediately. **Cost: $0.00 | Latency: <5ms**.

---

## 5. Seller Inventory Management Portal

### UX Workflow for Pharmacists (Hyper-Frictionless)
1. **Sign Up:** Pharmacist selects *"I am a Pharmacy / Seller"*, enters Store Name, Phone Number, and DRAP License Number.
2. **Dashboard Overview:** Displays list of Afiya's top 40 DRAP medicines.
3. **1-Click Toggles:**
   - Single-tap `[In Stock / Out of Stock]` switch.
   - Pre-filled with DRAP MRP (e.g. PKR 350). Optional input for store discount price (e.g. PKR 340).
4. **Instant Update:** Changes sync to PostgreSQL immediately.

```
+-----------------------------------------------------------------------+
|  🏪 Al-Razi Pharmacy (Verified ✔️)               [ Gulberg, Lahore ]   |
+-----------------------------------------------------------------------+
|  Medicine                     | DRAP Price | Stock Status  | Action   |
+-------------------------------+------------+---------------+----------+
|  Panadol 500mg (Paracetamol)  | PKR 350    |  🟢 IN STOCK  | [Toggle] |
|  Augmentin 625mg (Amoxicillin)| PKR 750    |  🔴 OUT STOCK | [Toggle] |
|  Brufen 400mg (Ibuprofen)     | PKR 436    |  🟢 IN STOCK  | [Toggle] |
+-----------------------------------------------------------------------+
```

---

## 6. Hyperlocal Pharmacy Finder & User Reservation

When a user scans a prescription or views a drug:

1. **DRAP MRP vs Seller Price Comparison:** Displays official DRAP MRP side-by-side with local seller listing.
2. **Verification Badge:** Shows `[✔️ DRAP Verified Seller]` next to pharmacies with verified license numbers.
3. **1-Click Direct Reserve via WhatsApp / Phone:**
   Generates a dynamic WhatsApp link:
   `https://wa.me/{seller_phone}?text=Assalam-o-Alaikum!%20I%20saw%20on%20Afiya%20AI%20that%20you%20have%20Panadol%20500mg%20in%20stock.%20Can%20I%20reserve%201%20pack?`

---

## 7. Safety & Regulatory Compliance Guardrails

1. **DRAP Price Ceiling Guard:**
   - If a seller attempts to enter a price *higher* than the official DRAP MRP, the system blocks the update or flags it with an Overcharge Warning badge.
2. **Rx Enforcement Warning:**
   - Antibiotics (e.g., Augmentin) and controlled drugs display a clear badge:
     `"⚠️ Prescription Required: Physical prescription must be verified at pickup."`
3. **Medical Safety Disclaimer:**
   - Permanent footer on all seller listings:
     `"Afiya AI does not prescribe or dispense medications. All orders are fulfilled directly by licensed pharmacies."`

---

## 8. Implementation Phases & Milestones

### Phase 1: Database Migration & Enriched JSON Seeding
- Create database migration script `0009_add_seller_and_enriched_info.py`.
- Run Python seed script to load `Afiya_Ai_medicine_data.json` into PostgreSQL `medicines.medical_info`.

### Phase 2: Backend API Expansion
- Extend `auth.py` to support `role: "user" | "seller"`.
- Create `sellers.py` router (`GET /sellers/inventory`, `PUT /sellers/inventory`).
- Create `GET /medicines/{id}/local-sellers` endpoint.

### Phase 3: Frontend UI Components
- **User Side:** Add Tabbed `MedicalInfoCards` (`When to Use`, `Side Effects`, `Precautions`) on Medicine detail page.
- **Seller Side:** Build `/seller/dashboard` with 1-click inventory toggles for 40 DRAP medicines.

### Phase 4: Local Matcher & WhatsApp Lead Hub
- Connect local pharmacy inventory to prescription scan result screen.
- Implement 1-click WhatsApp reservation button.

### Phase 5: Testing & Verification
- Run complete verification testing (Auth tests, inventory toggle tests, OCR matching, zero-LLM lookup speed).

---

> [!NOTE]
> All developments under this guide are non-breaking and additive. Existing OCR models, vector search tables, and chat pipelines remain fully functional.
