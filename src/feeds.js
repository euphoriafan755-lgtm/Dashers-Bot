import {store,save,getCh} from './state.js';

async function limitedFetch(url,opts={}){
  const r=await fetch(url,{...opts,signal:AbortSignal.timeout(9000)});
  if(!r.ok)throw new Error('HTTP '+r.status+' de '+new URL(url).hostname);
  return r;
}
const GD_BASE='https://www.boomlings.com/database/';
async function gdPost(endpoint,form){
  const body=new URLSearchParams({secret:'Wmfd2893gb7',gameVersion:'22',...form});
  const r=await limitedFetch(GD_BASE+endpoint,{method:'POST',headers:{'User-Agent':'','Content-Type':'application/x-www-form-urlencoded'},body});
  const text=await r.text();
  if(!text||text==='-1')throw new Error('Geometry Dash no devolvió datos válidos.');
  return text;
}
export function parseLevel(raw){
  // downloadGJLevel22 devuelve key:value ... # hash: procesar solo primer segmento.
  const arr=raw.split('#')[0].split(':');
  const obj={};
  for(let i=0;i<arr.length-1;i+=2)obj[arr[i]]=arr[i+1];
  if(!/^\d+$/.test(obj['1']||'')||!obj['2'])throw new Error('Respuesta de nivel incompleta.');
  return {id:obj['1'],name:obj['2'],creatorId:obj['6']||null};
}
export async function fetchTimely(kind){
  if(!['daily','weekly'].includes(kind))throw new Error('Tipo de nivel desconocido');
  const type=kind==='daily'?'0':'1';
  const indexRaw=await gdPost('getGJDailyLevel.php',{type});
  const index=indexRaw.split('|')[0];
  if(!/^\d+$/.test(index))throw new Error('Índice Daily/Weekly no válido.');
  const level=await gdPost('downloadGJLevel22.php',{levelID:kind==='daily'?'-1':'-2'});
  return {...parseLevel(level),index,kind};
}
const safeText=x=>String(x||'').replaceAll('@','＠').slice(0,180);
export function formatTimely(l){return `${l.kind==='daily'?'☀️ DAILY LEVEL':'🌙 WEEKLY DEMON'}\n**${safeText(l.name)}**\n🆔 Nivel: \`${l.id}\` · Nº ${l.index}\nAbrilo en Geometry Dash buscando el ID.`;}
export async function pollDaily(guild,force=false){
  const s=store();if(!force&&(!s.settings.daily||process.env.GD_FEED_ENABLED==='false'))return [];
  const channel=await guild.channels.fetch(getCh('daily')).catch(()=>null);if(!channel?.isTextBased())return [];
  const results=[];
  for(const kind of ['daily','weekly']){
    try{
      const data=await fetchTimely(kind);
      const current=`${data.index}:${data.id}`;
      if(force||s.dailySeen[kind]!==current){
        // Si es la primera vez, se publica el nivel actual. En reinicios posteriores no se repite.
        const ping=s.roles.pingdaily?`<@&${s.roles.pingdaily}> `:'';
        await channel.send({content:ping+formatTimely(data),allowedMentions:{roles:s.roles.pingdaily?[s.roles.pingdaily]:[]}});
        s.dailySeen[kind]=current;save();results.push(kind);
      }
    }catch(e){console.warn('[GD]',kind,e.message);}
  }
  return results;
}
export async function pollNews(guild,force=false){
  const s=store();if(!force&&(!s.settings.news||process.env.STEAM_FEED_ENABLED==='false'))return [];
  const ch=await guild.channels.fetch(getCh('official')).catch(()=>null);if(!ch?.isTextBased())return [];
  const url='https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=322170&count=15&maxlength=250';
  const data=await (await limitedFetch(url)).json();
  const articles=(data.appnews?.newsitems||[])
    .filter(n=>!n.is_external_url && String(n.feedname||'').includes('steam_community_announcements'))
    .sort((a,b)=>a.date-b.date);
  if(!s.newsInitialized&&!force){
    // Primer inicio: sin publicar anuncios antiguos.
    s.newsSeen=articles.map(n=>String(n.gid)).slice(-50);s.newsInitialized=true;save();return [];
  }
  const found=[];
  for(const item of articles){
    const id=String(item.gid);if(s.newsSeen.includes(id)&&!force)continue;
    const cleanUrl=String(item.url||'');
    if(!/^https:\/\/(store\.steampowered\.com|steamcommunity\.com|store\.steamcommunity\.com)\//i.test(cleanUrl))continue;
    await ch.send({content:`📰 **Anuncio oficial de Geometry Dash (Steam)**\n**${safeText(item.title)}**\n${cleanUrl}`,allowedMentions:{parse:[]}});
    s.newsSeen.push(id);s.newsSeen=s.newsSeen.slice(-80);save();found.push(id);
  }
  return found;
}
export function beginFeeds(client){
  let running=false;
  async function update(){
    if(running)return;running=true;
    try{const guild=await client.guilds.fetch(process.env.GUILD_ID);if(!store().setupComplete)return;
      await pollDaily(guild);try{await pollNews(guild);}catch(e){console.warn('[Steam]',e.message);}
    }catch(e){console.warn('[Feeds]',e.message);}finally{running=false;}
  }
  // Dar tiempo a que el bot y su caché terminen de cargar.
  const initial=setTimeout(update,15000);initial.unref?.();
  const timer=setInterval(update,60*60*1000);timer.unref?.();
  return ()=>{clearTimeout(initial);clearInterval(timer);};
}
