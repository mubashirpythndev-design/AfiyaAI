// Internationalization translations for Afiya AI
// Keys are English identifiers; values are translated strings per language.

export type TranslationKey =
  | "nav.features"
  | "nav.howItWorks"
  | "hero.badge"
  | "hero.title1"
  | "hero.titleHighlight"
  | "hero.title2"
  | "hero.description"
  | "hero.searchPlaceholder"
  | "hero.searchBtn"
  | "hero.stat1Num"
  | "hero.stat1Label"
  | "hero.stat2Num"
  | "hero.stat2Label"
  | "hero.stat3Num"
  | "hero.stat3Label"
  | "hero.drapBadge"
  | "category.title"
  | "category.subtitle"
  | "howItWorks.title"
  | "howItWorks.subtitle"
  | "howItWorks.step1Title"
  | "howItWorks.step1Desc"
  | "howItWorks.step2Title"
  | "howItWorks.step2Desc"
  | "howItWorks.step3Title"
  | "howItWorks.step3Desc"
  | "features.title"
  | "features.subtitle"
  | "features.ocr"
  | "features.ocrDesc"
  | "features.price"
  | "features.priceDesc"
  | "features.chat"
  | "features.chatDesc"
  | "features.safety"
  | "features.safetyDesc"
  | "chat.sectionBadge"
  | "chat.sectionTitle"
  | "chat.sectionSubtitle"
  | "chat.headerTitle"
  | "chat.headerStatus"
  | "chat.emptyTitle"
  | "chat.emptySubtitle"
  | "chat.inputPlaceholder"
  | "chat.errorMsg"
  | "chat.suggestion1"
  | "chat.suggestion2"
  | "chat.suggestion3"
  | "chat.suggestion4"
  | "results.backHome"
  | "results.backResults"
  | "results.viewInfo"
  | "results.comparePrices"
  | "results.form"
  | "results.category"
  | "results.manufacturer"
  | "upload.title"
  | "upload.titleDrag"
  | "upload.subtitle"
  | "upload.hint"
  | "upload.changeImage"
  | "upload.extracting"
  | "upload.invalidType"
  | "upload.tooLarge"
  | "footer.disclaimerTitle"
  | "footer.drapVerified"
  | "footer.builtFor"
  | "footer.safetyFirst"
  | "disclaimer.label"
  | "loading.text"
  | "error.noMatch"
  | "error.searchFailed"
  | "error.loadInfo"
  | "error.loadPrices"
  | "info.cheapestTitle"
  | "info.cheapestSubtitle"
  | "info.cheapestBadge"
  | "info.yourMedicine"
  | "info.packPrice"
  | "info.packSize"
  | "info.perUnit"
  | "info.save"
  | "info.vsYours"
  | "info.consultPharmacist"
  | "mrp.title"
  | "mrp.subtitle"
  | "mrp.inputLabel"
  | "mrp.placeholder"
  | "mrp.invalidPrice"
  | "mrp.checkBtn"
  | "mrp.checking"
  | "mrp.error"
  | "mrp.confirmPrompt"
  | "mrp.paidLabel"
  | "mrp.mrpLabel"
  | "mrp.overchargeLabel"
  | "mrp.effectiveLabel"
  | "mrp.packLabel"
  | "mrp.sourceLabel";

type TranslationMap = Record<TranslationKey, string>;

const en: TranslationMap = {
  "nav.features": "Features",
  "nav.howItWorks": "How it Works",
  "hero.badge": "Powered by Verified DRAP Data",
  "hero.title1": "Your Intelligent",
  "hero.titleHighlight": "Medicine",
  "hero.title2": "Assistant",
  "hero.description": "Upload a prescription, get instant medicine information, compare prices, and chat in English, Urdu, or Roman Urdu. All data verified by DRAP Pakistan.",
  "hero.searchPlaceholder": "Search a medicine name...",
  "hero.searchBtn": "Search",
  "hero.stat1Num": "40+",
  "hero.stat1Label": "Verified Medicines",
  "hero.stat2Num": "3",
  "hero.stat2Label": "Languages",
  "hero.stat3Num": "100%",
  "hero.stat3Label": "Free to Use",
  "hero.drapBadge": "DRAP Verified Data",
  "category.title": "Browse by Category",
  "category.subtitle": "Explore our verified medicine database across major therapeutic categories",
  "howItWorks.title": "How It Works",
  "howItWorks.subtitle": "Three simple steps to get verified medicine information",
  "howItWorks.step1Title": "Upload or Search",
  "howItWorks.step1Desc": "Upload a prescription image or type a medicine name to get started instantly",
  "howItWorks.step2Title": "AI Extraction & Matching",
  "howItWorks.step2Desc": "Our AI reads the prescription and matches medicines against the verified DRAP database",
  "howItWorks.step3Title": "Get Results",
  "howItWorks.step3Desc": "View detailed info, compare prices across sources, and chat in your preferred language",
  "features.title": "Key Features",
  "features.subtitle": "Built with safety and accuracy at its core",
  "features.ocr": "Prescription OCR",
  "features.ocrDesc": "AI-powered image reading for handwritten and printed prescriptions",
  "features.price": "Price Comparison",
  "features.priceDesc": "Compare DRAP-regulated prices across verified pharmacy sources",
  "features.chat": "Multilingual Chat",
  "features.chatDesc": "Chat in English, Urdu, or Roman Urdu with grounded AI responses",
  "features.safety": "Safety First",
  "features.safetyDesc": "No diagnosis, no prescribing. All facts verified from authoritative sources",
  "chat.sectionBadge": "AI-Powered",
  "chat.sectionTitle": "Chat with Afiya AI",
  "chat.sectionSubtitle": "Ask questions about medicines in your preferred language. All responses are grounded in verified data.",
  "chat.headerTitle": "Afiya AI Chat",
  "chat.headerStatus": "Online \u00b7 Grounded in verified data",
  "chat.emptyTitle": "Ask me anything about medicines",
  "chat.emptySubtitle": "All responses are grounded in verified DRAP data and medical knowledge",
  "chat.inputPlaceholder": "Ask about a medicine...",
  "chat.errorMsg": "Sorry, I encountered an error. Please try again.",
  "chat.suggestion1": "What is Panadol used for?",
  "chat.suggestion2": "Tell me about Augmentin",
  "chat.suggestion3": "Side effects of Brufen?",
  "chat.suggestion4": "How to take Metformin?",
  "results.backHome": "Back to Home",
  "results.backResults": "Back to Results",
  "results.viewInfo": "View Info",
  "results.comparePrices": "Compare Prices",
  "results.form": "Form",
  "results.category": "Category",
  "results.manufacturer": "Manufacturer",
  "upload.title": "Upload Prescription",
  "upload.titleDrag": "Drop your prescription here",
  "upload.subtitle": "Drag & drop or click to browse",
  "upload.hint": "JPEG, PNG, or WebP \u2022 Max 10MB",
  "upload.changeImage": "Click to change image",
  "upload.extracting": "Extracting medicines...",
  "upload.invalidType": "Please upload a JPEG, PNG, or WebP image.",
  "upload.tooLarge": "File is too large. Maximum size is 10MB.",
  "footer.disclaimerTitle": "Medical Disclaimer",
  "footer.drapVerified": "Verified DRAP Data",
  "footer.builtFor": "Built for Pakistan",
  "footer.safetyFirst": "Safety First",
  "disclaimer.label": "Disclaimer:",
  "loading.text": "Processing your request...",
  "error.noMatch": "No matching medicine found in our database.",
  "error.searchFailed": "Search failed",
  "error.loadInfo": "Failed to load info",
  "error.loadPrices": "Failed to load prices",
  "info.cheapestTitle": "Cheaper Brands of This Medicine",
  "info.cheapestSubtitle": "Same active ingredient & strength, compared per unit",
  "info.cheapestBadge": "Cheapest",
  "info.yourMedicine": "Your medicine",
  "info.packPrice": "Pack price",
  "info.packSize": "Pack size",
  "info.perUnit": "per unit",
  "info.save": "Save",
  "info.vsYours": "vs your medicine",
  "info.consultPharmacist": "Consult a pharmacist before switching brands.",
  "mrp.title": "Check price vs official MRP",
  "mrp.subtitle": "Compare the price you paid with the DRAP-notified Maximum Retail Price",
  "mrp.inputLabel": "Price you paid (PKR)",
  "mrp.placeholder": "e.g. 250",
  "mrp.invalidPrice": "Please enter a price greater than 0.",
  "mrp.checkBtn": "Check price",
  "mrp.checking": "Checking...",
  "mrp.error": "Price check failed. Please try again.",
  "mrp.confirmPrompt": "Please confirm which medicine you mean:",
  "mrp.paidLabel": "You paid",
  "mrp.mrpLabel": "Official MRP",
  "mrp.overchargeLabel": "Overcharge amount",
  "mrp.effectiveLabel": "MRP effective from",
  "mrp.packLabel": "Pack size",
  "mrp.sourceLabel": "Source",
};

const ur: TranslationMap = {
  "nav.features": "\u062E\u0648\u0628\u06CC\u0627\u06BA",
  "nav.howItWorks": "\u06CC\u06C1 \u06A9\u06CC\u0633\u06D2 \u06A9\u0627\u0645 \u06A9\u0631\u062A\u0627 \u06C1\u06D2",
  "hero.badge": "\u0645\u0635\u062F\u0642\u06C1 DRAP \u0688\u06CC\u0679\u0627 \u0633\u06D2 \u0645\u0627\u062F\u06CC",
  "hero.title1": "\u0622\u067E \u06A9\u0627 \u0630\u06C1\u06CC\u0646",
  "hero.titleHighlight": "\u062F\u0648\u0627\u0626\u06CC",
  "hero.title2": "\u0645\u062F\u062F\u06AF\u0627\u0631",
  "hero.description": "\u0646\u0633\u062E\u06C1 \u0627\u067E \u0644\u0648\u0688 \u06A9\u0631\u06CC\u06BA\u060C \u0641\u0648\u0631\u06CC \u062F\u0648\u0627 \u06A9\u06CC \u0645\u0639\u0644\u0648\u0645\u0627\u062A \u062D\u0627\u0635\u0644 \u06A9\u0631\u06CC\u06BA\u060C \u0642\u06CC\u0645\u062A\u0648\u06BA \u06A9\u0627 \u0645\u0648\u0627\u0632\u0646\u06C1 \u06A9\u0631\u06CC\u06BA\u060C \u0627\u0648\u0631 \u0686\u06CC\u0679 \u06A9\u0631\u06CC\u06BA\u06D4 \u062A\u0645\u0627\u0645 \u0688\u06CC\u0679\u0627 DRAP \u067E\u0627\u06A9\u0633\u062A\u0627\u0646 \u0633\u06D2 \u0645\u0635\u062F\u0642 \u06C1\u06D2\u06D4",
  "hero.searchPlaceholder": "\u062F\u0648\u0627 \u06A9\u0627 \u0646\u0627\u0645 \u062A\u0644\u0627\u0634 \u06A9\u0631\u06CC\u06BA...",
  "hero.searchBtn": "\u062A\u0644\u0627\u0634",
  "hero.stat1Num": "\u06F4\u06F0+",
  "hero.stat1Label": "\u0645\u0635\u062F\u0642 \u062F\u0648\u0627\u0626\u06CC\u06BA",
  "hero.stat2Num": "\u06F3",
  "hero.stat2Label": "\u0632\u0628\u0627\u0646\u06CC\u06BA",
  "hero.stat3Num": "\u06F1\u06F0\u06F0\u066A",
  "hero.stat3Label": "\u0645\u0641\u062A \u0627\u0633\u062A\u0639\u0645\u0627\u0644",
  "hero.drapBadge": "DRAP \u0645\u0635\u062F\u0642 \u0688\u06CC\u0679\u0627",
  "category.title": "\u0632\u0645\u0631\u06C1 \u06A9\u06D2 \u0645\u0648\u0627\u0628 \u062F\u06CC\u06A9\u06BE\u06CC\u06BA",
  "category.subtitle": "\u0627\u06C1\u0645 \u062A\u06CC\u0631\u0627\u067E\u06CC\u0648\u0679\u06A9 \u0632\u0645\u0631\u0648\u06BA \u0645\u06CC\u06BA \u0645\u0635\u062F\u0642 \u062F\u0648\u0627 \u0688\u06CC\u0679\u0627 \u0628\u06CC\u0633 \u06A9\u0627 \u0645\u0637\u0627\u0644\u0639\u06C1 \u06A9\u0631\u06CC\u06BA",
  "howItWorks.title": "\u06CC\u06C1 \u06A9\u06CC\u0633\u06D2 \u06A9\u0627\u0645 \u06A9\u0631\u062A\u0627 \u06C1\u06D2",
  "howItWorks.subtitle": "\u0645\u0635\u062F\u0642 \u062F\u0648\u0627 \u06A9\u06CC \u0645\u0639\u0644\u0648\u0645\u0627\u062A \u062D\u0627\u0635\u0644 \u06A9\u0631\u0646\u06D2 \u06A9\u06D2 \u062A\u06CC\u0646 \u0622\u0633\u0627\u0646 \u0645\u0631\u0627\u062D\u0644",
  "howItWorks.step1Title": "\u0627\u067E \u0644\u0648\u0688 \u06CC\u0627 \u062A\u0644\u0627\u0634 \u06A9\u0631\u06CC\u06BA",
  "howItWorks.step1Desc": "\u0646\u0633\u062E\u06C1 \u06A9\u06CC \u062A\u0635\u0648\u06CC\u0631 \u0627\u067E \u0644\u0648\u0688 \u06A9\u0631\u06CC\u06BA \u06CC\u0627 \u062F\u0648\u0627 \u06A9\u0627 \u0646\u0627\u0645 \u0644\u06A9\u06BE \u06A9\u0631 \u0641\u0648\u0631\u06CC \u0634\u0631\u0648\u0639 \u06A9\u0631\u06CC\u06BA",
  "howItWorks.step2Title": "AI \u0627\u06CC\u06A9\u0633\u0679\u06CC\u06A9\u0679 \u0627\u0648\u0631 \u0645\u06CC\u0686\u0646\u06AF",
  "howItWorks.step2Desc": "\u06C1\u0645\u0627\u0631\u0627 AI \u0646\u0633\u062E\u06C1 \u067E\u0691\u06BE\u062A\u0627 \u06C1\u06D2 \u0627\u0648\u0631 \u0645\u0635\u062F\u0642 DRAP \u0688\u06CC\u0679\u0627 \u0628\u06CC\u0633 \u06A9\u06D2 \u0633\u0627\u062A\u06BE \u0645\u0648\u0627\u0632\u0646\u06C1 \u06A9\u0631\u062A\u0627 \u06C1\u06D2",
  "howItWorks.step3Title": "\u0646\u062A\u0627\u0626\u062C \u062D\u0627\u0635\u0644 \u06A9\u0631\u06CC\u06BA",
  "howItWorks.step3Desc": "\u062A\u0641\u0635\u06CC\u0644\u06CC \u0645\u0639\u0644\u0648\u0645\u0627\u062A \u062F\u06CC\u06A9\u06BE\u06CC\u06BA\u060C \u0642\u06CC\u0645\u062A\u0648\u06BA \u06A9\u0627 \u0645\u0648\u0627\u0632\u0646\u06C1 \u06A9\u0631\u06CC\u06BA\u060C \u0627\u0648\u0631 \u0627\u067E\u0646\u06CC \u0645\u0646 \u0645\u0631\u0636\u06CC \u0632\u0628\u0627\u0646 \u0645\u06CC\u06BA \u0686\u06CC\u0679 \u06A9\u0631\u06CC\u06BA",
  "features.title": "\u0627\u06C1\u0645 \u062E\u0648\u0628\u06CC\u0627\u06BA",
  "features.subtitle": "\u062D\u0641\u0627\u0638\u062A \u0627\u0648\u0631 \u062F\u0631\u0633\u062A\u06AF\u06CC \u06A9\u0648 \u0628\u0646\u06CC\u0627\u062F \u0628\u0646\u0627 \u06A9\u0631 \u062A\u06CC\u0627\u0631 \u06A9\u06CC\u0627 \u06AF\u06CC\u0627",
  "features.ocr": "\u0646\u0633\u062E\u06C1 OCR",
  "features.ocrDesc": "\u06C1\u0627\u062A\u06BE \u0633\u06D2 \u0644\u06A9\u06BE\u06D2 \u0627\u0648\u0631 \u0686\u06BE\u067E\u06D2 \u06C1\u0648\u0626\u06D2 \u0646\u0633\u062E\u0648\u06BA \u06A9\u06D2 \u0644\u06CC\u06D2 AI \u0633\u06D2 \u0686\u0644\u0646\u06D2 \u0648\u0627\u0644\u06CC \u062A\u0635\u0648\u06CC\u0631 \u067E\u0691\u06BE\u0627\u0626\u06CC",
  "features.price": "\u0642\u06CC\u0645\u062A \u06A9\u0627 \u0645\u0648\u0627\u0632\u0646\u06C1",
  "features.priceDesc": "\u0645\u0635\u062F\u0642 \u0641\u0627\u0631\u0645\u06CC\u0633\u06CC \u0630\u0627\u0626\u0639 \u06A9\u06D2 \u0645\u0648\u0627\u0628 \u0645\u06CC\u06BA DRAP \u0633\u06D2 \u0645\u0646\u0638\u0645 \u0642\u06CC\u0645\u062A\u0648\u06BA \u06A9\u0627 \u0645\u0648\u0627\u0632\u0646\u06C1 \u06A9\u0631\u06CC\u06BA",
  "features.chat": "\u0686\u0646\u062F \u0632\u0628\u0627\u0646\u06CC \u0686\u06CC\u0679",
  "features.chatDesc": "\u0627\u0646\u06AF\u0631\u06CC\u0632\u06CC\u060C \u0627\u0631\u062F\u0648 \u06CC\u0627 \u0631\u0648\u0645\u0646 \u0627\u0631\u062F\u0648 \u0645\u06CC\u06BA AI \u0633\u06D2 \u0686\u06CC\u0679 \u06A9\u0631\u06CC\u06BA",
  "features.safety": "\u062D\u0641\u0627\u0638\u062A \u0633\u0628 \u0633\u06D2 \u0627\u0648\u0644",
  "features.safetyDesc": "\u0646\u06C1 \u062A\u0634\u062E\u06CC\u0635\u060C \u0646\u06C1 \u0646\u0633\u062E\u06C1\u06D4 \u062A\u0645\u0627\u0645 \u062D\u0642\u0627\u0626\u0642 \u0645\u0633\u062A\u0646\u062F \u0630\u0627\u0626\u0639 \u0633\u06D2 \u0645\u0635\u062F\u0642",
  "chat.sectionBadge": "AI \u0633\u06D2 \u0686\u0644\u0646\u06D2 \u0648\u0627\u0644\u0627",
  "chat.sectionTitle": "\u0627\u0641\u06CC\u06C1 AI \u0633\u06D2 \u0686\u06CC\u0679 \u06A9\u0631\u06CC\u06BA",
  "chat.sectionSubtitle": "\u0627\u067E\u0646\u06CC \u0645\u0646 \u0645\u0631\u0636\u06CC \u0632\u0628\u0627\u0646 \u0645\u06CC\u06BA \u062F\u0648\u0627\u0626\u0648\u06BA \u06A9\u06D2 \u0628\u0627\u0631\u06D2 \u0645\u06CC\u06BA \u0633\u0648\u0627\u0644\u0627\u062A \u067E\u0648\u0686\u06BE\u06CC\u06BA\u06D4",
  "chat.headerTitle": "\u0627\u0641\u06CC\u06C1 AI \u0686\u06CC\u0679",
  "chat.headerStatus": "\u0622\u0646 \u0644\u0627\u0626\u0646 \u00b7 \u0645\u0635\u062F\u0642 \u0688\u06CC\u0679\u0627 \u0633\u06D2 \u0645\u0627\u062F\u06CC",
  "chat.emptyTitle": "\u062F\u0648\u0627\u0626\u0648\u06BA \u06A9\u06D2 \u0628\u0627\u0631\u06D2 \u0645\u06CC\u06BA \u06A9\u0686\u06BE \u0628\u06BE\u06CC \u067E\u0648\u0686\u06BE\u06CC\u06BA",
  "chat.emptySubtitle": "\u062A\u0645\u0627\u0645 \u062C\u0648\u0627\u0628\u0627\u062A \u0645\u0635\u062F\u0642 DRAP \u0688\u06CC\u0679\u0627 \u0627\u0648\u0631 \u0637\u0628\u06CC \u0639\u0644\u0645 \u0633\u06D2 \u0645\u0627\u062F\u06CC \u06C1\u06CC\u06BA",
  "chat.inputPlaceholder": "\u062F\u0648\u0627 \u06A9\u06D2 \u0628\u0627\u0631\u06D2 \u0645\u06CC\u06BA \u067E\u0648\u0686\u06BE\u06CC\u06BA...",
  "chat.errorMsg": "\u0645\u0627\u0641 \u06A9\u06CC\u062C\u06CC\u06D2\u060C \u062E\u0631\u0627\u0628\u06CC \u0622 \u06AF\u0626\u06CC\u06D4 \u0628\u0631\u0627\u06C1 \u0645\u06C1\u0631\u0628\u0627\u0646\u06CC \u062F\u0648\u0628\u0627\u0631\u06C1 \u06A9\u0648\u0634\u0634 \u06A9\u0631\u06CC\u06BA\u06D4",
  "chat.suggestion1": "\u067E\u06CC\u0646\u0627\u0688\u0648\u0644 \u06A9\u0633 \u0644\u06CC\u06D2 \u0627\u0633\u062A\u0639\u0645\u0627\u0644 \u06C1\u0648\u062A\u06CC \u06C1\u06D2\u061F",
  "chat.suggestion2": "\u0622\u06AF\u0645\u06CC\u0646\u0679\u06CC\u0646 \u06A9\u06D2 \u0628\u0627\u0631\u06D2 \u0645\u06CC\u06BA \u0628\u062A\u0627\u0626\u06CC\u06BA",
  "chat.suggestion3": "\u0628\u0631\u0648\u0641\u06CC\u0646 \u06A9\u06D2 \u0636\u0631\u0631 \u0627\u0648\u0631\u0627\u062A\u061F",
  "chat.suggestion4": "\u0645\u06CC\u0679\u0641\u0627\u0631\u0645\u06CC\u0646 \u06A9\u06CC\u0633\u06D2 \u0644\u06CC \u062C\u0627\u0626\u06D2\u061F",
  "results.backHome": "\u06C1\u0648\u0645 \u067E\u0631 \u0648\u0627\u067E\u0633",
  "results.backResults": "\u0646\u062A\u0627\u0626\u062C \u067E\u0631 \u0648\u0627\u067E\u0633",
  "results.viewInfo": "\u0645\u0639\u0644\u0648\u0645\u0627\u062A \u062F\u06CC\u06A9\u06BE\u06CC\u06BA",
  "results.comparePrices": "\u0642\u06CC\u0645\u062A\u0648\u06BA \u06A9\u0627 \u0645\u0648\u0627\u0632\u0646\u06C1",
  "results.form": "\u0634\u06A9\u0644",
  "results.category": "\u0632\u0645\u0631\u06C1",
  "results.manufacturer": "\u0628\u0627\u0646\u06CC",
  "upload.title": "\u0646\u0633\u062E\u06C1 \u0627\u067E \u0644\u0648\u0688 \u06A9\u0631\u06CC\u06BA",
  "upload.titleDrag": "\u0627\u067E\u0646\u0627 \u0646\u0633\u062E\u06C1 \u06CC\u06C1\u0627\u06BA \u0686\u06BE\u0648\u0691\u06CC\u06BA",
  "upload.subtitle": "\u0688\u0631\u06CC\u06AF \u0627\u06CC\u0646\u0688 \u0688\u0631\u0627\u067E \u06CC\u0627 \u06A9\u0644\u06A9 \u06A9\u0631 \u06A9\u06D2 \u062F\u06CC\u06A9\u06BE\u06CC\u06BA",
  "upload.hint": "JPEG\u060C PNG \u06CC\u0627 WebP \u2022 \u0632\u06CC\u0627\u062F\u06C1 \u0633\u06D2 \u0632\u06CC\u0627\u062F\u06C1 10MB",
  "upload.changeImage": "\u062A\u0635\u0648\u06CC\u0631 \u0628\u062F\u0644\u0646\u06D2 \u06A9\u06D2 \u0644\u06CC\u06D2 \u06A9\u0644\u06A9 \u06A9\u0631\u06CC\u06BA",
  "upload.extracting": "\u062F\u0648\u0627\u0626\u06CC\u06BA \u0646\u06A9\u0627\u0644 \u06C1\u0648 \u0631\u06C1\u06CC \u06C1\u06CC\u06BA...",
  "upload.invalidType": "\u0628\u0631\u0627\u06C1 \u0645\u06C1\u0631\u0628\u0627\u0646\u06CC JPEG\u060C PNG\u060C \u06CC\u0627 WebP \u062A\u0635\u0648\u06CC\u0631 \u0627\u067E \u0644\u0648\u0688 \u06A9\u0631\u06CC\u06BA\u06D4",
  "upload.tooLarge": "\u0641\u0627\u0626\u0644 \u0628\u06C1\u062A \u0628\u0691\u06CC \u06C1\u06D2\u06D4 \u0632\u06CC\u0627\u062F\u06C1 \u0633\u06D2 \u0632\u06CC\u0627\u062F\u06C1 10MB\u06D4",
  "footer.disclaimerTitle": "\u0637\u0628\u06CC \u062F\u0639\u0648\u06CC\u06CC \u0628\u06CC\u0627\u0646",
  "footer.drapVerified": "\u0645\u0635\u062F\u0642 DRAP \u0688\u06CC\u0679\u0627",
  "footer.builtFor": "\u067E\u0627\u06A9\u0633\u062A\u0627\u0646 \u06A9\u06D2 \u0644\u06CC\u06D2 \u062A\u0639\u0645\u06CC\u0631",
  "footer.safetyFirst": "\u062D\u0641\u0627\u0638\u062A \u0633\u0628 \u0633\u06D2 \u0627\u0648\u0644",
  "disclaimer.label": "\u062F\u0639\u0648\u06CC\u06CC \u0628\u06CC\u0627\u0646:",
  "loading.text": "\u0622\u067E \u06A9\u06CC \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u067E\u0631 \u06A9\u0627\u0631\u0631\u0648\u0627\u0626\u06CC \u06C1\u0648 \u0631\u06C1\u06CC \u06C1\u06D2...",
  "error.noMatch": "\u06C1\u0645\u0627\u0631\u06D2 \u0688\u06CC\u0679\u0627 \u0628\u06CC\u0633 \u0645\u06CC\u06BA \u06A9\u0648\u0626\u06CC \u0645\u0648\u0627\u0641\u0642 \u062F\u0648\u0627 \u0646\u06C1\u06CC\u06BA \u0645\u0644\u06CC\u06D4",
  "error.searchFailed": "\u062A\u0644\u0627\u0634 \u0646\u0627\u06A9\u0627\u0645",
  "error.loadInfo": "\u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0644\u0648\u0688 \u0646\u06C1 \u06C1\u0648 \u0633\u06A9\u06CC\u06BA",
  "error.loadPrices": "\u0642\u06CC\u0645\u062A\u06CC\u06BA \u0644\u0648\u0688 \u0646\u06C1 \u06C1\u0648 \u0633\u06A9\u06CC\u06BA",
  "info.cheapestTitle": "\u0627\u0633 \u062F\u0648\u0627 \u06A9\u06D2 \u0633\u0633\u062A\u06D2 \u0628\u0631\u0627\u0646\u0688\u0632",
  "info.cheapestSubtitle": "\u0627\u06CC\u06A9 \u06C1\u06CC \u062C\u0646\u0631\u06A9 \u0627\u0648\u0631 \u0637\u0627\u0642\u062A\u060C \u0641\u06CC \u06CC\u0648\u0646\u0679 \u0642\u06CC\u0645\u062A \u06A9\u0627 \u0645\u0648\u0627\u0632\u0646\u06C1",
  "info.cheapestBadge": "\u0633\u0628 \u0633\u06D2 \u0633\u0633\u062A\u0627",
  "info.yourMedicine": "\u0622\u067E \u06A9\u06CC \u062F\u0648\u0627",
  "info.packPrice": "\u067E\u06CC\u06A9 \u0642\u06CC\u0645\u062A",
  "info.packSize": "\u067E\u06CC\u06A9 \u0633\u0627\u0626\u0632",
  "info.perUnit": "\u0641\u06CC \u06CC\u0648\u0646\u0679",
  "info.save": "\u0628\u0686\u062A",
  "info.vsYours": "\u0622\u067E \u06A9\u06CC \u062F\u0648\u0627 \u06A9\u06D2 \u0645\u0642\u0627\u0628\u0644\u06D2",
  "info.consultPharmacist": "\u0628\u0631\u0627\u0646\u0688 \u0628\u062F\u0644\u0646\u06D2 \u0633\u06D2 \u067E\u06C1\u0644\u06D2 \u0641\u0627\u0631\u0645\u0627\u0633\u0679 \u0633\u06D2 \u0645\u0634\u0648\u0631\u06C1 \u06A9\u0631\u06CC\u06BA\u06D4",
  "mrp.title": "\u0633\u0631\u06A9\u0627\u0631\u06CC \u0627\u06CC\u0645 \u0622\u0631 \u067E\u06CC \u0633\u06D2 \u0642\u06CC\u0645\u062A \u0686\u06CC\u06A9 \u06A9\u0631\u06CC\u06BA",
  "mrp.subtitle": "\u0622\u067E \u0646\u06D2 \u062C\u0648 \u0642\u06CC\u0645\u062A \u0627\u062F\u0627 \u06A9\u06CC \u0627\u0633 \u06A9\u0627 DRAP \u06A9\u06CC \u0645\u0642\u0631\u0631\u06C1 \u0632\u06CC\u0627\u062F\u06C1 \u0633\u06D2 \u0632\u06CC\u0627\u062F\u06C1 \u067E\u0631\u0686\u0648\u0646 \u0642\u06CC\u0645\u062A \u0633\u06D2 \u0645\u0648\u0627\u0632\u0646\u06C1 \u06A9\u0631\u06CC\u06BA",
  "mrp.inputLabel": "\u0622\u067E \u0646\u06D2 \u062C\u0648 \u0642\u06CC\u0645\u062A \u0627\u062F\u0627 \u06A9\u06CC (\u0631\u0648\u067E\u06D2)",
  "mrp.placeholder": "\u0645\u062B\u0644\u0627\u064B 250",
  "mrp.invalidPrice": "\u0628\u0631\u0627\u06C1 \u0645\u06C1\u0631\u0628\u0627\u0646\u06CC 0 \u0633\u06D2 \u0632\u06CC\u0627\u062F\u06C1 \u0642\u06CC\u0645\u062A \u062F\u0631\u062C \u06A9\u0631\u06CC\u06BA\u06D4",
  "mrp.checkBtn": "\u0642\u06CC\u0645\u062A \u0686\u06CC\u06A9 \u06A9\u0631\u06CC\u06BA",
  "mrp.checking": "\u0686\u06CC\u06A9 \u06C1\u0648 \u0631\u06C1\u0627 \u06C1\u06D2...",
  "mrp.error": "\u0642\u06CC\u0645\u062A \u06A9\u06CC \u062C\u0627\u0646\u0686 \u0646\u0627\u06A9\u0627\u0645 \u06C1\u0648 \u06AF\u0626\u06CC\u06D4 \u0628\u0631\u0627\u06C1 \u0645\u06C1\u0631\u0628\u0627\u0646\u06CC \u062F\u0648\u0628\u0627\u0631\u06C1 \u06A9\u0648\u0634\u0634 \u06A9\u0631\u06CC\u06BA\u06D4",
  "mrp.confirmPrompt": "\u0628\u0631\u0627\u06C1 \u0645\u06C1\u0631\u0628\u0627\u0646\u06CC \u062A\u0635\u062F\u06CC\u0642 \u06A9\u0631\u06CC\u06BA \u06A9\u06C1 \u0622\u067E \u06A9\u06CC \u0645\u0631\u0627\u062F \u06A9\u0648\u0646 \u0633\u06CC \u062F\u0648\u0627 \u06C1\u06D2:",
  "mrp.paidLabel": "\u0622\u067E \u0646\u06D2 \u0627\u062F\u0627 \u06A9\u06CC\u06D2",
  "mrp.mrpLabel": "\u0633\u0631\u06A9\u0627\u0631\u06CC \u0627\u06CC\u0645 \u0622\u0631 \u067E\u06CC",
  "mrp.overchargeLabel": "\u0632\u06CC\u0627\u062F\u06C1 \u0644\u06CC \u06AF\u0626\u06CC \u0631\u0642\u0645",
  "mrp.effectiveLabel": "\u0627\u06CC\u0645 \u0622\u0631 \u067E\u06CC \u0646\u0627\u0641\u0630 \u0627\u0644\u0639\u0645\u0644 \u062A\u0627\u0631\u06CC\u062E",
  "mrp.packLabel": "\u067E\u06CC\u06A9 \u0633\u0627\u0626\u0632",
  "mrp.sourceLabel": "\u0630\u0631\u06CC\u0639\u06C1",
};

const romanUr: TranslationMap = {
  "nav.features": "Khubiyan",
  "nav.howItWorks": "Yeh kaise kaam karta hai",
  "hero.badge": "Mustanad DRAP Data se taqatwar",
  "hero.title1": "Aap ka zaheen",
  "hero.titleHighlight": "Dawai",
  "hero.title2": "Madadgaar",
  "hero.description": "Nuskha app load karein, fori dawai ki maloomat hasil karein, qeematon ka muqabla karein, aur chat karein. Tamam data DRAP Pakistan se mustanad hai.",
  "hero.searchPlaceholder": "Dawai ka naam talash karein...",
  "hero.searchBtn": "Talash",
  "hero.stat1Num": "40+",
  "hero.stat1Label": "Mustanad Dawain",
  "hero.stat2Num": "3",
  "hero.stat2Label": "Zabanain",
  "hero.stat3Num": "100%",
  "hero.stat3Label": "Muft istemaal",
  "hero.drapBadge": "DRAP Mustanad Data",
  "category.title": "Zamray ke mutabiq dekhein",
  "category.subtitle": "Aham therapeutic zamron mein mustanad dawai database ka mutala karein",
  "howItWorks.title": "Yeh Kaise Kaam Karta Hai",
  "howItWorks.subtitle": "Mustanad dawai ki maloomat hasil karne ke teen aasan maraahl",
  "howItWorks.step1Title": "Upload ya Talash",
  "howItWorks.step1Desc": "Nuskha ki tasveer upload karein ya dawai ka naam likh kar fori shuru karein",
  "howItWorks.step2Title": "AI Extraction aur Matching",
  "howItWorks.step2Desc": "Hamara AI nuskha parhta hai aur mustanad DRAP database ke saath muqabla karta hai",
  "howItWorks.step3Title": "Natayj Hasil Karein",
  "howItWorks.step3Desc": "Tafseeli maloomat dekhein, qeematon ka muqabla karein, aur apni pasand ki zaban mein chat karein",
  "features.title": "Aham Khubiyan",
  "features.subtitle": "Hifazat aur durustagi ko bunyad bana kar tayar kiya gaya",
  "features.ocr": "Nuskha OCR",
  "features.ocrDesc": "Hath se likhay aur chapay huay nuskho ke liye AI se chalne wali tasveer parhayi",
  "features.price": "Qeemat ka Muqabla",
  "features.priceDesc": "Mustanad pharmacy sources mein DRAP se munazzam qeematon ka muqabla karein",
  "features.chat": "Chand Zabani Chat",
  "features.chatDesc": "Angrezi, Urdu ya Roman Urdu mein AI se chat karein",
  "features.safety": "Hifazat Sab Se Pehle",
  "features.safetyDesc": "Na tashkhees, na nuskha. Tamam haqayq mustanad zarya se mustanad",
  "chat.sectionBadge": "AI se chalne wala",
  "chat.sectionTitle": "Afiya AI se Chat Karein",
  "chat.sectionSubtitle": "Apni pasand ki zaban mein dawaiyon ke baare mein sawalat poochein.",
  "chat.headerTitle": "Afiya AI Chat",
  "chat.headerStatus": "Online \u00b7 Mustanad data se madad",
  "chat.emptyTitle": "Dawaiyon ke baare mein kuch bhi poochein",
  "chat.emptySubtitle": "Tamam jawabat mustanad DRAP data aur tibbi ilm se madad hain",
  "chat.inputPlaceholder": "Dawai ke baare mein poochein...",
  "chat.errorMsg": "Maaf kijiye, kharabi aa gayi. Barah-e-meharbani dobara koshish karein.",
  "chat.suggestion1": "Panadol kis liye istemaal hoti hai?",
  "chat.suggestion2": "Augmentin ke baare mein batayein",
  "chat.suggestion3": "Brufen ke zaruraat?",
  "chat.suggestion4": "Metformin kaise lein?",
  "results.backHome": "Home par wapis",
  "results.backResults": "Natayj par wapis",
  "results.viewInfo": "Maloomat dekhein",
  "results.comparePrices": "Qeematon ka muqabla",
  "results.form": "Shakal",
  "results.category": "Zamra",
  "results.manufacturer": "Bani",
  "upload.title": "Nuskha Upload Karein",
  "upload.titleDrag": "Apna nuskha yahan chhorrein",
  "upload.subtitle": "Drag & drop ya click karke dekhein",
  "upload.hint": "JPEG, PNG, ya WebP \u2022 Zyada se zyada 10MB",
  "upload.changeImage": "Tasveer badalne ke liye click karein",
  "upload.extracting": "Dawaiyan nikaal rahi hain...",
  "upload.invalidType": "Barah-e-meharbani JPEG, PNG, ya WebP tasveer upload karein.",
  "upload.tooLarge": "File bohat bari hai. Zyada se zyada 10MB.",
  "footer.disclaimerTitle": "Tibbi Dawiya Bayan",
  "footer.drapVerified": "Mustanad DRAP Data",
  "footer.builtFor": "Pakistan ke liye tameer",
  "footer.safetyFirst": "Hifazat Sab Se Pehle",
  "disclaimer.label": "Dawiyah Bayan:",
  "loading.text": "Aap ki darkhwast par karrawai ho rahi hai...",
  "error.noMatch": "Humare database mein koi muwafiq dawai nahin mili.",
  "error.searchFailed": "Talash nakaam",
  "error.loadInfo": "Maloomat load nahin ho saken",
  "error.loadPrices": "Qeematein load nahin ho saken",
  "info.cheapestTitle": "Is dawai ke saste brands",
  "info.cheapestSubtitle": "Ek hi generic aur taqat, fi unit qeemat ka muqabla",
  "info.cheapestBadge": "Sab se sasta",
  "info.yourMedicine": "Aap ki dawai",
  "info.packPrice": "Pack qeemat",
  "info.packSize": "Pack size",
  "info.perUnit": "fi unit",
  "info.save": "Bachat",
  "info.vsYours": "aap ki dawai ke muqable",
  "info.consultPharmacist": "Brand badalne se pehle pharmacist se mashwara karein.",
  "mrp.title": "Sarkari MRP se qeemat check karein",
  "mrp.subtitle": "Aap ne jo qeemat di us ka DRAP ki muqarrara MRP se muqabla karein",
  "mrp.inputLabel": "Aap ne jo qeemat di (PKR)",
  "mrp.placeholder": "Masalan 250",
  "mrp.invalidPrice": "Barah-e-meharbani 0 se zyada qeemat darj karein.",
  "mrp.checkBtn": "Qeemat check karein",
  "mrp.checking": "Check ho raha hai...",
  "mrp.error": "Qeemat ki jaanch nakaam ho gayi. Barah-e-meharbani dobara koshish karein.",
  "mrp.confirmPrompt": "Barah-e-meharbani confirm karein ke aap ki murad kaun si dawai hai:",
  "mrp.paidLabel": "Aap ne diye",
  "mrp.mrpLabel": "Sarkari MRP",
  "mrp.overchargeLabel": "Zyada li gayi raqam",
  "mrp.effectiveLabel": "MRP naafiz hone ki tareekh",
  "mrp.packLabel": "Pack size",
  "mrp.sourceLabel": "Source",
};

export const translations: Record<"en" | "ur" | "roman_ur", TranslationMap> = {
  en,
  ur,
  roman_ur: romanUr,
};

/** Helper to get a translation by key and language */
export function t(lang: "en" | "ur" | "roman_ur", key: TranslationKey): string {
  return translations[lang]?.[key] ?? translations.en[key] ?? key;
}
