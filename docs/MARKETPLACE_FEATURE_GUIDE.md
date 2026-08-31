# Afiya AI — Marketplace Features Master Guide (Roman Urdu)

Yeh guide Afiya AI ke liye **Marketplace Features** ki complete tafseel, architecture, user flow, database design aur implementation roadmap faraham karti hai.

---

## 1. Introduction: Marketplace Kyun Zaroori Hai?

Afiya AI abhi tak prescription ko scan karta hai, verified medicines match karta hai, aur unki qeematon ka mawazna (comparison) karta hai. 

**Marketplace feature add karne ka maqsad:**
User sirf qeematein dekh kar wapas na jaye, balkay direct usi waqt **sab se sasti ya qareebi verified pharmacy se dawai order kar sakay**. Yeh Afiya AI ko ek informational tool se **end-to-end Healthcare Commerce Solution** bana deta hai.

---

## 2. Top 5 Marketplace Ideas (Roman Urdu Tafseel)

---

### Idea 1: 🛒 Smart Cart Splitter & Best-Basket Marketplace (Sab Se Ziada Recommended)

#### Concept:
Jab user prescription upload karta hai (e.g. 3 dawaiyan extract huin), toh wo direct **"Buy All Medicines"** par click kar sakta hai. System mukhtalif pharmacies (e.g., Dvago, Servaid, D.Watson, Sehat) se poori basket ki qeemat calculate karke 2 options deta hai:

1. **Option A: "Fastest Single Delivery"**
   - E.g. Servaid se teeno dawaiyan ek sath Rs. 1,450 mein (Ek hi rider 2 ghante mein deliver karega).
2. **Option B: "Smart Savings Split Basket"**
   - E.g. Dawai A aur B Dvago se (Rs. 600) + Dawai C D.Watson se (Rs. 500) = Total Rs. 1,100.
   - **User ki bachat:** Rs. 350 direct savings!

#### User Flow:
1. OCR Results page par user ko **"Add All to Smart Cart"** ka button nazar ata hai.
2. Cart Drawer khulta hai jahan top pharmacies ke live total bills show hotay hain.
3. User apni pasand ka option select karke checkout karta hai.

---

### Idea 2: ⚡ "Generic Swap & Save" One-Click Checkout

#### Concept:
Cart mein check out karte waqt Afiya AI user ko ek intelligent alert dikhata hai:
> 💡 *"Aap is order par **Rs. 750** bacha saktay hain agar aap brand-name medicine ko same formula generic alternative se switch karein!"*

#### Example:
- **Prescribed Brand:** *Augmentin 625mg* (GSK) — Rs. 340 / strip
- **Verified Alternative:** *Amoxi-Clav 625mg* (Bosch / Getz) — Rs. 190 / strip
- **One-Click Action:** User sirf **"Switch & Save"** toggle on karta hai aur bill automatically reduce ho jata hai.
- **Safety Badge:** Sath hi **"✓ DRAP Verified Same Active Formula"** ka badge display hota hai taakay mareez ko poora aitmaad ho.

---

### Idea 3: 📱 WhatsApp 1-Click Local Pharmacy Dispatch (Pakistan Friendly)

#### Concept:
Pakistan mein 80%+ log online payment gateways ke bajaye WhatsApp par direct order karna pasand kartay hain. Yeh feature user ko uske ilaqay ki verified pharmacy se direct connect karta hai.

#### Kaise Kaam Karta Hai:
1. User apna sheher aur ilaaqa select karta hai (e.g. *Gulshan-e-Iqbal, Karachi* ya *F-10, Islamabad*).
2. **"Order via WhatsApp"** click karne par direct WhatsApp chat open hoti hai jismein automatically yeh details pre-filled hoti hain:
   ```text
   Assalam-o-Alaikum, mein Afiya AI se yeh dawaiyan order karna chahta hoon:
   1. Augmentin 625mg (1 Pack) - Rs. 340
   2. Panadol 500mg (2 Strips) - Rs. 70
   3. Risek 20mg (1 Box) - Rs. 380

   📍 Delivery Address: House #123, Street 4, F-10, Islamabad
   📸 Prescription Attached for Verification.
   ```
3. Pharmacy ka rider Cash on Delivery (COD) par 1 se 2 ghantay mein order deliver kar deta hai.

---

### Idea 4: 🔄 Chronic Care Monthly Refill Subscription (Dawaai Refill Hub)

#### Concept:
Sugar (Diabetes), Blood Pressure, Dil (Cardiac), aur Dama (Asthma) ke mareezon ko har maheene dawaiyan khareedni parti hain jo akser khatam ho jati hain.

#### Kaise Kaam Karta Hai:
1. User apne **"Digital Medicine Cabinet"** mein dawaiyon ko **"Monthly Refill"** mark karta hai.
2. Afiya AI calculate karta hai ke pack kitne din chalega (e.g. 30 tablets = 30 days).
3. Dawai khatam hone se 4 din pehle SMS / Notification / WhatsApp reminder jata hai:
   > *"Aapki Glucophage 500mg 4 din mein khatam hone wali hai. Kya hum aapka monthly refill Rs. 50 discount ke sath dispatch kar dein?"*
4. User **"Confirm Refill"** par click karta hai aur automated delivery schedule ho jati hai.

---

### Idea 5: 🛡️ Licensed Pharmacist Verification Portal (`/pharmacy-portal`)

#### Concept:
Medical aur legal compliance ke mutabiq, Antibiotics aur Controlled drugs bina prescription dispense nahi kiye ja saktay.

#### Kaise Kaam Karta Hai:
1. Jab user prescription upload karke order place karta hai, order **"Pending Pharmacist Review"** status mein jata hai.
2. Partner Pharmacy ke Pharmacist ke paas ek simple dashboard hota hai jahan:
   - Left side: Original prescription ki image hoti hai.
   - Right side: AI ke extract kiye huay medicine items hotay hain.
3. Pharmacist cross-check karke **"Approve & Dispatch"** click karta hai.
4. User ko *"Prescription Verified by Licensed Pharmacist"* ka green verified badge milta hai.

---

## 3. Database Schema & Architecture

Marketplace implement karne ke liye yeh naye database tables add kiye ja saktay hain:

```sql
-- 1. Verified Partner Pharmacies
CREATE TABLE pharmacies (
    id VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,               -- e.g. "Servaid Pharmacy", "Dvago"
    city VARCHAR NOT NULL,               -- e.g. "Karachi", "Lahore", "Islamabad"
    area VARCHAR NOT NULL,               -- e.g. "Blue Area", "Clifton"
    phone_whatsapp VARCHAR NOT NULL,
    delivery_fee DECIMAL(10,2) DEFAULT 0.0,
    estimated_delivery_time VARCHAR,     -- e.g. "1-2 Hours"
    is_active BOOLEAN DEFAULT TRUE
);

-- 2. Orders Table
CREATE TABLE orders (
    id VARCHAR PRIMARY KEY,
    user_id VARCHAR REFERENCES users(id),
    pharmacy_id VARCHAR REFERENCES pharmacies(id),
    prescription_image_url VARCHAR,
    total_amount DECIMAL(10,2) NOT NULL,
    savings_amount DECIMAL(10,2) DEFAULT 0.0,
    status VARCHAR DEFAULT 'pending',    -- 'pending', 'approved', 'dispatched', 'delivered', 'cancelled'
    delivery_address TEXT NOT NULL,
    payment_method VARCHAR DEFAULT 'COD',-- 'COD' (Cash on Delivery)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Order Items Table
CREATE TABLE order_items (
    id VARCHAR PRIMARY KEY,
    order_id VARCHAR REFERENCES orders(id) ON DELETE CASCADE,
    medicine_id VARCHAR REFERENCES medicines(id),
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    is_generic_swap BOOLEAN DEFAULT FALSE
);

-- 4. Monthly Refill Subscriptions
CREATE TABLE refill_subscriptions (
    id VARCHAR PRIMARY KEY,
    user_id VARCHAR REFERENCES users(id),
    medicine_id VARCHAR REFERENCES medicines(id),
    days_supply INT DEFAULT 30,
    last_refill_date DATE,
    next_refill_date DATE,
    auto_remind BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. Frontend Components Architecture

Marketplace UI ke liye Next.js frontend mein yeh components banaye ja saktay hain:

```
apps/web/src/components/marketplace/
├── CartDrawer.tsx           # Slide-over cart jisme items, total aur split options hon
├── PharmacySelector.tsx     # Fastest vs Cheapest pharmacy comparison cards
├── GenericSwapBanner.tsx    # "Switch to generic & save Rs. X" toggle banner
├── WhatsAppCheckout.tsx     # Direct 1-click WhatsApp order generation
├── OrderSuccessModal.tsx    # Order confirmed screen with tracking details
└── RefillManagerModal.tsx   # Monthly subscription & reminder settings
```

---

## 5. Hackathon Judges ke Samne Presentation Strategy (Pitch Points)

Jab aap judges ko yeh feature demo karein ge, toh yeh 3 key points unhein bohot impress karein ge:

1. **Closing the Loop (From Problem to Solution):**
   - *"User prescription scan karta hai (AI OCR) -> Sasti dawai find karta hai (Smart Matching) -> Aur usi waqt ek click mein saste tareen rate par order kar leta hai (Marketplace)."*
2. **Real Impact on Pakistani Households:**
   - *"Monthly generic substitution aur split-cart se aik aam Pakistani khandan har maheene dawaiyon ke bill par 30% se 50% bachat kar sakta hai."*
3. **Hyper-Localized Execution:**
   - *"Humne Pakistan ke ground reality ke mutabiq WhatsApp 1-Click Dispatch aur Cash on Delivery (COD) model design kiya hai jisme kisi complex bank card ki zaroorat nahi."*
