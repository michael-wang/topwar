// Capture the composited page and its procedural audio without external codecs.
export async function startGameRecording(page,width,height=844) {
 await page.evaluate(({width,height})=>{
  const a=window.__testApp,canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const stream=canvas.captureStream(0),sink=a.audio.context.createMediaStreamDestination();a.audio.master.connect(sink);
  stream.addTrack(sink.stream.getAudioTracks()[0]);
  const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9,opus',videoBitsPerSecond:1600000});
  window.__capture={canvas,ctx:canvas.getContext('2d'),track:stream.getVideoTracks()[0],stream,sink,recorder,chunks:[],startedAt:performance.now()};
  recorder.ondataavailable=e=>window.__capture.chunks.push(e.data);recorder.start();
 },{width,height});
 const cdp=await page.context().newCDPSession(page);let pending=Promise.resolve();
 const onFrame=event=>{pending=pending.then(async()=>{
  await page.evaluate(async data=>{const c=window.__capture,img=new Image();img.src='data:image/jpeg;base64,'+data;await img.decode();c.ctx.drawImage(img,0,0,c.canvas.width,c.canvas.height);c.track.requestFrame();},event.data);
  await cdp.send('Page.screencastFrameAck',{sessionId:event.sessionId});
 });};
 cdp.on('Page.screencastFrame',onFrame);await cdp.send('Page.startScreencast',{format:'jpeg',quality:90,maxWidth:width,maxHeight:height,everyNthFrame:1});
 return async()=>{
  cdp.off('Page.screencastFrame',onFrame);await cdp.send('Page.stopScreencast');await pending;
  const bytes=await page.evaluate(async()=>{const c=window.__capture;await new Promise(resolve=>{c.recorder.onstop=resolve;c.recorder.stop();});
   const bytes=new Uint8Array(await new Blob(c.chunks,{type:'video/webm'}).arrayBuffer());
   window.__testApp.audio.master.disconnect(c.sink);c.stream.getTracks().forEach(t=>t.stop());return Array.from(bytes);
  });await cdp.detach();return Buffer.from(bytes);
 };
}

export async function inspectRecordingFrames(browser,bytes,width,path,times) {
 const page=await browser.newPage({viewport:{width,height:844}});
 await page.setContent('<style>body{margin:0;background:#17222b}video{width:100%;height:844px;object-fit:contain}</style><video muted></video>');
 await page.evaluate(async bytes=>{const v=document.querySelector('video');v.src=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'video/webm'}));await new Promise(resolve=>v.onloadeddata=resolve);},Array.from(bytes));
 for(const [i,time] of times.entries()) {
  await page.evaluate(async time=>{const v=document.querySelector('video');await new Promise(resolve=>{v.onseeked=resolve;v.currentTime=time;});},time);
  await page.locator('video').screenshot({path:`${path}-video-${i}.png`});
 }
 await page.close();
}
