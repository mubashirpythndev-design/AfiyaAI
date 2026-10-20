const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('../apps/web/node_modules/typescript');
const source=fs.readFileSync(path.join(__dirname,'../apps/web/src/lib/marketplace.ts'),'utf8');
const exportsObject={};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:exportsObject,Intl,Error});
const {switchCartItem,price}=exportsObject;
test('switch uses evaluated whole-pack quantity and records the source, without mutating original cart',()=>{
  const original=[{medicine_id:'expensive',quantity:3},{medicine_id:'other',quantity:2}];
  const result=switchCartItem(original,'expensive',{medicine_id:'cheaper',target_quantity:1});
  assert.equal(result[0].quantity,1);
  assert.equal(result[0].switched_from_medicine_id,'expensive');
  assert.equal(result[1].quantity,2);
  assert.equal(original[0].medicine_id,'expensive');
});
test('switch refuses to merge with a medicine already in the pharmacist cart',()=>{
  assert.throws(()=>switchCartItem([{medicine_id:'a',quantity:1},{medicine_id:'b',quantity:2}],'a',{medicine_id:'b',target_quantity:1}),/already in this cart/);
});
test('money display accepts decimal strings and does not invent missing prices',()=>{
  assert.equal(price('123.45'),price(123.45));
  assert.equal(price(null),'Not available');
});
