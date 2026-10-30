import assert from 'node:assert/strict';
import {stat,writeFile} from 'node:fs/promises';
const {default:sharp}=await import(process.env.SHARP_MODULE||'sharp');
const source='artifacts/portraits/garden-scout-2026-10-27',target='public/images/garden-scout-dialogue';
const names=['greeting','thinking','surprised','guiding','encouraging','celebrating'],results=[];
for(const name of names) {
  const input=`${source}/${name}.png`,output=`${target}/${name}.webp`;
  const original=await sharp(input).metadata();assert.ok(original.hasAlpha&&original.width===original.height);
  await sharp(input).resize(512,512,{fit:'inside',withoutEnlargement:true}).webp({quality:92,alphaQuality:100}).toFile(output);
  const image=await sharp(output).metadata(),stats=await sharp(output).stats();
  assert.ok(image.hasAlpha&&image.width===512&&image.height===512);
  assert.equal(stats.channels[3].min,0);assert.equal(stats.channels[3].max,255);
  results.push({name,originalWidth:original.width,originalHeight:original.height,width:image.width,height:image.height,alpha:true,sourceBytes:(await stat(input)).size,runtimeBytes:(await stat(output)).size});
}
await writeFile(`${source}/asset-metrics.json`,JSON.stringify(results,null,2));
console.log('PASS six transparent originals and 512px WebP runtime portraits',JSON.stringify(results));
