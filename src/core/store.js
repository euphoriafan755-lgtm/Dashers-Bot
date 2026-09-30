import fs from 'node:fs';
import path from 'node:path';

/** Estado privado de Dashers: persistente, escritura atómica, sin tokens ni datos de acceso. */
export function initialState() {
  return {
    version: 1,
    setupComplete: false,
    roles: {}, channels: {}, panelMessageIds: {},
    tickets: {}, tempRooms: {}, achievements: [], warnings: {},
    settings: {daily: true, news: true, antispam: true},
    dailySeen: {daily: '', weekly: ''},
    newsSeen: [], newsInitialized: false
  };
}
function mergeState(input) {
  const fallback = initialState();
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Estado inválido');
  return {
    ...fallback, ...input,
    settings: {...fallback.settings, ...input.settings},
    roles: {...fallback.roles, ...input.roles},
    channels: {...fallback.channels, ...input.channels},
    panelMessageIds: {...fallback.panelMessageIds, ...input.panelMessageIds},
    dailySeen: {...fallback.dailySeen, ...input.dailySeen}
  };
}
export class JsonStore {
  constructor(dataDir) {
    this.dir = path.resolve(dataDir);
    this.file = path.join(this.dir, 'state.json');
    fs.mkdirSync(this.dir, {recursive: true});
    this.value = this.#load();
  }
  #load() {
    try {return mergeState(JSON.parse(fs.readFileSync(this.file, 'utf8')));}
    catch (error) {
      if (error.code === 'ENOENT') return initialState();
      throw new Error('No se pudo abrir el estado persistente. Hacé una copia y revisá el almacenamiento.', {cause: error});
    }
  }
  save() {
    const temp = `${this.file}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(this.value, null, 2), {mode: 0o600});
    fs.renameSync(temp, this.file);
  }
  channel(key) {return this.value.channels[key] || null;}
  role(key) {return this.value.roles[key] || null;}
}
