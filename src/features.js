import {ChannelType,PermissionFlagsBits,ActionRowBuilder,ButtonBuilder,ButtonStyle,EmbedBuilder} from 'discord.js';
import {store,save,getCh} from './state.js';
import {canModerate} from './setup.js';

async function textCh(guild,key){const id=getCh(key);return id?guild.channels.fetch(id).catch(()=>null):null;}
export async function log(guild,msg){
  try{const ch=await textCh(guild,'logs');if(ch?.isTextBased())await ch.send({content:String(msg).slice(0,1800),allowedMentions:{parse:[]}});}catch(e){console.warn('[LOG]',e.message);}
}
export async function memberJoin(m){
  if(m.guild.id!==process.env.GUILD_ID)return;
  const ch=await textCh(m.guild,'welcome');
  // No asignar automáticamente «Miembro»: Thiago decide las admisiones en TikTok.
  if(ch?.isTextBased())await ch.send({content:`👋 ¡Bienvenido/a, ${m}! Leé <#${getCh('rules')||ch.id}> y esperá a que el staff confirme tu acceso.`,allowedMentions:{users:[m.id]}});
}
export async function memberLeave(m){
  if(m.guild.id!==process.env.GUILD_ID)return;
  const ch=await textCh(m.guild,'goodbye');if(ch?.isTextBased())await ch.send({content:`🚪 Se fue **${m.user?.username||'un miembro'}**. ¡Nos vemos!`,allowedMentions:{parse:[]}});
}
const ticketLocks=new Set();
export async function handleButtons(i){
  const s=store();
  if(i.customId.startsWith('role:')){
    const key=i.customId.slice(5);
    if(!['pingdaily','pingevents'].includes(key))return i.reply({content:'Rol de notificación desconocido.',ephemeral:true});
    const roleId=s.roles[key];if(!roleId)return i.reply({content:'Primero ejecutá /setup.',ephemeral:true});
    const member=await i.guild.members.fetch(i.user.id);
    const role=i.guild.roles.cache.get(roleId);
    if(!role)return i.reply({content:'Ese rol ya no existe.',ephemeral:true});
    const has=member.roles.cache.has(roleId);
    try{has?await member.roles.remove(role):await member.roles.add(role);
      return i.reply({content:has?'Notificaciones desactivadas.':'¡Notificaciones activadas!',ephemeral:true});}
    catch(e){return i.reply({content:'No pude cambiar el rol. Revisá la posición del rol del bot.',ephemeral:true});}
  }
  if(i.customId==='ticket:open'){
    await i.deferReply({ephemeral:true});
    if(ticketLocks.has(i.user.id))return i.editReply('Ya se está abriendo tu ticket.');
    ticketLocks.add(i.user.id);
    try{
      const previous=Object.values(s.tickets).find(t=>t.owner===i.user.id&&t.open);
      if(previous){const existing=await i.guild.channels.fetch(previous.channelId).catch(()=>null);if(existing)return i.editReply(`Ya tenés un ticket: ${existing}`);previous.open=false;save();}
      const cat=getCh('community');if(!cat)return i.editReply('El servidor todavía no está configurado.');
      const staff=['founder','admin','mod'].map(x=>s.roles[x]).filter(Boolean);
      const overwrites=[{id:i.guild.roles.everyone.id,deny:[PermissionFlagsBits.ViewChannel]},
        {id:i.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]},
        ...staff.map(id=>({id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]})),{id:i.client.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ManageChannels]}];
      const channel=await i.guild.channels.create({name:`ticket-${i.user.username.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,12)||'usuario'}-${i.user.id.slice(-4)}`,type:ChannelType.GuildText,parent:cat,permissionOverwrites:overwrites,reason:'Ticket de soporte Dashers'});
      s.tickets[channel.id]={channelId:channel.id,owner:i.user.id,open:true,createdAt:Date.now()};save();
      const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket:close').setLabel('Cerrar ticket').setStyle(ButtonStyle.Danger));
      await channel.send({content:`🎟️ Ticket privado de <@${i.user.id}>. Contanos brevemente en qué necesitás ayuda.`,allowedMentions:{users:[i.user.id]},components:[row]});
      await log(i.guild,`🎟️ Ticket abierto por ${i.user.username}.`);
      return i.editReply(`Tu ticket está listo: ${channel}`);
    }catch(e){console.error(e);return i.editReply('No pude abrir el ticket. Revisá los permisos.');}
    finally{ticketLocks.delete(i.user.id);}
  }
  if(i.customId==='ticket:close'){
    const ticket=s.tickets[i.channelId];
    if(!ticket?.open)return i.reply({content:'No hay un ticket abierto aquí.',ephemeral:true});
    if(ticket.owner!==i.user.id&&!canModerate(i))return i.reply({content:'Solo el titular o el staff pueden cerrarlo.',ephemeral:true});
    await i.reply({content:'🔒 Cerrando ticket…',ephemeral:true});
    ticket.open=false;ticket.closedBy=i.user.id;ticket.closedAt=Date.now();save();
    await log(i.guild,`🔒 Ticket ${i.channel?.name} cerrado por ${i.user.username}.`);
    try{await i.channel.delete('Ticket cerrado por '+i.user.username);}catch(e){await log(i.guild,'Error cerrando ticket: '+e.message);}
    return;
  }
}
const spamMap=new Map();
export function pruneTransientCaches(now=Date.now()){
  // Ephemeral anti-spam activity expires automatically, keeping persistent warnings intact.
  let purged=0;
  for(const [key,records] of spamMap){
    const recent=records.filter(t=>now-t<15000);
    if(recent.length)spamMap.set(key,recent);
    else{spamMap.delete(key);purged++;}
  }
  return purged;
}
export async function antiSpam(m){
  if(!m.guild||m.guild.id!==process.env.GUILD_ID||m.author.bot||!store().settings.antispam)return;
  if(m.member?.permissions?.has(PermissionFlagsBits.ManageMessages))return;
  const key=m.guild.id+':'+m.author.id,now=Date.now();
  const times=(spamMap.get(key)||[]).filter(t=>now-t<10000);times.push(now);spamMap.set(key,times);
  if(spamMap.size>5000)spamMap.clear();
  if(times.length===6){
    if(m.deletable)await m.delete().catch(()=>{});
    const warning=store().warnings[m.author.id]||[];
    warning.push({at:now,by:'automod',reason:'Posible spam: ≥6 mensajes en 10 s'});
    store().warnings[m.author.id]=warning;save();
    await log(m.guild,`⚠️ Posible spam de ${m.author.username}. Mensaje eliminado si hubo permisos. No se aplicó sanción automática adicional.`);
  }
}
export async function handleVoice(oldState,newState){
  const g=newState.guild;if(g.id!==process.env.GUILD_ID)return;
  const s=store(),join=getCh('joinvoice');
  if(newState.channelId===join&&oldState.channelId!==join){
    try{
      const ch=await g.channels.create({name:`🎮 ${newState.member?.displayName?.slice(0,70)||'Sala temporal'}`,type:ChannelType.GuildVoice,parent:newState.channel.parentId,reason:'Sala temporal Dashers'});
      s.tempRooms[ch.id]={creator:newState.id,at:Date.now()};save();
      await newState.setChannel(ch);
    }catch(e){await log(g,`No se pudo crear sala temporal: ${e.message}`);}
  }
  if(oldState.channelId&&s.tempRooms[oldState.channelId]){
    const ch=await g.channels.fetch(oldState.channelId).catch(()=>null);
    if(!ch||ch.members.size===0){if(ch)await ch.delete('Sala temporal vacía').catch(()=>{});delete s.tempRooms[oldState.channelId];save();}
  }
}
export async function recoverTemp(guild){
  const s=store();for(const id of Object.keys(s.tempRooms)){
    const ch=await guild.channels.fetch(id).catch(()=>null);
    if(!ch||ch.type!==ChannelType.GuildVoice){delete s.tempRooms[id];save();continue;}
    if(ch.members.size===0){await ch.delete('Limpieza de sala temporal vacía').catch(()=>{});delete s.tempRooms[id];save();}
  }
}
export async function publishStats(guild){
  const s=store();const ch=await textCh(guild,'statistics');if(!ch?.isTextBased())return;
  // Do NOT fetch every GuildMember here: large member caches can exhaust free 512 MiB hosting.
  // Discord memberCount is kept updated by the gateway without a full members fetch.
  const embed=new EmbedBuilder().setTitle('📊 Dashers Community ES').setColor(0x9146FF)
    .addFields({name:'Miembros en Discord',value:String(guild.memberCount),inline:true},{name:'Tickets abiertos',value:String(Object.values(s.tickets).filter(t=>t.open).length),inline:true},{name:'Logros registrados',value:String(s.achievements.length),inline:true})
    .setFooter({text:'Actualización periódica • Dashers Bot'}).setTimestamp();
  const old=s.panelMessageIds.stats&&await ch.messages.fetch(s.panelMessageIds.stats).catch(()=>null);
  const msg=old?await old.edit({embeds:[embed]}):await ch.send({embeds:[embed]});s.panelMessageIds.stats=msg.id;save();
}
