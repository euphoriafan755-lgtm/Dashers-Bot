import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLevel,getFeaturedLevel,formatLevel,requestGame} from '../src/services/geometryDash.js';
import {selectAnnouncements} from '../src/services/steamNews.js';
test('parser GD valida IDs y sanitiza menciones',()=>{
  assert.deepEqual(parseLevel('1:123:2:Ejemplo:6:44:#hash'),{id:'123',name:'Ejemplo',creatorId:'44'});
  assert.throws(()=>parseLevel('-1'));
  assert.match(formatLevel({kind:'daily',name:'@everyone',id:'123',index:'22'}),/＠everyone/);
});
test('Daily usa solamente endpoints fijos y captura índice y nivel',async()=>{
  const urls=[];
  const mock=async url=>{urls.push(url);return {ok:true,text:async()=>urls.length===1?'912|20':'1:444:2:Daily Demo:6:3:#hash'};};
  assert.deepEqual(await getFeaturedLevel('daily',mock),{id:'444',name:'Daily Demo',creatorId:'3',kind:'daily',index:'912'});
  assert.deepEqual(urls,['https://www.boomlings.com/database/getGJDailyLevel.php',
    'https://www.boomlings.com/database/downloadGJLevel22.php']);
  await assert.rejects(requestGame('evil.php',{},mock),/no permitido/);
});
test('noticias Steam sólo acepta publicaciones oficiales y enlaces permitidos',()=>{
  const news=selectAnnouncements({appnews:{newsitems:[
    {gid:'2',title:'Bien',url:'https://steamcommunity.com/games/322170/announcements/detail/1',feedname:'steam_community_announcements',date:2},
    {gid:'3',title:'Mal',url:'https://sitio-ejemplo.com/123',feedname:'steam_community_announcements',date:3},
    {gid:'4',title:'Otro',url:'https://steamcommunity.com/news',feedname:'otro',date:4}
  ]}});
  assert.equal(news.length,1);assert.equal(news[0].id,'2');
});
