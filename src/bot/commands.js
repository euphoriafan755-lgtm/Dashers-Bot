import {PermissionFlagsBits,SlashCommandBuilder} from 'discord.js';
import {ROLES} from '../catalog.js';
import {isAdmin,isStaff,preview,provision,publishPanels} from './provision.js';
import {audit,postStats} from './features.js';
import {getFeaturedLevel,formatLevel} from '../services/geometryDash.js';
import {publishDaily} from '../services/announcements.js';

const ADMIN=PermissionFlagsBits.Administrator;
const MOD=PermissionFlagsBits.ModerateMembers;
const STAFF_ROLES=new Set(['founder','admin','mod','bots','pingdaily','pingevents']);
const optionalRoles=ROLES.filter(r=>!STAFF_ROLES.has(r.key));
const privateResponse=content=>({content,ephemeral:true,allowedMentions:{parse:[]}});

export const commandDefinitions=[
  new SlashCommandBuilder().setName('ping').setDescription('Comprobar la conexión con Discord.'),
  new SlashCommandBuilder().setName('setup').setDescription('Previsualizar o preparar el servidor.').setDefaultMemberPermissions(ADMIN)
    .addStringOption(o=>o.setName('modo').setDescription('Acción').setRequired(true).addChoices(
      {name:'Previsualizar',value:'preview'},{name:'Crear sin duplicados',value:'apply'})),
  new SlashCommandBuilder().setName('paneles').setDescription('Crear o actualizar los paneles del servidor.').setDefaultMemberPermissions(ADMIN),
  new SlashCommandBuilder().setName('config').setDescription('Administrar módulos automáticos.').setDefaultMemberPermissions(ADMIN)
    .addStringOption(o=>o.setName('modulo').setDescription('Módulo').setRequired(true).addChoices(
      {name:'Daily y Weekly',value:'daily'},{name:'Noticias oficiales',value:'news'},{name:'Antispam',value:'antispam'}))
    .addBooleanOption(o=>o.setName('activo').setDescription('Estado').setRequired(true)),
  new SlashCommandBuilder().setName('daily').setDescription('Consultar niveles destacados de Geometry Dash.')
    .addStringOption(o=>o.setName('accion').setDescription('Qué querés hacer').setRequired(true).addChoices(
      {name:'Consultar',value:'ver'},{name:'Publicar (staff)',value:'publicar'})),
  new SlashCommandBuilder().setName('estadisticas').setDescription('Ver los datos actuales de la comunidad.'),
  new SlashCommandBuilder().setName('actualizar-estadisticas').setDescription('Actualizar el panel del servidor.').setDefaultMemberPermissions(ADMIN),
  new SlashCommandBuilder().setName('rolusuario').setDescription('Dar o quitar un rol tras una revisión manual.').setDefaultMemberPermissions(ADMIN)
    .addUserOption(o=>o.setName('usuario').setDescription('Integrante').setRequired(true))
    .addStringOption(o=>o.setName('rol').setDescription('Rol').setRequired(true).addChoices(...optionalRoles.map(r=>({name:r.name,value:r.key}))))
    .addStringOption(o=>o.setName('accion').setDescription('Acción').setRequired(true).addChoices(
      {name:'Dar',value:'dar'},{name:'Quitar',value:'quitar'})),
  new SlashCommandBuilder().setName('logro').setDescription('Registrar un logro de un integrante.').setDefaultMemberPermissions(MOD)
    .addUserOption(o=>o.setName('usuario').setDescription('Integrante').setRequired(true))
    .addStringOption(o=>o.setName('nombre').setDescription('Logro').setMaxLength(140).setRequired(true)),
  new SlashCommandBuilder().setName('advertir').setDescription('Registrar una advertencia de moderación.').setDefaultMemberPermissions(MOD)
    .addUserOption(o=>o.setName('usuario').setDescription('Integrante').setRequired(true))
    .addStringOption(o=>o.setName('motivo').setDescription('Motivo').setMaxLength(250).setRequired(true)),
  new SlashCommandBuilder().setName('advertencias').setDescription('Consultar el registro de moderación.').setDefaultMemberPermissions(MOD)
    .addUserOption(o=>o.setName('usuario').setDescription('Integrante').setRequired(true)),
  new SlashCommandBuilder().setName('timeout').setDescription('Suspender temporalmente a una persona.').setDefaultMemberPermissions(MOD)
    .addUserOption(o=>o.setName('usuario').setDescription('Integrante').setRequired(true))
    .addIntegerOption(o=>o.setName('minutos').setDescription('Entre 1 y 1440').setMinValue(1).setMaxValue(1440).setRequired(true))
    .addStringOption(o=>o.setName('motivo').setDescription('Motivo').setMaxLength(250).setRequired(true)),
  new SlashCommandBuilder().setName('salud').setDescription('Consultar RAM, CPU y temporales.').setDefaultMemberPermissions(ADMIN),
  new SlashCommandBuilder().setName('limpieza').setDescription('Limpiar solamente los temporales propios.').setDefaultMemberPermissions(ADMIN)
];

export function createCommandHandler({state,maintenance,guildId}) {
  return async function handle(interaction){
    if(interaction.guildId!==guildId)return interaction.reply(privateResponse('Este comando pertenece a Dashers Community ES.'));
    const name=interaction.commandName;
    if(name==='ping')return interaction.reply(privateResponse('🏓 Dashers Bot está conectado.'));
    if(name==='setup'){
      if(!isAdmin(interaction))return interaction.reply(privateResponse('Solo administradores.'));
      await interaction.deferReply({ephemeral:true});
      if(interaction.options.getString('modo')==='preview'){
        const report=await preview(interaction.guild,state);
        return interaction.editReply(`Vista previa (sin cambios): ${report.categories} categorías, ${report.channels} canales, ${report.roles} roles.\nFaltan ${report.missingCategories} categorías, ${report.missingChannels} canales y ${report.missingRoles} roles.${report.needsCommunity?'\n⚠️ Activá Servidor de comunidad para crear los foros.':''}`);
      }
      const result=await provision(interaction.guild,state,line=>console.info('[Setup]',line));
      return interaction.editReply(`✅ Preparado: ${result.categories} categorías, ${result.channels} canales y ${result.roles} roles. Ejecutá /paneles. Los accesos se aprueban manualmente por TikTok.`);
    }
    if(!state.value.setupComplete)return interaction.reply(privateResponse('Primero utilizá /setup.'));
    if(name==='paneles'){
      if(!isAdmin(interaction))return interaction.reply(privateResponse('Solo administradores.'));
      await interaction.deferReply({ephemeral:true});
      const count=await publishPanels(interaction.guild,state);
      return interaction.editReply(`Se actualizaron ${count} paneles.`);
    }
    if(name==='config'){
      if(!isAdmin(interaction))return interaction.reply(privateResponse('Solo administradores.'));
      const key=interaction.options.getString('modulo'),value=interaction.options.getBoolean('activo');
      if(!Object.hasOwn(state.value.settings,key))return interaction.reply(privateResponse('Módulo desconocido.'));
      state.value.settings[key]=value;state.save();
      await audit(interaction.guild,state,`Configuración cambiada por ${interaction.user.username}: ${key} = ${value}`);
      return interaction.reply(privateResponse(`${key}: ${value?'activado':'desactivado'}.`));
    }
    if(name==='daily'){
      const action=interaction.options.getString('accion');
      if(action==='publicar'&&!isStaff(interaction))return interaction.reply(privateResponse('Solo staff.'));
      await interaction.deferReply({ephemeral:true});
      if(action==='publicar'){
        const published=await publishDaily(interaction.guild,state,{force:true});
        return interaction.editReply(published.length?`Publicados: ${published.join(' y ')}.`:'No se pudo publicar. Revisá el canal y la conectividad.');
      }
      const results=[];
      for(const kind of ['daily','weekly'])try{results.push(formatLevel(await getFeaturedLevel(kind)));}
      catch(e){results.push(`${kind}: no disponible (${e.message})`);}
      return interaction.editReply(results.join('\n\n'));
    }
    if(name==='estadisticas')return interaction.reply(privateResponse(
      `📊 Integrantes: ${interaction.guild.memberCount} · Logros: ${state.value.achievements.length} · Tickets abiertos: ${Object.values(state.value.tickets).filter(t=>t.open).length}`));
    if(name==='actualizar-estadisticas'){
      if(!isAdmin(interaction))return interaction.reply(privateResponse('Solo administradores.'));
      await interaction.deferReply({ephemeral:true});
      const updated=await postStats(interaction.guild,state);
      return interaction.editReply(updated?'Panel actualizado.':'No se encontró el canal de estadísticas.');
    }
    if(name==='salud'||name==='limpieza'){
      if(!isAdmin(interaction))return interaction.reply(privateResponse('Solo administradores.'));
      const cleaned=name==='limpieza'?maintenance.clean():null,snap=maintenance.snapshot();
      return interaction.reply(privateResponse(`${cleaned?`🧹 ${cleaned.removed} archivos temporales borrados.\n`:''}RAM del bot: ${snap.rssMiB} MiB / ${snap.limitMiB??'límite desconocido'} MiB\nTiempo activo: ${Math.floor(snap.uptime/60)} min.`));
    }
    if(!isStaff(interaction))return interaction.reply(privateResponse('Este comando requiere permisos de moderación.'));
    const user=interaction.options.getUser('usuario');
    const member=user&&await interaction.guild.members.fetch(user.id).catch(()=>null);
    if(!member)return interaction.reply(privateResponse('Esa persona no está en el servidor.'));
    if(name==='rolusuario'){
      if(!isAdmin(interaction))return interaction.reply(privateResponse('Solo administradores.'));
      const key=interaction.options.getString('rol'),roleId=state.role(key);
      if(STAFF_ROLES.has(key)||!roleId)return interaction.reply(privateResponse('No se puede gestionar ese rol desde el comando.'));
      const role=await interaction.guild.roles.fetch(roleId).catch(()=>null),bot=await interaction.guild.members.fetchMe();
      if(!role||bot.roles.highest.comparePositionTo(role)<=0)return interaction.reply(privateResponse('El bot necesita un rol superior al rol solicitado.'));
      const giving=interaction.options.getString('accion')==='dar';
      if(giving)await member.roles.add(role);else await member.roles.remove(role);
      await audit(interaction.guild,state,`${interaction.user.username} ${giving?'asignó':'retiró'} ${role.name} a ${user.username}.`);
      return interaction.reply(privateResponse(giving?'Rol asignado.':'Rol retirado.'));
    }
    if(name==='logro'){
      const title=interaction.options.getString('nombre');
      state.value.achievements.push({userId:user.id,title,by:interaction.user.id,at:Date.now()});state.save();
      const id=state.channel('achievements');const channel=id&&await interaction.guild.channels.fetch(id).catch(()=>null);
      if(channel?.isTextBased())await channel.send({content:`🏆 <@${user.id}> consiguió **${title.replaceAll('@','＠')}**`,allowedMentions:{users:[user.id]}});
      return interaction.reply(privateResponse('Logro registrado.'));
    }
    if(name==='advertir'){
      const reason=interaction.options.getString('motivo');
      const warnings=state.value.warnings[user.id]||[];
      warnings.push({at:Date.now(),by:interaction.user.id,reason});state.value.warnings[user.id]=warnings;state.save();
      await audit(interaction.guild,state,`Advertencia para ${user.username} por ${interaction.user.username}: ${reason}`);
      return interaction.reply(privateResponse(`Advertencia registrada: ${warnings.length} en total.`));
    }
    if(name==='advertencias'){
      const warnings=state.value.warnings[user.id]||[];
      const lines=warnings.slice(-8).map((w,i)=>`${i+1}. ${w.reason.replaceAll('@','＠')}`);
      return interaction.reply(privateResponse(lines.length?lines.join('\n'):'No hay advertencias registradas.'));
    }
    if(name==='timeout'){
      if(!member.moderatable)return interaction.reply(privateResponse('No tengo permisos para suspender a esa persona.'));
      const minutes=interaction.options.getInteger('minutos'),reason=interaction.options.getString('motivo');
      await member.timeout(minutes*60000,reason);
      await audit(interaction.guild,state,`${interaction.user.username} suspendió a ${user.username} por ${minutes} minutos: ${reason}`);
      return interaction.reply(privateResponse(`Suspensión aplicada: ${minutes} minutos.`));
    }
    return interaction.reply(privateResponse('Comando desconocido.'));
  };
}
