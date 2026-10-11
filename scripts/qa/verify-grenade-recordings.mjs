// Decode the actual recorded mix; never synthesize replacement evidence.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { inspectRecordingFrames } from './browser-recording.mjs';
const out=process.argv[2]??'artifacts/p3b6b3c/grenade-after';
const {chromium}=await import(process.env.TOPWAR_PLAYWRIGHT_MODULE??'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),results=[];
try{const page=await browser.newPage();await page.goto('about:blank');
 for(const file of readdirSync(out).filter(f=>f.endsWith('.webm'))){
  const decoded=await page.evaluate(async bytes=>{
   const context=new AudioContext();try{const buffer=await context.decodeAudioData(new Uint8Array(bytes).buffer),samples=[];
    for(let i=0;i<buffer.length;i++){let value=0;for(let c=0;c<buffer.numberOfChannels;c++)value+=buffer.getChannelData(c)[i];samples.push(value/buffer.numberOfChannels);}
    let sum=0,peak=0;for(const s of samples){sum+=s*s;peak=Math.max(peak,Math.abs(s));}return{rate:buffer.sampleRate,seconds:buffer.duration,peak,rms:Math.sqrt(sum/samples.length),samples};
   }finally{await context.close();}
  },Array.from(readFileSync(`${out}/${file}`)));
  assert(decoded.seconds>.5&&decoded.peak>.001,'Actual mix must have audible, nonempty samples');
  const bytes=Buffer.alloc(44+decoded.samples.length*2);bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(decoded.rate,24);bytes.writeUInt32LE(decoded.rate*2,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(decoded.samples.length*2,40);
  decoded.samples.forEach((s,i)=>bytes.writeInt16LE(Math.round(Math.max(-1,Math.min(1,s))*32767),44+i*2));writeFileSync(`${out}/${file.replace('.webm','.wav')}`,bytes);
  const times=file.includes('survival10')?[2,2.4]:[.9,1.3];
  await inspectRecordingFrames(browser,readFileSync(`${out}/${file}`),Number(file.slice(0,3)),`${out}/${file.replace('.webm','')}`,times);
  const {samples,...stats}=decoded;results.push({file,...stats});
 }assert.equal(results.length,6);writeFileSync(`${out}/audio-verification.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close();}
