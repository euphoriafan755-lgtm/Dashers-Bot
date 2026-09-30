import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {cleanTemporaryFolders} from '../src/core/maintenance.js';
test('limpia temporales antiguos, sin borrar backups ni estado',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dashers-care-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  fs.mkdirSync(path.join(dir,'tmp'));fs.mkdirSync(path.join(dir,'backups'));
  const old=path.join(dir,'tmp','old.tmp'),state=path.join(dir,'state.json'),backup=path.join(dir,'backups','copy.json');
  fs.writeFileSync(old,'temp');fs.writeFileSync(state,'IMPORTANTE');fs.writeFileSync(backup,'IMPORTANTE');
  const before=new Date(Date.now()-3*86400000);fs.utimesSync(old,before,before);
  assert.equal(cleanTemporaryFolders(dir).removed,1);
  assert.equal(fs.existsSync(old),false);assert.equal(fs.readFileSync(state,'utf8'),'IMPORTANTE');
  assert.equal(fs.readFileSync(backup,'utf8'),'IMPORTANTE');
});
test('no sigue enlaces simbólicos fuera de la carpeta',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dashers-care-link-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const ext=fs.mkdtempSync(path.join(os.tmpdir(),'dashers-other-'));t.after(()=>fs.rmSync(ext,{recursive:true,force:true}));
  fs.mkdirSync(path.join(dir,'cache'));const target=path.join(ext,'important.tmp');fs.writeFileSync(target,'KEEP');
  try{fs.symlinkSync(target,path.join(dir,'cache','fake.tmp'));}catch{return;}
  assert.equal(cleanTemporaryFolders(dir,{now:Date.now()+5*86400000}).removed,0);
  assert.equal(fs.readFileSync(target,'utf8'),'KEEP');
});
