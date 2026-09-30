import 'dotenv/config';
import {Client,GatewayIntentBits,Events,REST,Routes,Options} from 'discord.js';
import resourceCare from './resourceCare.cjs';
import {setResourceMonitor} from './runtime.js';
import {commands} from './commands.js';
import {store} from './state.js';
import {handleButtons,memberJoin,memberLeave,handleVoice,recoverTemp,antiSpam,publishStats,pruneTransientCaches} from './features.js';
import {routeCommand} from './commands.js';
import {beginFeeds} from './feeds.js';
const {BOT_TOKEN,GUILD_ID,CLIENT_ID}=process.env;
if(!BOT_TOKEN||!/^\d{17,20}$/.test(GUILD_ID||'')||!/^\d{17,20}$/.test(CLIENT_ID||''))throw new Error('Definí BOT_TOKEN y GUILD_ID como secretos del hosting.');
store();
const client=new Client({
  intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent,GatewayIntentBits.GuildVoiceStates],
  // Limited caches minimize RAM for shared free hosting. Moderation still receives message events.
  makeCache:Options.cacheWithLimits({MessageManager:20,ReactionManager:10,PresenceManager:0,UserManager:500}),
  sweepers:{messages:{interval:300,lifetime:1200}}
});
// Only cleans Dashers-owned temp/cache/log files. Does NOT touch state.json, SQLite,
// uploads, backups or hosting-panel logs. Never attempts to bypass provider quotas.
const resourceMonitor=resourceCare.startResourceCare({
  dataDir:process.env.DATA_DIR||'./data',
  onPrune:()=>pruneTransientCaches(),
  onAlert:({type,snapshot})=>console.warn(`[Dashers Bot] ${type} alert:`,JSON.stringify(snapshot))
});
setResourceMonitor(resourceMonitor);
client.once(Events.ClientReady,async()=>{
  console.log(`🤖 Dashers Bot listo como ${client.user.tag}`);
  const g=await client.guilds.fetch(GUILD_ID).catch(()=>null);
  if(!g){console.error('No encontré el servidor configurado: revisá GUILD_ID y la invitación.');return;}
  if(store().setupComplete){await recoverTemp(g).catch(console.error);await publishStats(g).catch(e=>console.warn('[STATS]',e.message));}
  beginFeeds(client);
  const stats=setInterval(async()=>{try{if(store().setupComplete)await publishStats(g);}catch(e){console.warn('[STATS]',e.message);}},6*60*60*1000);
  stats.unref?.();
});
client.on(Events.InteractionCreate,async i=>{
  try{
    if(!i.guild||i.guildId!==GUILD_ID)return;
    if(i.isChatInputCommand())await routeCommand(i);
    else if(i.isButton())await handleButtons(i);
  }catch(e){console.error('[Interaction]',e);
    try{const message={content:'⚠️ Ocurrió un error. Revisá los registros del bot.',ephemeral:true};
      if(i.deferred||i.replied)await i.followUp(message);else await i.reply(message);
    }catch{}
  }
});
client.on(Events.GuildMemberAdd,m=>memberJoin(m).catch(console.error));
client.on(Events.GuildMemberRemove,m=>memberLeave(m).catch(console.error));
client.on(Events.MessageCreate,m=>antiSpam(m).catch(console.error));
client.on(Events.VoiceStateUpdate,(a,b)=>handleVoice(a,b).catch(console.error));
client.on(Events.Error,e=>console.error('[Discord]',e));
process.on('unhandledRejection',e=>console.error('[Promise]',e));
process.on('SIGTERM',()=>{console.log('[Sistema] Apagado controlado');resourceMonitor.stop();client.destroy();process.exitCode=0;});
process.on('SIGINT',()=>{console.log('[Sistema] Detenido');resourceMonitor.stop();client.destroy();process.exitCode=0;});
const rest=new REST({version:'10'}).setToken(BOT_TOKEN);
await rest.put(Routes.applicationGuildCommands(CLIENT_ID,GUILD_ID),{body:commands.map(c=>c.toJSON())});
console.log('[Comandos] Sincronizados automáticamente.');
await client.login(BOT_TOKEN);
