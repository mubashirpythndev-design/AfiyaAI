import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";
import ts from "../apps/web/node_modules/typescript/lib/typescript.js";
const source=await readFile(new URL("../apps/web/src/lib/ocrReview.ts",import.meta.url),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {enrichOCRCandidates,mergeOCRRescan}=await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
const medicine={id:"panadol",brand_name:"Panadol",strength:"500mg",dosage_form:"Tablet"};
const match={medicine,confidence:1,needs_confirmation:false};
const base={raw_text:"Panadol 500mg Tablet",raw_line:"Panadol",confidence:.3,is_verified:false,reviewed:false};
let active=0,maxActive=0;
const matcher=async()=>{active++;maxActive=Math.max(active,maxActive);await new Promise(r=>setTimeout(r,5));active--;return match;};
const result=await enrichOCRCandidates(Array.from({length:9},(_,i)=>({...base,line_id:String(i)})),matcher);
assert.equal(maxActive,4);
assert.deepEqual(result.map(c=>c.line_id),Array.from({length:9},(_,i)=>String(i)));
assert.ok(result.every(c=>c.confidence===.3 && c.match_confidence===1 && !c.is_verified && c.needs_confirmation));
assert.equal((await enrichOCRCandidates([{...base,reviewed:true}],async()=>match))[0].is_verified,true);
for(const response of [{...match,needs_confirmation:true},{...match,lasa_warning:{confirmation_required:true}},{...match,strength_assessment:{status:"STRENGTH_MISMATCH"}},{...match,form_assessment:{status:"FORM_MISMATCH"}},{...match,medicine:null}]) {
 assert.equal((await enrichOCRCandidates([{...base,reviewed:true}],async()=>response))[0].is_verified,false);
}
assert.equal((await enrichOCRCandidates([base],async()=>{throw new Error("offline");}))[0].raw_text,base.raw_text);
await enrichOCRCandidates([{...base,unreadable:true}],async()=>{throw new Error("must not match unreadable placeholder");});
const old=[{...base,unreadable:true,bbox:[100,100,200,500]}, {...base,bbox:[500,100,600,500],reviewed:true,is_verified:true}];
const merged=mergeOCRRescan(old,[{...base,bbox:[100,100,200,500]},{...base,raw_text:"Brufen",bbox:[500,100,600,500]},{...base,bbox:[800,100,900,500]}]);
assert.equal(merged.length,3);assert.equal(merged[0].unreadable,undefined);
assert.equal(merged[1].raw_text,base.raw_text);assert.equal(merged[1].alternative_reading,"Brufen");assert.equal(merged[1].is_verified,false);
const overlapping = mergeOCRRescan([
 {...base,raw_text:"Alpha",bbox:[100,100,300,600]}, {...base,raw_text:"Beta",bbox:[250,100,450,600]},
], [{...base,raw_text:"Alpha",bbox:[150,100,350,600]}, {...base,raw_text:"Gamma",bbox:[180,100,380,600]}]);
assert.equal(overlapping.length,2);
assert.equal(overlapping[0].alternative_reading,undefined);
assert.equal(overlapping[1].alternative_reading,"Gamma");
const requireWeb=createRequire(new URL("../apps/web/package.json",import.meta.url));
const React=requireWeb("react");const {renderToStaticMarkup}=requireWeb("react-dom/server");const Module=requireWeb("node:module");
const file=fileURLToPath(new URL("../apps/web/src/components/upload/OCRReview.tsx",import.meta.url));
const compiled=ts.transpileModule(await readFile(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const progressFile=fileURLToPath(new URL("../apps/web/src/components/upload/PrescriptionScanProgress.tsx",import.meta.url));
const progressModule=new Module(progressFile);progressModule.require=requireWeb;
progressModule._compile(ts.transpileModule(await readFile(progressFile,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,progressFile);
const moduleObject=new Module(file);moduleObject.require=name=>name==="./PrescriptionScanProgress"?progressModule.exports:requireWeb(name);moduleObject._compile(compiled,file);
for(const language of ["en","ur","roman_ur"]) {
 const html=renderToStaticMarkup(React.createElement(moduleObject.exports.default,{file:null,data:{candidates:[{...base,correction_suggestion:"Panadol",alternative_reading:"Brufen",matched_medicine:medicine}],medicine_line_count:2,warnings:["Review missing line"]},language,busy:false,onRemove:()=>{},onEdit:async()=>{},onRescan:async()=>{}}));
 assert.ok(html.includes("Panadol") && html.includes("Brufen") && html.includes("Review missing line"));
}
console.log("PASS: bounded matching, original confidence, review gates, mismatch/LASA, recovery conflicts, and actual review screen in three languages");
