// Jerarquía descendente de roles, configurada por Thiago.
export const ROLES = [
  ['👑 Fundador','#FFD166',true,'founder'],
  ['🛡️ Administrador','#ED4245',true,'admin'],
  ['🔨 Moderador','#F47B20',true,'mod'],
  ['🤖 Bots','#5865F2',true,'bots'],
  ['⭐ Miembro destacado','#FEE75C',true,'featured'],
  ['🔴 Streamer','#9146FF',true,'streamer'],
  ['🧩 Creador de niveles','#38BDF8',true,'creator'],
  ['👤 Miembro','#B5BAC1',true,'member'],
  ['✅ Verificador','#52C41A',false,'verifier'],
  ['🎨 Decorador','#FF85C0',false,'decorator'],
  ['📐 Layout Creator','#40A9FF',false,'layout'],
  ['🔥 Miembro activo','#FF8C42',false,'active'],
  ['🤝 Colaborador','#37C7B2',false,'collaborator'],
  ['🎬 Editor','#C68CFF',false,'editor'],
  ['🧪 Playtester','#54D3AA',false,'playtester'],
  ['🏆 Ganador de evento','#FFC857',false,'winner'],
  ['🟢 Easy Demon','#73D13D',false,'easy'],
  ['🟡 Medium Demon','#FADB14',false,'medium'],
  ['🟠 Hard Demon','#FA8C16',false,'hard'],
  ['🔴 Insane Demon','#FF4D4F',false,'insane'],
  ['🟣 Extreme Demon','#B23AEE',false,'extreme'],
  ['☀️ Ping Daily/Weekly','#F7D774',false,'pingdaily'],
  ['🎉 Ping eventos','#00B0F4',false,'pingevents']
].map(([name,color,hoist,key])=>({name,color,hoist,key}));

// channel types: text, media (= texto multimedia), forum, voice, join (= sala temporal)
export const CATEGORIES = [
  {name:'📌 IMPORTANTE', key:'important', channels:[
    ['👋・bienvenida','text','welcome'],['🚪・adios','text','goodbye'],['📢・anuncios','text','announcements'],['📜・reglas','text','rules'],['🎭・roles','text','roles'],['❓・como-funciona','text','howto'],['📅・eventos','text','events'],['☀️・daily-weekly','text','daily'],['📰・actualizaciones-oficiales','text','official']
  ]},
  {name:'💬 COMUNIDAD',key:'community',channels:[
    ['💬・general','text','general'],['😂・memes','text','memes'],['📸・clips','media','clips'],['🤖・comandos','text','commands'],['📝・presentaciones','text','introductions'],['💡・sugerencias','forum','suggestions'],['🎟️・soporte','text','support']
  ]},
  {name:'🧩 NIVELES',key:'levels',channels:[
    ['🛠️・creacion-de-niveles','forum','levelcreation'],['🏆・niveles-completados','forum','completed'],['🤝・busco-collab','text','levelcollab'],['🧪・playtesting','text','playtesting'],['💡・feedback-niveles','text','levelfeedback'],['🎯・verificaciones','forum','verifications'],['🏗️・proyectos-activos','forum','projects']
  ]},
  {name:'🎥 CREACIÓN DE CONTENIDO',key:'content',channels:[
    ['🔎・busco-gente','forum','findpeople'],['💡・ideas','text','ideas'],['🔴・directos','text','live'],['🤝・colaboraciones-en-curso','forum','collabs'],['📈・estadisticas-de-contenido','forum','contentstats'],['🎙️・invitados','text','guests']
  ]},
  {name:'📊 PROGRESO',key:'progress',channels:[
    ['💀・hardest','text','hardest'],['📈・progreso-demons','text','demonprogress'],['🏆・logros','text','achievements']
  ]},
  {name:'🌐 EL GRUPO',key:'group',channels:[
    ['👥・miembros','text','members'],['📺・canales-de-los-miembros','text','memberchannels'],['📅・calendario','text','calendar'],['📊・estadisticas','text','statistics']
  ]},
  {name:'🔊 CANALES DE VOZ',key:'voice',channels:[
    ['🔊 General','voice','voicegeneral'],['🎮 Geometry Dash','voice','voicegd'],['🔴 Streaming','voice','voicestream'],['🎥 Grabando','voice','voicerecord'],['🛠️ Creando nivel','voice','voicebuild'],['🔒 Privado 1','voice','voiceprivate1'],['🔒 Privado 2','voice','voiceprivate2'],['➕ Crear tu sala','join','joinvoice']
  ]},
  {name:'🛡️ STAFF · PRIVADO',key:'staff',private:true,channels:[
    ['📋・aplicaciones','text','applications'],['✅・aprobados','text','approved'],['❌・rechazados','text','rejected'],['🚨・reportes','text','reports'],['📝・staff-chat','text','staffchat'],['📊・logs','text','logs'],['⚙️・bot-config','text','botconfig'],['⚠️・sanciones','text','sanctions'],['🐛・errores-del-bot','forum','botbugs']
  ]}
];
export const FORUM_TAGS = {
  levelcreation:['Layout','Decoración','Busco verificador','Collab','Feedback','Terminado'],
  completed:['Easy','Medium','Hard','Insane','Extreme'],
  findpeople:['Stream','Vídeo','Reto','Collab','Busco jugadores'],
  verifications:['Busco verificador','En progreso','Verificado','Abierto'],
  projects:['Layout','Decoración','Jugabilidad','Terminado'],
  collabs:['Busco gente','En curso','Terminado'],
  contentstats:['TikTok','Twitch','YouTube','Consejos'],
  botbugs:['Error','Sugerencia','Resuelto'],
  suggestions:['Pendiente','Considerando','Implementado']
};
export const TOTAL_CHANNELS = CATEGORIES.reduce((n,c)=>n+c.channels.length,0);
