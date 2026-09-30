/** Sólo lectura de anuncios públicos publicados en Steam. */
const SOURCE = 'https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=322170&count=15&maxlength=250';
const APPROVED = /^(https:\/\/)(steamcommunity\.com|store\.steampowered\.com)(\/|$)/i;
export function selectAnnouncements(payload) {
  const entries = payload?.appnews?.newsitems;
  if (!Array.isArray(entries)) throw new Error('Steam: respuesta inesperada');
  return entries.filter(item =>
    typeof item.gid === 'string' &&
    !item.is_external_url &&
    item.feedname === 'steam_community_announcements' &&
    APPROVED.test(item.url || '')
  ).sort((a,b) => a.date - b.date).map(item => ({
    id: item.gid,
    title: String(item.title || 'Actualización').replaceAll('@','＠').slice(0,140),
    url: item.url
  }));
}
export async function getAnnouncements(request = fetch) {
  const result = await request(SOURCE, {signal: AbortSignal.timeout(9000)});
  if (!result.ok) throw new Error(`Steam: HTTP ${result.status}`);
  return selectAnnouncements(await result.json());
}
