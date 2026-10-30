import {advanceGarden} from './garden-quest-helpers.mjs';
export async function driveBoat(page) {
 const boss=await page.evaluate(()=>game.boatTrip.toBoss);
 await page.keyboard.down(boss?'KeyD':'KeyA');await advanceGarden(page,12);await page.keyboard.up(boss?'KeyD':'KeyA');
 const dz=await page.evaluate(()=>game.boatMooring(game.boatTrip.toBoss).z-game.boat.position.z);
 const key=dz<0?'KeyW':'KeyS';await page.keyboard.down(key);await advanceGarden(page,Math.abs(dz)/6);await page.keyboard.up(key);
 await page.keyboard.press('KeyE');
}
