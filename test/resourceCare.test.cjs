'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {cleanOwnEphemeralFiles,startResourceCare}=require('../src/resourceCare.cjs');
function fixture(){const root=fs.mkdtempSync(path.join(os.tmpdir(),'dashers-care-test-'));return {root,clean:()=>fs.rmSync(root,{recursive:true,force:true})};}
const DAY=86400000;
test('elimina temporales antiguos, nunca state.json ni backups ni archivos ajenos',t=>{
  const {root,clean}=fixture();t.after(clean);
  fs.mkdirSync(path.join(root,'cache'),{recursive:true});fs.mkdirSync(path.join(root,'backups'));
  const safe=path.join(root,'state.json'),backup=path.join(root,'backups','discord.json'),old=path.join(root,'cache','outdated.tmp');
  fs.writeFileSync(safe,'{"warnings": ["PRESERVAR"]}');fs.writeFileSync(backup,'RESPALDO');fs.writeFileSync(old,'TEMPORAL');
  const ago=new Date(Date.now()-4*DAY);fs.utimesSync(old,ago,ago);
  const result=cleanOwnEphemeralFiles(root);
  assert.equal(result.removed,1);assert.equal(fs.existsSync(old),false);
  assert.equal(fs.existsSync(safe),true);assert.equal(fs.existsSync(backup),true);
});
test('no recorre carpetas ajenas ni sigue symlinks',t=>{
  const {root,clean}=fixture();t.after(clean);
  const outside=fs.mkdtempSync(path.join(os.tmpdir(),'dashers-not-owned-'));
  t.after(()=>fs.rmSync(outside,{recursive:true,force:true}));
  const protectedFile=path.join(outside,'important.json');fs.writeFileSync(protectedFile,'do not delete');
  fs.mkdirSync(path.join(root,'cache'),{recursive:true});
  const link=path.join(root,'cache','fake.tmp');
  try{fs.symlinkSync(protectedFile,link);}catch{return;}
  const result=cleanOwnEphemeralFiles(root,Date.now()+5*DAY);
  assert.equal(result.removed,0);assert.equal(fs.readFileSync(protectedFile,'utf8'),'do not delete');
});
test('limpieza de archivos recientes no borra datos vigentes',t=>{
  const {root,clean}=fixture();t.after(clean);
  fs.mkdirSync(path.join(root,'logs'),{recursive:true});
  const log=path.join(root,'logs','current.log');fs.writeFileSync(log,'live');
  const result=cleanOwnEphemeralFiles(root);
  assert.equal(result.removed,0);assert.equal(fs.existsSync(log),true);
});
test('monitor informa RAM real sin afirmar que puede cambiar cuota de hosting',t=>{
  const {root,clean}=fixture();t.after(clean);
  const monitor=startResourceCare({dataDir:root,limitBytes:512*1024*1024,intervalMs:30000});t.after(()=>monitor.stop());
  const result=monitor.snapshot();
  assert.ok(result.rssMiB>0);assert.equal(result.limitMiB,512);assert.equal(result.removedFiles,0);assert.ok(result.uptimeSeconds>=0);
});
