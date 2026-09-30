import test from 'node:test';
import assert from 'node:assert/strict';
import {ROLES,CATEGORIES,FORUM_TAGS,TOTAL_CHANNELS} from '../src/catalog.js';
test('configuración aprobada: 8 categorías, 53 canales y 23 roles',()=>{
  assert.equal(CATEGORIES.length,8);assert.equal(TOTAL_CHANNELS,53);assert.equal(ROLES.length,23);
});
test('8 visibles y 15 ocultos, sin IDs repetidos',()=>{
  assert.equal(ROLES.filter(r=>r.hoist).length,8);
  assert.equal(ROLES.filter(r=>!r.hoist).length,15);
  const keys=CATEGORIES.flatMap(c=>c.channels.map(x=>x[2]));
  assert.equal(new Set(keys).size,keys.length);
});
test('los foros tienen etiquetas y no hay canales rechazados',()=>{
  const names=CATEGORIES.flatMap(c=>c.channels.map(x=>x[0]));
  const rejected=['📩・postulaciones','📊・estado-del-bot','📊・encuestas','🏅・logros-comunidad',
    '🆔・niveles-para-jugar','📹・completions-destacadas','📊・ranking-del-grupo',
    '🎂・cumpleaños','🗳️・decisiones-del-grupo','⏳ Sala de espera','🔍・revision-de-requisitos','🔊 Reunión Staff'];
  for(const name of rejected)assert.ok(!names.includes(name),name);
  for(const c of CATEGORIES)for(const [,type,key] of c.channels)
    if(type==='forum')assert.ok(FORUM_TAGS[key]?.length,key);
});
