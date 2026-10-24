import { DomainError } from './repository.mjs';
import { profileSelect } from './profile.mjs';
import { SUBSCRIBER_LIMITS } from './subscriber-contract.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WEAPONS=new Set(['kick','punch','slap','glove','flipflop','ruler','fish','bat','pan','hammer','taser','cactus','saw','extinguisher','guitar','bomb','rocket','anvil']);
const UPGRADES=new Set(['power','crit','coins','tough']);
const VOICES=new Set(['professor','grumpy','squeaky','robot','custom','builtin:professor','builtin:grumpy','builtin:squeaky','builtin:robot']);
const DEFAULT_SAVE=Object.freeze({v:1,coins:250,owned:['kick','punch'],equipped:'kick',upgrades:{power:0,crit:0,coins:0,tough:0},cosmetics:{background:'classroom',face:'cartoon',doll:null,voice:'builtin:professor',voicePitch:1},customAssets:{background:null,face:null,doll:null},settings:{sound:true,music:true,haptics:true,damageNumbers:true,lang:'auto',reduceGlow:false},stats:{bestRound:0,bestCombo:0,totalDamage:0,kos:0,rounds:0},seen:{intro:false,shop:false}});
const SCORE_COOLDOWN_MS=2_000,MAX_DAMAGE=5_000_000,MAX_COMBO=10_000,MAX_KOS=1,MAX_COINS=1_000_000_000,LEADERBOARD_LIMIT=50;
const idString=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(value);
const int=(value,max)=>Number.isSafeInteger(value)&&value>=0&&value<=max;
const fail=(code,status=400)=>{throw new DomainError(code,status);};

function validateSave(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||input.v!==1)fail('invalid_kick_buddy_save');
 const save={...DEFAULT_SAVE,coins:input.coins,owned:input.owned,equipped:input.equipped,upgrades:input.upgrades,cosmetics:input.cosmetics,settings:input.settings,stats:input.stats,seen:input.seen};
 if(!int(save.coins,MAX_COINS))fail('invalid_kick_buddy_save');
 if(!Array.isArray(save.owned)||save.owned.length<1||save.owned.length>WEAPONS.size||save.owned.some(id=>!WEAPONS.has(id))||new Set(save.owned).size!==save.owned.length)fail('invalid_kick_buddy_save');
 if(!WEAPONS.has(save.equipped)||!save.owned.includes(save.equipped))fail('invalid_kick_buddy_save');
 if(!save.upgrades||typeof save.upgrades!=='object'||Array.isArray(save.upgrades)||Object.keys(save.upgrades).some(key=>!UPGRADES.has(key)))fail('invalid_kick_buddy_save');
 const upgrades={};for(const key of UPGRADES){const level=save.upgrades[key]??0;if(!int(level,10))fail('invalid_kick_buddy_save');upgrades[key]=level;}
 const c=save.cosmetics;
 if(!c||typeof c!=='object'||Array.isArray(c)||!idString(c.background)||!idString(c.face)||!(c.doll===null||idString(c.doll))||!VOICES.has(c.voice)||typeof c.voicePitch!=='number'||!Number.isFinite(c.voicePitch)||c.voicePitch<0.6||c.voicePitch>1.6)fail('invalid_kick_buddy_save');
 const s=save.settings,booleanKeys=['sound','music','haptics','damageNumbers','reduceGlow'];
 if(!s||typeof s!=='object'||Array.isArray(s)||booleanKeys.some(key=>typeof s[key]!=='boolean')||!['auto','en','ar','de','es','ru'].includes(s.lang))fail('invalid_kick_buddy_save');
 const st=save.stats,statCaps={bestRound:MAX_DAMAGE,bestCombo:MAX_COMBO,totalDamage:Number.MAX_SAFE_INTEGER,kos:1_000_000,rounds:1_000_000};
 if(!st||typeof st!=='object'||Array.isArray(st)||Object.entries(statCaps).some(([key,max])=>!int(st[key],max)))fail('invalid_kick_buddy_save');
 const seen=save.seen;if(!seen||typeof seen!=='object'||Array.isArray(seen)||typeof seen.intro!=='boolean'||typeof seen.shop!=='boolean')fail('invalid_kick_buddy_save');
 // Custom images and recordings can contain personal data; keep them on this device.
 return {v:1,coins:save.coins,owned:[...save.owned],equipped:save.equipped,upgrades,cosmetics:{background:c.background,face:c.face,doll:c.doll,voice:c.voice,voicePitch:c.voicePitch},customAssets:{background:null,face:null,doll:null},settings:{sound:s.sound,music:s.music,haptics:s.haptics,damageNumbers:s.damageNumbers,lang:s.lang,reduceGlow:s.reduceGlow},stats:Object.fromEntries(Object.keys(statCaps).map(key=>[key,st[key]])),seen:{intro:seen.intro,shop:seen.shop}};
}

function scoreInput(input){
 if(!input||typeof input!=='object'||!UUID.test(input.requestId||'')||!int(input.damage,MAX_DAMAGE)||!int(input.combo,MAX_COMBO)||!int(input.kos,MAX_KOS))fail('invalid_kick_buddy_score');
 if(input.kos===1&&(input.damage<1||input.combo<1))fail('invalid_kick_buddy_score');
 return {requestId:input.requestId.toLowerCase(),damage:input.damage,combo:input.combo,kos:input.kos};
}

/** Uses the caller's authenticated database and internal user ID; no messenger IDs are exposed. */
export function kickBuddyService(db,{allowDemo=false,clock=()=>Date.now()}={}){
 const stmt=(sql,...values)=>db.prepare(sql).bind(...values);
 async function identity(user){
  if(!user?.id||typeof user.id!=='string')throw new DomainError('auth_required',401);
  if(user.kind==='demo'&&allowDemo)return {id:user.id,name:'Локальный профиль',platform:'demo'};
  if(user.kind!=='messenger')throw new DomainError('auth_required',401);
  const row=await stmt(profileSelect,user.id).first();
  if(!row||row.kind!=='messenger'||!['telegram','max'].includes(row.platform))throw new DomainError('auth_required',401);
  return {id:user.id,name:row.displayName||'Подписчик Мироздания',platform:row.platform};
 }
 const priorScore=async(userId,requestId)=>stmt('SELECT damage,combo,kos FROM kick_buddy_scores WHERE user_id=? AND request_id=?',userId,requestId).first();
 async function current(user){const player=await identity(user),row=await stmt('SELECT save_json,revision FROM kick_buddy_saves WHERE user_id=?',player.id).first();return {player,save:row?JSON.parse(row.save_json):null,revision:row?.revision??0};}
 return {
  async state(user){return current(user);},
  async save(user,input){
   const player=await identity(user),revision=input?.revision;
   if(!int(revision,Number.MAX_SAFE_INTEGER-1))fail('invalid_kick_buddy_revision');
   const save=validateSave(input?.save),saveJson=JSON.stringify(save),next=revision+1;
   const existing=await stmt('SELECT revision FROM kick_buddy_saves WHERE user_id=?',player.id).first();
   if(existing){
    if(existing.revision!==revision){if(existing.revision===next){const prior=await stmt('SELECT save_json FROM kick_buddy_saves WHERE user_id=?',player.id).first();if(prior?.save_json===saveJson)return {player,save,revision:next};}throw new DomainError('kick_buddy_revision_conflict',409);}
    const result=await stmt('UPDATE kick_buddy_saves SET save_json=?,revision=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND revision=?',saveJson,next,player.id,revision).run();
    if(result?.meta?.changes===0){const latest=await stmt('SELECT save_json,revision FROM kick_buddy_saves WHERE user_id=?',player.id).first();if(latest?.revision===next&&latest.save_json===saveJson)return {player,save,revision:next};throw new DomainError('kick_buddy_revision_conflict',409);}
   }else{
    if(revision!==0)throw new DomainError('kick_buddy_revision_conflict',409);
    const result=await stmt('INSERT OR IGNORE INTO kick_buddy_saves(user_id,save_json,revision) VALUES(?,?,?)',player.id,saveJson,next).run();
    if(result?.meta?.changes===0){const latest=await stmt('SELECT save_json,revision FROM kick_buddy_saves WHERE user_id=?',player.id).first();if(latest?.revision===next&&latest.save_json===saveJson)return {player,save,revision:next};throw new DomainError('kick_buddy_revision_conflict',409);}
   }
   return {player,save,revision:next};
  },
  async score(user,input){
   const player=await identity(user),value=scoreInput(input),previous=await priorScore(player.id,value.requestId);
   if(previous){if(previous.damage!==value.damage||previous.combo!==value.combo||previous.kos!==value.kos)throw new DomainError('kick_buddy_request_conflict',409);return {accepted:true,duplicate:true};}
   const now=clock(),cutoff=now-SCORE_COOLDOWN_MS;
   await db.batch([
    stmt('INSERT INTO kick_buddy_score_limits(user_id,last_score_at,last_request_id) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET last_score_at=excluded.last_score_at,last_request_id=excluded.last_request_id WHERE kick_buddy_score_limits.last_score_at<=?',player.id,now,value.requestId,cutoff),
    stmt('INSERT OR IGNORE INTO kick_buddy_scores(user_id,request_id,damage,combo,kos,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM kick_buddy_score_limits WHERE user_id=? AND last_score_at=? AND last_request_id=?)',player.id,value.requestId,value.damage,value.combo,value.kos,now,player.id,now,value.requestId)
   ]);
   const inserted=await priorScore(player.id,value.requestId);
   if(inserted)return {accepted:true,duplicate:false};
   const raced=await priorScore(player.id,value.requestId);
   if(raced&&raced.damage===value.damage&&raced.combo===value.combo&&raced.kos===value.kos)return {accepted:true,duplicate:true};
   throw new DomainError('kick_buddy_score_rate_limited',429);
  },
  async leaderboard(user,period='all'){
   const player=await identity(user);if(!['all','week'].includes(period))fail('invalid_kick_buddy_period');
   const since=clock()-7*24*60*60*1000;
   const filter=period==='week'?'AND s.created_at>=?':'';
   const args=period==='week'?[since]:[];
   const rows=await stmt(`SELECT s.user_id,SUM(s.damage) AS totalDamage,MAX(s.damage) AS bestRound,MAX(s.combo) AS bestCombo FROM kick_buddy_scores s JOIN users u ON u.id=s.user_id AND u.kind='messenger' WHERE 1=1 ${filter} GROUP BY s.user_id ORDER BY totalDamage DESC,bestRound DESC,bestCombo DESC,s.user_id LIMIT ${LEADERBOARD_LIMIT}`,...args).all();
   const profiles=new Map();
   for(let offset=0;offset<rows.results.length;offset+=SUBSCRIBER_LIMITS.queryBatch){
    const chunk=rows.results.slice(offset,offset+SUBSCRIBER_LIMITS.queryBatch);
    const profileResults=await db.batch(chunk.map(row=>stmt('SELECT * FROM messenger_profiles WHERE user_id=?',row.user_id)));
    for(let index=0;index<chunk.length;index++){
     const profile=profileResults[index]?.results?.[0];
     profiles.set(chunk[index].user_id,profile?.preferred_name?.trim()||profile?.display_name?.trim()||'Подписчик Мироздания');
    }
   }
   return {rows:rows.results.map((row,index)=>({place:index+1,name:profiles.get(row.user_id)||'Подписчик Мироздания',bestRound:row.bestRound,bestCombo:row.bestCombo,totalDamage:row.totalDamage,mine:row.user_id===player.id}))};
  },
  async stats(user){
   await identity(user);
   const row=await stmt("SELECT COUNT(DISTINCT s.user_id) AS players,COALESCE(SUM(s.damage),0) AS damage,COALESCE(SUM(s.kos),0) AS kos FROM kick_buddy_scores s JOIN users u ON u.id=s.user_id AND u.kind='messenger'").first();
   return {stats:{players:row.players,damage:row.damage,kos:row.kos}};
  }
 };
}

export async function kickBuddyRoute({path,method,user,db,body,query,allowDemo=false}){
 const service=kickBuddyService(db,{allowDemo});
 if(path==='/api/kick-buddy/state'&&method==='GET')return service.state(user);
 if(path==='/api/kick-buddy/state'&&method==='POST')return service.save(user,await body());
 if(path==='/api/kick-buddy/score'&&method==='POST')return service.score(user,await body());
 if(path==='/api/kick-buddy/leaderboard'&&method==='GET')return service.leaderboard(user,query?.get('period')||'all');
 if(path==='/api/kick-buddy/stats'&&method==='GET')return service.stats(user);
 throw new DomainError('not_found',404);
}
