// Build into a new directory so a previous plaintext site can never leak into the upload.
import {readFile,writeFile,mkdir,readdir,copyFile} from 'node:fs/promises';
import {randomBytes,pbkdf2Sync,createCipheriv,createHash} from 'node:crypto';
import path from 'node:path';
const [source,output]=process.argv.slice(2);
const password=process.env.STAGING_PASSWORD;
if(!source||!output||!password)throw Error('Set STAGING_PASSWORD and pass source and new output directories.');
await mkdir(output);
const release=randomBytes(8).toString('hex'),salt=randomBytes(16);
const key=pbkdf2Sync(password,salt,600000,32,'sha256');
const folder=path.join(output,'sealed',release);
await mkdir(folder,{recursive:true});
function seal(name,data){
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
  cipher.setAAD(Buffer.from(name));
  const ciphertext=Buffer.concat([cipher.update(data),cipher.final(),cipher.getAuthTag()]);
  return {iv:iv.toString('base64'),ciphertext};
}
const check=seal('check',Buffer.from('MyDogKing'));
const manifest={salt:salt.toString('base64'),check:{iv:check.iv,data:check.ciphertext.toString('base64')},files:{}};
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.pdf':'application/pdf'};
async function pack(relative){
  for(const entry of await readdir(path.join(source,relative),{withFileTypes:true})){
    const name=path.posix.join(relative,entry.name);
    if(entry.isDirectory()){await pack(name);continue;}
    const type=types[path.extname(name)];
    if(!entry.isFile()||!type)throw Error('Unexpected asset '+name);
    const {iv,ciphertext}=seal(name,await readFile(path.join(source,name)));
    const file=createHash('sha256').update(ciphertext).digest('hex')+'.bin';
    await writeFile(path.join(folder,file),ciphertext);
    manifest.files[name]={file,type,iv};
    if(name.endsWith('.html'))await copyFile(new URL('gate.html',import.meta.url),path.join(output,name));
  }
}
await pack('');
await writeFile(path.join(folder,'manifest.json'),JSON.stringify(manifest));
await copyFile(new URL('gate.js',import.meta.url),path.join(output,'gate.js'));
const worker=await readFile(new URL('preview-worker.js',import.meta.url),'utf8');
await writeFile(path.join(output,'preview-worker.js'),worker.replace('__RELEASE__',release));
await writeFile(path.join(output,'.nojekyll'),'');
