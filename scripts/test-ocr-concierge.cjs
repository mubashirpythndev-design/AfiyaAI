const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('../apps/web/node_modules/typescript');
const root=path.resolve(__dirname,'..');
function compile(file,overrides={},globals={}){
  const exports={};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,
    {exports,require:id=>id in overrides?overrides[id]:require(id),Error,TypeError,Date,Response,Request,File,FormData,AbortController,DOMException,setTimeout,clearTimeout,...globals});
  return exports;
}
test('OCR busy response survives the client parser and an attached image can be sent directly to concierge',async()=>{
  const calls=[],file=new File(['synthetic-image'],'rx.png',{type:'image/png'});
  const api=compile('apps/web/src/lib/api.ts',{'./constants':{API_BASE_URL:'http://backend.test'},'./auth':{getAuthToken:async()=> 'test-token',clearSession:()=>{}}},{fetch:async(url,options)=>{
    calls.push({url,options});
    assert.equal(options.headers.Authorization,'Bearer test-token');
    if(url.endsWith('/api/ocr/extract'))return Response.json({error:'OCR_SERVICE_BUSY',message:'AI OCR models are temporarily busy.',fallback_available:true},{status:503});
    if(url==='/api/marketplace/prescriptions')return Response.json({prescription_image_url:'/uploads/test-reference'});
    if(url.endsWith('/concierge-rx')){assert.equal(JSON.parse(options.body).prescription_image_url,'/uploads/test-reference');return Response.json({id:'order-1',status:'AWAITING_PHARMACIST_CART'});}
    throw Error('Unexpected endpoint');
  }});
  await assert.rejects(api.extractFromImage(file),error=>api.isOCRServiceBusy(error)&&error.code==='OCR_SERVICE_BUSY'&&error.fallbackAvailable);
  const uploaded=await api.uploadStorePrescription(file),order=await api.submitConciergeRx(uploaded);
  assert.equal(order.status,'AWAITING_PHARMACIST_CART');
  assert.equal(calls.filter(call=>call.url.endsWith('/api/ocr/extract')).length,1);
});
test('a non-JSON proxy 503 is still recognized as an OCR fallback condition',async()=>{
  const api=compile('apps/web/src/lib/api.ts',{'./constants':{API_BASE_URL:'http://backend.test'},'./auth':{getAuthToken:async()=>null,clearSession:()=>{}}},{fetch:async()=>new Response('Unavailable',{status:503})});
  await assert.rejects(api.extractFromImage(new File(['image'],'rx.png')),error=>api.isOCRServiceBusy(error)&&error.status===503);
});
test('a successful HTTP response can request manual pharmacist review without a 503',async()=>{
  const api=compile('apps/web/src/lib/api.ts',{'./constants':{API_BASE_URL:'http://backend.test'},'./auth':{getAuthToken:async()=>null,clearSession:()=>{}}},{fetch:async()=>Response.json({candidates:[],raw_text:'Unverified recognized text',demo_catalog_items:[{id:'catalog-example'}],engine:'concierge',error:'OCR_SERVICE_BUSY',fallback_available:true,message:'Please send this image for manual review.'})});
  await assert.rejects(api.extractFromImage(new File(['image'],'rx.png')),error=>api.isOCRServiceBusy(error)&&error.status===200&&error.fallbackAvailable&&error.ocrResult.raw_text==='Unverified recognized text'&&error.ocrResult.demo_catalog_items[0].id==='catalog-example');
});
test('browser OCR deadlines leave room for the complete server fallback chain',async()=>{
  const deadlines=[];
  const api=compile('apps/web/src/lib/api.ts',{'./constants':{API_BASE_URL:'http://backend.test'},'./auth':{getAuthToken:async()=>null,clearSession:()=>{}}},{
    setTimeout:(callback,ms)=>{deadlines.push(ms);return setTimeout(callback,ms);},
    fetch:async()=>Response.json({candidates:[],raw_text:''}),
  });
  const file=new File(['image'],'rx.png');
  await api.extractFromImage(file);
  assert.ok(deadlines.includes(150000));
  deadlines.length=0;
  await api.extractFromImage(file,{scanMode:'thorough'});
  assert.ok(deadlines.includes(210000));
});
function elements(node){if(Array.isArray(node))return node.flatMap(elements);if(!node||typeof node!=='object')return[];const children=node.props?.children;return[node,...(Array.isArray(children)?children:[children]).flatMap(elements)];}
test('fallback button submits once, keeps the image and records the awaiting-pharmacist confirmation',async()=>{
  const updates=[],state=[],uploaded=[],submitted=[],file=new File(['image'],'rx.png');let index=0;
  const react={useState:value=>{const key=index++;state[key]=value;return[value,next=>{state[key]=next;updates.push(next);}];},useRef:value=>({current:value})};
  const api={uploadStorePrescription:async actual=>{uploaded.push(actual);await new Promise(resolve=>setImmediate(resolve));return {prescription_image_url:'/uploads/photo'};},submitConciergeRx:async payload=>{submitted.push(payload);return{id:'order-2',status:'AWAITING_PHARMACIST_CART'};}};
  const component=compile('apps/web/src/components/marketplace/OCRBusyFallback.tsx',{'react':react,'react/jsx-runtime':require('../apps/web/node_modules/react/jsx-runtime'),'lucide-react':{},'@/lib/api':api,'@/lib/marketplace':{errorMessage:error=>error.message},'./MarketplaceProvider':{useMarketplace:()=>({requireAuth:()=>true,openOrders:()=>{}})},'./MarketplaceUI':{button:'',secondary:'',ErrorBanner:()=>null}}).default;
  const button=elements(component({file})).find(node=>node.type==='button');
  assert.ok(button);button.props.onClick();button.props.onClick();
  for(let i=0;i<10&&!state[0];i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(uploaded.length,1);assert.equal(uploaded[0],file);
  assert.equal(submitted.length,1);assert.equal(submitted[0].prescription_image_url,'/uploads/photo');
  assert.equal(state[0].status,'AWAITING_PHARMACIST_CART');
});

test('local review keeps catalog demos separate and preview switches never touch the real cart',()=>{
  const state=[];let index=0,realCartChanges=0;
  const react={useState:value=>{const key=index++;if(!(key in state))state[key]=value;return[state[key],next=>{state[key]=typeof next==='function'?next(state[key]):next;}];}};
  const catalog=[{id:'pan',medicine_id:'pan',brand_name:'Panadol',strength:'500mg',dosage_form:'Tablet',selling_price:100,cheapest_alternative:{medicine_id:'alt',brand_name:'Demo Alternative',savings_pkr:20}},
    {id:'alt',medicine_id:'alt',brand_name:'Demo Alternative',strength:'500mg',dosage_form:'Tablet',selling_price:80}];
  const staging=()=>null;
  const component=compile('apps/web/src/components/marketplace/OCRLocalReview.tsx',{'react':react,'react/jsx-runtime':require('../apps/web/node_modules/react/jsx-runtime'),
    './MarketplaceProvider':{useMarketplace:()=>({catalog,addItems:()=>{realCartChanges++;}})},'./OCRCartStaging':{default:staging},'./MarketplaceUI':{button:'',secondary:'',input:''},'@/lib/marketplace':{price:value=>'PKR '+value}}).default;
  const file=new File(['image'],'rx.png');
  const render=()=>{index=0;return component({file,rawText:'Patient Name: Demo',demoItems:[catalog[0]]});};
  let tree=render();assert.ok(JSON.stringify(tree).includes('Patient Name: Demo'));
  const label=node=>Array.isArray(node.props.children)?node.props.children.filter(value=>typeof value==='string').join(' '):node.props.children;
  assert.ok(JSON.stringify(tree).includes('Demo cart preview'));
  elements(tree).find(node=>node.type==='button'&&label(node)==='Hide catalog demo').props.onClick();
  tree=render();elements(tree).find(node=>node.type==='button'&&label(node)==='Show catalog demo (not my prescription)').props.onClick();
  tree=render();assert.ok(JSON.stringify(tree).includes('not detected in your image'));
  elements(tree).find(node=>node.type==='button'&&String(label(node)).includes('Preview Switch')).props.onClick();
  tree=render();assert.ok(JSON.stringify(tree).includes('Demo Alternative'));assert.equal(realCartChanges,0);
  elements(tree).find(node=>node.type==='input').props.onChange({target:{value:'Name I can read'}});
  tree=render();elements(tree).find(node=>node.type==='form').props.onSubmit({preventDefault(){}});
  tree=render();const manual=elements(tree).find(node=>node.type===staging);
  assert.equal(manual.props.candidates.length,1);assert.equal(manual.props.candidates[0].raw_text,'Name I can read');
  assert.ok(manual.props.candidates[0].user_edited);assert.equal(realCartChanges,0);
});
