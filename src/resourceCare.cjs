'use strict';
/*
 * Dashers/BOTT7TV Resource Care
 * Native Node.js, no dependencies, CommonJS AND ESM compatible (.cjs).
 * Never touches tokens, database files, backups, uploaded files or provider logs.
 */
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');

const MiB=1024*1024;
const NOW=()=>Date.now();
const bounds=(n,min,max,fallback)=>Number.isFinite(Number(n))?Math.min(max,Math.max(min,Number(n))):fallback;
const cgroupFiles=['/sys/fs/cgroup/memory.max','/sys/fs/cgroup/memory/memory.limit_in_bytes'];
function cgroupLimit(){
  for (const file of cgroupFiles){try{
    const value=fs.readFileSync(file,'utf8').trim();
    const n=Number(value);
    if(Number.isFinite(n)&&n>32*MiB&&n<Number.MAX_SAFE_INTEGER/10)return n;
  }catch{}}
  return 0;
}
function localData(dataDir){
  const root=path.resolve(dataDir);
  fs.mkdirSync(root,{recursive:true});
  for(const dir of ['cache','tmp','logs'])fs.mkdirSync(path.join(root,dir),{recursive:true});
  return root;
}
function sweepDirectory(directory,{ageDays,maxMiB,extensions,now=NOW()}={}){
  const keepMs=ageDays*86400e3;
  const maxBytes=maxMiB*MiB;
  let entries=[];
  let visited=0;
  for (const d of fs.readdirSync(directory,{withFileTypes:true})) {
    if(++visited>3000)break;
    // Never follow symlinks or descend into nested folders.
    if(!d.isFile()||!extensions.includes(path.extname(d.name).toLowerCase()))continue;
    const file=path.join(directory,d.name);
    try{
      const stat=fs.lstatSync(file);
      if(stat.isSymbolicLink()||!stat.isFile())continue;
      entries.push({file,bytes:stat.size,mtime:stat.mtimeMs});
    }catch{}
  }
  let bytes=entries.reduce((sum,e)=>sum+e.bytes,0);
  let removedBytes=0,removed=0;
  // Expire old temporary resources first.
  entries.sort((a,b)=>a.mtime-b.mtime);
  for(const e of entries){
    if(now-e.mtime<keepMs && bytes<=maxBytes)continue;
    try{
      // Never delete changed/replaced symlink entries between scan and unlink.
      const actual=fs.lstatSync(e.file);
      if(actual.isSymbolicLink()||!actual.isFile())continue;
      if(actual.mtimeMs!==e.mtime||actual.size!==e.bytes)continue;
      fs.unlinkSync(e.file);bytes-=e.bytes;removedBytes+=e.bytes;removed++;
    }catch{}
  }
  return {removed,removedBytes,remainingBytes:bytes};
}
function cleanOwnEphemeralFiles(dataDir,now=NOW()){
  const root=localData(dataDir);
  const targets=[
    ['cache',{ageDays:2,maxMiB:12,extensions:['.tmp','.cache','.json']}],
    ['tmp',{ageDays:1,maxMiB:8,extensions:['.tmp','.log','.cache','.json']}],
    ['logs',{ageDays:3,maxMiB:12,extensions:['.log','.txt']}],
  ];
  let removed=0,removedBytes=0;
  for(const [dir,config] of targets){
    const stats=sweepDirectory(path.join(root,dir),{...config,now});
    removed+=stats.removed;removedBytes+=stats.removedBytes;
  }
  return {removed,removedBytes};
}
function ownDataBytes(root){
  let size=0,files=0;
  // Only read files in application-controlled directories and the JSON state.
  for(const name of ['state.json','state.json.tmp']){
    try{const s=fs.lstatSync(path.join(root,name));if(s.isFile())size+=s.size;}catch{}
  }
  for(const dir of ['cache','tmp','logs']){
    try{for(const d of fs.readdirSync(path.join(root,dir),{withFileTypes:true}).slice(0,3000)){
      if(d.isFile()){try{size+=fs.lstatSync(path.join(root,dir,d.name)).size;files++;}catch{}}
    }}catch{}
  }
  return {bytes:size,files};
}
function startResourceCare(options={}){
  const root=localData(options.dataDir||process.env.DATA_DIR||'./data');
  const memoryEnv=bounds(process.env.HOST_RAM_MB,128,131072,0);
  const configuredLimit=memoryEnv?memoryEnv*MiB:0;
  const detectedLimit=cgroupLimit();
  // The dashboard quota can be lower than the outer container cgroup. Use the smaller one.
  const limitBytes=options.limitBytes||(configuredLimit&&detectedLimit?Math.min(configuredLimit,detectedLimit):configuredLimit||detectedLimit); 
  const intervalMs=bounds(options.intervalMs,30000,900000,60000);
  const threshold=bounds(options.warningRatio,0.5,0.99,0.8);
  const onAlert=typeof options.onAlert==='function'?options.onAlert:()=>{};
  const onClean=typeof options.onClean==='function'?options.onClean:()=>{};
  const onPrune=typeof options.onPrune==='function'?options.onPrune:()=>{};
  const info={startsAt:NOW(),limitBytes,lastCleanup:0,cleanups:0,removedBytes:0,removedFiles:0,lastAlert:0,lastPrune:0,latest:{}};
  let lastCpu=process.cpuUsage(),lastTime=process.hrtime.bigint(),closed=false;
  function safeCleanup(){
    try{
      const s=cleanOwnEphemeralFiles(root);
      info.removedFiles+=s.removed;info.removedBytes+=s.removedBytes;
      info.cleanups++;info.lastCleanup=NOW();
      onClean(s);
      return s;
    }catch(e){console.warn('[Recursos] No se pudo limpiar el área temporal:',e.message);return {removed:0,removedBytes:0,error:e.message};}
  }
  function prune(){try{onPrune();info.lastPrune=NOW();}catch(e){console.warn('[Recursos] No se pudieron depurar cachés:',e.message);}}
  function snapshot(){
    const memory=process.memoryUsage();
    const uptimeSeconds=Math.floor(process.uptime());
    const now=process.hrtime.bigint(),elapsedMs=Number(now-lastTime)/1e6;
    const used=process.cpuUsage(lastCpu);lastCpu=process.cpuUsage();lastTime=now;
    // May exceed 100% on multicore. This is consumption, unlike hosting allocations.
    const cpuPercent=elapsedMs>0?(used.user+used.system)/1000/elapsedMs*100:0;
    const disk=ownDataBytes(root);
    return {rssMiB:Math.round(memory.rss/MiB),heapMiB:Math.round(memory.heapUsed/MiB),
      limitMiB:limitBytes?Math.round(limitBytes/MiB):null,cpuPercent:Math.round(cpuPercent),
      ownFilesMiB:Math.round(disk.bytes/MiB*10)/10,uptimeSeconds,
      lastCleanup:info.lastCleanup,removedFiles:info.removedFiles,removedMiB:Math.round(info.removedBytes/MiB*10)/10};
  }
  function check(){
    if(closed)return;
    const s=snapshot();info.latest=s;
    if(limitBytes && s.rssMiB*MiB > limitBytes*threshold){
      prune();safeCleanup();
      if(NOW()-info.lastAlert>30*60000){
        info.lastAlert=NOW();console.warn(`[Recursos] Alerta RAM ${s.rssMiB}/${s.limitMiB} MiB. Limpié solo cachés y archivos temporales; no puedo aumentar la RAM del hosting.`);
        Promise.resolve().then(()=>onAlert({type:'memory',snapshot:s})).catch(e=>console.warn('[Recursos] Alerta:',e.message));
      }
    }else if(s.cpuPercent>=90 && NOW()-info.lastAlert>30*60000){
      info.lastAlert=NOW();console.warn(`[Recursos] Alerta CPU de proceso ~${s.cpuPercent}%. Las reservas del panel no son consumo de CPU.`);
      Promise.resolve().then(()=>onAlert({type:'cpu',snapshot:s})).catch(()=>{});
    }
  }
  safeCleanup();prune();info.latest=snapshot();
  // Run scheduled cleanup every 60 minutes; monitor only once per minute.
  const monitor=setInterval(check,intervalMs);monitor.unref?.();
  const cleanup=setInterval(()=>{prune();safeCleanup()},60*60000);cleanup.unref?.();
  return {snapshot:()=>{const s=snapshot();info.latest=s;return s;},cleanup:()=>{prune();const r=safeCleanup();info.latest=snapshot();return r;},stop:()=>{closed=true;clearInterval(monitor);clearInterval(cleanup);},information:info};
}
module.exports={startResourceCare,cleanOwnEphemeralFiles,sweepDirectory,cgroupLimit};
