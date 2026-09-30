import 'dotenv/config';
import {REST,Routes} from 'discord.js';
import {commands} from './commands.js';
const {BOT_TOKEN,CLIENT_ID,GUILD_ID}=process.env;
if(!BOT_TOKEN||!CLIENT_ID||!/^\d{17,20}$/.test(GUILD_ID||''))throw new Error('Faltan BOT_TOKEN, CLIENT_ID o GUILD_ID. Revisá .env (nunca compartas el token).');
const rest=new REST({version:'10'}).setToken(BOT_TOKEN);
const results=await rest.put(Routes.applicationGuildCommands(CLIENT_ID,GUILD_ID),{body:commands.map(c=>c.toJSON())});
console.log('Registrados',results.length,'comandos en el servidor',GUILD_ID);
