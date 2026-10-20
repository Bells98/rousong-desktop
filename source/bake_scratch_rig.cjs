'use strict';
// Runtime texture animation: fixed cat body + continuous two-bone front arms.
// Source pixels are cropped, uniformly sampled through a triangular mesh, and
// drawn by Node Canvas; no pose swapping or cross-fading drives the arm motion.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const packaged=fs.existsSync(path.join(__dirname,'assets'));
const ROOT=packaged?__dirname:path.resolve(__dirname,'..'),ASSETS=packaged?path.join(__dirname,'assets'):path.join(ROOT,'desktop/source/assets'),QA=path.join(ROOT,'qa');
const SRC='exec-771d1880-89a0-47e9-8d08-0efc298c5a26.png';
const vec=(x,y)=>({x,y}),add=(a,b)=>vec(a.x+b.x,a.y+b.y),sub=(a,b)=>vec(a.x-b.x,a.y-b.y),mul=(a,k)=>vec(a.x*k,a.y*k),len=a=>Math.hypot(a.x,a.y),norm=a=>mul(a,1/(len(a)||1)),lerp=(a,b,t)=>add(mul(a,1-t),mul(b,t));
const boxes={body:[137,4,563,610],near:[834,119,986,535],far:[245,752,384,1173],reference:[672,629,1176,1236]};
function crop(image,b){const c=createCanvas(b[2]-b[0],b[3]-b[1]);c.getContext('2d').drawImage(image,b[0],b[1],c.width,c.height,0,0,c.width,c.height);return c;}
function ik(S,T,L1,L2){const dvec=sub(T,S),d=Math.min(L1+L2-.5,Math.max(Math.abs(L1-L2)+.5,len(dvec))),u=norm(dvec),v=vec(-u.y,u.x),a=(L1*L1-L2*L2+d*d)/(2*d),h=Math.sqrt(Math.max(0,L1*L1-a*a));return add(add(S,mul(u,a)),mul(v,h));}
function cubic(a,b,c,d,t){const q=1-t;return add(add(mul(a,q*q*q),mul(b,3*q*q*t)),add(mul(c,3*q*t*t),mul(d,t*t*t)));}
function centerAt(y,arm,S,E,T){
 const rootY=arm.rootY,jointY=arm.jointY,endY=arm.endY,blend=30;
 if(y<jointY-blend)return lerp(S,E,(y-rootY)/(jointY-rootY));
 if(y>jointY+blend)return lerp(E,T,(y-jointY)/(endY-jointY));
 const a=lerp(S,E,(jointY-blend-rootY)/(jointY-rootY));
 const d=lerp(E,T,blend/(endY-jointY));
 return cubic(a,lerp(a,E,.72),lerp(d,E,.72),d,(y-jointY+blend)/(blend*2));
}
function srcCenter(y,pts){for(let i=1;i<pts.length;i++)if(y<=pts[i][0]){const t=(y-pts[i-1][0])/(pts[i][0]-pts[i-1][0]);return pts[i-1][1]*(1-t)+pts[i][1]*t;}return pts[pts.length-1][1];}
function targetPoint(u,v,arm,S,E,T){const p=centerAt(v,arm,S,E,T),tangent=norm(sub(centerAt(v+.5,arm,S,E,T),centerAt(v-.5,arm,S,E,T))),n=vec(tangent.y,-tangent.x);return add(p,mul(n,(u-srcCenter(v,arm.sourceCenter))*arm.widthScale));}
function triangle(ctx,img,s,d){
 const det=(s[1].x-s[0].x)*(s[2].y-s[0].y)-(s[2].x-s[0].x)*(s[1].y-s[0].y);
 if(Math.abs(det)<1e-8)return;
 const du1=s[1].x-s[0].x,dv1=s[1].y-s[0].y,du2=s[2].x-s[0].x,dv2=s[2].y-s[0].y;
 const dx1=d[1].x-d[0].x,dy1=d[1].y-d[0].y,dx2=d[2].x-d[0].x,dy2=d[2].y-d[0].y;
 const a=(dx1*dv2-dx2*dv1)/det,b=(dy1*dv2-dy2*dv1)/det,c=(du1*dx2-du2*dx1)/det,f=(du1*dy2-du2*dy1)/det;
 const e=d[0].x-a*s[0].x-c*s[0].y,g=d[0].y-b*s[0].x-f*s[0].y;
 // Subpixel overlap prevents antialias gaps between neighboring texture facets.
 const mid=mul(add(add(d[0],d[1]),d[2]),1/3),clip=d.map(p=>add(p,mul(norm(sub(p,mid)),.38)));
 ctx.save();ctx.beginPath();ctx.moveTo(clip[0].x,clip[0].y);ctx.lineTo(clip[1].x,clip[1].y);ctx.lineTo(clip[2].x,clip[2].y);ctx.closePath();ctx.clip();ctx.setTransform(a,b,c,f,e,g);ctx.drawImage(img,0,0);ctx.restore();
}
function drawArm(ctx,img,arm,t,targetOverride=null){
 const S=arm.shoulder,phase=2*Math.PI*t+arm.phase;
 const T=targetOverride||vec(arm.contactX,arm.midY+arm.amplitude*Math.sin(phase));
 const E=ik(S,T,arm.upper,arm.lower),steps=58;
 for(let i=0;i<steps;i++){
  const y0=img.height*i/steps,y1=img.height*(i+1)/steps;
  const s=[vec(0,y0),vec(img.width,y0),vec(img.width,y1),vec(0,y1)];
  const d=s.map(p=>targetPoint(p.x,p.y,arm,S,E,T));
  triangle(ctx,img,[s[0],s[1],s[2]],[d[0],d[1],d[2]]);triangle(ctx,img,[s[0],s[2],s[3]],[d[0],d[2],d[3]]);
 }
 return {shoulder:S,elbow:E,paw:T};
}
const rig={
 body:{scale:.565,x:45,y:366-(606-4)*.565},
 near:{shoulder:vec(226,171),upper:64,lower:74,rootY:34,jointY:193,endY:406,widthScale:.36,sourceCenter:[[0,80],[50,74],[190,96],[345,111],[416,112]],contactX:309,midY:128,amplitude:40,phase:0},
 far:{shoulder:vec(245,153),upper:61,lower:72,rootY:32,jointY:197,endY:410,widthScale:.35,sourceCenter:[[0,86],[50,76],[200,74],[355,85],[421,89]],contactX:324,midY:128,amplitude:37,phase:Math.PI}
};
const rest={near:vec(252,241),far:vec(274,224)};
const loopFirst={near:vec(rig.near.contactX,rig.near.midY),far:vec(rig.far.contactX,rig.far.midY)};
const smooth=t=>t*t*(3-2*t);
const pixelHash=c=>crypto.createHash('sha256').update(Buffer.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data)).digest('hex');
async function main(){
 fs.mkdirSync(QA,{recursive:true});const source=await loadImage(path.join(ASSETS,'raw',SRC)),parts={};for(const [k,b]of Object.entries(boxes))parts[k]=crop(source,b);
 const board=await loadImage(path.join(ASSETS,'scratch-board.png'));
 const render=(t,targets=null)=>{const c=createCanvas(400,400),ctx=c.getContext('2d');const far=drawArm(ctx,parts.far,rig.far,t,targets&&targets.far);ctx.drawImage(parts.body,rig.body.x,rig.body.y,parts.body.width*rig.body.scale,parts.body.height*rig.body.scale);const near=drawArm(ctx,parts.near,rig.near,t,targets&&targets.near);return {canvas:c,coordinates:{t,near,far}};};
 const frames=[],rendered=[];
 for(let i=0;i<90;i++){
  let frame,segment,local;
  if(i<30){segment='enter';local=i/29;const q=smooth(local);frame=render(0,{near:lerp(rest.near,loopFirst.near,q),far:lerp(rest.far,loopFirst.far,q)});}
  else if(i<60){segment='loop';local=(i-30)/30;frame=render(local);}
  else{segment='exit';local=(i-60)/29;const q=smooth(local);frame=render(0,{near:lerp(loopFirst.near,rest.near,q),far:lerp(loopFirst.far,rest.far,q)});}
  frames.push({index:i,segment,local,...frame.coordinates});rendered.push(frame.canvas);
 }
 const hashes={enterFirst:pixelHash(rendered[0]),enterLast:pixelHash(rendered[29]),loopFirst:pixelHash(rendered[30]),loopLast:pixelHash(rendered[59]),exitFirst:pixelHash(rendered[60]),exitLast:pixelHash(rendered[89])};
 if(hashes.enterLast!==hashes.loopFirst||hashes.exitFirst!==hashes.loopFirst||hashes.enterFirst!==hashes.exitLast)throw new Error('Endpoint pixels do not match');
 const atlas=createCanvas(320*6,320*15),ac=atlas.getContext('2d');for(let i=0;i<90;i++)ac.drawImage(rendered[i],(i%6)*320,Math.floor(i/6)*320,320,320);
 fs.writeFileSync(path.join(ASSETS,'scratch-smooth.png'),atlas.toBuffer('image/png'));
 for(const [file,index]of [['scratch-loop-first.png',30],['scratch-loop-last.png',59],['scratch-ready.png',0]])fs.writeFileSync(path.join(ASSETS,file),rendered[index].toBuffer('image/png'));
 const contact=createCanvas(400*4,440*2),cx=contact.getContext('2d');cx.fillStyle='#f6f0e6';cx.fillRect(0,0,contact.width,contact.height);
 for(let k=0;k<8;k++){const index=30+Math.round(k*30/8)%30,x=(k%4)*400,y=Math.floor(k/4)*440;cx.drawImage(board,x,y);cx.drawImage(rendered[index],x,y);cx.strokeStyle='#d6cbbd';cx.strokeRect(x+.5,y+.5,399,439);cx.fillStyle='#4e4437';cx.font='16px sans-serif';cx.fillText(`loop t=${((index-30)/30).toFixed(3)}s`,x+12,y+416);}
 fs.writeFileSync(path.join(QA,'scratch-rig-contact.png'),contact.toBuffer('image/png'));
 const transition=createCanvas(1600,880),tx=transition.getContext('2d');tx.fillStyle='#f6f0e6';tx.fillRect(0,0,1600,880);
 for(let k=0;k<8;k++){const index=k<4?[0,9,19,29][k]:[60,69,79,89][k-4],x=(k%4)*400,y=Math.floor(k/4)*440;tx.drawImage(board,x,y);tx.drawImage(rendered[index],x,y);tx.strokeStyle='#d6cbbd';tx.strokeRect(x+.5,y+.5,399,439);tx.fillStyle='#4e4437';tx.font='16px sans-serif';tx.fillText(`${k<4?'enter':'exit'} frame ${index}`,x+12,y+416);}
 fs.writeFileSync(path.join(QA,'scratch-rig-transition-contact.png'),transition.toBuffer('image/png'));
 // Alpha bounds and lower-body identity use the actual final 320px packed cells.
 const bytes=ac.getImageData(0,0,atlas.width,atlas.height).data,alpha={zero:0,partial:0,opaque:0},footHashes=[];
 for(let n=3;n<bytes.length;n+=4){const a=bytes[n];if(a===0)alpha.zero++;else if(a===255)alpha.opaque++;else alpha.partial++;}
 for(let i=0;i<90;i++){const x=(i%6)*320,y=Math.floor(i/6)*320,foot=ac.getImageData(x,y+224,320,96).data;footHashes.push(crypto.createHash('sha256').update(Buffer.from(foot)).digest('hex'));}
 const feetUnique=[...new Set(footHashes)];if(feetUnique.length!==1)throw new Error('Rear feet moved between frames');
 const contract={version:2,source:SRC,sourceBounds:boxes,canvas:[400,400],atlas:{file:'scratch-smooth.png',tile:[320,320],columns:6,rows:15,frames:90,fps:30,boardIncluded:false,segments:{enter:[0,29],loop:[30,59],exit:[60,89]},loopDuration:1},
  behavior:'Body, tail and hind legs remain fixed. Enter only raises independent front arms from the chest; exit only retracts them. No seated pose or idle-to-standing transformation is implied. Activity boundary switches to the normal idle after the ready pose hold.',
  drawOrder:['far','body','near'],rig,rest,loopFirst,endpointPixelHashes:hashes,
  alphaSummary:alpha,rearFeet:{packedRect:[0,224,320,96],uniqueFrameHashes:feetUnique.length,pixelSha256:feetUnique[0]},frames};
 fs.writeFileSync(path.join(ASSETS,'scratch-rig-layout.json'),JSON.stringify(contract,null,2)+'\n');
 console.log(JSON.stringify({atlas:path.join(ASSETS,'scratch-smooth.png'),size:[atlas.width,atlas.height],loopContact:path.join(QA,'scratch-rig-contact.png'),transitionContact:path.join(QA,'scratch-rig-transition-contact.png'),hashes,alpha,rearFeet:contract.rearFeet}));
}
module.exports={rig,boxes,crop,ik,drawArm,targetPoint,main};
if(require.main===module)main().catch(e=>{console.error(e);process.exit(1);});
