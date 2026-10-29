/** Input rules shared by the authenticated player-directory endpoints. */
export const PLAYER_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SEARCH_QUERY=/^[A-Za-z0-9_가-힣]{2,24}$/;

export function playerSearchQuery(raw:string|null):string|null{
 if(raw===null)return null;
 const query=raw.trim();
 return SEARCH_QUERY.test(query)?query:null;
}
export function playerSearchLimit(raw:string|null):number|null{
 if(raw===null)return 10;
 if(!/^(?:[1-9]|1[0-9]|20)$/.test(raw))return null;
 return Number(raw);
}
export type PlayerVisibilitySettings={discoverable:boolean;showRankedStats:boolean};
export function playerVisibilitySettings(input:unknown):input is PlayerVisibilitySettings{
 if(!input||typeof input!=='object'||Array.isArray(input))return false;
 const object=input as Record<string,unknown>;
 return Object.keys(object).length===2&&typeof object.discoverable==='boolean'
  &&typeof object.showRankedStats==='boolean';
}
