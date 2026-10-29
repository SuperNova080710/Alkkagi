export const COSMETIC_CODE=/^(?:piece|avatar)-[a-z0-9-]{2,32}$/;
export function validEquipCosmetic(body:unknown):body is {itemCode:string}{
  if(!body||typeof body!=='object'||Array.isArray(body))return false;
  const b=body as Record<string,unknown>;
  return Object.keys(b).length===1
    &&typeof b.itemCode==='string'
    &&COSMETIC_CODE.test(b.itemCode);
}
