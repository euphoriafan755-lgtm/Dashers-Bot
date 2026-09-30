import {Client,Events,GatewayIntentBits,Options,REST,Routes} from 'discord.js';
import {readConfig} from './core/config.js';
import {JsonStore} from './core/store.js';
import {startMaintenance} from './core/maintenance.js';
import {commandDefinitions,createCommandHandler} from './bot/commands.js';
import {onJoin,onLeave,onMessage,onVoice,recoverRooms,postStats,onButton,dropExpiredSpam} from './bot/features.js';
import {beginAnnouncements} from './services/announcements.js';

const config=readConfig();
const state=new JsonStore(config.dataDir);
const maintenance=startMaintenance({dataDir:config.dataDir,limitMiB:config.memoryLimitMiB,onPrune:dropExpiredSpam});
const bot=new Client({
  intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers,GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,GatewayIntentBits.GuildVoiceStates],
  makeCache:Options.cacheWithLimits({MessageManager:20,ReactionManager:10,PresenceManager:0,UserManager:400}),
  sweepers:{messages:{interval:300,lifetime:1200}}
});
const handleCommand=createCommandHandler({state,maintenance,guildId:config.guildId});
let stopAnnouncements=()=>{};
let statsTimer=null;
bot.once(Events.ClientReady,async()=>{
  console.info(`[Dashers] Conectado como ${bot.user.tag}`);
  const guild=await bot.guilds.fetch(config.guildId).catch(()=>null);
  if(!guild){console.error('[Dashers] No se encontró el servidor configurado.');return;}
  if(state.value.setupComplete){
    await recoverRooms(guild,state).catch(e=>console.warn('[Salas]',e.message));
    await postStats(guild,state).catch(e=>console.warn('[Estadísticas]',e.message));
  }
  stopAnnouncements=beginAnnouncements(bot,state,config.guildId);
  statsTimer=setInterval(()=>{
    if(state.value.setupComplete)postStats(guild,state).catch(e=>console.warn('[Estadísticas]',e.message));
  },6*3600000);
  statsTimer.unref?.();
});
bot.on(Events.InteractionCreate,async i=>{
  if(i.guildId!==config.guildId)return;
  try{
    if(i.isChatInputCommand())await handleCommand(i);
    else if(i.isButton())await onButton(i,state);
  }catch(error){
    console.error('[Interacción]',error.message);
    const message={content:'Ocurrió un error. El staff puede revisar los registros.',ephemeral:true};
    try{if(i.deferred||i.replied)await i.followUp(message);else await i.reply(message);}catch{}
  }
});
bot.on(Events.GuildMemberAdd,m=>onJoin(m,state,config.guildId).catch(e=>console.error('[Bienvenida]',e.message)));
bot.on(Events.GuildMemberRemove,m=>onLeave(m,state,config.guildId).catch(e=>console.error('[Despedida]',e.message)));
bot.on(Events.MessageCreate,m=>onMessage(m,state,config.guildId).catch(e=>console.warn('[Automod]',e.message)));
bot.on(Events.VoiceStateUpdate,(oldState,newState)=>onVoice(oldState,newState,state,config.guildId).catch(e=>console.error('[Voz]',e.message)));
bot.on(Events.Error,e=>console.error('[Discord]',e.message));
process.on('unhandledRejection',error=>console.error('[Promesa]',error?.message||'Error desconocido'));
function shutdown(){stopAnnouncements();if(statsTimer)clearInterval(statsTimer);maintenance.stop();bot.destroy();}
process.once('SIGTERM',shutdown);
process.once('SIGINT',shutdown);

// Comandos de UN servidor: cambios casi instantáneos. Credencial sólo en memoria del proceso.
const rest=new REST({version:'10'}).setToken(config.token);
await rest.put(Routes.applicationGuildCommands(config.clientId,config.guildId),
  {body:commandDefinitions.map(command=>command.toJSON())});
console.info('[Dashers] Comandos registrados.');
await bot.login(config.token);
