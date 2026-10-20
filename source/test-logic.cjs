const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {PetLife,atlasFrames,playScene,playDuration,motionDuration,motionData}=require('./preview.js');
const checks=[];function check(name,test){test();checks.push(name)}
check('decay rates',()=>{let p=new PetLife(null,0);p.advance(1);assert.equal(p.state.food,76);assert.equal(p.state.water,77);assert.equal(p.state.energy,72);assert.equal(p.state.mood,85)});
check('food/water locks and bounds',()=>{let p=new PetLife();p.act('eat');p.act('eat');p.act('drink');p.act('sleep');assert.equal(p.state.meals,1);assert.equal(p.state.drinks,0);assert.equal(p.activity,'eat');p.tick(7);p.act('drink');assert.equal(p.state.drinks,1);assert(p.state.food<=100);assert(p.state.water<=100);p.tick(6);assert.match(p.act('drink'),/够/)});
check('sleep restores energy, wake stretches, and pet respects care',()=>{let p=new PetLife();p.act('sleep');let e=p.state.energy;p.tick(30);assert(p.state.energy>e);p.act('pet');assert.equal(p.activity,'sleep');p.act('sleep');assert.equal(p.activity,'stretch');assert.equal(p.remaining,7);p.tick(7);assert.equal(p.activity,'idle');p.act('eat');p.act('pet');assert.equal(p.activity,'eat');assert.equal(p.state.pats,2)});
check('random actions, full stretch duration, and wander disabled',()=>{for(const [r,a] of [[.1,'walk'],[.4,'groom'],[.55,'stretch'],[.95,'scratch']]){let p=new PetLife();p.tick(9,()=>r);assert.equal(p.activity,a);if(a==='stretch')assert.equal(p.remaining,7)}let p=new PetLife();p.state.playful=false;p.tick(9,()=>.95);assert.equal(p.activity,'idle');p.state.wander=false;p.setActivity('idle',0);p.tick(9,()=>.1);assert.notEqual(p.activity,'walk');p.state.energy=10;p.setActivity('idle',0);p.tick(1);assert.equal(p.activity,'sleep')});
check('offline floor/cap and malformed data',()=>{let p=new PetLife({food:82,water:86,energy:78,mood:88,saved:0},3600000*100);assert.equal(p.state.food,34);assert.equal(p.state.water,15);assert.equal(p.state.energy,30);assert.equal(p.state.mood,64);p=new PetLife({food:-5,water:NaN,energy:Infinity,mood:1000,meals:-10,size:100,saved:1},0);assert.equal(p.state.food,15);assert.equal(p.state.water,86);assert.equal(p.state.energy,78);assert.equal(p.state.mood,100);assert.equal(p.state.meals,0);assert.equal(p.state.size,1.18);p.tick(NaN);p.tick(-10);assert(Number.isFinite(p.state.food));assert.equal(p.elapsed,0)});
check('save round trip and old preference defaults',()=>{let p=new PetLife();p.state.food=50;p.act('eat');p.state.size=1.11;p.state.wander=false;p.state.playful=false;let q=new PetLife(JSON.parse(JSON.stringify(p.snapshot(100))),100);assert.equal(q.state.meals,1);assert.equal(q.state.size,1.11);assert.equal(q.state.wander,false);assert.equal(q.state.playful,false);assert.equal(new PetLife({saved:100},100).state.playful,true)});
check('old atlas rectangles valid and anchored',()=>{for(const row of atlasFrames){assert(row.y+row.h<=1254);for(const b of row.base)assert(b>=0&&b<=row.h);assert.equal(row.cx.length,4)}});
check('all motions finish and care, sleep, and pet interrupt them',()=>{
 for(const a of Object.keys(motionData)){
  let p=new PetLife();p.act(a);assert.equal(p.activity,a);p.tick(motionDuration[a]-.01);assert.equal(p.activity,a);p.tick(.02);assert.equal(p.activity,'idle');assert.equal(playScene(p.activity,0).useMotion,false);assert.equal(playScene(p.activity,0).prop,null);
  p.act('sleep');p.act(a);assert.equal(p.activity,'sleep');p.act('sleep');p.act('eat');p.act(a);assert.equal(p.activity,'eat');p.tick(7);p.act(a);p.act('drink');assert.equal(p.activity,'drink');p.tick(6);p.act(a);p.act('pet');assert.equal(p.activity,'play');assert.equal(playScene(p.activity,0).prop,null);
  p=new PetLife();p.act(a);p.act('sleep');assert.equal(p.activity,'sleep');assert.equal(playScene(p.activity,0).useMotion,false);
 }
});
check('random toys alternate, have a cooldown and obey preference/energy',()=>{
 let p=new PetLife();p.tick(8,()=>.7);assert.equal(p.activity,'butterfly');p.tick(playDuration.butterfly,()=>.7);p.tick(12,()=>.7);assert.equal(p.activity,'idle');p.tick(13,()=>.7);assert.equal(p.activity,'ball');
 for(const r of [.7,.8]){p=new PetLife();p.state.playful=false;p.tick(9,()=>r);assert.equal(p.activity,'idle');p=new PetLife();p.state.energy=20;p.tick(9,()=>r);assert.equal(p.activity,'idle');}
 for(const a of Object.keys(playDuration)){p=new PetLife();p.state.energy=20;p.act(a);assert.equal(p.activity,'idle');}
});
check('random scratching obeys energy, sleep, preference, and shared cooldown',()=>{
 for(const n of [.90,.95,.999]){let p=new PetLife();p.tick(9,()=>n);assert.equal(p.activity,'scratch');assert.equal(p.remaining,11);assert(p.toyCooldown>0)}
 for(const guard of ['energy','sleep','preference','cooldown']){const p=new PetLife();if(guard==='energy')p.state.energy=20;if(guard==='sleep'){p.state.sleeping=true;p.setActivity('sleep',60)}if(guard==='preference')p.state.playful=false;if(guard==='cooldown')p.toyCooldown=100;p.tick(9,()=>.95);assert.equal(p.activity,guard==='sleep'?'sleep':'idle',guard+' prevents autonomous scratching')}
 const p=new PetLife();p.act('scratch');p.tick(11,()=>.95);assert.equal(p.activity,'idle');p.setActivity('idle',0);p.tick(1,()=>.95);assert.equal(p.activity,'idle','cooldown prevents immediate repeat');p.toyCooldown=0;p.setActivity('idle',0);p.tick(1,()=>.95);assert.equal(p.activity,'scratch');
 p.state.playful=false;p.setActivity('idle',8);p.act('scratch');assert.equal(p.activity,'scratch','manual scratching remains available when automatic play is disabled');
});
check('web timeline equals shared data and covers every pose in each atlas range',()=>{
 assert.deepEqual(motionData,JSON.parse(fs.readFileSync(path.join(__dirname,'motion-data.json'),'utf8')));
 assert.deepEqual(motionDuration,{stretch:7,butterfly:12,ball:11,scratch:11,yawn:4.2,roll:7.2});assert.deepEqual(playDuration,{butterfly:12,ball:11,scratch:11,roll:7.2});
 for(const [a,first,count] of [['stretch',0,8],['butterfly',8,8],['ball',16,8],['scratch',24,8],['yawn',0,16],['roll',16,16]]){
  const d=motionData[a];assert.equal(d.keys[0][0],0);assert.equal(d.keys.at(-1)[0],d.duration);assert.deepEqual([...new Set(d.keys.map(k=>k[1]))].sort((a,b)=>a-b),Array.from({length:count},(_,n)=>first+n));
  d.keys.forEach((k,n)=>{assert.equal(k.length,7);assert(k.every(Number.isFinite));assert(k[0]>=0&&k[0]<=d.duration);if(n)assert(k[0]>d.keys[n-1][0]);assert(Number.isInteger(k[1]));assert(k[6]>=0&&k[6]<=1)});
 }
});
check('complete motion timelines remain finite, in range, and settle without props',()=>{
 let samples=0;
 for(const [i,a] of ['stretch','butterfly','ball','scratch'].entries()){
  for(let step=0;step<=motionDuration[a]*40;step++){
   const s=playScene(a,step/40);samples++;assert(s.useMotion);assert(Number.isInteger(s.tile));assert(s.tile>=i*8&&s.tile<(i+1)*8);assert(Number.isFinite(s.dx)&&Math.abs(s.dx)<=16);assert(Number.isFinite(s.hop)&&s.hop>=0&&s.hop<=35);assert.equal(s.tilt,0);
   if(a==='stretch')assert.equal(s.prop,null);else{assert(s.prop);for(const v of Object.values(s.prop))assert(Number.isFinite(v));assert(s.prop.alpha>=0&&s.prop.alpha<=1);if(a==='scratch'){if('rotation' in s.prop)assert.equal(s.prop.rotation,0,'board does not rotate');if('wing' in s.prop)assert.equal(s.prop.wing,1,'board does not flap');for(const coord of ['x','y'])if(coord in s.prop)assert.equal(s.prop[coord],playScene('scratch',0).prop[coord],'board stays fixed')}else{assert(s.prop.wing>=.2&&s.prop.wing<=1);assert.equal(s.prop.r,12)}}
  }
  const final=playScene(a,motionDuration[a]);assert.equal(final.dx,0);assert.equal(final.hop,0);if(final.prop)assert.equal(final.prop.alpha,0);
  assert.deepEqual(playScene(a,-10),playScene(a,0));assert.deepEqual(playScene(a,NaN),playScene(a,0));assert.deepEqual(playScene(a,motionDuration[a]+100),final);
 }
 assert(samples>1600);
 for(const a of ['idle','walk','eat','drink','sleep','groom','play']){const s=playScene(a,5);assert.equal(s.useMotion,false);assert.equal(s.prop,null)}
});
check('full-body scratch uses 120 frames, repeats its two-second loop, and holds its settled pose',()=>{
 for(let step=0;step<=330;step++){
  const s=playScene('scratch',step/30);assert.equal(s.useScratch,true,'scratch uses its continuous full-body atlas throughout the activity');const expected=step<30?step:step<270?30+(step-30)%60:step<300?90+step-270:119;
  assert.equal(s.scratchFrame,expected,'frame at '+step+'/30 seconds');assert(Number.isInteger(s.scratchFrame)&&s.scratchFrame>=0&&s.scratchFrame<120);
 }
 for(const [t,frame] of [[0,0],[1-1e-5,29],[1,30],[2,60],[3-1e-5,89],[3,30],[9-1e-5,89],[9,90],[10-1e-5,119],[10,119]])assert.equal(playScene('scratch',t).scratchFrame,frame,'phase boundary at '+t+' seconds');
 for(const a of ['stretch','butterfly','ball','yawn','roll','idle','sleep','eat','drink'])assert.equal(playScene(a,2).useScratch,false,'only scratch uses the full-body atlas');
 for(const t of [10,10.25,10.99,11,100])assert.equal(playScene('scratch',t).scratchFrame,119,'last second holds the settled pose');
 for(const t of [-10,NaN,Infinity])assert.deepEqual(playScene('scratch',t),playScene('scratch',0));
 for(let cycle=1;cycle<4;cycle++)for(const phase of [.015,.215,.515,.815,1.215,1.815])assert.equal(playScene('scratch',1+cycle*2+phase).scratchFrame,playScene('scratch',1+phase).scratchFrame,'two-second loop frame is derived from time, not accumulated');
 const p=new PetLife();p.act('scratch');p.tick(11);assert.equal(p.activity,'idle');assert.equal(playScene(p.activity,0).useScratch,false,'scratch atlas clears when the activity completes');
});
check('desktop MotionData retains all shared keys and separate scratch/relax atlas fields',()=>{
 const cs=fs.readFileSync(path.join(__dirname,'MotionData.cs'),'utf8'),fields=cs.match(/public class MotionPose\s*\{([\s\S]*?)\n \}/)?.[1];assert(fields);assert(/\bScratchFrame\b/.test(fields));assert(/\bUseScratch\b/.test(fields));assert(/\bRelaxFrame\b/.test(fields));assert(/\bUseRelax\b/.test(fields));
 const shared=JSON.parse(fs.readFileSync(path.join(__dirname,'motion-data.json'),'utf8')).scratch.render.boardRect;assert.deepEqual(shared,[120,0,280,400],'shared board destination is contact aligned');assert.deepEqual(motionData.scratch.render.boardRect,shared,'web board destination matches shared metadata');
 const boardConstants=['ScratchBoardX','ScratchBoardY','ScratchBoardWidth','ScratchBoardHeight'].map(name=>{const value=cs.match(new RegExp('\\b'+name+'\\s*=\\s*(-?(?:\\d+(?:\\.\\d*)?|\\.\\d+))'))?.[1];assert.notEqual(value,undefined,'generated desktop constant '+name+' exists');return Number(value)});assert.deepEqual(boardConstants,shared,'desktop board destination matches shared metadata');
 for(const [name,label] of [['stretch','Stretch'],['butterfly','Butterfly'],['ball','Ball'],['scratch','Scratch'],['yawn','Yawn'],['roll','Roll']]){const block=cs.match(new RegExp(label+'Keys = new double\\[\\]\\[\\] \\{([\\s\\S]*?)\\n  \\};'))?.[1];assert(block,'desktop '+name+' keys exist');const keys=[...block.matchAll(/new double\[\]\{([^}]+)\}/g)].map(m=>m[1].split(',').map(Number));assert.deepEqual(keys,motionData[name].keys,'web and desktop key data match for '+name)}
});
check('yawning is a quiet idle action and rolling obeys automatic play, energy, and cooldown',()=>{
 const draws=(...values)=>{let i=0;return ()=>values[Math.min(i++,values.length-1)]};
 for(const [r,a] of [[.85,'yawn'],[.7,'roll']]){const p=new PetLife();p.tick(9,draws(.4,r));assert.equal(p.activity,a);assert.equal(p.remaining,motionDuration[a]);}
 for(const guard of ['energy','preference','cooldown','sleep']){
  const p=new PetLife();if(guard==='energy')p.state.energy=20;if(guard==='preference')p.state.playful=false;if(guard==='cooldown')p.toyCooldown=100;if(guard==='sleep'){p.state.sleeping=true;p.setActivity('sleep',60)}
  p.tick(9,draws(.4,.7));assert.notEqual(p.activity,'roll',guard+' prevents automatic rolling');
 }
 const quiet=new PetLife();quiet.state.energy=20;quiet.state.playful=false;quiet.toyCooldown=100;quiet.tick(9,draws(.4,.85));assert.equal(quiet.activity,'yawn');assert.equal(quiet.toyCooldown,91,'a yawn leaves the existing play cooldown running');
 const manual=new PetLife();manual.state.playful=false;manual.act('roll');assert.equal(manual.activity,'roll','automatic preference does not remove manual rolling');assert(manual.toyCooldown>0);manual.state.playful=true;manual.tick(motionDuration.roll);manual.setActivity('idle',0);manual.tick(1,draws(.4,.7));assert.notEqual(manual.activity,'roll','rolling shares the automatic play cooldown');
 manual.toyCooldown=0;manual.state.playful=true;manual.setActivity('idle',0);manual.tick(1,draws(.4,.7));assert.equal(manual.activity,'roll');
});
check('relax timelines show their own body poses, use no toy props, and settle safely',()=>{
 for(const [a,first] of [['yawn',0],['roll',16]]){
  const seen=new Set();for(let step=0;step<=Math.ceil(motionDuration[a]*60);step++){
   const scene=playScene(a,Math.min(motionDuration[a],step/60));assert(scene.useMotion&&scene.useRelax);assert.equal(scene.useScratch,false);assert.equal(scene.prop,null);assert(Number.isInteger(scene.relaxFrame)&&scene.relaxFrame>=first&&scene.relaxFrame<first+16);assert(Number.isFinite(scene.dx)&&Number.isFinite(scene.hop));seen.add(scene.relaxFrame);
  }
  assert.equal(seen.size,16,'the whole action reaches every dedicated body pose');
  const settled=playScene(a,motionDuration[a]);assert.equal(settled.relaxFrame,first+15);assert.deepEqual(playScene(a,motionDuration[a]+100),settled);
  for(const t of [-10,NaN,Infinity])assert.deepEqual(playScene(a,t),playScene(a,0));
  const p=new PetLife();p.act(a);p.tick(motionDuration[a]+.01);assert.equal(p.activity,'idle');assert.equal(playScene(p.activity,0).useRelax,false,'returning to idle clears the new atlas');
 }
 for(const a of ['stretch','butterfly','ball','scratch','idle','walk','groom','eat','drink','sleep','play'])assert.equal(playScene(a,2).useRelax,false,'only the two new activities use the relax atlas');
});
console.log('PASS',checks.length,checks);
