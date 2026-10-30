export const FERRY_SEA_Y=-.65;
export const FERRY_BOAT_Y=-.8;

export function gardenCoastX(z:number) {
  const t=Math.max(0,1-((z+12)/20)**2);
  return 102.5-5.8*t*t+.25*Math.sin(z*.7)*t;
}
export function bossCoastX(z:number) {
  const t=Math.max(0,1-((z+15)/13)**2);
  return 127.5+4.2*t*t+.16*Math.sin(z*.9)*t;
}
