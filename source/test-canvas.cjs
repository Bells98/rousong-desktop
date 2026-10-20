// Real production Canvas pixels with a stub DOM. This does not test browser layout.
const fs=require('fs'),vm=require('vm'),path=require('path'),crypto=require('crypto'),assert=require('node:assert/strict');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const {motionData,motionDuration,playScene}=require('./preview.js');
const hash=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
const checks=[];async function check(name,fn){await fn();checks.push(name)}
(async()=>{
 const sourceHtml=fs.readFileSync(path.join(__dirname,'../Rousong-Preview.html'),'utf8');
 assert.equal((sourceHtml.match(/<script src="source\/preview\.js"><\/script>/g)||[]).length,1,'source preview loads the production script once');
 const html=fs.readFileSync(path.join(__dirname,'../dist/Rousong-Preview.html'),'utf8');
 const js=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 assert.equal(js,fs.readFileSync(path.join(__dirname,'preview.js'),'utf8'));
 const assetFiles={spriteAsset:'atlas.png',motionsAsset:'motions.png',scratchBoardAsset:'scratch-board.png',scratchSmoothAsset:'scratch-smooth.png',relaxAsset:'relax.png'},assetIds=Object.keys(assetFiles);
 for(const [id,file] of Object.entries(assetFiles)){
  const sourceTags=[...sourceHtml.matchAll(new RegExp('<img[^>]*id="'+id+'"[^>]*>','g'))];assert.equal(sourceTags.length,1,'one source image for '+id);
  assert.equal(sourceTags[0][0].match(/src="([^"]+)"/)?.[1],'source/assets/'+file,'source image uses its repository path: '+id);
  const bytes=fs.readFileSync(path.join(__dirname,'assets',file));
  const tag=html.match(new RegExp('<img[^>]*id="'+id+'"[^>]*>'))?.[0];assert(tag,'missing '+id);
  const src=tag.match(/src="data:image\/[a-z]+;base64,([^"]+)"/)?.[1];assert(src,'image must be self-contained: '+id);assert.deepEqual(Buffer.from(src,'base64'),bytes,'embedded '+id+' is current');
 }
 class Element{
  constructor(){this.events={};this.dataset={};this.attrs={};this.checked=true;this.value=1;this.clientWidth=600;this.clientHeight=500;this.offsetWidth=360;this.offsetHeight=360;this.textContent='';this.style={setProperty(k,v){this[k]=v},getPropertyValue(k){return this[k]}};const classes=new Set();this.classList={add:k=>classes.add(k),remove:k=>classes.delete(k)};}
  addEventListener(k,f){(this.events[k]??=[]).push(f)}setAttribute(k,v){this.attrs[k]=v}setPointerCapture(id){this.capture=id}hasPointerCapture(id){return this.capture===id}releasePointerCapture(){this.capture=null}emit(k,e={}){for(const f of this.events[k]||[])f({target:this,...e})}
 }
 // Decode the immutable pixels once. Startup-order cases only change completion
 // flags and event listeners; native image buffers must not multiply across VMs.
 const decodedImages=Object.fromEntries(await Promise.all(Object.entries(assetFiles).map(async([id,file])=>[id,await loadImage(path.join(__dirname,'assets',file))])));
 async function harness(order=assetIds){
  const canvas=createCanvas(400,400),els={};let now=0,raf,rafCount=0;
  for(const [,id] of html.matchAll(/id="([^"]+)"/g))els[id]=new Element();
  const images=decodedImages;
  for(const [id,img] of Object.entries(images)){Object.defineProperty(img,'complete',{value:false,writable:true});img.events={};img.addEventListener=(k,f)=>(img.events[k]??=[]).push(f);img.emit=k=>{for(const f of img.events[k]||[])f()};els[id]=img;}
  els.petCanvas=canvas;
  const actions=[...html.matchAll(/data-action="([^"]+)"/g)].map(([,action])=>{const e=new Element();e.dataset.action=action;return e});
  const store=new Map();const document={getElementById:id=>{assert(els[id],'missing '+id);return els[id]},querySelectorAll:()=>actions,body:{dataset:{}},addEventListener(){}};
  const context={console,document,window:{addEventListener(){}},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},performance:{now:()=>now},requestAnimationFrame:f=>{raf=f;rafCount++},Date,Math};
  vm.createContext(context);vm.runInContext(js,context);assert.equal(context.window.roussong,undefined,'wait for all five images');
  for(const id of order.slice(0,-1)){images[id].complete=true;images[id].emit('load');assert.equal(context.window.roussong,undefined,'partial image loading cannot start animation')}
  images[order.at(-1)].complete=true;images[order.at(-1)].emit('load');const api=context.window.roussong;assert(api.ready);assert.equal(rafCount,1);
  for(const id of order)images[id].emit('load');assert.equal(rafCount,1,'duplicate image events cannot start another RAF loop');
  const click=a=>{const b=actions.find(b=>b.dataset.action===a);assert(b,'missing action '+a);b.emit('click')};
  const advance=dt=>{now+=dt*1000;raf(now)};
  const render=(a,t)=>{api.life.setActivity(a,motionDuration[a]||8);api.life.elapsed=t;api.draw();return canvas.getContext('2d').getImageData(0,0,400,400).data};
  return {canvas,els,images,document,store,api,click,advance,render};
 }
 let h;
 await check('each of the five image assets can arrive last and startup never duplicates its loop',async()=>{const ids=assetIds;for(let shift=0;shift<ids.length;shift++){const next=await harness([...ids.slice(shift),...ids.slice(0,shift)]);if(!h)h=next}});
 const {canvas,els,api,click,advance,render,images,document,store}=h;
 const rawCanvas=createCanvas(400,400),rawCtx=rawCanvas.getContext('2d'),tileHashes=[],tileBounds=[];
 await check('32 safely inset RGBA tiles, distinct poses, and preserved neutral endpoints for the original motions',()=>{
  assert.equal(images.motionsAsset.naturalWidth,1600);assert.equal(images.motionsAsset.naturalHeight,3200);
  for(let n=0;n<32;n++){
   rawCtx.clearRect(0,0,400,400);rawCtx.drawImage(images.motionsAsset,(n%4)*400,Math.floor(n/4)*400,400,400,0,0,400,400);
   const pixels=rawCtx.getImageData(0,0,400,400).data;tileHashes.push(hash(pixels));let visible=0,transparent=0,left=400,top=400,right=0,bottom=0;
   for(let y=0;y<400;y++)for(let x=0;x<400;x++){const a=pixels[(y*400+x)*4+3];if(a===0)transparent++;if(a>48){visible++;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y)}}
   assert(visible>10000,'tile '+n+' has a full cat');assert(transparent>50000,'tile '+n+' has transparent background');assert(left>=2&&top>=2&&right<=397&&bottom<=397,'tile '+n+' does not touch its crop edge');tileBounds.push([left,top,right,bottom]);
  }
  for(const offset of [0,8,16,24]){assert.equal(new Set(tileHashes.slice(offset+1,offset+7)).size,6,'six distinct generated body poses');assert.equal(tileHashes[offset],tileHashes[0],'same neutral identity');assert.equal(tileHashes[offset+7],tileHashes[0],'same neutral on return')}
 });
 const relaxTileBounds=[],relaxTileHashes=[];
 await check('32 new full-body RGBA poses fit their slices and return to the original neutral body',()=>{
  assert.equal(images.relaxAsset.naturalWidth,1600);assert.equal(images.relaxAsset.naturalHeight,3200);
  for(let frame=0;frame<32;frame++){
   rawCtx.clearRect(0,0,400,400);rawCtx.drawImage(images.relaxAsset,(frame%4)*400,Math.floor(frame/4)*400,400,400,0,0,400,400);const pixels=rawCtx.getImageData(0,0,400,400).data;let visible=0,transparent=0,left=400,top=400,right=0,bottom=0;
   for(let y=0;y<400;y++)for(let x=0;x<400;x++){const alpha=pixels[(y*400+x)*4+3];if(alpha===0)transparent++;if(alpha>48){visible++;left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y)}}
   assert(visible>7000,'relax frame '+frame+' contains body pixels');assert(transparent>50000,'relax frame '+frame+' has a transparent background');assert(left>=2&&top>=2&&right<=397&&bottom<=397,'relax frame '+frame+' fits inside its crop');relaxTileBounds.push([left,top,right,bottom]);relaxTileHashes.push(hash(pixels));
  }
  for(const first of [0,16]){assert(new Set(relaxTileHashes.slice(first+1,first+15)).size>=6,'both new actions contain varied complete body poses');for(const endpoint of [first,first+15])assert.equal(relaxTileHashes[endpoint],tileHashes[0],'relax endpoint '+endpoint+' returns to the unchanged neutral pose')}
 });
 const firstPoseTimes={};let sceneSampleCount=0,maxEdgeAlpha=0;
 await check('production draw renders all full-body poses and prevents high-alpha clipping',()=>{
  for(const a of Object.keys(motionData)){
   const times=new Map();for(const k of motionData[a].keys)if(!times.has(k[1]))times.set(k[1],k[0]);firstPoseTimes[a]=a==='scratch'?[0,.5,1,1.15,1.4,1.65,9.5,10.5].map(t=>[playScene(a,t).scratchFrame,t]):[...times].sort((a,b)=>a[0]-b[0]);
   const outputs=[];
   for(const [tile,t] of firstPoseTimes[a]){const pixels=render(a,t);assert(pixels.some((v,i)=>i%4===3&&v>48),a+' tile '+tile+' renders');outputs.push(hash(pixels))}
   assert(new Set(outputs).size>=6,a+' renders multiple distinct full-body poses');
   const sample=new Set([0,motionDuration[a]]);for(const [i,k] of motionData[a].keys.entries()){sample.add(k[0]);sample.add(Math.max(0,k[0]-.001));sample.add(Math.min(motionDuration[a],k[0]+.001));if(i)sample.add((k[0]+motionData[a].keys[i-1][0])/2)}
   if(a==='scratch')for(let step=0;step<=330;step++)sample.add(step/30);
   for(const t of sample){const pixels=render(a,t);sceneSampleCount++;let edge=0;for(let n=0;n<400;n++)for(const [x,y] of [[n,0],[n,399],[0,n],[399,n]])edge=Math.max(edge,pixels[(y*400+x)*4+3]);maxEdgeAlpha=Math.max(maxEdgeAlpha,edge);assert(edge<=48,a+' at '+t+'s touches the canvas edge with visible pixels (alpha='+edge+')')}
  }
 });
 await check('scratch composes its fixed board first and cat second without an accidental toy layer',()=>{
  assert.equal(images.scratchBoardAsset.naturalWidth,400);assert.equal(images.scratchBoardAsset.naturalHeight,400);
  const boardRect=motionData.scratch.render.boardRect;assert.deepEqual(boardRect,[120,0,280,400],'shared board destination is the contact-aligned rectangle');
  rawCtx.clearRect(0,0,400,400);rawCtx.drawImage(images.scratchBoardAsset,0,0,400,400);const boardPixels=rawCtx.getImageData(0,0,400,400).data;assert(boardPixels.some((v,i)=>i%4===3&&v>48),'board is visible');assert(boardPixels.some((v,i)=>i%4===3&&v===0),'board has transparent background');
  const times=[...motionData.scratch.keys.map(k=>k[0]),0,1,9,10,11];for(const t of times){const scene=playScene('scratch',t);assert.equal(scene.useScratch,true);assert.equal(scene.dx,0);assert.equal(scene.hop,0);assert.equal(scene.prop.rotation,0);assert.equal(scene.prop.wing,1);assert.equal(scene.prop.x,0);assert.equal(scene.prop.y,0);assert.equal(scene.prop.r,0);rawCtx.clearRect(0,0,400,400);rawCtx.globalAlpha=scene.prop.alpha;rawCtx.drawImage(images.scratchBoardAsset,...boardRect);rawCtx.globalAlpha=1;rawCtx.drawImage(images.scratchSmoothAsset,(scene.scratchFrame%6)*320,Math.floor(scene.scratchFrame/6)*320,320,320,0,0,400,400);const expected=rawCtx.getImageData(0,0,400,400).data;assert.equal(hash(render('scratch',t)),hash(expected),'scratch has only its fixed board and full-body cat at '+t+'s')}
 });
 const smoothFrames=[],smoothFrameHashes=[],smoothCanvas=createCanvas(320,320),smoothCtx=smoothCanvas.getContext('2d');let loopSeamDifference=0,maxAdjacentLoopDifference=0;const loopPixelChanges={};
 await check('120 full-body frames fit their slices and join enter, two-second loop, and exit',()=>{
  assert.equal(images.scratchSmoothAsset.naturalWidth,1920);assert.equal(images.scratchSmoothAsset.naturalHeight,6400);
  for(let frame=0;frame<120;frame++){
   smoothCtx.clearRect(0,0,320,320);smoothCtx.drawImage(images.scratchSmoothAsset,(frame%6)*320,Math.floor(frame/6)*320,320,320,0,0,320,320);const pixels=smoothCtx.getImageData(0,0,320,320).data;assert(pixels.some((v,i)=>i%4===3&&v>48),'full-body frame '+frame+' renders');smoothFrames.push(pixels);smoothFrameHashes.push(hash(pixels));
   for(let n=0;n<320;n++)for(const [x,y] of [[n,0],[n,319],[0,n],[319,n]])assert(pixels[(y*320+x)*4+3]<=48,'full-body frame '+frame+' is not clipped by its slice');
  }
  assert(new Set(smoothFrameHashes.slice(30,90)).size>=16,'loop atlas contains distinct samples');assert.equal(smoothFrameHashes[29],smoothFrameHashes[30],'enter ends on the loop starting pose');assert.equal(smoothFrameHashes[90],smoothFrameHashes[30],'exit begins on the loop starting pose');assert.equal(smoothFrameHashes[119],smoothFrameHashes[0],'exit returns to the starting full-body pose');
  const distance=(a,b,y0=0,y1=320)=>{let sum=0;for(let i=y0*320*4;i<y1*320*4;i++)sum+=Math.abs(a[i]-b[i]);return sum/((y1-y0)*320*4*255)};
  for(let n=30;n<89;n++)maxAdjacentLoopDifference=Math.max(maxAdjacentLoopDifference,distance(smoothFrames[n],smoothFrames[n+1]));loopSeamDifference=distance(smoothFrames[89],smoothFrames[30]);assert(loopSeamDifference<=maxAdjacentLoopDifference*1.25+1e-6,'loop wrap is comparable to an ordinary frame step');assert(maxAdjacentLoopDifference>0,'the atlas loop changes');
  // Diagnostics describe pixel movement, not whether the cat's biomechanics look natural.
  for(const [name,y0,y1] of [['upperCanvas',0,160],['middleCanvas',160,248],['lowerCanvas',248,320]])loopPixelChanges[name]=distance(smoothFrames[30],smoothFrames[60],y0,y1);
 });
 await check('all manual motion buttons run for their full duration then restore idle',()=>{
  for(const a of Object.keys(motionData)){click(a);assert.equal(api.life.activity,a);advance(motionDuration[a]-.01);assert.equal(api.life.activity,a);advance(.02);assert.equal(api.life.activity,'idle');assert.equal(document.body.dataset.activity,'idle')}
 });
 await check('care immediately removes independent pose and prop layers and remains locked',()=>{
  for(const a of Object.keys(motionData)){
   api.life.state.food=50;api.life.state.water=50;click(a);click('eat');assert.equal(api.life.activity,'eat');api.life.elapsed=0;api.draw();const interrupted=canvas.toBuffer('image/png');api.life.setActivity('eat',7);api.draw();assert.deepEqual(canvas.toBuffer('image/png'),interrupted,'no residual prop pixels');click(a);assert.equal(api.life.activity,'eat');advance(7.01);
   click(a);click('drink');assert.equal(api.life.activity,'drink');advance(6.01);
  }
 });
 await check('sleep blocks all motions and waking plays the full stretch',()=>{click('sleep');for(const a of Object.keys(motionData)){click(a);assert.equal(api.life.activity,'sleep')}click('sleep');assert.equal(api.life.activity,'stretch');advance(7.01);assert.equal(api.life.activity,'idle')});
 await check('drag cancels every new action, drops props, and freezes auto actions while held',()=>{
  for(const a of Object.keys(motionData)){
   click(a);els.petWrap.emit('pointerdown',{button:0,pointerId:1,clientX:100});assert.equal(api.life.activity,'idle');advance(20);assert.equal(api.life.activity,'idle');api.draw();assert.equal(playScene(api.life.activity,0).prop,null);els.petWrap.emit('pointermove',{pointerId:1,clientX:160});els.petWrap.emit('pointerup',{pointerId:1});assert.equal(api.life.activity,'idle');
  }
 });
 await check('turning random play off cancels toys, scratch, and rolling and persists preference',()=>{for(const a of ['butterfly','ball','scratch','roll']){els.playful.checked=true;els.playful.emit('change');click(a);assert.equal(api.life.activity,a);els.playful.checked=false;els.playful.emit('change');assert.equal(api.life.activity,'idle');assert.equal(JSON.parse(store.get('roussong-pet-preview-v1')).playful,false)}});
 await check('scratch button obeys low-energy guard and autonomous scratch begins through the animation loop',()=>{api.life.state.energy=20;click('scratch');assert.equal(api.life.activity,'idle');api.life.state.energy=78;els.playful.checked=true;els.playful.emit('change');api.life.toyCooldown=0;api.life.setActivity('idle',0);api.life.tick(.1,()=>.95);assert.equal(api.life.activity,'scratch');advance(.1);assert.equal(document.body.dataset.activity,'scratch');api.life.setActivity('idle',8)});
 await check('yawn and roll use their new full-body artwork and return visually to neutral',()=>{
  const neutral=hash(render('stretch',0));
  for(const a of ['yawn','roll']){
   for(const [frame,t] of firstPoseTimes[a])assert.equal(hash(render(a,t)),relaxTileHashes[frame],a+' selects its new body artwork without leftover props or extra overlays');
   assert.equal(hash(render(a,0)),neutral,a+' starts on the original neutral body');assert.equal(hash(render(a,motionDuration[a])),neutral,a+' ends on the original neutral body');
  }
 });
 await check('quiet yawning ignores the random-play toggle while rolling respects it and the shared cooldown',()=>{
  api.life.setActivity('idle',8);api.life.state.energy=20;click('roll');assert.equal(api.life.activity,'idle');click('yawn');assert.equal(api.life.activity,'yawn','low energy still allows quiet yawning');els.playful.checked=false;els.playful.emit('change');assert.equal(api.life.activity,'yawn','disabling automatic play does not interrupt a yawn');advance(motionDuration.yawn+.01);assert.equal(api.life.activity,'idle');
  api.life.state.energy=78;els.playful.checked=true;els.playful.emit('change');api.life.toyCooldown=0;api.life.setActivity('idle',0);let draws=0;api.life.tick(.1,()=>draws++===0?.4:.7);assert.equal(api.life.activity,'roll');advance(.1);assert.equal(document.body.dataset.activity,'roll');advance(motionDuration.roll);assert.equal(api.life.activity,'idle');assert(api.life.toyCooldown>0,'finishing a roll leaves the shared cooldown active');
  api.life.setActivity('idle',0);draws=0;api.life.tick(.1,()=>draws++===0?.4:.7);assert.notEqual(api.life.activity,'roll','the animation loop cannot immediately start another roll');api.life.setActivity('idle',8);
 });
 await check('small phone and narrow tablet fit the entire canvas at max pet size',()=>{
  for(const [width,height,wrap] of [[286,330,320],[380,350,320],[640,408,360],[800,480,360]]){els.stage.clientWidth=width;els.stage.clientHeight=height;els.petWrap.offsetWidth=wrap;els.petWrap.offsetHeight=wrap;api.life.state.size=1.18;api.fitPet();const scale=Number(els.petWrap.style.getPropertyValue('--pet-scale'));assert(wrap*scale<=width-16+.01);assert(wrap*scale<=height-16+.01)}
 });
 const renderedPoseCount=Object.values(firstPoseTimes).reduce((total,frames)=>total+frames.length,0),sheet=createCanvas(1600,Math.ceil(renderedPoseCount/4)*440),g=sheet.getContext('2d');let n=0;
 for(const a of Object.keys(motionData))for(const [tile,t] of firstPoseTimes[a]){const x=n%4*400,y=Math.floor(n/4)*440;g.fillStyle='#f8f4ea';g.fillRect(x,y,400,440);render(a,t);g.drawImage(canvas,x,y+40);g.fillStyle='#6b5234';g.font='17px sans-serif';g.fillText(a+' / '+(a==='scratch'?'body '+tile:'pose '+tile)+' / '+t+'s',x+15,y+25);n++}
 const out=path.resolve(__dirname,'../qa');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'motion-production-64-frames.png'),sheet.toBuffer('image/png'));
 fs.writeFileSync(path.join(out,'canvas-results.json'),JSON.stringify({passed:checks,renderedPoses:renderedPoseCount,relaxAtlasFrames:32,continuousScratchFrames:120,sceneTransitionSamples:sceneSampleCount,maxEdgeAlpha,tileBounds,relaxTileBounds,loopSeamDifference,maxAdjacentLoopDifference,loopPixelChanges,limitations:'Production draw() is rendered with real Canvas pixels and a stub DOM. Checks cover slicing, timing, composition, clipping and interactions; frame count and pixel differences do not establish naturalness. Browser layout and Windows WPF runtime are not covered.'},null,2));
 console.log('PASS Canvas',checks.length,{sceneSampleCount,maxEdgeAlpha},checks);
})().catch(e=>{console.error(e);process.exitCode=1});
