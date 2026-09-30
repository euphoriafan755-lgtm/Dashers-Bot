import {SlashCommandBuilder,PermissionFlagsBits,InteractionContextType} from 'discord.js';
import {ROLES,CATEGORIES,TOTAL_CHANNELS} from './manifest.js';
import {store,save,getCh} from './state.js';
import {canAdmin,canModerate,preview,applySetup,sendPanels} from './setup.js';
import {log,publishStats} from './features.js';
import {fetchTimely,formatTimely,pollDaily} from './feeds.js';
import {resourceMonitor} from './runtime.js';

const restricted=PermissionFlagsBits.Administrator;
const modPermission=PermissionFlagsBits.ModerateMembers;
export const commands=[
  new SlashCommandBuilder().setName('ping').setDescription('Comprobar que Dashers Bot funciona.'),
  new SlashCommandBuilder().setName('salud').setDescription('Estado REAL del proceso y limpieza temporal (staff).').setDefaultMemberPermissions(restricted),
  new SlashCommandBuilder().setName('limpieza').setDescription('Limpiar archivos temporales propios ahora (staff).').setDefaultMemberPermissions(restricted),
  new SlashCommandBuilder().setName('setup').setDescription('Vista previa o creación de tu Discord.').setDefaultMemberPermissions(restricted)
    .addStringOption(o=>o.setName('modo').setDescription('Qué querés hacer').setRequired(true).addChoices({name:'Vista previa',value:'preview'},{name:'Aplicar configuración',value:'apply'})),
  new SlashCommandBuilder().setName('paneles').setDescription('Publicar los paneles de roles y soporte.').setDefaultMemberPermissions(restricted),
  new SlashCommandBuilder().setName('config').setDescription('Activar o desactivar los sistemas automáticos.').setDefaultMemberPermissions(restricted)
    .addStringOption(o=>o.setName('sistema').setDescription('Función').setRequired(true).addChoices({name:'Daily/Weekly',value:'daily'},{name:'Noticias Steam',value:'news'},{name:'Anti-spam',value:'antispam'}))
    .addBooleanOption(o=>o.setName('activo').setDescription('¿Activado?').setRequired(true)),
  new SlashCommandBuilder().setName('daily').setDescription('Ver o publicar los niveles Daily y Weekly.')
    .addStringOption(o=>o.setName('accion').setDescription('Acción').setRequired(true).addChoices({name:'Ver niveles',value:'ver'},{name:'Publicar en canal (staff)',value:'publicar'})),
  new SlashCommandBuilder().setName('stats').setDescription('Ver estadísticas de Dashers Community.'),
  new SlashCommandBuilder().setName('actualizar-stats').setDescription('Actualizar el panel de estadísticas.').setDefaultMemberPermissions(restricted),
  new SlashCommandBuilder().setName('rolusuario').setDescription('Asignar o retirar rol validado manualmente (staff).').setDefaultMemberPermissions(restricted)
    .addUserOption(o=>o.setName('usuario').setDescription('Integrante').setRequired(true))
    .addStringOption(o=>o.setName('rol').setDescription('Rol que querés gestionar').setRequired(true).addChoices(
      ...ROLES.filter(r=>!['founder','admin','mod','bots','pingdaily','pingevents'].includes(r.key)).map(r=>({name:r.name.slice(0,100),value:r.key}))))
    .addStringOption(o=>o.setName('accion').setDescription('Acción').setRequired(true).addChoices({name:'Dar',value:'dar'},{name:'Quitar',value:'quitar'})),
  new SlashCommandBuilder().setName('logro').setDescription('Registrar un logro de un integrante.').setDefaultMemberPermissions(modPermission)
    .addUserOption(o=>o.setName('usuario').setDescription('Integrante').setRequired(true))
    .addStringOption(o=>o.setName('logro').setDescription('Nombre del logro').setMaxLength(140).setRequired(true)),
  new SlashCommandBuilder().setName('advertir').setDescription('Añadir advertencia con motivo.').setDefaultMemberPermissions(modPermission)
    .addUserOption(o=>o.setName('usuario').setDescription('Integrante').setRequired(true))
    .addStringOption(o=>o.setName('motivo').setDescription('Motivo').setMaxLength(250).setRequired(true)),
  new SlashCommandBuilder().setName('advertencias').setDescription('Ver advertencias de una persona (staff).').setDefaultMemberPermissions(modPermission)
    .addUserOption(o=>o.setName('usuario').setDescription('Integrante').setRequired(true)),
  new SlashCommandBuilder().setName('timeout').setDescription('Suspender temporalmente a una persona (staff).').setDefaultMemberPermissions(modPermission)
    .addUserOption(o=>o.setName('usuario').setDescription('Integrante').setRequired(true))
    .addIntegerOption(o=>o.setName('minutos').setDescription('Entre 1 y 1440').setMinValue(1).setMaxValue(1440).setRequired(true))
    .addStringOption(o=>o.setName('motivo').setDescription('Motivo').setMaxLength(250).setRequired(true))
].map(x=>x.setContexts(InteractionContextType.Guild));
const response=(text)=>({content:text,ephemeral:true,allowedMentions:{parse:[]}});
export async function routeCommand(i){
  if(i.guildId!==process.env.GUILD_ID)return i.reply(response('Este bot está configurado solo para Dashers Community ES.'));
  const name=i.commandName,s=store();
  if(name==='ping')return i.reply(response('🏓 Pong. Dashers Bot está en línea.'));
  if(name==='salud'||name==='limpieza'){
    if(!canAdmin(i))return i.reply(response('Solo administradores.'));
    if(!resourceMonitor)return i.reply(response('Monitor de recursos no disponible.'));
    const cleaned=name==='limpieza'?resourceMonitor.cleanup():null;
    const snap=resourceMonitor.snapshot();
    const formatted=`RAM del proceso: ${snap.rssMiB} MiB${snap.limitMiB?` / límite detectado ${snap.limitMiB} MiB`:''}\n`+
      `CPU aproximada del proceso: ${snap.cpuPercent}%\nArchivos temporales propios: ${snap.ownFilesMiB} MiB\n`+
      `Archivos eliminados desde inicio: ${snap.removedFiles}\nTiempo activo: ${Math.floor(snap.uptimeSeconds/60)} min`;
    return i.reply(response((cleaned?`🧹 Limpiados ${cleaned.removed} archivos temporales (${(cleaned.removedBytes/1048576).toFixed(2)} MiB).\n`:'' )+'📊 '+formatted));
  }
  if(name==='setup'){
    if(!canAdmin(i))return i.reply(response('Necesitás permisos de administrador.'));
    const mode=i.options.getString('modo');
    await i.deferReply({ephemeral:true});
    if(mode==='preview'){
      const p=await preview(i.guild);
      return i.editReply(`**Dashers Bot /setup preview**\nCategorías definidas: ${CATEGORIES.length}\nCanales definidos: ${TOTAL_CHANNELS}\nRoles definidos: ${ROLES.length}\nFaltan por crear aprox.: ${p.missingCategories} categorías, ${p.missingChannels} canales, ${p.missingRoles} roles.${p.forumsRequireCommunity?'\n⚠️ Primero activá Servidor de comunidad en Discord para permitir foros.':''}\n**No se modificó nada.**`);
    }
    if(mode==='apply'){
      if(!i.guild.features.includes('COMMUNITY'))return i.editReply('Primero activá **Ajustes del servidor → Habilitar comunidad**. Los canales de foro dependen de esa función.');
      const updates=[];
      try{
        const result=await applySetup(i.guild,msg=>{updates.push(msg);console.log('[SETUP]',msg);});
        return i.editReply(`✅ Configuración terminada. ${result.channels} canales y ${result.roles} roles definidos.\nEjecutá **/paneles** para publicar los botones. La admisión es manual por TikTok; el bot NO acepta candidatos automáticamente.\nSi el rol del bot queda por debajo de otros, subilo en Ajustes → Roles.`);
      }catch(e){console.error(e);return i.editReply(`⚠️ Setup interrumpido: ${e.message}\nPodés corregir el problema y volver a ejecutar /setup aplicar. El proceso reutiliza los elementos existentes.`);}
    }
  }
  if(!s.setupComplete&&name!=='ping')return i.reply(response('Primero configurá el servidor con /setup.'));
  if(name==='paneles'){
    if(!canAdmin(i))return i.reply(response('Solo administradores.'));
    await i.deferReply({ephemeral:true});const result=await sendPanels(i.guild);
    return i.editReply(result.length?'Paneles publicados o actualizados: '+result.join(' y '):'Faltan canales, revisá /setup.');
  }
  if(name==='config'){
    if(!canAdmin(i))return i.reply(response('Solo administradores.'));
    const key=i.options.getString('sistema'),active=i.options.getBoolean('activo');
    s.settings[key]=active;save();await log(i.guild,`⚙️ ${i.user.username} cambió ${key}: ${active}`);
    return i.reply(response(`${key}: ${active?'activado':'desactivado'}.`));
  }
  if(name==='daily'){
    const action=i.options.getString('accion');
    if(action==='publicar'&&!canModerate(i))return i.reply(response('Necesitás ser staff para publicar.'));
    await i.deferReply({ephemeral:true});
    if(action==='ver'){
      const levels=[];
      for(const kind of ['daily','weekly']){try{levels.push(formatTimely(await fetchTimely(kind)));}catch(e){levels.push(`${kind}: no se pudieron consultar datos (${e.message})`);}}
      return i.editReply(levels.join('\n\n'));
    }
    const posted=await pollDaily(i.guild,true);
    return i.editReply(posted.length?'Publicados: '+posted.join(' y '):'No se publicaron niveles. Revisá la conectividad o el canal.');
  }
  if(name==='stats'){
    const member=i.guild.memberCount;
    return i.reply(response(`📊 Miembros del servidor: ${member}\n🏆 Logros registrados: ${s.achievements.length}\n🎟️ Tickets abiertos: ${Object.values(s.tickets).filter(t=>t.open).length}`));
  }
  if(name==='actualizar-stats'){
    if(!canAdmin(i))return i.reply(response('Solo administradores.'));
    await i.deferReply({ephemeral:true});await publishStats(i.guild);return i.editReply('✅ Estadísticas publicadas o actualizadas.');
  }
  if(name==='rolusuario'){
    if(!canAdmin(i))return i.reply(response('Solo administradores.'));
    const user=i.options.getUser('usuario'),key=i.options.getString('rol'),action=i.options.getString('accion');
    const roleSpec=ROLES.find(r=>r.key===key);const role=i.guild.roles.cache.get(s.roles[key]);
    if(!roleSpec||!role)return i.reply(response('Rol no encontrado.'));
    const member=await i.guild.members.fetch(user.id).catch(()=>null);
    if(!member)return i.reply(response('El usuario no está en este servidor.'));
    const me=await i.guild.members.fetchMe();
    if(me.roles.highest.comparePositionTo(role)<=0)return i.reply(response('Subí el rol del bot por encima de ese rol.'));
    if(action==='dar')await member.roles.add(role,'Asignación manual de Thiago/staff');
    else await member.roles.remove(role,'Revocación manual de Thiago/staff');
    await log(i.guild,`🎭 ${i.user.username} ${action==='dar'?'dio':'quitó'} ${role.name} a ${user.username}`);
    return i.reply(response(`✅ ${action==='dar'?'Asignado':'Retirado'} ${role.name} a ${user.username}.`));
  }
  if(name==='logro'){
    if(!canModerate(i))return i.reply(response('Solo staff.'));
    const user=i.options.getUser('usuario'),label=i.options.getString('logro');
    const achievement={userId:user.id,label,by:i.user.id,at:Date.now()};s.achievements.push(achievement);save();
    const ch=await i.guild.channels.fetch(getCh('achievements')).catch(()=>null);
    if(ch?.isTextBased())await ch.send({content:`🏆 **¡Nuevo logro!**\n<@${user.id}> consiguió **${label.replaceAll('@','＠')}**.`,allowedMentions:{users:[user.id]}});
    await log(i.guild,`🏆 Logro registrado para ${user.username} por ${i.user.username}: ${label}`);
    return i.reply(response('✅ Logro registrado.'));
  }
  if(name==='advertir'||name==='advertencias'||name==='timeout'){
    if(!canModerate(i))return i.reply(response('Solo staff.'));
    const user=i.options.getUser('usuario'),history=s.warnings[user.id]||[];
    if(name==='advertencias')return i.reply(response(history.length?history.slice(-15).map((w,n)=>`${n+1}. ${new Date(w.at).toLocaleDateString('es-UY')} — ${String(w.reason).slice(0,160)}`).join('\n'):'Sin advertencias registradas.'));
    const reason=i.options.getString('motivo');
    if(user.id===i.user.id||user.id===i.client.user.id)return i.reply(response('No podés sancionarte ni sancionar al bot.'));
    if(name==='advertir'){
      history.push({by:i.user.id,reason,at:Date.now()});s.warnings[user.id]=history;save();
      await log(i.guild,`⚠️ ${i.user.username} advirtió a ${user.username}: ${reason}`);
      return i.reply(response('Advertencia registrada.'));
    }
    const target=await i.guild.members.fetch(user.id).catch(()=>null);
    if(!target)return i.reply(response('Ese usuario ya no está en el servidor.'));
    if(!target.moderatable)return i.reply(response('No tengo permisos para suspender temporalmente a esa persona.'));
    const minutes=i.options.getInteger('minutos');
    await target.timeout(minutes*60000,reason);
    await log(i.guild,`🔇 ${i.user.username} aplicó timeout de ${minutes} min a ${user.username}: ${reason}`);
    return i.reply(response(`Timeout de ${minutes} minutos aplicado.`));
  }
  return i.reply(response('Comando no reconocido.'));
}
