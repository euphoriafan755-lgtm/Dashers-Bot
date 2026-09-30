import {getFeaturedLevel,formatLevel} from './geometryDash.js';
import {getAnnouncements} from './steamNews.js';

/** Separación entre datos públicos y publicación en Discord; jamás recibe tokens. */
export async function publishDaily(guild,state,{force=false,levelSource=getFeaturedLevel}={}) {
  if(!force&&!state.value.settings.daily)return [];
  const id=state.channel('daily');
  const channel=id&&await guild.channels.fetch(id).catch(()=>null);
  if(!channel?.isTextBased())return [];
  const sent=[];
  for(const kind of ['daily','weekly']){
    try{
      const level=await levelSource(kind), fingerprint=`${level.index}:${level.id}`;
      if(!force && state.value.dailySeen[kind]===fingerprint)continue;
      const role=state.role('pingdaily');
      const ping=role?`<@&${role}> `:'';
      await channel.send({content:ping+formatLevel(level),allowedMentions:{roles:role?[role]:[]}});
      state.value.dailySeen[kind]=fingerprint;state.save();sent.push(kind);
    }catch(error){console.warn(`[Daily ${kind}]`,error.message);}
  }
  return sent;
}
export async function publishNews(guild,state,{force=false,newsSource=getAnnouncements}={}) {
  if(!force&&!state.value.settings.news)return 0;
  const id=state.channel('official');
  const channel=id&&await guild.channels.fetch(id).catch(()=>null);
  if(!channel?.isTextBased())return 0;
  const articles=await newsSource();
  if(!state.value.newsInitialized && !force){
    state.value.newsSeen=articles.map(item=>item.id).slice(-60);
    state.value.newsInitialized=true;state.save();return 0;
  }
  let sent=0;
  for(const article of articles){
    if(!force&&state.value.newsSeen.includes(article.id))continue;
    await channel.send({content:`📰 **Noticia oficial de Geometry Dash**\n${article.title}\n${article.url}`,
      allowedMentions:{parse:[]}});
    state.value.newsSeen.push(article.id);
    state.value.newsSeen=state.value.newsSeen.slice(-80);state.save();sent++;
  }
  return sent;
}
export function beginAnnouncements(client,state,guildId,{intervalMs=3600000}={}){
  let busy=false;
  const tick=async()=>{
    if(busy||!state.value.setupComplete)return;
    busy=true;
    try{
      const guild=await client.guilds.fetch(guildId);
      await publishDaily(guild,state);
      await publishNews(guild,state).catch(e=>console.warn('[Noticias]',e.message));
    }catch(e){console.warn('[Actualizaciones]',e.message);}
    finally{busy=false;}
  };
  const initial=setTimeout(tick,15000);initial.unref?.();
  const recurring=setInterval(tick,intervalMs);recurring.unref?.();
  return ()=>{clearTimeout(initial);clearInterval(recurring);};
}
