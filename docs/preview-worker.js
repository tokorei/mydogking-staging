// Each release gets its own salt and encrypted files. Only the gate and this loader are public.
const release='e829e7844209bce7';
const base=new URL(self.registration.scope);
const encoder=new TextEncoder();
const bytes=value=>Uint8Array.from(atob(value),ch=>ch.charCodeAt(0));
let manifest;
async function catalogue(){
  if(!manifest){
    const response=await fetch(new URL('sealed/'+release+'/manifest.json',base));
    if(!response.ok)throw Error('Preview manifest unavailable');
    manifest=await response.json();
  }
  return manifest;
}
function grantStore(write,value){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('mdk-preview-'+base.pathname,1);
    request.onupgradeneeded=()=>request.result.createObjectStore('session');
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
      const db=request.result,tx=db.transaction('session',write?'readwrite':'readonly');
      const store=tx.objectStore('session');
      const query=write?store.put(value,'active'):store.get('active');
      tx.oncomplete=()=>{db.close();resolve(query.result);};
      tx.onabort=()=>{db.close();reject(tx.error);};
    };
  });
}
function decrypt(key,name,iv,buffer){
  return crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(iv),additionalData:encoder.encode(name)},key,buffer);
}
self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('message',e=>{
  if(!e.ports[0]||typeof e.data?.password!=='string')return;
  e.waitUntil((async()=>{
    const config=await catalogue();
    const material=await crypto.subtle.importKey('raw',encoder.encode(e.data.password),'PBKDF2',false,['deriveKey']);
    const key=await crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',iterations:600000,salt:bytes(config.salt)},material,{name:'AES-GCM',length:256},false,['decrypt']);
    try{await decrypt(key,'check',config.check.iv,bytes(config.check.data));}
    catch{e.ports[0].postMessage('denied');return;}
    await grantStore(true,{key,release,expires:Date.now()+8*60*60*1000});
    e.ports[0].postMessage('ok');
  })().catch(()=>e.ports[0].postMessage('unavailable')));
});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(u.origin!==base.origin||!u.pathname.startsWith(base.pathname)||e.request.method!=='GET')return;
  const name=u.pathname.slice(base.pathname.length)||'index.html';
  if(['gate.js','preview-worker.js'].includes(name)||name.startsWith('sealed/'))return;
  e.respondWith((async()=>{
    const config=await catalogue();
    if(!Object.hasOwn(config.files,name))return fetch(e.request);
    const grant=await grantStore(false);
    if(!grant||grant.release!==release||grant.expires<=Date.now()){
      if(e.request.mode==='navigate'&&name.endsWith('.html'))return fetch(new URL('index.html',base),{cache:'no-store'});
      return new Response('Password required',{status:401,headers:{'Cache-Control':'no-store'}});
    }
    const entry=config.files[name];
    const response=await fetch(new URL('sealed/'+release+'/'+entry.file,base));
    if(!response.ok)throw Error('File unavailable');
    const content=await decrypt(grant.key,name,entry.iv,await response.arrayBuffer());
    return new Response(content,{headers:{'Content-Type':entry.type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  })().catch(()=>new Response('Preview unavailable. Reload to try again.',{status:503})));
});
