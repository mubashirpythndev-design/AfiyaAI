import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "../apps/web/node_modules/typescript/lib/typescript.js";
const source = await readFile(new URL("../apps/web/src/lib/cabinetPrices.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { quantityPrices, previewCabinetBudget } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const pricing = { current: { pack_price_paisa: 9000, units_per_pack: 30 }, alternatives: [{ pack_price_paisa: 9000, units_per_pack: 30 }, { pack_price_paisa: 6000, units_per_pack: 30 }], comparison_available: true };
assert.equal(quantityPrices(1, pricing).proportionalCost, 3);
assert.equal(quantityPrices(10, pricing).proportionalCost, 30);
assert.equal(quantityPrices(20, pricing).proportionalCost, 60);
assert.equal(quantityPrices(30, pricing).proportionalCost, 90);
assert.equal(quantityPrices(40, pricing).proportionalCost, 120);
assert.equal(quantityPrices(40, pricing).wholePackCost, 180);
assert.equal(quantityPrices(40, pricing).packs, 2);
assert.equal(quantityPrices(3, { ...pricing, current: { pack_price_paisa: 100, units_per_pack: 3 } }).proportionalCost, 1); // no multiplying rounded per-unit prices
for (const value of [null, 0, -1, 1.5, NaN, Infinity, 100001]) assert.equal(quantityPrices(value, pricing), null);
assert.equal(quantityPrices(10, null), null);
const items = [{ medicine_id: "capsule", monthly_units: 10, pricing }, { medicine_id: "tablet", monthly_units: 10, pricing }];
assert.deepEqual(previewCabinetBudget(items, {}), { monthly_cost: 180, monthly_savings: 60, annual_savings: 720 });
assert.deepEqual(previewCabinetBudget(items, { capsule: 40 }), { monthly_cost: 270, monthly_savings: 90, annual_savings: 1080 });
assert.equal(previewCabinetBudget(items, { capsule: null }), null);
assert.equal(previewCabinetBudget([{ medicine_id: "unknown", monthly_units: 10 }], {}), null);
assert.equal(previewCabinetBudget([{ ...items[0], pricing: { ...pricing, comparison_available: false } }], {}), null);
assert.equal(previewCabinetBudget([{ ...items[0], pricing: { ...pricing, alternatives: [pricing.current] } }], {}).monthly_savings, 0);
console.log("PASS: live per-tablet, strip/pack quantities, money rounding, multi-item budget, savings and unknown prices");

// Render the actual selector: persisted strips must show their own price,
// while the complete-pack budget stays separately labeled.
const { createRequire } = await import("node:module");
const { fileURLToPath } = await import("node:url");
const requireWeb = createRequire(new URL("../apps/web/package.json", import.meta.url));
const React = requireWeb("react");
const { renderToStaticMarkup } = requireWeb("react-dom/server");
const Module = requireWeb("node:module");
const componentFile = fileURLToPath(new URL("../apps/web/src/components/medicine/CabinetQuantity.tsx", import.meta.url));
const componentSource = await readFile(componentFile, "utf8");
const componentJs = ts.transpileModule(componentSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const moduleObject = new Module(componentFile);
moduleObject.require = specifier => specifier === "@/lib/cabinetPrices" ? { quantityPrices } : specifier === "@/lib/api" ? { updateCabinetReminder: () => { throw new Error("SSR must not call the API"); } } : requireWeb(specifier);
moduleObject._compile(componentJs, componentFile);
const item = { medicine_id: "capsule", monthly_units: 40, monthly_quantity: 4, monthly_quantity_unit: "strip", package_size: "3x10's", pricing, quantity_options: [{ unit: "capsule", units_per_quantity: 1 }, { unit: "strip", units_per_quantity: 10 }, { unit: "pack", units_per_quantity: 30 }] };
const html = renderToStaticMarkup(React.createElement(moduleObject.exports.default, { item, language: "en", onSaved: async () => {}, onPreview: () => {} }));
assert.ok(html.includes("PKR 120.00"));
assert.ok(html.includes("PKR 180.00"));
assert.ok(html.includes("Price for selected quantity"));
assert.ok(html.includes("Whole packs needed"));
assert.ok(html.includes('value="strip" selected=""'));
console.log("PASS: actual cabinet selector renders 4 strips = PKR 120, with a separate PKR 180 whole-pack budget");
