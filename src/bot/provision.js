import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType,
  EmbedBuilder, PermissionFlagsBits
} from 'discord.js';
import {ROLES, CATEGORIES, FORUM_TAGS, TOTAL_CHANNELS} from '../catalog.js';

const P = PermissionFlagsBits;
const kinds = {text: ChannelType.GuildText, media: ChannelType.GuildMedia,
  forum: ChannelType.GuildForum, voice: ChannelType.GuildVoice, join: ChannelType.GuildVoice};
const READ_ONLY = new Set(['welcome','goodbye','announcements','rules','roles','howto','events',
  'daily','official','members','memberchannels','statistics','achievements','calendar','support']);

export function totals() {return {categories: CATEGORIES.length, channels: TOTAL_CHANNELS, roles: ROLES.length};}
export function isAdmin(interaction) {return interaction.guild?.ownerId === interaction.user.id || interaction.memberPermissions?.has(P.Administrator);}
export function isStaff(interaction) {return isAdmin(interaction) || interaction.memberPermissions?.has(P.ModerateMembers);}

function categoryPermissions(guild, spec, state, botId) {
  if (spec.private) return [
    {id: guild.roles.everyone.id, deny:[P.ViewChannel]},
    ...['founder','admin','mod'].map(k=>({id:state.role(k), allow:[P.ViewChannel,P.SendMessages]})).filter(x=>x.id),
    {id:botId,allow:[P.ViewChannel,P.SendMessages,P.ManageChannels]}
  ];
  if (spec.key === 'important') return [
    {id:guild.roles.everyone.id, allow:[P.ViewChannel],deny:[P.SendMessages]},
    ...['founder','admin','mod'].map(k=>({id:state.role(k),allow:[P.SendMessages]})).filter(x=>x.id),
    {id:botId,allow:[P.SendMessages]}
  ];
  return [
    {id:guild.roles.everyone.id,deny:[P.ViewChannel]},
    {id:state.role('member'),allow:[P.ViewChannel,P.SendMessages,P.Connect,P.Speak]},
    ...['founder','admin','mod'].map(k=>({id:state.role(k),allow:[P.ViewChannel,P.SendMessages]})).filter(x=>x.id),
    {id:botId,allow:[P.ViewChannel,P.SendMessages,P.ManageChannels]}
  ];
}

export async function preview(guild, state) {
  await Promise.all([guild.roles.fetch(),guild.channels.fetch()]);
  const seenCategory = key => guild.channels.cache.find(c=>c.type===ChannelType.GuildCategory && c.name===key);
  const missingRoles = ROLES.filter(r=>!guild.roles.cache.has(state.role(r.key)) && !guild.roles.cache.some(ex=>ex.name===r.name));
  const missingCategories = CATEGORIES.filter(c=>!seenCategory(c.name));
  let missingChannels=0;
  for (const spec of CATEGORIES) {
    const category = seenCategory(spec.name);
    for (const [name,type,key] of spec.channels) {
      const existing = guild.channels.cache.get(state.channel(key));
      if (existing || category && guild.channels.cache.some(c=>c.name===name&&c.parentId===category.id))continue;
      missingChannels++;
    }
  }
  return {...totals(),missingRoles:missingRoles.length,missingCategories:missingCategories.length,
    missingChannels, needsCommunity:!guild.features.includes('COMMUNITY')};
}

/** Idempotente: nunca borra canales o roles preexistentes. Guarda progreso tras cada cambio. */
export async function provision(guild,state,progress=()=>{}) {
  if (!guild.features.includes('COMMUNITY')) throw new Error('Activá la función Comunidad del servidor para crear foros.');
  const bot = await guild.members.fetchMe();
  if (!bot.permissions.has(P.ManageChannels) || !bot.permissions.has(P.ManageRoles))
    throw new Error('Faltan los permisos Administrar canales y Administrar roles.');
  await Promise.all([guild.roles.fetch(),guild.channels.fetch()]);
  for (const spec of [...ROLES].reverse()) {
    let role = guild.roles.cache.get(state.role(spec.key));
    role ||= guild.roles.cache.find(r=>r.name===spec.name);
    if (!role) {
      role=await guild.roles.create({name:spec.name,color:spec.color,hoist:spec.hoist,
        mentionable:false,reason:'Dashers Bot: configuración inicial'});
      progress(`Rol creado: ${spec.name}`);
    }
    state.value.roles[spec.key]=role.id;state.save();
  }
  // Ningún usuario recibe Miembro automáticamente: Thiago controla las entradas en TikTok.
  const botRole=guild.roles.cache.get(state.role('bots'));
  if(botRole && bot.roles.highest.comparePositionTo(botRole)>0 && !bot.roles.cache.has(botRole.id)) {
    await bot.roles.add(botRole).catch(()=>progress('Asigná manualmente el rol Bots al bot.'));
  }
  // Los roles de staff se crean sin autoasignarse a terceros.
  const limitedPermissions={admin:[P.ManageGuild,P.ManageChannels,P.ManageMessages,P.ModerateMembers,P.ViewAuditLog],
    mod:[P.ManageMessages,P.ModerateMembers]};
  for (const [key,perms] of Object.entries(limitedPermissions)) {
    const role=guild.roles.cache.get(state.role(key));
    if (role && role.permissions.bitfield===0n && bot.roles.highest.comparePositionTo(role)>0)
      await role.setPermissions(perms).catch(()=>progress(`Revisá manualmente los permisos de ${key}.`));
  }
  for (const spec of CATEGORIES) {
    let parent=guild.channels.cache.get(state.channel(spec.key));
    parent ||= guild.channels.cache.find(ch=>ch.type===ChannelType.GuildCategory&&ch.name===spec.name);
    if (!parent) {
      parent=await guild.channels.create({name:spec.name,type:ChannelType.GuildCategory,
        permissionOverwrites:categoryPermissions(guild,spec,state,bot.id),reason:'Dashers Bot: categoría'});
      progress(`Categoría creada: ${spec.name}`);
    }
    state.value.channels[spec.key]=parent.id;state.save();
    for (const [name,kind,key] of spec.channels) {
      let channel=guild.channels.cache.get(state.channel(key));
      channel ||=guild.channels.cache.find(c=>c.parentId===parent.id && c.name===name);
      if (channel) {state.value.channels[key]=channel.id;state.save();continue;}
      const options={name,type:kinds[kind],parent:parent.id,
        reason:'Dashers Bot: canal configurado'};
      if (kind==='forum') {
        options.availableTags=(FORUM_TAGS[key]||[]).map(tag=>({name:tag,moderated:false}));
        options.defaultAutoArchiveDuration=1440;
      }
      if (kind==='join') options.userLimit=1;
      if (kind==='voice'||kind==='join') options.bitrate=64000;
      if (READ_ONLY.has(key)&&spec.key!=='important') options.permissionOverwrites=[
        {id:guild.roles.everyone.id,deny:[P.ViewChannel,P.SendMessages]},
        {id:state.role('member'),allow:[P.ViewChannel],deny:[P.SendMessages]},
        ...['founder','admin','mod'].map(k=>({id:state.role(k),allow:[P.ViewChannel,P.SendMessages]})),
        {id:bot.id,allow:[P.ViewChannel,P.SendMessages]}
      ];
      try {channel=await guild.channels.create(options);}
      catch (error) {
        if (kind!=='media')throw error;
        channel=await guild.channels.create({...options,type:ChannelType.GuildText});
        progress('Canal multimedia no disponible: se creó un canal de texto con adjuntos.');
      }
      state.value.channels[key]=channel.id;state.save();progress(`Canal creado: ${name}`);
    }
  }
  state.value.setupComplete=true;state.save();
  return totals();
}

async function upsertPanel(guild,state,key,embed,buttons) {
  const id=state.channel(key);
  const ch=id && await guild.channels.fetch(id).catch(()=>null);
  if (!ch?.isTextBased()) return false;
  const opts={embeds:[embed],components:[new ActionRowBuilder().addComponents(...buttons)],allowedMentions:{parse:[]}};
  const previous=state.value.panelMessageIds[key];
  const message=previous && await ch.messages.fetch(previous).catch(()=>null);
  const current=message?await message.edit(opts):await ch.send(opts);
  state.value.panelMessageIds[key]=current.id;state.save();return true;
}
export async function publishPanels(guild,state) {
  let count=0;
  count+=Number(await upsertPanel(guild,state,'roles',new EmbedBuilder().setColor(0x9146FF)
    .setTitle('🎭 Notificaciones').setDescription('Elegí qué avisos querés recibir. Los roles de especialidad los asigna el staff.'),[
      new ButtonBuilder().setCustomId('role:pingdaily').setLabel('Daily / Weekly').setEmoji('☀️').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('role:pingevents').setLabel('Eventos').setEmoji('🎉').setStyle(ButtonStyle.Secondary)
    ]));
  count+=Number(await upsertPanel(guild,state,'support',new EmbedBuilder().setColor(0x38BDF8)
    .setTitle('🎟️ Soporte').setDescription('Abrí un ticket privado. Nunca publiques datos personales en canales públicos.'),[
      new ButtonBuilder().setCustomId('ticket:open').setLabel('Abrir ticket').setStyle(ButtonStyle.Primary)
    ]));
  return count;
}
