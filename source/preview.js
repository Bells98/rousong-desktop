(function () {
  'use strict';
  const clamp = (v, fallback = 50) => Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : fallback;
  const labels = { idle:'安静陪着你', walk:'正在散步', groom:'认真洗脸中', stretch:'伸个懒腰', eat:'吧唧吧唧', drink:'咕嘟咕嘟', sleep:'做个软软的梦', play:'喜欢和你玩', butterfly:'追一只小蝴蝶', ball:'拨拨小球', scratch:'在猫抓板上磨磨爪', yawn:'困困地打个哈欠', roll:'躺下翻翻小肚皮' };
  const playDuration = { butterfly:12, ball:11, scratch:11, roll:7.2 };
  const smooth = n => {n=Math.max(0,Math.min(1,n));return n*n*(3-2*n);};
  const motionData = {"stretch":{"duration":7,"keys":[[0,0,0,0,0,0,0],[0.55,1,0,0,0,0,0],[1.1,2,0,0,0,0,0],[1.65,3,0,0,0,0,0],[2.4,4,0,0,0,0,0],[4.15,5,0,0,0,0,0],[5.35,6,0,0,0,0,0],[6.25,7,0,0,0,0,0],[7,7,0,0,0,0,0]]},"butterfly":{"duration":12,"keys":[[0,8,0,0,392,135,0],[0.7,9,0,0,322,120,1],[2.2,10,0,0,310,155,1],[3.6,11,2,0,312,130,1],[3.8,12,8,18,318,95,1],[4.05,13,16,35,340,72,1],[4.3,14,16,0,350,115,1],[4.9,9,6,0,316,155,1],[6,10,0,0,316,100,1],[6.75,11,2,0,314,130,1],[6.95,12,8,18,320,95,1],[7.2,13,16,35,343,70,1],[7.45,14,16,0,350,118,1],[8.2,9,6,0,312,125,1],[10.8,15,0,0,386,30,0],[12,15,0,0,400,-15,0]]},"scratch":{"duration":11,"render":{"fps":30,"cell":320,"columns":6,"frames":120,"enterSeconds":1,"loopSeconds":2,"loopUntil":9,"exitUntil":10,"boardRect":[120,0,280,400]},"keys":[[0,24,0,0,0,0,0],[0.55,25,0,0,0,0,1],[1.15,26,0,0,0,0,1],[1.85,27,0,0,0,0,1],[2.2,28,0,0,0,0,1],[2.55,27,0,0,0,0,1],[2.9,28,0,0,0,0,1],[3.25,29,0,0,0,0,1],[4.05,27,0,0,0,0,1],[4.4,28,0,0,0,0,1],[4.75,27,0,0,0,0,1],[5.1,28,0,0,0,0,1],[5.45,29,0,0,0,0,1],[6.25,27,0,0,0,0,1],[6.6,28,0,0,0,0,1],[6.95,27,0,0,0,0,1],[7.3,28,0,0,0,0,1],[7.65,29,0,0,0,0,1],[8.45,26,0,0,0,0,1],[9.05,30,0,0,0,0,1],[9.75,31,0,0,0,0,1],[10.5,31,0,0,0,0,0],[11,31,0,0,0,0,0]]},"ball":{"duration":11,"keys":[[0,16,0,0,393,354,0],[0.7,17,0,0,325,354,1],[1.5,18,0,0,325,354,1],[2,19,0,0,325,354,1],[2.25,20,8,0,351,354,1],[2.9,21,16,0,336,354,1],[3.4,22,12,0,329,354,1],[3.65,19,8,0,329,354,1],[4.2,20,12,0,353,354,1],[5,21,16,0,338,354,1],[5.8,22,8,0,329,354,1],[6.2,19,8,0,329,354,1],[6.55,20,12,0,356,354,1],[7.4,21,16,0,338,354,1],[8.2,22,4,0,330,354,1],[9.1,23,0,0,350,354,0.9],[10.3,23,0,0,390,354,0],[11,23,0,0,399,354,0]]},"yawn":{"duration":4.2,"atlas":"relax","keys":[[0,0,0,0,0,0,0],[0.4,1,0,0,0,0,0],[0.65,2,0,0,0,0,0],[0.8,3,0,0,0,0,0],[0.95,4,0,0,0,0,0],[1.1,5,0,0,0,0,0],[1.25,6,0,0,0,0,0],[1.4,7,0,0,0,0,0],[1.65,8,0,0,0,0,0],[1.85,9,0,0,0,0,0],[2,10,0,0,0,0,0],[2.15,11,0,0,0,0,0],[2.3,12,0,0,0,0,0],[2.6,13,0,0,0,0,0],[2.9,14,0,0,0,0,0],[3.2,15,0,0,0,0,0],[4.2,15,0,0,0,0,0]]},"roll":{"duration":7.2,"atlas":"relax","keys":[[0,16,0,0,0,0,0],[0.35,17,0,0,0,0,0],[0.55,18,0,0,0,0,0],[0.75,19,0,0,0,0,0],[0.95,20,0,0,0,0,0],[1.12,21,0,0,0,0,0],[1.3,22,0,0,0,0,0],[1.5,23,0,0,0,0,0],[1.72,24,0,0,0,0,0],[2.2,25,0,0,0,0,0],[2.6,24,0,0,0,0,0],[2.95,25,0,0,0,0,0],[3.3,24,0,0,0,0,0],[3.65,25,0,0,0,0,0],[4,26,0,0,0,0,0],[4.5,27,0,0,0,0,0],[4.75,28,0,0,0,0,0],[5,29,0,0,0,0,0],[5.3,30,0,0,0,0,0],[5.6,31,0,0,0,0,0],[7.2,31,0,0,0,0,0]]}};
const motionDuration = Object.fromEntries(Object.entries(motionData).map(([k,v])=>[k,v.duration]));
  function playScene(name,t){
    const data=motionData[name],s={row:0,frame:0,dx:0,hop:0,tilt:0,prop:null,useMotion:false,tile:0,useScratch:false,scratchFrame:0,useRelax:false,relaxFrame:0};
    if(!data)return s;
    t=Number.isFinite(t)?Math.max(0,Math.min(data.duration,t)):0;
    const keys=data.keys;let i=0;while(i+1<keys.length&&t>=keys[i+1][0])i++;
    const a=keys[i],b=keys[Math.min(i+1,keys.length-1)],u=b[0]===a[0]?0:smooth((t-a[0])/(b[0]-a[0]));
    const mix=c=>a[c]+(b[c]-a[c])*u;
    s.useMotion=true;s.tile=a[1];s.dx=mix(2);s.hop=mix(3);
    if(data.atlas==='relax'){s.useRelax=true;s.relaxFrame=a[1];return s;}
    if(name==='scratch'&&data.render){
      const r=data.render,enter=Math.round(r.enterSeconds*r.fps),loop=Math.round(r.loopSeconds*r.fps);
      const tick=Math.floor(t*r.fps+1e-7),until=Math.round(r.loopUntil*r.fps);
      s.useScratch=true;s.scratchFrame=tick<enter?tick:tick<until?enter+(tick-enter)%loop:enter+loop+Math.min(r.frames-enter-loop-1,tick-until);
    }
    if(name==='scratch')s.prop={x:0,y:0,alpha:mix(6),wing:1,rotation:0,r:0};
    else if(name!=='stretch')s.prop={x:mix(4)+(name==='butterfly'?6*Math.sin(t*4):0),y:mix(5)+(name==='butterfly'?8*Math.sin(t*3):0),alpha:mix(6),wing:.2+.8*Math.abs(Math.sin(t*18)),rotation:(name==='butterfly'?.24*Math.sin(t*3):t*3)*180/Math.PI,r:12};
    return s;
  }

  // Source rectangles isolate each unmodified atlas row. Anchors follow the
  // visible paws/tail in each frame rather than the unequal transparent margins.
  const atlasFrames = [
    {y:0,h:373,cx:[198,197,197,194],base:[356,356,356,352]},
    {y:373,h:258,cx:[160,160.5,159,157],base:[236,234,235,237]},
    {y:631,h:345,cx:[168,168,167,167.5],base:[323,323,323,323]},
    {y:976,h:278,cx:[163.5,162,162,161],base:[192,192,192,192]}
  ];
  class PetLife {
    constructor(saved, now = Date.now()) {
      this.state = { food:82, water:86, energy:78, mood:88, sleeping:false, wander:true, playful:true, meals:0, drinks:0, pats:0, size:1, saved:now };
      if (saved && typeof saved === 'object') {
        for (const k of ['food','water','energy','mood']) this.state[k] = clamp(saved[k], this.state[k]);
        for (const k of ['meals','drinks','pats']) this.state[k] = Number.isFinite(saved[k]) ? Math.max(0, Math.floor(saved[k])) : 0;
        this.state.sleeping = saved.sleeping === true;
        this.state.wander = saved.wander !== false;
        this.state.playful = saved.playful !== false;
        if(Number.isFinite(saved.size)) this.state.size=Math.max(.75,Math.min(1.18,saved.size));
        if(Number.isFinite(saved.saved)) this.advance(Math.max(0,(now-saved.saved)/3600000),true);
      }
      this.activity = this.state.sleeping ? 'sleep' : 'idle';
      this.remaining = 8; this.elapsed = 0;this.lastToy=null;this.toyCooldown=0;
    }
    advance(hours,offline=false) {
      const s=this.state; hours=Math.max(0,Math.min(offline?8:24,Number.isFinite(hours)?hours:0));
      s.food=clamp(s.food-hours*6);s.water=clamp(s.water-hours*9);
      s.energy=clamp(s.energy+hours*(s.sleeping?28:-6));s.mood=clamp(s.mood-hours*(s.sleeping?1:3));
      if(offline){s.food=Math.max(15,s.food);s.water=Math.max(15,s.water);s.energy=Math.max(15,s.energy);s.mood=Math.max(25,s.mood);}
    }
    setActivity(name,duration=8){this.activity=name;this.remaining=duration;this.elapsed=0;}
    act(action){
      const s=this.state;
      if(action==='pet'){s.mood=clamp(s.mood+8);s.pats++;if(!s.sleeping&&!['eat','drink'].includes(this.activity))this.setActivity('play',3);return s.sleeping?'呼噜……梦里也被摸摸了。':'呼噜呼噜，喜欢你摸摸。';}
      if(['eat','drink'].includes(this.activity))return '等我吃喝完这一口呀。';
      if(playDuration[action]){
        if(s.sleeping)return '肉松睡着啦，醒来再一起玩。';
        if(s.energy<25)return '有点困了，休息一会儿再玩吧。';
        if(action==='ball'||action==='butterfly')this.lastToy=action;this.toyCooldown=35;this.setActivity(action,playDuration[action]);
        return action==='roll'?'躺一躺，翻个肚皮，再慢慢坐好。':action==='scratch'?'后脚站稳，抓一抓，再往上伸一点。':action==='butterfly'?'咦，小蝴蝶！让我轻轻扑一下。':'小球滚过来啦，拨一下，再拨一下。';
      }
      if(action==='yawn'){if(s.sleeping)return '肉松睡着啦，醒来再打哈欠。';this.setActivity('yawn',motionDuration.yawn);return '哈——有一点点困，又想陪着你。';}
      if(action==='stretch'){if(s.sleeping)return '肉松睡着啦，醒来再伸展。';this.setActivity('stretch',motionDuration.stretch);return '前爪伸远一点，舒舒服服伸个懒腰。';}
      if(action==='eat'){if(s.food>=98)return '肚子圆圆的，饿了再吃吧。';s.sleeping=false;s.food=clamp(s.food+28);s.mood=clamp(s.mood+3);s.meals++;this.setActivity('eat',7);return '开饭啦！吧唧吧唧……';}
      if(action==='drink'){if(s.water>=98)return '水喝够啦，陪我待一会儿吧。';s.sleeping=false;s.water=clamp(s.water+35);s.mood=clamp(s.mood+2);s.drinks++;this.setActivity('drink',6);return '咕嘟咕嘟，水真好喝。';}
      if(action==='sleep'){s.sleeping=!s.sleeping;this.setActivity(s.sleeping?'sleep':'stretch',s.sleeping?8:motionDuration.stretch);return s.sleeping?'我先眯一会儿，陪你慢慢忙。':'睡醒啦，伸个懒腰。';}
      return '';
    }
    tick(seconds,random=Math.random){
      seconds=Number.isFinite(seconds)?Math.max(0,seconds):0;
      this.advance(seconds/3600,seconds>120);this.elapsed+=seconds;this.remaining-=seconds;this.toyCooldown=Math.max(0,this.toyCooldown-seconds);
      if(this.state.sleeping||this.remaining>0)return;
      if(this.activity!=='idle'){this.setActivity('idle',6+random()*8);return;}
      if(this.state.energy<18){this.state.sleeping=true;this.setActivity('sleep',60);return;}
      const n=random();
      if(n<.62){
        const r=random();
        if(r>=.80){this.act('yawn');return;}
        if(r>=.65&&this.state.playful&&this.state.energy>=25&&this.toyCooldown===0){this.act('roll');return;}
      }
      if(n>=.90&&this.state.playful&&this.state.energy>=25&&this.toyCooldown===0){this.act('scratch');return;}
      if(n>=.62&&n<.90&&this.state.playful&&this.state.energy>=25&&this.toyCooldown===0){
        const toy=this.lastToy?(this.lastToy==='ball'?'butterfly':'ball'):(n<.76?'butterfly':'ball');
        this.act(toy);return;
      }
      const next=n<.24&&this.state.wander?'walk':n<.46?'groom':n<.62?'stretch':'idle';this.setActivity(next,next==='stretch'?motionDuration.stretch:next==='idle'?8:5);
    }
    snapshot(now=Date.now()){return {...this.state,saved:now};}
  }
  if(typeof module!=='undefined')module.exports={PetLife,clamp,atlasFrames,playScene,playDuration,motionDuration,motionData};
  if(typeof document==='undefined')return;
  const key='roussong-pet-preview-v1';let stored=null,storageOK=true;
  try{stored=JSON.parse(localStorage.getItem(key));}catch(e){storageOK=false;}
  const life=new PetLife(stored),$=id=>document.getElementById(id),canvas=$('petCanvas'),ctx=canvas.getContext('2d'),atlas=$('spriteAsset'),motions=$('motionsAsset'),board=$('scratchBoardAsset'),scratchSmooth=$('scratchSmoothAsset'),relax=$('relaxAsset');
  let last=performance.now(),lastSave=last,lastUI=0,lastNeed=0,walkX=0,direction=1,lastActivity='idle',drag=null,bubbleUntil=0;
  const rects=atlasFrames;
  function save(){try{localStorage.setItem(key,JSON.stringify(life.snapshot()));$('saveStatus').textContent='已在本机保存';storageOK=true;}catch(e){storageOK=false;$('saveStatus').textContent='本次未能保存';}}
  function speak(text){$('speech').textContent=text;$('speech').classList.add('visible');bubbleUntil=performance.now()+4400;$('message').textContent=text;}
  function refresh(){const s=life.state;for(const k of ['food','water','energy','mood']){$(k+'Value').textContent=Math.round(s[k]);$(k+'Bar').style.width=s[k]+'%';$(k+'Track').setAttribute('aria-valuenow',Math.round(s[k]));}const sleeping=s.sleeping;$('sleepLabel').textContent=sleeping?'叫醒肉松':'睡一会儿';$('sleepButton').setAttribute('aria-pressed',String(sleeping));$('activity').textContent=labels[life.activity];$('stageState').textContent=labels[life.activity];$('countMeals').textContent=s.meals;$('countDrinks').textContent=s.drinks;$('countPats').textContent=s.pats;$('wander').checked=s.wander;$('size').value=s.size;document.body.dataset.activity=life.activity;}
  document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>{speak(life.act(b.dataset.action));refresh();save();}));
  $('wander').addEventListener('change',e=>{life.state.wander=e.target.checked;if(!life.state.wander&&life.activity==='walk')life.setActivity('idle');save();});
  $('playful').checked=life.state.playful;
  $('playful').addEventListener('change',e=>{life.state.playful=e.target.checked;if(!life.state.playful&&playDuration[life.activity])life.setActivity('idle');refresh();save();});
  function fitPet(){
    const wrap=$('petWrap'),stage=$('stage');
    // Leave room above the ears at max size, including small-phone layouts.
    const scale=Math.min(life.state.size,(stage.clientWidth-16)/wrap.offsetWidth,(stage.clientHeight-16)/wrap.offsetHeight);
    wrap.style.setProperty('--pet-scale',Math.max(.25,scale));
    walkX=Math.max(-boundary(),Math.min(boundary(),walkX));
  }
  $('size').addEventListener('input',e=>{life.state.size=Math.max(.75,Math.min(1.18,Number(e.target.value)||1));fitPet();save();});
  window.addEventListener('resize',fitPet);
  $('petWrap').addEventListener('pointerdown',e=>{if(e.button!==0)return;if(motionDuration[life.activity]){life.setActivity('idle');refresh();}drag={id:e.pointerId,startX:e.clientX,base:walkX,moved:false};$('petWrap').setPointerCapture(e.pointerId);});
  $('petWrap').addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const d=e.clientX-drag.startX;if(Math.abs(d)>5)drag.moved=true;walkX=Math.max(-boundary(),Math.min(boundary(),drag.base+d));});
  $('petWrap').addEventListener('pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;const moved=drag.moved;drag=null;if($('petWrap').hasPointerCapture(e.pointerId))$('petWrap').releasePointerCapture(e.pointerId);if(!moved){speak(life.act('pet'));refresh();save();}});
  $('petWrap').addEventListener('pointercancel',()=>drag=null);
  $('petWrap').addEventListener('lostpointercapture',()=>drag=null);
  $('petWrap').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();speak(life.act('pet'));refresh();save();}});
  function boundary(){const wrap=$('petWrap'),scale=Number(wrap.style.getPropertyValue('--pet-scale'))||1;return Math.max(0,($('stage').clientWidth-wrap.offsetWidth*.98*scale)/2-10);}
  function draw(){
    const a=life.activity,t=life.elapsed;let row=0,frame=0,sy=1,bottom=366,flip=1;
    const scene=playScene(a,t);
    if(a==='walk'){row=1;frame=Math.floor(t/.18)%4;flip=direction;}
    else if(['groom','eat','drink'].includes(a)){row=2;frame=Math.floor(t/.32)%4;}
    else if(a==='sleep'){row=3;frame=Math.floor(t/1.9)%4;sy=1+Math.sin(t*1.6)*.012;}
    else{const b=t%6.5;frame=b<.12?1:b<.25?2:b<.38?1:0;sy=1+Math.sin(t*1.8)*.007;if(a==='play')bottom-=Math.abs(Math.sin(t*3.5))*10;}
    ctx.clearRect(0,0,400,400);
    if(a==='scratch'&&scene.prop){ctx.save();ctx.globalAlpha=scene.prop.alpha;ctx.drawImage(board,...motionData.scratch.render.boardRect);ctx.restore();}
    if(scene.useMotion){
      ctx.save();ctx.translate(scene.dx,-scene.hop);
      if(scene.useRelax)ctx.drawImage(relax,(scene.relaxFrame%4)*400,Math.floor(scene.relaxFrame/4)*400,400,400,0,0,400,400);
      else if(scene.useScratch){const r=motionData.scratch.render;ctx.drawImage(scratchSmooth,(scene.scratchFrame%r.columns)*r.cell,Math.floor(scene.scratchFrame/r.columns)*r.cell,r.cell,r.cell,0,0,400,400);}
      else ctx.drawImage(motions,(scene.tile%4)*400,Math.floor(scene.tile/4)*400,400,400,0,0,400,400);ctx.restore();
    }else{
      ctx.save();ctx.translate(200,bottom);ctx.scale(flip,sy);const r=rects[row],x=frame*314,w=Math.min(314,atlas.naturalWidth-x),scale=.94;ctx.drawImage(atlas,x,r.y,w,r.h,-r.cx[frame]*scale,-r.base[frame]*scale,w*scale,r.h*scale);ctx.restore();
    }
    if(scene.prop&&(a==='butterfly'||a==='ball'))drawToy(a,scene.prop);
    if(a==='eat'||a==='drink'){const water=a==='drink';ctx.fillStyle=water?'#8baeb4':'#c29470';ctx.beginPath();ctx.roundRect(278,341,66,28,[3,3,12,12]);ctx.fill();ctx.fillStyle=water?'#cce6e8':'#8f6142';ctx.beginPath();ctx.ellipse(311,343,33,8,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(255,255,255,.4)';ctx.beginPath();ctx.ellipse(305,341,15,2,0,0,Math.PI*2);ctx.fill();}
    if(a==='sleep'||a==='play'){ctx.font='24px Georgia';ctx.fillStyle='#ae8965';ctx.fillText(a==='sleep'?'z Z':'♥',300,100-Math.sin(t*2)*5);}
    $('petWrap').style.setProperty('--pet-x',walkX+'px');
  }
  function drawToy(name,p){
    ctx.save();ctx.globalAlpha=p.alpha;
    if(name==='ball'){
      ctx.fillStyle='rgba(91,73,53,.13)';ctx.beginPath();ctx.ellipse(p.x,369,13,3,0,0,Math.PI*2);ctx.fill();
      ctx.translate(p.x,p.y);ctx.rotate(p.rotation*Math.PI/180);
      const fill=ctx.createRadialGradient(-4,-5,1,0,0,13);fill.addColorStop(0,'#ecd8af');fill.addColorStop(1,'#b67d50');
      ctx.fillStyle=fill;ctx.beginPath();ctx.arc(0,0,p.r,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#f6e8cb';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,0,5,11,0,0,Math.PI*2);ctx.moveTo(-11,0);ctx.lineTo(11,0);ctx.stroke();
    }else{
      ctx.translate(p.x,p.y);ctx.rotate(p.rotation*Math.PI/180);ctx.scale(p.wing,1);
      for(const side of [-1,1]){ctx.fillStyle='#c3a0cd';ctx.strokeStyle='#96769e';ctx.lineWidth=.9;ctx.beginPath();ctx.ellipse(side*7,-4,8,11,side*.5,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#e5c6bb';ctx.beginPath();ctx.ellipse(side*5,7,5,6,-side*.45,0,Math.PI*2);ctx.fill();}
      ctx.scale(1/p.wing,1);ctx.strokeStyle='#796878';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(0,11);ctx.moveTo(0,-7);ctx.quadraticCurveTo(-1,-14,-5,-14);ctx.moveTo(0,-7);ctx.quadraticCurveTo(1,-14,5,-14);ctx.stroke();
    }
    ctx.restore();
  }
  function frame(now){const dt=Math.max(0,(now-last)/1000);last=now;if(!drag)life.tick(dt);if(life.activity!==lastActivity){if(life.activity==='walk')direction=Math.random()<.5?-1:1;lastActivity=life.activity;refresh();}
    if(life.activity==='walk'&&!drag){walkX+=direction*Math.min(dt,.1)*18;const b=boundary();if(Math.abs(walkX)>b){walkX=Math.sign(walkX)*b;direction*=-1;}}
    if(now-lastUI>1000){refresh();lastUI=now;}if(now-lastSave>15000){save();lastSave=now;}if(now>bubbleUntil)$('speech').classList.remove('visible');
    if(now-lastNeed>180000&&!life.state.sleeping){lastNeed=now;if(life.state.water<25)speak('想喝水了，给我一点水好不好？');else if(life.state.food<25)speak('肚子咕咕叫，想吃饭啦。');}
    draw();requestAnimationFrame(frame);
  }
  window.addEventListener('pagehide',save);document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});
  function start(){fitPet();refresh();speak(stored?'你回来啦，肉松一直在这里。':'你好呀，我是肉松。摸摸我吧。');if(storageOK)save();else $('saveStatus').textContent='本次未能保存';window.roussong={life,draw,refresh,save,fitPet,atlasFrames,playScene,motionDuration,ready:true};requestAnimationFrame(frame);}
  const assets=[atlas,motions,board,scratchSmooth,relax];
  let started=false;function tryStart(){if(!started&&assets.every(img=>img.complete&&img.naturalWidth)){started=true;start();}}
  assets.forEach(img=>img.addEventListener('load',tryStart));tryStart();
  relax.addEventListener('error',()=>{speak('放松动作图未能加载，请重新打开完整的预览文件。');$('saveStatus').textContent='放松动作加载失败';});
  scratchSmooth.addEventListener('error',()=>{speak('连续磨爪图未能加载，请重新打开完整的预览文件。');$('saveStatus').textContent='磨爪加载失败';});
  board.addEventListener('error',()=>{speak('猫抓板图未能加载，请重新打开完整的预览文件。');$('saveStatus').textContent='猫抓板加载失败';});
  motions.addEventListener('error',()=>{speak('新动作图未能加载，请重新打开完整的预览文件。');$('saveStatus').textContent='动作加载失败';});
  atlas.addEventListener('error',()=>{speak('猫咪图像未能加载，请重新打开完整的预览文件。');$('saveStatus').textContent='图像加载失败';});
})();
