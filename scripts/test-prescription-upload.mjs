// Exercise the actual page handlers with delayed requests, plus real component SSR.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "../apps/web/node_modules/typescript/lib/typescript.js";

const requireWeb=createRequire(new URL("../apps/web/package.json",import.meta.url));
const Module=requireWeb("node:module");
const React=requireWeb("react");
const {renderToStaticMarkup}=requireWeb("react-dom/server");
const page=await readFile(new URL("../apps/web/src/app/page.tsx",import.meta.url),"utf8");
const source=ts.createSourceFile("page.tsx",page,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const names=["applyOCRResult","handleImageSelected","handleRemoveImage","handleOCRRescan"];
const declarations=[];
function visit(node) {
 if(ts.isVariableStatement(node)&&node.declarationList.declarations.some(d=>names.includes(d.name.getText(source)))) declarations.push(node.getText(source));
 ts.forEachChild(node,visit);
}
visit(source);
assert.equal(declarations.length,names.length);
const setters=["PrescriptionFile","OcrData","Candidates","Medicines","IsScanning","IsProcessing","Error","ChatPrompt","View","HomeSection"];
const dependencies=["scanSerial","scanAbort","isSignedIn","authUser","language","prescriptionFile","ocrData","requestAuth","t","extractFromImage","enrichOCRCandidates","matchMedicine","mergeOCRRescan",...setters.map(name=>"set"+name)];
const handlerModule=new Module("prescription-handlers");
handlerModule._compile(ts.transpileModule(`module.exports = deps => { const {${dependencies.join(",")}}=deps; ${declarations.join("\n")} return {${names.join(",")}}; };`,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,"prescription-handlers");
const pending=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const image=new File(["image"],"prescription.jpg",{type:"image/jpeg"});
const result={candidates:[{raw_text:"Read medicine",is_verified:false}],raw_text:"Read medicine"};
function harness(overrides={}) {
 const state={};
 const deps={scanSerial:{current:0},scanAbort:{current:null},isSignedIn:true,language:"en",prescriptionFile:null,ocrData:null,
  requestAuth:()=>{throw new Error("unexpected auth request")},t:()=>"translated",matchMedicine:async()=>{},
  extractFromImage:async()=>result,enrichOCRCandidates:async rows=>rows,mergeOCRRescan:(_old,newRows)=>newRows,...overrides};
 for(const name of setters) deps["set"+name]=value=>{state[name]=typeof value==="function"?value(state[name]):value;};
 return {state,deps,...handlerModule.exports(deps)};
}
// Remove during provider wait, then ignore a provider that responds after abort.
{
 const wait=pending(); let signal; let matches=0;
 const h=harness({extractFromImage:(_file,options)=>{signal=options.signal;return wait.promise},enrichOCRCandidates:async rows=>{matches++;return rows}});
 const task=h.handleImageSelected(image);
 assert.equal(h.state.IsScanning,true);
 h.handleRemoveImage();
 assert.equal(signal.aborted,true);
 assert.equal(h.state.PrescriptionFile,null);
 assert.equal(h.state.OcrData,null);
 assert.equal(h.state.IsScanning,false);
 assert.equal(h.state.Error,null);
 wait.resolve(result); await task;
 assert.equal(matches,0); assert.equal(h.state.OcrData,null); assert.equal(h.state.View,"home");
}
// Remove while catalog matching is still pending: its late result cannot restore the image/results.
{
 const wait=pending();const h=harness({enrichOCRCandidates:()=>wait.promise});
 const task=h.handleImageSelected(image);await tick();
 assert.equal(h.state.View,"results");assert.equal(h.state.IsScanning,false);
 assert.equal(h.state.OcrData.candidates[0].raw_text,"Read medicine");
 assert.equal(h.state.OcrData.candidates[0].is_verified,false);
 assert.equal(h.state.IsProcessing,true);
 h.handleRemoveImage();wait.resolve(result.candidates);await task;
 assert.equal(h.state.OcrData,null);assert.deepEqual(h.state.Medicines,[]);
}
// A new upload is not cleared by the previous upload's finally/error handlers.
{
 const first=pending(),second=pending();let count=0;
 const h=harness({extractFromImage:()=>++count===1?first.promise:second.promise});
 const old=h.handleImageSelected(image);h.handleRemoveImage();
 const current=h.handleImageSelected(image);first.reject(new Error("late failure"));await old;
 assert.equal(h.state.IsScanning,true);assert.equal(h.state.Error,null);
 second.resolve(result);await current;
 assert.equal(h.state.View,"results");assert.equal(h.state.IsScanning,false);assert.ok(h.state.OcrData);
 h.handleRemoveImage();assert.equal(h.state.OcrData,null);assert.equal(h.state.View,"home");
}
// Rescans display busy state; failures keep the original file available for removal/retry.
{
 const wait=pending();let options;
 const h=harness({prescriptionFile:image,ocrData:result,extractFromImage:(_file,opts)=>{options=opts;return wait.promise}});
 const task=h.handleOCRRescan([100,100,500,500]);
 assert.equal(h.state.IsScanning,true);assert.ok(options.signal);assert.equal(options.forceRefresh,true);
 wait.reject(new Error("service unavailable"));await task;
 assert.equal(h.state.Error,"service unavailable");assert.equal(h.state.IsScanning,false);
 assert.equal(h.deps.prescriptionFile,image);
}

async function component(relative, mocks={}) {
 const file=fileURLToPath(new URL(relative,import.meta.url));const mod=new Module(file);
 mod.require=name=>Object.hasOwn(mocks,name)?mocks[name]:requireWeb(name);
 mod._compile(ts.transpileModule(await readFile(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
 return mod.exports;
}
const progress=await component("../apps/web/src/components/upload/PrescriptionScanProgress.tsx");
const uploader=await component("../apps/web/src/components/upload/ImageUploader.tsx",{
 "./PrescriptionScanProgress":progress,"@/lib/constants":{MAX_FILE_SIZE:10*1024*1024,ALLOWED_FILE_TYPES:["image/jpeg"]},
 "@/lib/i18n":{t:()=>"Change image"},"next/image":({unoptimized,fill,...props})=>React.createElement("img",props),
});
const review=await component("../apps/web/src/components/upload/OCRReview.tsx",{"./PrescriptionScanProgress":progress});
for(const [language,label] of [["en","Remove image"],["ur","تصویر ہٹائیں"],["roman_ur","Tasveer hataein"]]) {
 const props={file:image,onImageSelected:()=>{},onImageRemoved:()=>{},language,isProcessing:true,showProgress:true};
 const html=renderToStaticMarkup(React.createElement(uploader.default,props));
 assert.ok(html.includes(label)&&html.includes('role="status"')&&html.includes("prescription-scan-track"));
 const remove=html.match(/<button[^>]*class="prescription-remove"[^>]*>[\s\S]*?<\/button>/)?.[0];
 assert.ok(remove&&!remove.includes("disabled"));
 const empty=renderToStaticMarkup(React.createElement(uploader.default,{...props,file:null,isProcessing:false,showProgress:false}));
 assert.ok(!empty.includes("prescription-remove")&&!empty.includes("prescription-scan-status"));
 const reviewed=renderToStaticMarkup(React.createElement(review.default,{file:image,data:result,language,busy:true,scanning:true,onRemove:()=>{},onEdit:async()=>{},onRescan:async()=>{}}));
 assert.ok(reviewed.includes(label)&&reviewed.includes("prescription-scan-status"));
}
console.log("PASS: image removal, cancellation and late-result races, re-upload, rescan failure, visible scanning status and three-language removal controls");
