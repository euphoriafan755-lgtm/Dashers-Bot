import {ChannelType,PermissionFlagsBits,EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle} from 'discord.js';
import {ROLES,CATEGORIES,FORUM_TAGS,TOTAL_CHANNELS} from './manifest.js';
import {store,save,getCh} from './state.js';

const typeOf = t => t==='forum'?ChannelType.GuildForum:t==='media'?ChannelType.GuildMedia:(t==='voice'||t==='join')?ChannelType.GuildVoice:ChannelType.GuildText;
export function canAdmin(i){return i.guild && (i.user.id===i.guild.ownerId || i.memberPermissions?.has(PermissionFlagsBits.Administrator));}
export function canModerate(i){return canAdmin(i)||i.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)||i.memberPermissions?.has(PermissionFlagsBits.ManageMessages);}
export async function preview(guild){
  await Promise.all([guild.channels.fetch(),guild.roles.fetch()]);
  const missingRoles=ROLES.filter(r=>!guild.roles.cache.some(x=>x.name===r.name));
  const missingCategories=CATEGORIES.filter(c=>!guild.channels.cache.some(x=>x.type===ChannelType.GuildCategory&&x.name===c.name));
  // Apenas estima por nombre y categoría; apply valida los IDs del estado persistente.
  const missingChannels=CATEGORIES.flatMap(c=>c.channels.filter(([n])=>!guild.channels.cache.some(x=>x.name===n&&x.parent?.name===c.name)));
  return {missingRoles:missingRoles.length,missingCategories:missingCategories.length,missingChannels:missingChannels.length,forumsRequireCommunity:!guild.features.includes('COMMUNITY')};
}
export async function applySetup(guild,onProgress=()=>{}){
  if (!guild.features.includes('COMMUNITY')) throw new Error('Activá Servidor de comunidad en Discord antes de crear los foros.');
  await Promise.all([guild.roles.fetch(),guild.channels.fetch()]);
  const me=await guild.members.fetchMe();
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)||!me.permissions.has(PermissionFlagsBits.ManageChannels))throw new Error('Faltan permisos Manage Roles y Manage Channels.');
  const s=store();
  // Crear roles desde abajo. Respeta roles existentes. No reemplaza roles/canales ajenos.
  for(const spec of [...ROLES].reverse()){
    let role=s.roles[spec.key]&&guild.roles.cache.get(s.roles[spec.key]);
    role ||= guild.roles.cache.find(r=>r.name===spec.name);
    if(!role){role=await guild.roles.create({name:spec.name,color:spec.color,hoist:spec.hoist,mentionable:false,reason:'Dashers Bot: configuración inicial'});onProgress('Rol creado: '+spec.name);}
    s.roles[spec.key]=role.id;save();
  }
  // Sólo configura permisos de roles recién creados/recuperados si NO elevan privilegios sin control.
  try{const botRole=guild.roles.cache.get(s.roles.bots);if(botRole&&me.roles.highest.comparePositionTo(botRole)>0&&!me.roles.cache.has(botRole.id))await me.roles.add(botRole,'Dashers Bot: categoría Bots');}catch(e){onProgress('Aviso: asigná Bots manualmente: '+e.message);}
  const adminRole=guild.roles.cache.get(s.roles.admin);
  const modRole=guild.roles.cache.get(s.roles.mod);
  // Concede permisos mínimos necesarios solo a roles staff; el fundador es el dueño real de Discord.
  for(const [role,perms] of [
    [adminRole,[PermissionFlagsBits.ManageGuild,PermissionFlagsBits.ManageChannels,PermissionFlagsBits.ManageMessages,PermissionFlagsBits.ModerateMembers,PermissionFlagsBits.ViewAuditLog]],
    [modRole,[PermissionFlagsBits.ManageMessages,PermissionFlagsBits.ModerateMembers]]
  ])if(role&&me.roles.highest.comparePositionTo(role)>0 && role.permissions.bitfield===0n) await role.setPermissions(perms,'Dashers Bot: permisos de staff previstos');
  try{const owner=await guild.fetchOwner();const founder=guild.roles.cache.get(s.roles.founder);if(founder&&me.roles.highest.comparePositionTo(founder)>0&&!owner.roles.cache.has(founder.id))await owner.roles.add(founder,'Dashers Bot: rol de propietario');}catch(e){onProgress('Aviso: asigná Fundador manualmente si el bot está por debajo del rol: '+e.message);}
  for(const catSpec of CATEGORIES){
    let cat=s.channels[catSpec.key]&&guild.channels.cache.get(s.channels[catSpec.key]);
    cat ||=guild.channels.cache.find(x=>x.type===ChannelType.GuildCategory&&x.name===catSpec.name);
    if(!cat){
      const overwrites=catSpec.private ? [{id:guild.roles.everyone.id,deny:[PermissionFlagsBits.ViewChannel]},...['founder','admin','mod'].map(key=>({id:s.roles[key],allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages]})),{id:me.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ManageChannels]}]:undefined;
      cat=await guild.channels.create({name:catSpec.name,type:ChannelType.GuildCategory,permissionOverwrites:overwrites,reason:'Dashers Bot: crear categoría'});
      onProgress('Categoría: '+catSpec.name);
    }
    s.channels[catSpec.key]=cat.id;save();
    for(const [name,kind,key] of catSpec.channels){
      const expected=typeOf(kind);
      let ch=s.channels[key]&&guild.channels.cache.get(s.channels[key]);
      ch ||=guild.channels.cache.find(x=>x.name===name&&x.parentId===cat.id&&x.type===expected);
      if(!ch){
        const tags=FORUM_TAGS[key]?.map(n=>({name:n,moderated:false}))||[];
        // Canales normales: requisitos de miembro oficial. IMPORTANT es público (solo lectura si procede).
        const isStaff=!!catSpec.private;
        const noPost=['welcome','goodbye','announcements','rules','roles','support','howto','daily','official','members','memberchannels','statistics','achievements','calendar','events'].includes(key);
        const overwrites=isStaff?undefined:[
          {id:guild.roles.everyone.id,allow:catSpec.key==='important'?[PermissionFlagsBits.ViewChannel]:[],deny:catSpec.key==='important'&&noPost?[PermissionFlagsBits.SendMessages]:catSpec.key==='important'?[]:[PermissionFlagsBits.ViewChannel]},
          ...(noPost?[...['founder','admin','mod'].map(key=>({id:s.roles[key],allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages]})),{id:me.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages]}]:[]), ...(catSpec.key==='important'?[]:[{id:s.roles.member,allow:[PermissionFlagsBits.ViewChannel]}])
        ];
        const base={name,parent:cat.id,type:expected,reason:'Dashers Bot: crear canal',permissionOverwrites:overwrites};
        if(kind==='forum'){base.availableTags=tags;base.defaultAutoArchiveDuration=1440;}
        if(kind==='voice'||kind==='join'){base.bitrate=64000;if(kind==='join')base.userLimit=1;}
        try{ch=await guild.channels.create(base);}
        catch(e){if(kind!=='media')throw e;ch=await guild.channels.create({...base,type:ChannelType.GuildText},'Dashers Bot: respaldo para canal multimedia');onProgress('Canal multimedia no disponible; usando texto con archivos adjuntos.');}
        onProgress('Canal: '+name);
      }
      s.channels[key]=ch.id;save();
    }
  }
  s.setupComplete=true;save();
  onProgress('Listo: '+TOTAL_CHANNELS+' canales previstos, '+ROLES.length+' roles.');
  return {roles:ROLES.length,channels:TOTAL_CHANNELS};
}
export async function sendPanels(guild){
  const s=store();
  const messages=[];
  const roleChannel=await guild.channels.fetch(getCh('roles')).catch(()=>null);
  if(roleChannel?.isTextBased()){
    const embed=new EmbedBuilder().setColor(0x9146FF).setTitle('🎭 Tus notificaciones').setDescription('Activá o desactivá las notificaciones que querés recibir. Los roles de streamer, creador y dificultades se asignan desde el staff.');
    const row=new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('role:pingdaily').setLabel('☀️ Daily / Weekly').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('role:pingevents').setLabel('🎉 Eventos').setStyle(ButtonStyle.Secondary)
    );
    const old=s.panelMessageIds.roles&&await roleChannel.messages.fetch(s.panelMessageIds.roles).catch(()=>null);
    const msg=old?await old.edit({embeds:[embed],components:[row]}):await roleChannel.send({embeds:[embed],components:[row]});
    s.panelMessageIds.roles=msg.id;messages.push('roles');
  }
  const ticketChannel=await guild.channels.fetch(getCh('support')).catch(()=>null);
  if(ticketChannel?.isTextBased()){
    const embed=new EmbedBuilder().setColor(0x38BDF8).setTitle('🎟️ Soporte Dashers').setDescription('¿Necesitás ayuda con el servidor? Abrí un ticket privado. No hace falta explicar datos personales en público.');
    const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket:open').setLabel('Abrir ticket').setEmoji('🎟️').setStyle(ButtonStyle.Primary));
    const old=s.panelMessageIds.support&&await ticketChannel.messages.fetch(s.panelMessageIds.support).catch(()=>null);
    const msg=old?await old.edit({embeds:[embed],components:[row]}):await ticketChannel.send({embeds:[embed],components:[row]});
    s.panelMessageIds.support=msg.id;messages.push('soporte');
  }
  save();return messages;
}
