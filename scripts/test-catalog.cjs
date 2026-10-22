const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('../apps/web/node_modules/typescript');
const source=fs.readFileSync(path.join(__dirname,'../apps/web/src/lib/catalog.ts'),'utf8');
const api={};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:api});
const defaults={query:'',category:'',prescription:'',availableOnly:false,sort:'name'};
const med=(id,patch={})=>({medicine_id:id,brand_name:id,generic_name:'Paracetamol',strength:'500mg',dosage_form:'Tablet',category:'Analgesic',available:true,requires_prescription:false,selling_price:'100.00',...patch});
const rows=[med('Alpha'),med('Beta',{category:'Respiratory',requires_prescription:true,selling_price:'25.00'}),med('Gamma',{category:null,requires_prescription:null,available:false,selling_price:null})];
test('search, exact category, availability and prescription filters combine without assuming unknown Rx status',()=>{
  assert.equal(api.filterCatalog(rows,{...defaults,query:'paracetamol 500MG',category:'Analgesic',prescription:'otc',availableOnly:true})[0].medicine_id,'Alpha');
  assert.equal(api.filterCatalog(rows,{...defaults,query:'Respiratory',prescription:'rx'}).length,1);
  assert.equal(api.filterCatalog(rows,{...defaults,prescription:'otc'}).length,1);
  assert.equal(api.filterCatalog(rows,{...defaults,category:'Analgesic',query:'missing'}).length,0);
});
test('price sort handles Decimal strings numerically, keeps unknown prices last and preserves original catalog',()=>{
  assert.equal(api.filterCatalog(rows,{...defaults,sort:'price-asc'}).map(item=>item.medicine_id).join(','),'Beta,Alpha,Gamma');
  assert.equal(api.filterCatalog(rows,{...defaults,sort:'price-desc'}).map(item=>item.medicine_id).join(','),'Alpha,Beta,Gamma');
  assert.equal(rows[0].medicine_id,'Alpha');
});
test('pagination covers every medicine once, clamps stale page after filtering, and handles empty lists',()=>{
  const catalog=Array.from({length:102},(_,i)=>med(String(i)));
  const ids=[];
  for(let page=1;page<=9;page++)ids.push(...api.catalogPage(catalog,page).items.map(item=>item.medicine_id));
  assert.equal(ids.length,102);assert.equal(new Set(ids).size,102);
  const last=api.catalogPage(catalog,9);assert.equal(last.items.length,6);assert.equal(last.start,97);assert.equal(last.end,102);
  assert.equal(api.catalogPage(rows,9).page,1);
  const empty=api.catalogPage([],4);assert.equal(empty.page,1);assert.equal(empty.start,0);assert.equal(empty.end,0);assert.equal(empty.items.length,0);
});
test('category choices are unique and taken from stored classifications',()=>{
  assert.equal(api.catalogCategories([...rows,med('other')]).join(','),'Analgesic,Respiratory');
});
