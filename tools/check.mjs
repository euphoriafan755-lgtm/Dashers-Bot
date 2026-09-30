import {readdirSync,readFileSync} from 'node:fs';
import {join,relative} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url).pathname;
function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):
  e.name.endsWith('.js')?[join(dir,e.name)]:[]);}
const files=[...walk(join(root,'src')),...walk(join(root,'test'))];
for(const file of files){const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});
  if(result.status!==0)process.exit(1);}
const code=readFileSync(join(root,'src/services/geometryDash.js'),'utf8');
if(code.includes('process.env')||code.includes('node:fs'))throw new Error('La capa de red no puede leer secretos ni archivos');
console.log(`CHECK OK: ${files.length} archivos con sintaxis válida.`);
