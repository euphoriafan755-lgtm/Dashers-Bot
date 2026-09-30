/** API pública del juego. Esta capa no accede a configuración, credenciales ni disco. */
const BASE = 'https://www.boomlings.com/database/';
const PUBLIC_GAME_SECRET = 'Wmfd2893gb7';
const ENDPOINTS = Object.freeze({daily: 'getGJDailyLevel.php', level: 'downloadGJLevel22.php'});

export function parseLevel(payload) {
  const fields = payload.split('#', 1)[0].split(':');
  const values = new Map();
  for (let i = 0; i + 1 < fields.length; i += 2) values.set(fields[i], fields[i + 1]);
  const id = values.get('1'), name = values.get('2');
  if (!/^\d+$/.test(id || '') || !name) throw new Error('Respuesta de nivel inválida');
  return {id, name, creatorId: values.get('6') || null};
}
export async function requestGame(endpoint, params, request = fetch) {
  if (!Object.values(ENDPOINTS).includes(endpoint)) throw new Error('Endpoint del juego no permitido');
  const body = new URLSearchParams({secret: PUBLIC_GAME_SECRET, gameVersion: '22', ...params});
  const result = await request(BASE + endpoint, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': ''},
    body,
    signal: AbortSignal.timeout(9000)
  });
  if (!result.ok) throw new Error(`Geometry Dash: HTTP ${result.status}`);
  const text = await result.text();
  if (!text || text === '-1') throw new Error('Geometry Dash no devolvió un nivel');
  return text;
}
export async function getFeaturedLevel(kind, request = fetch) {
  if (kind !== 'daily' && kind !== 'weekly') throw new Error('Tipo de nivel inválido');
  const index = (await requestGame(ENDPOINTS.daily, {type: kind === 'daily' ? '0' : '1'}, request)).split('|')[0];
  if (!/^\d+$/.test(index)) throw new Error('Número de nivel inválido');
  const level = await requestGame(ENDPOINTS.level, {levelID: kind === 'daily' ? '-1' : '-2'}, request);
  return {...parseLevel(level), kind, index};
}
export function formatLevel(level) {
  const title = String(level.name).replaceAll('@', '＠').slice(0, 100).replaceAll('`','');
  return `${level.kind === 'daily' ? '☀️ **DAILY LEVEL**' : '🌙 **WEEKLY DEMON**'}\n${title}\nID: \`${level.id}\` · Nº ${level.index}`;
}
