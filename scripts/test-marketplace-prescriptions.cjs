const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('../apps/web/node_modules/typescript');
const tmpRoot=path.resolve(os.tmpdir());
const temporary=fs.mkdtempSync(path.join(tmpRoot,'afiya-marketplace-test-'));
const root=path.resolve(__dirname,'..');
function load(file,overrides={}){
  const exports={};
  const customRequire=id=>id in overrides?overrides[id]:require(id);
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,
    {exports,require:customRequire,process:{cwd:()=>path.join(temporary,'apps/web')},Buffer,Response,Request,File,Uint8Array,AbortSignal,fetch:async(_url,options)=>{
      const role=options.headers.authorization?.replace('Bearer ','');
      return ['buyer','other','admin'].includes(role)?Response.json({id:role,is_admin:role==='admin'}):Response.json({detail:'Not authenticated'},{status:401});
    }});
  return exports;
}
const storage=load('apps/web/src/lib/local-prescriptions.ts',{'server-only':{},'./constants':{API_BASE_URL:'http://isolated-backend.test'}});
const upload=load('apps/web/src/app/api/marketplace/prescriptions/route.ts',{'@/lib/local-prescriptions':storage});
const download=load('apps/web/src/app/uploads/[id]/route.ts',{'@/lib/local-prescriptions':storage});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jY1QAAAAASUVORK5CYII=','base64');
function request(role,bytes=png,type='image/png'){
  const body=new FormData();body.append('image',new File([bytes],'prescription.png',{type}));
  return new Request('http://local.test/api/marketplace/prescriptions',{method:'POST',headers:role?{Authorization:`Bearer ${role}`}:{},body});
}
test('real local upload returns a backend-compatible private reference, accessible only to its owner and admins',async()=>{
  const response=await upload.POST(request('buyer'));
  assert.equal(response.status,200);
  const {prescription_image_url:reference}=await response.json();
  assert.match(reference,/^\/uploads\/[a-f0-9-]{36}$/);
  for(const [role,status] of [['buyer',200],['admin',200],['other',404],[null,401]]){
    const result=await download.GET(new Request('http://local.test'+reference,{headers:role?{Authorization:`Bearer ${role}`}:{}}),{params:Promise.resolve({id:reference.split('/').pop()})});
    assert.equal(result.status,status);
    if(status===200){assert.equal(result.headers.get('Content-Type'),'image/png');assert.deepEqual(Buffer.from(await result.arrayBuffer()),png);assert.equal(result.headers.get('Cache-Control'),'private, no-store');}
  }
});
test('unauthenticated and non-image uploads are rejected',async()=>{
  assert.equal((await upload.POST(request(null))).status,401);
  assert.equal((await upload.POST(request('buyer',Buffer.from('<svg></svg>'),'image/svg+xml'))).status,422);
});
test('oversized bodies and path traversal references are rejected',async()=>{
  const tooLarge=new Request('http://local.test/api/marketplace/prescriptions',{method:'POST',headers:{Authorization:'Bearer buyer','Content-Length':String(10*1024*1024)},body:'x'});
  assert.equal((await upload.POST(tooLarge)).status,413);
  const result=await download.GET(new Request('http://local.test/uploads/x',{headers:{Authorization:'Bearer buyer'}}),{params:Promise.resolve({id:'../../outside'})});
  assert.equal(result.status,404);
});
after(()=>{
  const resolved=path.resolve(temporary);
  assert.equal(path.dirname(resolved),tmpRoot);
  assert.ok(path.basename(resolved).startsWith('afiya-marketplace-test-'));
  fs.rmSync(resolved,{recursive:true,force:true});
});
