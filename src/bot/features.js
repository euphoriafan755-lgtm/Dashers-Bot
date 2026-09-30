import {ActionRowBuilder,ButtonBuilder,ButtonStyle,ChannelType,EmbedBuilder,PermissionFlagsBits} from 'discord.js';
import {isStaff} from './provision.js';

const recentMessages=new Map();
const ticketLocks=new Set();
const permissions=PermissionFlagsBits;

async function getChannel(guild,state,key) {
  const id=state.channel(key);
  return id ? guild.channels.fetch(id).catch(()=>null) : null;
}
export async function audit(guild,state,description) {
  const channel=await getChannel(guild,state,'logs');
  if (channel?.isTextBased()) {
    await channel.send({content:String(description).replaceAll('@','＠').slice(0,1800),allowedMentions:{parse:[]}})
      .catch(error=>console.warn('[AUDIT] No se pudo escribir:',error.message));
  }
}
export async function onJoin(member,state,configuredGuild) {
  if(member.guild.id!==configuredGuild || !state.value.setupComplete)return;
  const ch=await getChannel(member.guild,state,'welcome');
  // No se otorga rol Miembro: las admisiones se deciden fuera del bot.
  if(ch?.isTextBased())await ch.send({content:`👋 ¡Bienvenido/a, <@${member.id}>! Leé las reglas y esperá al staff para tener acceso.`,allowedMentions:{users:[member.id]}});
}
export async function onLeave(member,state,configuredGuild) {
  if(member.guild.id!==configuredGuild || !state.value.setupComplete)return;
  const ch=await getChannel(member.guild,state,'goodbye');
  const name=(member.user?.username||'Un integrante').replaceAll('@','＠').slice(0,50);
  if(ch?.isTextBased())await ch.send({content:`🚪 ${name} dejó Dashers Community ES.`,allowedMentions:{parse:[]}});
}
export function dropExpiredSpam(now=Date.now()) {
  for(const [id,entry] of recentMessages)if(now-entry.last>20000)recentMessages.delete(id);
  return recentMessages.size;
}
export async function onMessage(message,state,configuredGuild) {
  if(!state.value.setupComplete||!state.value.settings.antispam||message.guildId!==configuredGuild||message.author.bot)return;
  if(message.member?.permissions.has(permissions.ManageMessages))return;
  const now=Date.now(), key=message.author.id;
  const times=(recentMessages.get(key)?.times||[]).filter(t=>now-t<=10000);
  times.push(now);recentMessages.set(key,{times,last:now});
  if(recentMessages.size>5000)dropExpiredSpam(now);
  if(times.length!==6)return; // una advertencia por ráfaga; no censuramos lenguaje por heurísticas.
  if(message.deletable)await message.delete().catch(()=>{});
  const warnings=state.value.warnings[key]||[];
  warnings.push({at:now,by:'automod',reason:'6 mensajes en 10 segundos'});
  state.value.warnings[key]=warnings;state.save();
  await audit(message.guild,state,`⚠️ Posible spam: ${message.author.username}. Advertencia automática.`);
}
export async function onVoice(previous,current,state,configuredGuild) {
  if(!state.value.setupComplete||current.guild.id!==configuredGuild)return;
  const lobby=state.channel('joinvoice');
  if(current.channelId===lobby && previous.channelId!==lobby){
    const name=(current.member?.displayName||'integrante').slice(0,65);
    let created;
    try {
      created=await current.guild.channels.create({name:`🎮 Sala de ${name}`,type:ChannelType.GuildVoice,
        parent:current.channel.parentId,reason:'Dashers: sala temporal'});
      state.value.tempRooms[created.id]={owner:current.id,createdAt:Date.now()};state.save();
      await current.setChannel(created);
    } catch(e){
      if(created){await created.delete().catch(()=>{});delete state.value.tempRooms[created.id];state.save();}
      await audit(current.guild,state,`No se pudo crear una sala temporal: ${e.message}`);
    }
  }
  const oldId=previous.channelId;
  if(oldId&&state.value.tempRooms[oldId]){
    const oldChannel=await current.guild.channels.fetch(oldId).catch(()=>null);
    if(!oldChannel||oldChannel.members.size===0){
      if(oldChannel)await oldChannel.delete('Sala temporal vacía').catch(()=>{});
      delete state.value.tempRooms[oldId];state.save();
    }
  }
}
export async function recoverRooms(guild,state) {
  await guild.channels.fetch();
  for(const id of Object.keys(state.value.tempRooms)){
    const room=guild.channels.cache.get(id);
    if(!room||room.type!==ChannelType.GuildVoice||room.members.size===0){
      if(room)await room.delete('Limpieza de sala temporal').catch(()=>{});
      delete state.value.tempRooms[id];state.save();
    }
  }
}
export async function postStats(guild,state){
  const ch=await getChannel(guild,state,'statistics');
  if(!ch?.isTextBased())return false;
  const embed=new EmbedBuilder().setTitle('📊 Dashers Community ES').setColor(0x9146FF).addFields(
    {name:'Integrantes',value:String(guild.memberCount),inline:true},
    {name:'Tickets abiertos',value:String(Object.values(state.value.tickets).filter(t=>t.open).length),inline:true},
    {name:'Logros',value:String(state.value.achievements.length),inline:true}
  ).setTimestamp();
  const msgId=state.value.panelMessageIds.statistics;
  const old=msgId&&await ch.messages.fetch(msgId).catch(()=>null);
  const updated=old?await old.edit({embeds:[embed]}):await ch.send({embeds:[embed]});
  state.value.panelMessageIds.statistics=updated.id;state.save();return true;
}

export async function onButton(interaction,state){
  const action=interaction.customId;
  if(action.startsWith('role:')){
    const key=action.slice(5);
    if(!['pingdaily','pingevents'].includes(key))return;
    const roleId=state.role(key);
    const role=roleId&&await interaction.guild.roles.fetch(roleId).catch(()=>null);
    if(!role)return interaction.reply({content:'Ese rol no está configurado.',ephemeral:true});
    const member=await interaction.guild.members.fetch(interaction.user.id);
    const exists=member.roles.cache.has(roleId);
    try {if(exists)await member.roles.remove(role);else await member.roles.add(role);
      return interaction.reply({content:exists?'Notificaciones desactivadas.':'Notificaciones activadas.',ephemeral:true});}
    catch {return interaction.reply({content:'No tengo permiso para cambiar ese rol.',ephemeral:true});}
  }
  if(action==='ticket:open'){
    await interaction.deferReply({ephemeral:true});
    if(ticketLocks.has(interaction.user.id))return interaction.editReply('Ya estoy preparando tu ticket.');
    ticketLocks.add(interaction.user.id);
    try{
      const existing=Object.values(state.value.tickets).find(t=>t.open&&t.owner===interaction.user.id);
      if(existing){
        const ch=await interaction.guild.channels.fetch(existing.id).catch(()=>null);
        if(ch)return interaction.editReply(`Ya tenés un ticket abierto: ${ch}`);
        existing.open=false;state.save();
      }
      const groupId=state.channel('community');
      if(!groupId)return interaction.editReply('El servidor no está configurado.');
      const staff=['founder','admin','mod'].map(k=>state.role(k)).filter(Boolean);
      const overwrites=[
        {id:interaction.guild.roles.everyone.id,deny:[permissions.ViewChannel]},
        {id:interaction.user.id,allow:[permissions.ViewChannel,permissions.SendMessages,permissions.ReadMessageHistory]},
        ...staff.map(id=>({id,allow:[permissions.ViewChannel,permissions.SendMessages,permissions.ReadMessageHistory]})),
        {id:interaction.client.user.id,allow:[permissions.ViewChannel,permissions.SendMessages,permissions.ManageChannels]}
      ];
      const ch=await interaction.guild.channels.create({
        name:`ticket-${interaction.user.id.slice(-8)}`,parent:groupId,type:ChannelType.GuildText,
        permissionOverwrites:overwrites,reason:'Solicitud de soporte Dashers'
      });
      state.value.tickets[ch.id]={id:ch.id,owner:interaction.user.id,open:true,createdAt:Date.now()};state.save();
      const buttons=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket:close')
        .setLabel('Cerrar ticket').setStyle(ButtonStyle.Danger));
      await ch.send({content:`🎟️ Ticket privado de <@${interaction.user.id}>. Explicá tu consulta.`,
        allowedMentions:{users:[interaction.user.id]},components:[buttons]});
      await audit(interaction.guild,state,`Ticket creado por ${interaction.user.username}.`);
      return interaction.editReply(`Tu ticket está listo: ${ch}`);
    }catch(e){console.error('[Ticket]',e.message);return interaction.editReply('No se pudo abrir el ticket. Revisá los permisos.');}
    finally{ticketLocks.delete(interaction.user.id);}
  }
  if(action==='ticket:close'){
    const record=state.value.tickets[interaction.channelId];
    if(!record?.open)return interaction.reply({content:'Este canal no es un ticket abierto.',ephemeral:true});
    if(record.owner!==interaction.user.id&&!isStaff(interaction))return interaction.reply({content:'Solo el titular o el staff pueden cerrarlo.',ephemeral:true});
    await interaction.reply({content:'Cerrando ticket…',ephemeral:true});
    record.open=false;record.closedAt=Date.now();record.closedBy=interaction.user.id;state.save();
    await audit(interaction.guild,state,`Ticket cerrado por ${interaction.user.username}.`);
    await interaction.channel.delete('Ticket cerrado').catch(()=>{});
  }
}
