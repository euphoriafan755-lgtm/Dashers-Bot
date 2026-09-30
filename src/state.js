import fs from 'node:fs';
import path from 'node:path';
const dir = process.env.DATA_DIR || './data';
const file = path.join(dir,'state.json');
const blank = () => ({schema:1,channels:{},roles:{},setupComplete:false,tickets:{},tempRooms:{},warnings:{},achievements:[],dailySeen:{},newsSeen:[],newsInitialized:false,settings:{daily:true,news:true,antispam:true},panelMessageIds:{}});
let state;
export function store(){
  if (!state){fs.mkdirSync(dir,{recursive:true});try{state={...blank(),...JSON.parse(fs.readFileSync(file,'utf8'))};}catch(e){if(e.code!=='ENOENT')throw e;state=blank();}}
  return state;
}
export function save(){
  fs.mkdirSync(dir,{recursive:true});const data=JSON.stringify(store(),null,2);const tmp=file+'.tmp';fs.writeFileSync(tmp,data,{mode:0o600});fs.renameSync(tmp,file);
}
export function getCh(key){return store().channels[key];}
