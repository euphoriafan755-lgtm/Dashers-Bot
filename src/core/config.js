/** Configuración del proceso. Nunca se imprime ni almacena el token. */
const DISCORD_ID = /^\d{17,20}$/;
export function readConfig(env = process.env) {
  const clientId = env.CLIENT_ID || '1554881611202437221';
  const guildId = env.GUILD_ID || '1554862905294463078';
  if (!DISCORD_ID.test(clientId) || !DISCORD_ID.test(guildId)) {
    throw new Error('CLIENT_ID o GUILD_ID inválidos: revisá los identificadores públicos.');
  }
  if (typeof env.BOT_TOKEN !== 'string' || env.BOT_TOKEN.length < 20) {
    throw new Error('Configurá BOT_TOKEN en los secretos privados del hosting.');
  }
  const memory = Number(env.HOST_RAM_MB);
  return Object.freeze({
    token: env.BOT_TOKEN,
    clientId,
    guildId,
    dataDir: env.DATA_DIR || './data',
    memoryLimitMiB: Number.isFinite(memory) && memory >= 128 && memory <= 32768 ? memory : null
  });
}
