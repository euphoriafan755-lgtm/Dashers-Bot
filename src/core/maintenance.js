import fs from 'node:fs';
import path from 'node:path';
const MIB=1024*1024;
const RULES=Object.freeze({
  cache:{maxAgeMs:48*3600000,keepBytes:12*MIB,extensions:new Set(['.tmp','.cache','.json'])},
  tmp:{maxAgeMs:24*3600000,keepBytes:8*MIB,extensions:new Set(['.tmp','.cache','.log'])},
  logs:{maxAgeMs:72*3600000,keepBytes:12*MIB,extensions:new Set(['.log','.txt'])}
});
/** Sólo tres carpetas internas. No sigue enlaces, nunca toca bases de datos ni backups. */
export function cleanTemporaryFolders(dataDir,{now=Date.now()}={}){
  const root=path.resolve(dataDir);
  let removed=0,bytes=0;
  for(const [folder,rule] of Object.entries(RULES)){
    const directory=path.join(root,folder);
    if(!fs.existsSync(directory))continue;
    if(fs.lstatSync(directory).isSymbolicLink())continue;
    const entries=[];
    for(const entry of fs.readdirSync(directory,{withFileTypes:true}).slice(0,3000)){
      if(!entry.isFile()||!rule.extensions.has(path.extname(entry.name)))continue;
      const file=path.join(directory,entry.name);
      const stat=fs.lstatSync(file);
      if(stat.isFile()&&!stat.isSymbolicLink())entries.push({file,mtime:stat.mtimeMs,size:stat.size});
    }
    entries.sort((a,b)=>a.mtime-b.mtime);
    let total=entries.reduce((sum,x)=>sum+x.size,0);
    for(const entry of entries){
      if(now-entry.mtime<rule.maxAgeMs && total<=rule.keepBytes)continue;
      try{
        const current=fs.lstatSync(entry.file);
        if(!current.isFile()||current.isSymbolicLink()||current.size!==entry.size||current.mtimeMs!==entry.mtime)continue;
        fs.unlinkSync(entry.file);removed++;bytes+=entry.size;total-=entry.size;
      }catch(error){if(error.code!=='ENOENT')console.warn('[Limpieza]',error.message);}
    }
  }
  return {removed,bytes};
}
export function startMaintenance({dataDir,limitMiB=null,onPrune=()=>{}}){
  fs.mkdirSync(path.resolve(dataDir),{recursive:true});
  const first=process.cpuUsage(),started=process.hrtime.bigint();
  let totalRemoved=0,lastPrune=0,lastAlert=0;
  function clean(){const result=cleanTemporaryFolders(dataDir);totalRemoved+=result.removed;
    onPrune();lastPrune=Date.now();return result;}
  function snapshot(){
    const cpu=process.cpuUsage(first),elapsed=Number(process.hrtime.bigint()-started)/1e9;
    return {rssMiB:Math.round(process.memoryUsage().rss/MIB),limitMiB,
      cpuSeconds:Math.round((cpu.user+cpu.system)/1e6),
      cpuPercent:elapsed>0?Math.round((cpu.user+cpu.system)/1e4/elapsed):0,
      uptime:Math.floor(process.uptime()),totalRemoved,lastPrune};
  }
  const monitor=setInterval(()=>{
    onPrune();
    const current=snapshot();
    if(limitMiB && current.rssMiB>limitMiB*0.8 && Date.now()-lastAlert>30*60000){
      lastAlert=Date.now();console.warn(`[Recursos] RAM: ${current.rssMiB}/${limitMiB} MiB. Revisá el plan del hosting.`);
    }
  },60000);
  const task=setInterval(()=>clean(),3600000);
  monitor.unref?.();task.unref?.();clean();
  return {clean,snapshot,stop(){clearInterval(monitor);clearInterval(task);}};
}
