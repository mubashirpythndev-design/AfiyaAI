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
  | "ocr.extractedTitle"
  | "ocr.foundCount"
  | "ocr.available"
  | "ocr.unavailable"
  | "ocr.availableDesc"
  | "ocr.unavailableDesc"
  | "ocr.directions"
  | "form.injection"
  | "form.capsule"
  | "form.tablet"
  | "form.syrup"
  | "form.suspension"
  | "form.inhaler"
  | "form.drops"
  | "form.cream"
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
  | "mrp.sourceLabel"
  // Auth: email + password sign-up / sign-in
  | "nav.signIn"
    | "nav.signOut"
    | "auth.title"
    | "auth.subtitle"
    | "auth.signInTab"
    | "auth.signUpTab"
    | "auth.nameLabel"
    | "auth.namePlaceholder"
    | "auth.emailLabel"
    | "auth.emailPlaceholder"
    | "auth.passwordLabel"
    | "auth.passwordHint"
    | "auth.signInBtn"
    | "auth.signUpBtn"
    | "auth.signingIn"
    | "auth.creating"
    | "auth.switchToSignUp"
    | "auth.switchToSignIn"
    | "auth.errorGeneric"
    | "auth.sessionExpired"
    | "auth.searchRequired"
    | "auth.categoryRequired"
    | "auth.uploadRequired"
    | "auth.infoRequired";

type TranslationMap = Record<TranslationKey, string>;

const en: TranslationMap = {
  "nav.features": "Features",
  "nav.howItWorks": "How it Works",
  "hero.badge": "DRAP-Aligned Comparison Dataset",
  "hero.title1": "Your Intelligent",
  "hero.titleHighlight": "Medicine",
  "hero.title2": "Assistant",
  "hero.description": "Upload a prescription, get instant medicine information, compare prices, and chat in English, Urdu, or Roman Urdu. DRAP-aligned comparison dataset — verify current availability and prices with official sources.",
  "hero.searchPlaceholder": "Search a medicine name...",
  "hero.searchBtn": "Search",
  "hero.stat1Num": "100+",
  "hero.stat1Label": "Comparison Medicines",
  "hero.stat2Num": "3",
  "hero.stat2Label": "Languages",
  "hero.stat3Num": "100%",
  "hero.stat3Label": "Free to Use",
  "hero.drapBadge": "DRAP Baseline Dataset",
  "category.title": "Browse by Category",
  "category.subtitle": "Explore our verified medicine database across major therapeutic categories",
  "howItWorks.title": "How It Works",
  "howItWorks.subtitle": "Three simple steps to get verified medicine information",
  "howItWorks.step1Title": "Upload or Search",
  "howItWorks.step1Desc": "Upload a prescription image or type a medicine name to get started instantly",
  "howItWorks.step2Title": "AI Extraction & Matching",
  "howItWorks.step2Desc": "Our AI reads the prescription and matches medicines against our DRAP-aligned reference database",
  "howItWorks.step3Title": "Get Results",
  "howItWorks.step3Desc": "View detailed info, compare prices across sources, and chat in your preferred language",
  "features.title": "Key Features",
  "features.subtitle": "Built with safety and accuracy at its core",
  "features.ocr": "Prescription OCR",
  "features.ocrDesc": "AI-powered image reading for handwritten and printed prescriptions",
  "features.price": "Price Comparison",
  "features.priceDesc": "Compare retail pharmacy prices against the DRAP reference baseline",
  "features.chat": "Multilingual Chat",
  "features.chatDesc": "Chat in English, Urdu, or Roman Urdu with grounded AI responses",
  "features.safety": "Safety First",
  "features.safetyDesc": "No diagnosis, no prescribing. All facts verified from authoritative sources",
  "chat.sectionBadge": "AI-Powered",
  "chat.sectionTitle": "Chat with Afiya AI",
  "chat.sectionSubtitle": "Ask questions about medicines in your preferred language. All responses are grounded in verified data.",
  "chat.headerTitle": "Afiya AI Chat",
  "chat.headerStatus": "Online · Grounded in verified data",
  "chat.emptyTitle": "Ask me anything about medicines",
  "chat.emptySubtitle": "All responses are grounded in verified medicine information and DRAP-aligned reference data",
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
  "ocr.extractedTitle": "Extracted Medicines",
  "ocr.foundCount": "Found in Prescription",
  "ocr.available": "Ready for comparison",
  "ocr.unavailable": "Review required / unmatched",
  "ocr.availableDesc": "DRAP-aligned comparison record — clinical info, price comparisons, and alternatives available.",
  "ocr.unavailableDesc": "Not currently in our comparison medicines database. You can search manually or consult your physician.",
  "ocr.directions": "Directions",
  "form.injection": "Injection",
  "form.capsule": "Capsule",
  "form.tablet": "Tablet",
  "form.syrup": "Syrup",
  "form.suspension": "Suspension",
  "form.inhaler": "Inhaler",
  "form.drops": "Drops",
  "form.cream": "Cream / Ointment",
  "footer.disclaimerTitle": "Medical Disclaimer",
  "footer.drapVerified": "DRAP-Aligned Baseline",
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
  "mrp.title": "Check price vs DRAP reference baseline",
  "mrp.subtitle": "Compare what you paid with the DRAP-aligned reference Maximum Retail Price (Official SRO required for statutory enforcement)",
  "mrp.inputLabel": "Price you paid (PKR)",
  "mrp.placeholder": "e.g. 250",
  "mrp.invalidPrice": "Please enter a price greater than 0.",
  "mrp.checkBtn": "Check price",
  "mrp.checking": "Checking...",
  "mrp.error": "Price check failed. Please try again.",
  "mrp.confirmPrompt": "Please confirm which medicine you mean:",
  "mrp.paidLabel": "You paid",
  "mrp.mrpLabel": "DRAP Reference MRP",
  "mrp.overchargeLabel": "Overcharge amount",
  "mrp.effectiveLabel": "MRP effective from",
  "mrp.packLabel": "Pack size",
  "mrp.sourceLabel": "Source",
  // Auth: email + password sign-up / sign-in
  "nav.signIn": "Sign in",
  "nav.signOut": "Sign out",
  "auth.title": "Sign in to continue",
  "auth.subtitle": "Viewing medicine info and comparing prices requires a free account.",
  "auth.signInTab": "Sign in",
  "auth.signUpTab": "Sign up",
  "auth.nameLabel": "Name",
  "auth.namePlaceholder": "Your full name",
  "auth.emailLabel": "Email",
  "auth.emailPlaceholder": "you@example.com",
  "auth.passwordLabel": "Password",
  "auth.passwordHint": "At least 8 characters",
  "auth.signInBtn": "Sign in",
  "auth.signUpBtn": "Create account",
  "auth.signingIn": "Signing in...",
  "auth.creating": "Creating account...",
  "auth.switchToSignUp": "New here? Create an account",
  "auth.switchToSignIn": "Already have an account? Sign in",
  "auth.errorGeneric": "Something went wrong. Please try again.",
  "auth.sessionExpired": "Your session expired. Please sign in again.",
  "auth.searchRequired": "Please sign in or sign up first to search medicines.",
  "auth.categoryRequired": "Please sign in or sign up first to browse medicines by category.",
  "auth.uploadRequired": "Please sign in or sign up first to upload and scan prescriptions.",
  "auth.infoRequired": "Please sign in or sign up first to view detailed medicine information and price comparisons.",
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
  "hero.stat1Num": "100+",
  "hero.stat1Label": "\u062A\u0642\u0627\u0628\u0644 \u06A9\u06CC \u062F\u0648\u0627\u0626\u06CC\u06BA",
  "hero.stat2Num": "\u06F3",
  "hero.stat2Label": "\u0632\u0628\u0627\u0646\u06CC\u06BA",
  "hero.stat3Num": "\u06F1\u06F0\u06F0\u066A",
  "hero.stat3Label": "\u0645\u0641\u062A \u0627\u0633\u062A\u0639\u0645\u0627\u0644",
  "hero.drapBadge": "DRAP \u0628\u06CC\u0633 \u0644\u0627\u0626\u0646 \u0688\u06CC\u0679\u0627",
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
  "ocr.extractedTitle": "\u0646\u0633\u062E\u06D2 \u0633\u06D2 \u0646\u06A9\u0627\u0644\u06CC \u06AF\u0626\u06CC \u062F\u0648\u0627\u0626\u06CC\u06BA",
  "ocr.foundCount": "\u0646\u0633\u062E\u06D2 \u0645\u06CC\u06BA \u062F\u0631\u06CC\u0627\u0641\u062A \u0634\u062F\u06C1",
  "ocr.available": "\u0688\u06CC\u0679\u0627 \u0628\u06CC\u0633 \u0645\u06CC\u06BA \u062F\u0633\u062A\u06CC\u0627\u0628",
  "ocr.unavailable": "\u0688\u06CC\u0679\u0627 \u0628\u06CC\u0633 \u0645\u06CC\u06BA \u0645\u0648\u062C\u0648\u062F \u0646\u06C1\u06CC\u06BA",
  "ocr.availableDesc": "ڈیٹا بیس کا حوالہ — معلومات اور قیمتوں کا موازنہ دستیاب ہے۔",
  "ocr.unavailableDesc": "یہ دوا ہماری 100+ تقابل شدہ فہرست میں نہیں ملی۔ براہ مہربانی ڈاکٹر سے رجوع کریں۔",
  "ocr.directions": "طریقہ استعمال / ہدایات",
  "form.injection": "انجکشن",
  "form.capsule": "کیپسول",
  "form.tablet": "گولی (ٹیبلٹ)",
  "form.syrup": "شربت (سیرپ)",
  "form.suspension": "معلق شربت (سسپنشن)",
  "form.inhaler": "انہیلر",
  "form.drops": "قطرے",
  "form.cream": "مرہم / کریم",
  "footer.disclaimerTitle": "طبی دعویٰ بیان",
  "footer.drapVerified": "DRAP \u06A9\u06D2 \u0645\u0637\u0627\u0628\u0642 \u0688\u06CC\u0679\u0627",
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
  "mrp.title": "DRAP حوالہ پر مبنی ایم آر پی سے قیمت چیک کریں",
  "mrp.subtitle": "آپ نے جو قیمت ادا کی اس کا DRAP کے ہم آہنگ حوالہ ایم آر پی سے موازنہ کریں (قانونی نفاذ کے لیے سرکاری SRO کا حوالہ درکار ہے)",
  "mrp.inputLabel": "آپ نے جو قیمت ادا کی (روپے)",
  "mrp.placeholder": "مثلاً 250",
  "mrp.invalidPrice": "براہ مہربانی 0 سے زیادہ قیمت درج کریں۔",
  "mrp.checkBtn": "قیمت چیک کریں",
  "mrp.checking": "چیک ہو رہا ہے...",
  "mrp.error": "قیمت کی جانچ ناکام ہو گئی۔ براہ مہربانی دوبارہ کوشش کریں۔",
  "mrp.confirmPrompt": "براہ مہربانی تصدیق کریں کہ آپ کی مراد کون سی دوا ہے:",
  "mrp.paidLabel": "آپ نے ادا کیے",
  "mrp.mrpLabel": "DRAP حوالہ ایم آر پی",
  "mrp.overchargeLabel": "\u0632\u06CC\u0627\u062F\u06C1 \u0644\u06CC \u06AF\u0626\u06CC \u0631\u0642\u0645",
  "mrp.effectiveLabel": "\u0627\u06CC\u0645 \u0622\u0631 \u067E\u06CC \u0646\u0627\u0641\u0630 \u0627\u0644\u0639\u0645\u0644 \u062A\u0627\u0631\u06CC\u062E",
  "mrp.packLabel": "\u067E\u06CC\u06A9 \u0633\u0627\u0626\u0632",
  "mrp.sourceLabel": "\u0630\u0631\u06CC\u0639\u06C1",
  // Auth: email + password sign-up / sign-in
  "nav.signIn": "\u0644\u0627\u06AF \u0627\u06CC\u0646",
  "nav.signOut": "\u0644\u0627\u06AF \u0622\u0624\u0679",
  "auth.title": "\u062C\u0627\u0631\u06CC \u0631\u06A9\u06BE\u0646\u06D2 \u06A9\u06D2 \u0644\u06CC\u06D2 \u0644\u0627\u06AF \u0627\u06CC\u0646 \u06A9\u0631\u06CC\u06BA",
  "auth.subtitle": "\u062F\u0648\u0627 \u06A9\u06CC \u0645\u0639\u0644\u0648\u0645\u0627\u062A \u062F\u06CC\u06A9\u06BE\u0646\u06D2 \u0627\u0648\u0631 \u0642\u06CC\u0645\u062A\u0648\u06BA \u06A9\u06D2 \u0645\u0648\u0627\u0632\u0646\u06D2 \u06A9\u06D2 \u0644\u06CC\u06D2 \u0645\u0641\u062A \u0627\u06A9\u0627\u0624\u0646\u0679 \u062F\u0631\u06A9\u0627\u0631 \u06C1\u06D2\u06D4",
  "auth.signInTab": "\u0644\u0627\u06AF \u0627\u06CC\u0646",
  "auth.signUpTab": "\u0627\u06A9\u0627\u0624\u0646\u0679 \u0628\u0646\u0627\u0626\u06CC\u06BA",
  "auth.nameLabel": "\u0646\u0627\u0645",
  "auth.namePlaceholder": "\u0622\u067E \u06A9\u0627 \u067E\u0648\u0631\u0627 \u0646\u0627\u0645",
  "auth.emailLabel": "\u0627\u06CC \u0645\u06CC\u0644",
  "auth.emailPlaceholder": "you@example.com",
  "auth.passwordLabel": "\u067E\u0627\u0633 \u0648\u0631\u0688",
  "auth.passwordHint": "\u06A9\u0645 \u0627\u0632 \u06A9\u0645 8 \u062D\u0631\u0648\u0641",
  "auth.signInBtn": "\u0644\u0627\u06AF \u0627\u06CC\u0646 \u06A9\u0631\u06CC\u06BA",
  "auth.signUpBtn": "\u0627\u06A9\u0627\u0624\u0646\u0679 \u0628\u0646\u0627\u0626\u06CC\u06BA",
  "auth.signingIn": "\u0644\u0627\u06AF \u0627\u06CC\u0646 \u06C1\u0648 \u0631\u06C1\u0627 \u06C1\u06D2...",
  "auth.creating": "\u0627\u06A9\u0627\u0624\u0646\u0679 \u0628\u0646 \u0631\u06C1\u0627 \u06C1\u06D2...",
  "auth.switchToSignUp": "\u0646\u0626\u06D2 \u06C1\u06CC\u06BA\u061F \u0627\u06A9\u0627\u0624\u0646\u0679 \u0628\u0646\u0627\u0626\u06CC\u06BA",
  "auth.switchToSignIn": "\u067E\u06C1\u0644\u06D2 \u0633\u06D2 \u0627\u06A9\u0627\u0624\u0646\u0679 \u06C1\u06D2\u061F \u0644\u0627\u06AF \u0627\u06CC\u0646 \u06A9\u0631\u06CC\u06BA",
  "auth.errorGeneric": "کچھ غلط ہو گیا۔ براہ مہربانی دوبارہ کوشش کریں۔",
  "auth.sessionExpired": "آپ کا سیشن ختم ہو گیا ہے۔ براہ مہربانی دوبارہ لاگ ان کریں۔",
  "auth.searchRequired": "ادویات تلاش کرنے کے لیے پہلے سائن ان یا سائن اپ کریں۔",
  "auth.categoryRequired": "کیٹیگری کے مطابق ادویات دیکھنے کے لیے پہلے سائن ان یا سائن اپ کریں۔",
  "auth.uploadRequired": "نسخہ (Prescription) اپلوڈ اور اسکین کرنے کے لیے پہلے سائن ان یا سائن اپ کریں۔",
  "auth.infoRequired": "دوا کی مکمل تفصیلات اور قیمتوں کا موازنہ دیکھنے کے لیے پہلے سائن ان یا سائن اپ کریں۔",
};

const romanUr: TranslationMap = {
  "nav.features": "Khubiyan",
  "nav.howItWorks": "Yeh kaise kaam karta hai",
  "hero.badge": "DRAP-Aligned Comparison Dataset",
  "hero.title1": "Aap ka zaheen",
  "hero.titleHighlight": "Dawai",
  "hero.title2": "Madadgaar",
  "hero.description": "Nuskha app load karein, fori dawai ki maloomat hasil karein, qeematon ka muqabla karein, aur chat karein. Tamam data DRAP Pakistan se mustanad hai.",
  "hero.searchPlaceholder": "Dawai ka naam talash karein...",
  "hero.searchBtn": "Talash",
  "hero.stat1Num": "100+",
  "hero.stat1Label": "Comparison Dawain",
  "hero.stat2Num": "3",
  "hero.stat2Label": "Zabanain",
  "hero.stat3Num": "100%",
  "hero.stat3Label": "Muft istemaal",
  "hero.drapBadge": "DRAP Baseline Data",
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
  "ocr.extractedTitle": "Nuskhay se nikali gayi dawaiyan",
  "ocr.foundCount": "Nuskhay mein daryaft shuda",
  "ocr.available": "Database mein dastiyab",
  "ocr.unavailable": "Review zaroori / match nahi mila",
  "ocr.availableDesc": "Catalog reference — maloomat aur qeematon ka muqabla dastiyab hai.",
  "ocr.unavailableDesc": "Yeh dawai hamari 100+ comparison list mein nahi mili. Barah-e-karam doctor se rujoo karein.",
  "ocr.directions": "Tariqa-e-Istemal / Hidayat",
  "form.injection": "Injection",
  "form.capsule": "Capsule",
  "form.tablet": "Goli (Tablet)",
  "form.syrup": "Sharbat (Syrup)",
  "form.suspension": "Suspension",
  "form.inhaler": "Inhaler",
  "form.drops": "Qatre (Drops)",
  "form.cream": "Marham / Cream",
  "footer.disclaimerTitle": "Tibbi Dawiya Bayan",
  "footer.drapVerified": "DRAP-Aligned Data",
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
  "mrp.title": "DRAP reference baseline se qeemat check karein",
  "mrp.subtitle": "Aap ne jo qeemat di us ka DRAP-aligned reference MRP se muqabla karein (official SRO reference darkaar hai)",
  "mrp.inputLabel": "Aap ne jo qeemat di (PKR)",
  "mrp.placeholder": "Masalan 250",
  "mrp.invalidPrice": "Barah-e-meharbani 0 se zyada qeemat darj karein.",
  "mrp.checkBtn": "Qeemat check karein",
  "mrp.checking": "Check ho raha hai...",
  "mrp.error": "Qeemat ki jaanch nakaam ho gayi. Barah-e-meharbani dobara koshish karein.",
  "mrp.confirmPrompt": "Barah-e-meharbani confirm karein ke aap ki murad kaun si dawai hai:",
  "mrp.paidLabel": "Aap ne diye",
  "mrp.mrpLabel": "DRAP Reference MRP",
  "mrp.overchargeLabel": "Zyada li gayi raqam",
  "mrp.effectiveLabel": "MRP naafiz hone ki tareekh",
  "mrp.packLabel": "Pack size",
  "mrp.sourceLabel": "Source",
  // Auth: email + password sign-up / sign-in
  "nav.signIn": "Sign in",
  "nav.signOut": "Sign out",
  "auth.title": "Aagay barhne ke liye sign in karein",
  "auth.subtitle": "Dawai ki maloomat dekhne aur qeematon ka muqabla karne ke liye muft account zaroori hai.",
  "auth.signInTab": "Sign in",
  "auth.signUpTab": "Account banayein",
  "auth.nameLabel": "Naam",
  "auth.namePlaceholder": "Aap ka poora naam",
  "auth.emailLabel": "Email",
  "auth.emailPlaceholder": "you@example.com",
  "auth.passwordLabel": "Password",
  "auth.passwordHint": "Kam az kam 8 huroof",
  "auth.signInBtn": "Sign in karein",
  "auth.signUpBtn": "Account banayein",
  "auth.signingIn": "Sign in ho raha hai...",
  "auth.creating": "Account ban raha hai...",
  "auth.switchToSignUp": "Naye hain? Account banayein",
  "auth.switchToSignIn": "Pehle se account hai? Sign in karein",
  "auth.errorGeneric": "Kuch ghalat ho gaya. Barah-e-meharbani dobara koshish karein.",
  "auth.sessionExpired": "Aap ka session khatam ho gaya hai. Barah-e-meharbani dobara sign in karein.",
  "auth.searchRequired": "Dawaiyan talash karne ke liye pehle sign in ya sign up karein.",
  "auth.categoryRequired": "Category ke mutabiq dawaiyan dekhne ke liye pehle sign in ya sign up karein.",
  "auth.uploadRequired": "Nuskha (Prescription) upload aur scan karne ke liye pehle sign in ya sign up karein.",
  "auth.infoRequired": "Dawa ki mukammal tafseelat aur prices dekhne ke liye pehle sign in ya sign up karein.",
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

/** Expand cryptic doctor prescription shorthand (TDS, BD, 1-0-1, pc, ac, IV, IM, etc.) into clean human-friendly English */
export function humanizeDirections(raw: string, form?: string | null): string {
  if (!raw) return "";
  let t = raw.trim();

  // 1. Pre-clean nested and tautological parentheticals
  t = t.replace(/\(immediately\s*\((?:immediately\s*\(stat\)|stat)\)\)/gi, "");
  t = t.replace(/\(immediately\s*\(stat\)\)/gi, "");
  t = t.replace(/\(intramuscularly\s*\(IM\)\)/gi, "(IM)");
  t = t.replace(/\(once daily\s*\((?:once daily|od)\)\)/gi, "");
  t = t.replace(/\(at bedtime\s*\((?:at bedtime|hs)\)\)/gi, "");

  // Repeated parenthetical identicals and acronym tags
  t = t.replace(/\bonce daily\s*\(\s*(?:once daily|od)\s*\)/gi, "once daily");
  t = t.replace(/\bat bedtime\s*\(\s*(?:at bedtime|hs)\s*\)/gi, "at bedtime");
  t = t.replace(/\b2 times daily\s*\(\s*(?:2 times daily|bd)\s*\)/gi, "twice daily");
  t = t.replace(/\btwice daily\s*\(\s*(?:twice daily|bd)\s*\)/gi, "twice daily");
  t = t.replace(/\b3 times daily\s*\(\s*(?:3 times daily|tds)\s*\)/gi, "3 times daily");
  t = t.replace(/\b4 times daily\s*\(\s*(?:4 times daily|qds)\s*\)/gi, "4 times daily");
  t = t.replace(/\bas needed\s*\(\s*(?:as needed|sos)\s*\)/gi, "as needed");
  t = t.replace(/\bimmediately\s*\(\s*(?:immediately|stat)\s*\)/gi, "immediately");
  t = t.replace(/\bafter meals\s*\(\s*(?:after meals|pc)\s*\)/gi, "after meals");
  t = t.replace(/\bbefore meals\s*\(\s*(?:before meals|ac)\s*\)/gi, "before meals (empty stomach)");

  const isInjection = form?.toLowerCase() === "injection" || /\b(?:inj|injection|amp|vial|iv|im)\b/i.test(t) || /\b(?:inj|injection)\b/i.test(form || "");
  const isCapsule = form?.toLowerCase() === "capsule" || /\b(?:cap|capsule)\b/i.test(t);
  const isSyrup = form?.toLowerCase() === "syrup" || form?.toLowerCase() === "suspension" || /\b(?:syp|syrup|susp|tsp)\b/i.test(t);
  const isInhaler = form?.toLowerCase() === "inhaler" || /\b(?:inh|inhaler|puff)\b/i.test(t);
  const isDrops = form?.toLowerCase() === "drops" || /\b(?:drops?|gtts?)\b/i.test(t);

  const unitWord = isInjection ? "1 injection" : isCapsule ? "1 capsule" : isSyrup ? "1 teaspoon (5ml)" : isInhaler ? "2 puffs" : isDrops ? "2 drops" : "1 tablet";

  // Shorthand frequency digits (e.g. 1-1-1, 1-0-1, 1-0-0, 0-0-1)
  t = t.replace(/\b1-1-1\b/g, `${unitWord} 3 times daily (morning, afternoon & night)`);
  t = t.replace(/\b1-0-1\b/g, `${unitWord} twice daily (morning & night)`);
  t = t.replace(/\b1-0-0\b/g, `${unitWord} once daily in morning`);
  t = t.replace(/\b0-0-1\b/g, `${unitWord} at bedtime (night)`);
  t = t.replace(/\b0-1-0\b/g, `${unitWord} in afternoon`);

  // Injection specific administration
  if (isInjection) {
    if (!/\bintramuscular/i.test(t)) {
      t = t.replace(/\b(?:im|i\.m\.)\b/gi, "Intramuscular (IM)");
    } else {
      t = t.replace(/\b(?:im|i\.m\.)\b/gi, "IM");
      t = t.replace(/\bIntramuscular\s*\(IM\)/gi, "Intramuscular (IM)");
    }
    if (!/\bintravenous/i.test(t)) {
      t = t.replace(/\b(?:iv|i\.v\.)\b/gi, "Intravenous (IV)");
    }
    t = t.replace(/\b(?:amp|ampoule)s?\b/gi, "ampoule");
    t = t.replace(/\bvials?\b/gi, "vial");
  }

  // Latin clinical frequency abbreviations
  t = t.replace(/\b(?:tds|tid|t\.d\.s\.)\b/gi, "3 times daily");
  t = t.replace(/\b(?:bd|bid|b\.i\.d\.)\b/gi, "twice daily");
  t = t.replace(/\b(?:od|qd|o\.d\.)\b/gi, "once daily");
  t = t.replace(/\b(?:qds|qid|q\.d\.s\.)\b/gi, "4 times daily");
  t = t.replace(/\b(?:hs|h\.s\.)\b/gi, "at bedtime");
  t = t.replace(/\b(?:sos|prn|p\.r\.n\.)\b/gi, "as needed");
  t = t.replace(/\bstat\b/gi, "immediately");

  // Meal timing abbreviations
  t = t.replace(/\b(?:pc|p\.c\.)\b/gi, "after meals");
  t = t.replace(/\b(?:ac|a\.c\.)\b/gi, "before meals (empty stomach)");
  t = t.replace(/\b(?:bbf|b\.b\.f\.)\b/gi, "before breakfast (empty stomach)");
  t = t.replace(/\bafter food\b/gi, "after meals");
  t = t.replace(/\bbefore food\b/gi, "before meals");

  // Durations (e.g. x 5/7, 5/7, x 5d, x 2/52)
  t = t.replace(/(?:x|for)?\s*(\d+)\s*\/\s*7\b/gi, "for $1 days");
  t = t.replace(/(?:x|for)?\s*(\d+)\s*d(?:ays)?\b/gi, "for $1 days");
  t = t.replace(/(?:x|for)?\s*(\d+)\s*\/\s*52\b/gi, "for $1 weeks");
  t = t.replace(/(?:x|for)?\s*(\d+)\s*\/\s*12\b/gi, "for $1 months");

  // Clean 'once daily (morning)' -> 'once daily in the morning'
  t = t.replace(/\bonce daily\s*\(morning\)/gi, "once daily in the morning");
  t = t.replace(/\bat bedtime\s*\(night\)/gi, "at bedtime");

  // Deduplicate repeated phrases across the whole string
  const dedupePhrases = [
    "once daily in the morning",
    "once daily in morning",
    "once daily",
    "twice daily",
    "3 times daily",
    "4 times daily",
    "at bedtime",
    "immediately",
    "as needed",
    "after meals",
    "before meals",
  ];

  for (const phrase of dedupePhrases) {
    const regex = new RegExp("\\b" + phrase.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&") + "\\b", "gi");
    let count = 0;
    t = t.replace(regex, (match) => {
      count++;
      return count === 1 ? match : "";
    });
  }

  // Dosage units and forms
  if (!isInjection && !isCapsule && !isSyrup && !isInhaler && !isDrops) {
    t = t.replace(/\b1\s*tab\b/gi, "1 tablet");
    t = t.replace(/\b(\d+)\s*tabs\b/gi, "$1 tablets");
  } else if (isCapsule) {
    t = t.replace(/\b1\s*(?:tab|cap)\b/gi, "1 capsule");
    t = t.replace(/\b(\d+)\s*(?:tabs|caps)\b/gi, "$1 capsules");
  } else if (isInjection) {
    t = t.replace(/\b1\s*(?:tab|amp|vial)\b/gi, "1 ampoule/vial");
  }

  t = t.replace(/\b1\s*cap\b/gi, "1 capsule");
  t = t.replace(/\b(\d+)\s*caps\b/gi, "$1 capsules");
  t = t.replace(/\b1\s*tsp\b/gi, "1 teaspoon (5ml)");
  t = t.replace(/\b(\d+)\s*tsps\b/gi, "$1 teaspoons");

  // Clean duplicate unit words
  t = t.replace(/\b(1 tablet|1 capsule|1 injection)\s+\1\b/gi, "$1");

  // Clean duplicate "for for" or consecutive spaces
  t = t.replace(/\bfor\s+for\b/gi, "for");
  t = t.replace(/(for \d+ days)\s+\1/gi, "$1");

  // Clean up empty parens and punctuation artifacts
  t = t.replace(/\(\s*\)/g, "");
  t = t.replace(/\s+([,\.\)])/g, "$1");
  t = t.replace(/\(\s+/g, "(");
  t = t.replace(/\s+/g, " ").trim();

  return t;
}

/** Localize clinical prescription directions into clear, patient-friendly English, Urdu, and Roman Urdu */
export function localizeDirections(text: string, lang: "en" | "ur" | "roman_ur", form?: string | null): string {
  if (!text) return "";
  const en = humanizeDirections(text, form);
  if (lang === "en") return en;

  let res = en;
  if (lang === "ur") {
    res = res
      .replace(/Intramuscular \(IM\) injection administered immediately as a single dose/gi, "پٹھے / گوشت میں (IM) انجکشن فوری طور پر ایک خوراک کے طور پر لگائیں")
      .replace(/3 times daily \(morning, afternoon & night\)/gi, "دن میں 3 بار (صبح، دوپہر اور رات)")
      .replace(/twice daily \(morning & night\)/gi, "دن میں 2 بار (صبح اور رات)")
      .replace(/3 times daily/gi, "دن میں 3 بار")
      .replace(/twice daily/gi, "دن میں 2 بار (صبح اور رات)")
      .replace(/2 times daily/gi, "دن میں 2 بار (صبح اور رات)")
      .replace(/once daily in the morning/gi, "روزانہ صبح 1 بار")
      .replace(/once daily in morning/gi, "روزانہ صبح 1 بار")
      .replace(/once daily/gi, "روزانہ 1 بار")
      .replace(/4 times daily/gi, "دن میں 4 بار")
      .replace(/at bedtime \(night\)/gi, "رات کو سوتے وقت")
      .replace(/at bedtime/gi, "رات کو سوتے وقت")
      .replace(/at night/gi, "رات کو")
      .replace(/in morning/gi, "صبح کے وقت")
      .replace(/in afternoon/gi, "دوپہر کے وقت")
      .replace(/as needed/gi, "ضرورت پڑنے پر")
      .replace(/immediately \(stat\)/gi, "فوری طور پر (stat)")
      .replace(/immediately/gi, "فوری طور پر")
      .replace(/Intramuscular \(IM\)/gi, "پٹھے / گوشت میں (IM)")
      .replace(/intramuscularly \(IM\)/gi, "پٹھے / گوشت میں (IM)")
      .replace(/Intravenous \(IV\)/gi, "رگ میں (IV)")
      .replace(/intravenously \(IV\)/gi, "رگ میں (IV)")
      .replace(/ampoule/gi, "ایمپول")
      .replace(/vial/gi, "وائل")
      .replace(/1 injection/gi, "1 انجکشن")
      .replace(/after meals/gi, "کھانے کے بعد")
      .replace(/before meals \(empty stomach\)/gi, "نہار منہ (کھانے سے پہلے)")
      .replace(/before meals/gi, "کھانے سے پہلے")
      .replace(/before breakfast \(empty stomach\)/gi, "ناشتے سے پہلے (نہار منہ)")
      .replace(/before breakfast/gi, "ناشتے سے پہلے")
      .replace(/with meals/gi, "کھانے کے ساتھ")
      .replace(/with water/gi, "پانی کے ساتھ")
      .replace(/for (\d+) days/gi, "$1 دن کے لیے")
      .replace(/for (\d+) weeks/gi, "$1 ہفتوں کے لیے")
      .replace(/for (\d+) months/gi, "$1 مہینے کے لیے")
      .replace(/\b1 tablet\b/gi, "1 گولی")
      .replace(/\b(\d+) tablets\b/gi, "$1 گولیاں")
      .replace(/\b1 capsule\b/gi, "1 کیپسول")
      .replace(/\b(\d+) capsules\b/gi, "$1 کیپسول")
      .replace(/\b1 teaspoon \(5ml\)\b/gi, "1 چائے کا چمچ (5 ملی لیٹر)")
      .replace(/\b1 teaspoon\b/gi, "1 چائے کا چمچ")
      .replace(/\b(\d+) teaspoons\b/gi, "$1 چمچ")
      .replace(/\b(\d+) puffs?\b/gi, "$1 پف")
      .replace(/\b(\d+) drops?\b/gi, "$1 قطرے");
  } else if (lang === "roman_ur") {
    res = res
      .replace(/Intramuscular \(IM\) injection administered immediately as a single dose/gi, "muscle / gosht mein (IM) injection fori tor par single dose ke tor par lagayein")
      .replace(/3 times daily \(morning, afternoon & night\)/gi, "din mein 3 martaba (subah, dopahar aur raat)")
      .replace(/twice daily \(morning & night\)/gi, "din mein 2 martaba (subah aur raat)")
      .replace(/3 times daily/gi, "din mein 3 martaba")
      .replace(/twice daily/gi, "din mein 2 martaba (subah aur raat)")
      .replace(/2 times daily/gi, "din mein 2 martaba (subah aur raat)")
      .replace(/once daily in the morning/gi, "rozana subah 1 martaba")
      .replace(/once daily in morning/gi, "rozana subah 1 martaba")
      .replace(/once daily/gi, "rozana 1 martaba")
      .replace(/4 times daily/gi, "din mein 4 martaba")
      .replace(/at bedtime \(night\)/gi, "raat ko sotay waqt")
      .replace(/at bedtime/gi, "raat ko sotay waqt")
      .replace(/at night/gi, "raat ko")
      .replace(/in morning/gi, "subah ke waqt")
      .replace(/in afternoon/gi, "dopahar ke waqt")
      .replace(/as needed/gi, "zaroorat parne par")
      .replace(/immediately \(stat\)/gi, "fori tor par (stat)")
      .replace(/immediately/gi, "fori tor par")
      .replace(/Intramuscular \(IM\)/gi, "muscle / gosht mein (IM)")
      .replace(/intramuscularly \(IM\)/gi, "muscle / gosht mein (IM)")
      .replace(/Intravenous \(IV\)/gi, "vein / ragg mein (IV)")
      .replace(/intravenously \(IV\)/gi, "vein / ragg mein (IV)")
      .replace(/ampoule/gi, "ampoule")
      .replace(/vial/gi, "vial")
      .replace(/1 injection/gi, "1 injection")
      .replace(/after meals/gi, "khaney ke baad")
      .replace(/before meals \(empty stomach\)/gi, "niharr munh (khaney se pehle)")
      .replace(/before meals/gi, "khaney se pehle")
      .replace(/before breakfast \(empty stomach\)/gi, "nashtay se pehle (niharr munh)")
      .replace(/before breakfast/gi, "nashtay se pehle")
      .replace(/with meals/gi, "khaney ke saath")
      .replace(/with water/gi, "paani ke saath")
      .replace(/for (\d+) days/gi, "$1 din ke liye")
      .replace(/for (\d+) weeks/gi, "$1 hafton ke liye")
      .replace(/for (\d+) months/gi, "$1 mahine ke liye")
      .replace(/\b1 tablet\b/gi, "1 goli")
      .replace(/\b(\d+) tablets\b/gi, "$1 goliyan")
      .replace(/\b1 capsule\b/gi, "1 capsule")
      .replace(/\b(\d+) capsules\b/gi, "$1 capsules")
      .replace(/\b1 teaspoon \(5ml\)\b/gi, "1 chamach (5ml)")
      .replace(/\b1 teaspoon\b/gi, "1 chamach")
      .replace(/\b(\d+) teaspoons\b/gi, "$1 chamach")
      .replace(/\b(\d+) puffs?\b/gi, "$1 puffs")
      .replace(/\b(\d+) drops?\b/gi, "$1 qatre");
  }
  return res;
}
