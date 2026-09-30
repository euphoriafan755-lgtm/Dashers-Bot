'use strict';
// Safe: never prints token, env contents, member data or private files.
const fs=require('node:fs'),path=require('node:path');
const expected={client:'1554881611202437221',guild:'1554862905294463078'};
let failed=false;
const report=(name,ok,hint='')=>{console.log(`[${ok?'OK':'FALTA'}] ${name}${hint?' — '+hint:''}`);if(!ok)failed=true;};
const node=process.versions.node.split('.').map(Number);
report('Node.js >=22.12',node[0]>22||(node[0]===22&&node[1]>=12),process.versions.node);
report('package.json en raíz',fs.existsSync(path.join(__dirname,'../package.json')));
report('CLIENT_ID correcto',process.env.CLIENT_ID===expected.client,'ID público del bot');
report('GUILD_ID correcto',process.env.GUILD_ID===expected.guild,'ID público del servidor');
report('BOT_TOKEN presente',!!process.env.BOT_TOKEN,'No muestres el token ni lo pegues en Discord o el chat');
const data=path.resolve(process.env.DATA_DIR||'./data');
try{fs.mkdirSync(data,{recursive:true});fs.accessSync(data,fs.constants.R_OK|fs.constants.W_OK);report('Carpeta persistente escribible',true,data);}catch{report('Carpeta persistente escribible',false,data);}
console.log('Estos chequeos NO demuestran que Discord o el proveedor estén funcionando.');
if(failed)process.exitCode=1;
