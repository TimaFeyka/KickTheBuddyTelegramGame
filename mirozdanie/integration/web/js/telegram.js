/* Host bridge: both messengers use the existing signed Мироздание session. */
import {api, bridge, watchSafeAreas, ApiError} from '/adapters.js';
const host = bridge();
export const platform = host.host;
export const isTelegram = platform === 'telegram';
export const embedded = window.parent !== window && new URLSearchParams(location.search).get('embedded') === '1';
let player = null;
let hapticsEnabled=true;
export function setHapticsEnabled(value){hapticsEnabled=value!==false;}
export const tgUser = () => player;
export const initData = () => ''; // Never forward raw messenger auth to game endpoints.
export const startParam = () => host.startParam;
export const themeParams = () => host.sdk?.themeParams || null;
export function setPlayer(value) { player = {...value, language_code:'ru'}; }
export function initTelegram() {
  if (!embedded) host.init();
  watchSafeAreas({sdk:host.sdk,root:document.documentElement,embedded,host:platform});
  if (!embedded) {host.back?.onClick?.(closeApp);host.back?.show?.();}
  const activity = event => {if (embedded && event.isTrusted) window.parent.postMessage({type:'mirozdanie-kick-buddy-activity'},location.origin);};
  document.addEventListener('pointerdown',activity,{capture:true,passive:true});
  document.addEventListener('keydown',activity,{capture:true,passive:true});
}
export async function ensureSession() {
  const session = await api.session();
  if (!session.demoIdentity && !session.authenticated) {
    if (!host.initData || !['telegram','max'].includes(platform)) throw new ApiError('auth_required',401);
    await api.auth(platform,host.initData);
    return api.session();
  }
  return session;
}
export async function gameRequest(path,body,{keepalive=false,recover=true}={}) {
  const response = await fetch('/api/kick-buddy/'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),keepalive,signal:AbortSignal.timeout(20000)});
  let data;try {data=await response.json();} catch {throw new ApiError('service_unavailable',503);}
  if (response.status===401 && recover && host.initData) {await api.auth(platform,host.initData);return gameRequest(path,body,{keepalive,recover:false});}
  if (!response.ok) throw new ApiError(data.error||'service_unavailable',response.status);
  return data;
}
export function haptic(kind='light') {
  if(!hapticsEnabled)return false;
  try {
    const h=host.sdk?.HapticFeedback;if(!h)return false;
    if(['success','warning','error'].includes(kind))h.notificationOccurred?.(kind);
    else if(kind==='select')h.selectionChanged?.();else h.impactOccurred?.(kind);
    return true;
  } catch {return false;}
}
export function shareScore(_damage,text) {
  // Only public launch links: location.href may contain signed initData.
  const url=platform==='telegram'?'https://t.me/cyber_sheff_bot?startapp=game-kick-buddy':platform==='max'?'https://max.ru/se13939169_bot?startapp=game-kick-buddy':location.origin+'/#games/kick-buddy';
  try {
    if(platform==='max'&&typeof host.sdk?.shareContent==='function'){host.sdk.shareContent({text,link:url});return true;}
    if(platform==='telegram'&&typeof host.sdk?.openTelegramLink==='function'){host.sdk.openTelegramLink('https://t.me/share/url?url='+encodeURIComponent(url)+'&text='+encodeURIComponent(text));return true;}
    if(navigator.share){navigator.share({text,url,title:'Пни профессора · Мироздание'}).catch(()=>{});return true;}
    if(navigator.clipboard?.writeText){navigator.clipboard.writeText(text+' '+url).then(()=>window.dispatchEvent(new Event('kick-buddy-link-copied'))).catch(()=>{});return true;}
  } catch {}
  return false;
}
export function openTelegramLink(url){host.open(url);}
export function closeApp(){if(embedded)window.parent.postMessage({type:'mirozdanie-kick-buddy-back'},location.origin);else location.href='/#games';}
export const canRate=()=>false;
