import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {JsonStore} from '../src/core/store.js';
import {readConfig} from '../src/core/config.js';
test('persistencia atómica: mantiene las advertencias y no guarda tokens',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dashers-state-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const store=new JsonStore(dir);store.value.warnings['123']=[{reason:'Prueba'}];store.save();
  const loaded=new JsonStore(dir);assert.equal(loaded.value.warnings['123'][0].reason,'Prueba');
  assert.ok(!fs.readFileSync(path.join(dir,'state.json'),'utf8').includes('BOT_TOKEN'));
});
test('estado corrupto nunca se sobreescribe automáticamente',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dashers-bad-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  fs.writeFileSync(path.join(dir,'state.json'),'{roto');
  assert.throws(()=>new JsonStore(dir),/estado persistente/);
  assert.equal(fs.readFileSync(path.join(dir,'state.json'),'utf8'),'{roto');
});
test('configuración rechaza valores inválidos y nunca imprime secretos',()=>{
  assert.throws(()=>readConfig({BOT_TOKEN:''}),/secretos/);
  const result=readConfig({BOT_TOKEN:'fake-long-testing-token-123',CLIENT_ID:'1554881611202437221',GUILD_ID:'1554862905294463078'});
  assert.equal(result.guildId,'1554862905294463078');
});
