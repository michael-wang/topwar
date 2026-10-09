import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {inspectRecordingFrames} from './browser-recording.mjs';
const {chromium}=await import(process.env.TOPWAR_PLAYWRIGHT_MODULE??'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=process.argv[2]??'artifacts/p3a/browser';
const browser=await chromium.launch({headless:true,executablePath:process.env.TOPWAR_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const results=[];
try{
 const page=await browser.newPage();
 for(const file of readdirSync(out).filter(f=>f.endsWith('.webm'))){
  const bytes=readFileSync(`${out}/${file}`);
  const audio=await page.evaluate(async bytes=>{
   const context=new AudioContext(),buffer=await context.decodeAudioData(new Uint8Array(bytes).buffer);
   let peak=0,square=0,clipped=0,samples=0;
   for(let ch=0;ch<buffer.numberOfChannels;ch++)for(const sample of buffer.getChannelData(ch)){
    peak=Math.max(peak,Math.abs(sample));square+=sample*sample;if(Math.abs(sample)>=.999)clipped++;samples++;
   }
   await context.close();return{seconds:buffer.duration,channels:buffer.numberOfChannels,sampleRate:buffer.sampleRate,peak,rms:Math.sqrt(square/samples),clippedSamples:clipped};
  },Array.from(bytes));
  if(audio.rms<.0001||audio.clippedSamples)throw Error(`Missing or clipped audio: ${file}`);
  results.push({file,bytes:bytes.length,...audio});
 }
 for(const width of [390,350]){
  const events=JSON.parse(readFileSync(`${out}/${width}-recording-events.json`,'utf8'));
  const launches=events.dodgeTimes.filter(e=>e.kind==='artilleryLaunch');
  await inspectRecordingFrames(browser,readFileSync(`${out}/${width}-dodge-overlap.webm`),width,
   `${out}/${width}-overlap-recorded`,[launches[4].time+.15,launches[4].time+.55]);
 }
 writeFileSync(`${out}/recording-audit.json`,JSON.stringify(results,null,2));console.log(results);
}finally{await browser.close();}
