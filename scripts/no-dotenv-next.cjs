// Build verification only: Next must not read project dotenv files for this task.
const path = require('node:path');
const fs = require('node:fs');
const blocked = value => typeof value === 'string' && /(^|[\\/])\.env(?:\.[^\\/]*)?$/i.test(value);
for(const method of ['readFileSync','openSync']) {
  const original=fs[method];
  fs[method]=function(file,...args){if(blocked(String(file))){const error=new Error('Dotenv file access blocked during verification');error.code='ENOENT';throw error;}return original.call(this,file,...args);};
}
for(const method of ['readFile','open']){
  const original=fs[method];
  fs[method]=function(file,...args){if(blocked(String(file))){const error=new Error('Dotenv file access blocked during verification');error.code='ENOENT';const callback=args[args.length-1];if(typeof callback==='function'){process.nextTick(()=>callback(error));return;}throw error;}return original.call(this,file,...args);};
}
const originalRead=fs.promises.readFile;
fs.promises.readFile=async function(file,...args){if(blocked(String(file))){const error=new Error('Dotenv file access blocked during verification');error.code='ENOENT';throw error;}return originalRead.call(this,file,...args);};
const resolved = require.resolve(path.resolve(__dirname, '../apps/web/node_modules/@next/env'));
const env = require(resolved);
// This package exports loadEnvConfig through a non-configurable getter.
require.cache[resolved].exports = new Proxy(env,{get(target,key){
  if(key==='loadEnvConfig')return()=>({combinedEnv:process.env,parsedEnv:{},loadedEnvFiles:[]});
  return Reflect.get(target,key);
}});
