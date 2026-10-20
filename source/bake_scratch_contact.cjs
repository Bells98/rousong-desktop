'use strict';
// v0.8 contact-rhythm preview. One original whole-cat B texture, one
// connected 83-point anatomy mesh. No old whole-body u-cycle, detached limbs,
// endpoint texture dissolve, alpha intersection or annotated QA source.
// Reproduce from the extracted package directory (Node + @napi-rs/canvas):
//   node source/bake_scratch_contact.cjs --out-dir motion-build
// After visual review, copy motion-build/scratch-contact-atlas.png to
// source/assets/scratch-smooth.png and motion-build/scratch-contact-layout.json
// to source/assets/scratch-fullbody-layout.json. Normal startup uses the PNG.
// The historical bake_scratch_fullbody.cjs regenerates the older v0.7 motion.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {createCanvas,loadImage,ImageData}=require('@napi-rs/canvas');
const ASSETS=path.join(__dirname,'assets'),C=400,CELL=320,COLUMNS=6;
const flag=process.argv.indexOf('--out-dir');
const OUT=flag>=0?path.resolve(process.argv[flag+1]):path.resolve(__dirname,'../qa/scratch-contact-motion');
fs.mkdirSync(OUT,{recursive:true});fs.mkdirSync(path.join(OUT,'frames'),{recursive:true});
const BOARD={x:120,y:0,width:280,height:400,sisalLeft:320.2,woodLeft:317.4};
const rows=[
 ['border-tl',0,0,0,0],['border-tc',200,0,200,0],['border-tr',400,0,400,0],['border-rc',400,200,400,200],['border-br',400,400,400,400],['border-bc',200,400,200,400],['border-bl',0,400,0,400],['border-lc',0,200,0,200],
 // Face, ear and jaw correspondence: eye/nose are registered BEFORE blend.
 ['ear-back-tip',193,69,212,118],['ear-back-rim',202,75,220,124],['ear-back-bottom',205,96,224,145],['ear-front-tip',236,38,255,90],['ear-front-left',224,66,243,116],['ear-front-right',244,67,263,117],
 ['forehead',250,75,268,122],['eye-near',239,87,258,136],['eye-near-left',233,88,250,137],['eye-near-top',239,82,257,131],['eye-near-right',245,87,264,135],['eye-near-bottom',239,92,258,141],
 ['eye-far',257,79,274,126],['eye-far-top',257,75,274,122],['eye-far-right',261,78,278,125],['eye-far-bottom',257,82,274,130],
 ['nose',269,89,284,136],['muzzle-tip',274,97,287,145],['muzzle-low',267,106,280,155],['chin',247,120,258,171],['jaw-rear',212,112,226,159],['cheek',230,104,248,152],['neck-front',244,137,252,189],['neck-back',187,134,207,152],
 // Near/far arms remain part of the same connected cat topology.
 ['near-shoulder',244,166,254,215],['near-elbow-inner',273,152,281,210],['near-elbow-outer',281,168,284,231],['near-wrist-inner',302,123,305,195],['near-wrist-outer',309,134,313,203],
 ['near-paw-left',308,96,309,175],['near-paw-top',320,91,320,172],['near-paw-tip',330,100,329,181],['near-paw-bottom',317,114,316,194],
 ['far-shoulder',251,139,265,168],['far-elbow-inner',278,111,283,154],['far-elbow-outer',285,119,291,164],['far-wrist-inner',307,77,306,125],['far-wrist-outer',315,84,316,133],
 ['far-paw-left',310,60,311,108],['far-paw-top',321,56,321,103],['far-paw-tip',330,66,330,114],['far-paw-bottom',319,80,319,127],
 // Thorax, back contour, abdomen and pelvis have TRUE pose differences.
 ['scapula-near',221,151,228,198],['scapula-far',239,130,258,178],['chest',242,190,253,233],['thorax',203,191,217,205],
 ['back-upper',178,158,194,154],['back-mid',157,184,172,174],['spine-mid',141,229,154,227],['abdomen',199,242,204,262],['belly-edge',206,254,204,273],
 ['hip',145,278,150,288],['pelvis',128,291,142,298],['near-knee',132,318,143,321],['far-knee',169,314,179,324],
 ['near-ankle-left',132,344,134,344],['near-ankle-right',154,344,157,344],['near-foot-left',144,364,147,364],['near-foot-tip',172,359,175,359],['near-foot-bottom',158,366,161,366],
 ['far-ankle-left',175,330,179,332],['far-ankle-right',192,333,195,333],['far-foot-left',189,349,192,349],['far-foot-tip',210,346,214,346],['far-foot-bottom',199,354,202,354],
 ['tail-root-top',102,260,112,261],['tail-root-inner',110,287,117,286],['tail-left-upper',65,275,63,278],['tail-left-mid',49,313,50,314],['tail-bottom',80,345,81,346],['tail-tip-top',103,334,104,335],['tail-tip-bottom',108,347,109,348],
 ['ground-left',85,378,85,378],['ground-middle',170,378,170,378],['ground-right',270,378,270,378]
];
const A=rows.map(r=>[r[1],r[2]]),BS=rows.map(r=>[r[3],r[4]]),B=BS.map(p=>p.slice());
// Pose B is normalized with exactly the A scale/offset. Only the two planted
// foot regions are locally registered to their A ground contacts.
for(let i=0;i<rows.length;i++)if(/^(near|far)-(foot|ankle)/.test(rows[i][0]))B[i]=A[i].slice();
function orient(a,b,c){return(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);}
function circle(a,b,c){const d=2*(a[0]*(b[1]-c[1])+b[0]*(c[1]-a[1])+c[0]*(a[1]-b[1]));if(Math.abs(d)<1e-8)return null;const aa=a[0]**2+a[1]**2,bb=b[0]**2+b[1]**2,cc=c[0]**2+c[1]**2;const x=(aa*(b[1]-c[1])+bb*(c[1]-a[1])+cc*(a[1]-b[1]))/d,y=(aa*(c[0]-b[0])+bb*(a[0]-c[0])+cc*(b[0]-a[0]))/d;return[x,y,(x-a[0])**2+(y-a[1])**2];}
function delaunay(input){const p=input.concat([[-5000,-4000],[5000,-4000],[0,8000]]);let tris=[[input.length,input.length+1,input.length+2]];for(let n=0;n<input.length;n++){const bad=[],edges=new Map();for(let i=0;i<tris.length;i++){const t=tris[i],c=circle(...t.map(v=>p[v]));if(c&&((p[n][0]-c[0])**2+(p[n][1]-c[1])**2<=c[2]+1e-5)){bad.push(i);for(let j=0;j<3;j++){const a=t[j],b=t[(j+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(',');if(edges.has(key))edges.delete(key);else edges.set(key,[a,b]);}}}const bs=new Set(bad);tris=tris.filter((_,i)=>!bs.has(i));for(const[a,b]of edges.values()){const t=[a,b,n];if(orient(p[a],p[b],p[n])<0)[t[0],t[1]]=[t[1],t[0]];tris.push(t);}}return tris.filter(t=>t.every(v=>v<input.length));}
function raster(out,src,s,d){const area=orient(...d);if(Math.abs(area)<1e-6)return;const minX=Math.max(0,Math.floor(Math.min(...d.map(v=>v[0])))),maxX=Math.min(C-1,Math.ceil(Math.max(...d.map(v=>v[0])))),minY=Math.max(0,Math.floor(Math.min(...d.map(v=>v[1])))),maxY=Math.min(C-1,Math.ceil(Math.max(...d.map(v=>v[1]))));for(let yy=minY;yy<=maxY;yy++)for(let xx=minX;xx<=maxX;xx++){const x=xx+.5,y=yy+.5,b=((x-d[0][0])*(d[2][1]-d[0][1])-(y-d[0][1])*(d[2][0]-d[0][0]))/area,c=((d[1][0]-d[0][0])*(y-d[0][1])-(d[1][1]-d[0][1])*(x-d[0][0]))/area,a=1-b-c;if(a<-.000001||b<-.000001||c<-.000001)continue;const u=Math.max(0,Math.min(C-1,s[0][0]*a+s[1][0]*b+s[2][0]*c-.5)),v=Math.max(0,Math.min(C-1,s[0][1]*a+s[1][1]*b+s[2][1]*c-.5)),u0=Math.floor(u),v0=Math.floor(v),fu=u-u0,fv=v-v0;const sample=[[(v0*C+u0)*4,(1-fu)*(1-fv)],[(v0*C+Math.min(C-1,u0+1))*4,fu*(1-fv)],[(Math.min(C-1,v0+1)*C+u0)*4,(1-fu)*fv],[(Math.min(C-1,v0+1)*C+Math.min(C-1,u0+1))*4,fu*fv]];let aa=0,r=0,g=0,bb=0;for(const[i,w]of sample){const alpha=src[i+3]*w;aa+=alpha;r+=src[i]*alpha;g+=src[i+1]*alpha;bb+=src[i+2]*alpha;}const i=(yy*C+xx)*4;if(aa>0){out[i]=Math.round(r/aa);out[i+1]=Math.round(g/aa);out[i+2]=Math.round(bb/aa);out[i+3]=Math.round(aa);}}}
function warped(src,sp,dp){const out=new Uint8ClampedArray(C*C*4);for(const t of triangles)raster(out,src,t.map(i=>sp[i]),t.map(i=>dp[i]));return out;}
function mix(a,b,u){return a.map((p,i)=>[p[0]+(b[i][0]-p[0])*u,p[1]+(b[i][1]-p[1])*u]);}


const smooth=u=>{u=Math.max(0,Math.min(1,u));return u*u*(3-2*u);};
const easeOut=u=>1-(1-Math.max(0,Math.min(1,u)))**3;
const wrap=t=>((t%2)+2)%2;
const profiles={near:{offset:0,hold:.44,pullEnd:.60,pauseEnd:.88,peelEnd:1.08,liftEnd:1.58,stroke:6,retreat:20,peelAngle:-.14,tip:[329,181],hook:[329,181]},far:{offset:.86,hold:.34,pullEnd:.53,pauseEnd:.91,peelEnd:1.10,liftEnd:1.64,stroke:9,retreat:18,peelAngle:-.10,tip:[330,114],hook:[329,114]}};
// The hook and pause are true fixed-tip intervals. The short loaded pull stays
// on the same board x plane. Release first peels horizontally, THEN lifts at
// a visible gap, THEN approaches the board along a separate small arc.
function pawState(t,side){
 const p=profiles[side],q=wrap(t+p.offset);let stage,dx=0,dy=0,load=0,peel=0,contact=true;
 if(q<p.hold){stage='hook-hold';load=.72*smooth(q/p.hold);}
 else if(q<p.pullEnd){stage='resisted-pull';const u=(q-p.hold)/(p.pullEnd-p.hold);dy=p.stroke*easeOut(u);load=.72+.28*smooth(u);}
 else if(q<p.pauseEnd){stage='pull-pause';dy=p.stroke;load=1-.15*smooth((q-p.pullEnd)/(p.pauseEnd-p.pullEnd));}
 else if(q<p.peelEnd){stage='release-peel';contact=false;const u=smooth((q-p.pauseEnd)/(p.peelEnd-p.pauseEnd));dx=-p.retreat*u;dy=p.stroke;peel=u;load=.85*(1-u);}
 else if(q<p.liftEnd){stage='return-lift';contact=false;const u=(q-p.peelEnd)/(p.liftEnd-p.peelEnd);dx=-p.retreat-1.2*Math.sin(Math.PI*u);dy=p.stroke-(p.stroke+2)*smooth(u);peel=1-.35*smooth(u);}
 else{stage='return-approach';contact=false;const u=(q-p.liftEnd)/(2-p.liftEnd),v=smooth(u);dx=-p.retreat*(1-v);dy=-2*(1-v)-1.2*Math.sin(Math.PI*u);peel=.65*(1-v);}
 return {side,q,stage,contact,dx,dy,load,peel,angle:.016*load+p.peelAngle*peel,tip:[p.hook[0]+dx,p.hook[1]+dy]};
}
function rotOffset(point,pivot,angle){const x=point[0]-pivot[0],y=point[1]-pivot[1],co=Math.cos(angle),si=Math.sin(angle);return[x*(co-1)-y*si,x*si+y*(co-1)];}
function poseAt(t,amplitude=1){
 const near=pawState(t,'near'),far=pawState(t,'far');
 // Muscular load lags the actual hook. Head/hip deliberately do not travel in
 // the same vertical direction as the loaded shoulder and thorax.
 const nl=pawState(t-.075,'near').load,fl=pawState(t-.105,'far').load,nb=pawState(t-.15,'near').load,fb=pawState(t-.18,'far').load;
 const body=.58*nl+.42*fl,balance=.58*nb+.42*fb;
 const headCenter=[255,145],headAngle=-.010*body+.003*(fl-nl),headShift=[-.25*nl+.35*fl,-1.8*body];
 const target=rows.map((r,i)=>{
  const name=r[0],source=BS[i],base=B[i];let d=[0,0];
  if(/^border-|^ground-|^(near|far)-(foot|ankle)/.test(name))return base.slice();
  if(/^(ear-|eye-|forehead$|nose$|muzzle-|chin$|jaw-|cheek$)/.test(name)){const rr=rotOffset(source,headCenter,headAngle);d=[headShift[0]+rr[0],headShift[1]+rr[1]];}
  else if(/^(near|far)-paw-/.test(name)){const side=name.startsWith('near')?'near':'far',s=side==='near'?near:far,p=profiles[side],rr=rotOffset(source,p.tip,s.angle);d=[s.tip[0]-p.tip[0]+rr[0],s.tip[1]-p.tip[1]+rr[1]];}
  // The complete wrist/palm is one rigid target, so a retreat never leaves
  // a wrist point behind the palm and folds the connecting forearm triangle.
  else if(/^(near|far)-wrist-/.test(name)){const side=name.startsWith('near')?'near':'far',s=side==='near'?near:far,p=profiles[side],rr=rotOffset(source,p.tip,s.angle);d=[s.tip[0]-p.tip[0]+rr[0],s.tip[1]-p.tip[1]+rr[1]];}
  // This medial far-elbow control lies at the cheek occlusion boundary,
  // three pixels from the muzzle. Keep that boundary attached to the head;
  // wrist retraction is absorbed by the visible outer forearm instead.
  else if(name==='far-elbow-inner'){const rr=rotOffset(source,headCenter,headAngle);d=[headShift[0]+rr[0],headShift[1]+rr[1]];}
  else if(/^(near|far)-elbow-/.test(name)){const side=name.startsWith('near')?'near':'far',s=side==='near'?near:far,p=profiles[side],load=side==='near'?nl:fl,rr=rotOffset(source,p.tip,-.045*load);d=[.38*(s.tip[0]-p.tip[0])+.25*load+rr[0]+(side==='far'?.30*near.dx:0),.38*s.dy+.65*load+rr[1]];}
  else if(name==='near-shoulder')d=[.75*nl-.22*fl,2.6*nl-.45*fl];
  else if(name==='far-shoulder')d=[.60*fl-.18*nl,2.2*fl-.4*nl];
  else if(name==='scapula-near')d=[-.8*nl+.15*fl,2.8*nl-.4*fl];
  else if(name==='scapula-far')d=[-.6*fl+.15*nl,2.3*fl-.35*nl];
  else if(name==='neck-front')d=[.25*nl+.2*fl,.75*nl+.45*fl];
  else if(name==='neck-back')d=[-.4*nl+.15*fl,.6*nl-.2*fl];
  else if(name==='chest')d=[.8*nl+.3*fl,1.7*nl+.8*fl];
  else if(name==='thorax')d=[.4*nl-.1*fl,1.1*nl+.5*fl];
  else if(name==='back-upper')d=[-.65*nl+.25*fl,.7*nl-.3*fl];
  else if(name==='back-mid')d=[-.45*nb+.25*fb,.25*nb-.45*fb];
  else if(name==='spine-mid')d=[-.55*balance,-.25*balance];
  else if(name==='abdomen'||name==='belly-edge')d=[-.5*nb+.2*fb,.35*fb-.25*nb];
  else if(name==='hip')d=[-.75*balance,-.35*balance];
  else if(name==='pelvis')d=[-.65*balance,-.3*balance];
  else if(name==='near-knee')d=[-.25*balance,-.1*balance];
  else if(name==='far-knee')d=[-.2*balance,.1*balance];
  else if(name.startsWith('tail-'))d=[-.2*balance,.35*fb-.20*nb];
  return[base[0]+d[0]*amplitude,base[1]+d[1]*amplitude];
 });
 return{target,near,far,load:{near:nl,far:fl,thorax:body,hip:balance},amplitude};
}
// Only B is rendered: its source topology avoids cross-arm slivers inherited
// from the unused high-reach A pose.
const triangles=delaunay(BS);
function framePose(i){if(i<30)return poseAt(0,smooth(i/29));if(i<90)return poseAt((i-30)/30);return poseAt(0,1-smooth((i-90)/29));}
function tipFromTarget(target,side){return target[rows.findIndex(r=>r[0]===side+'-paw-tip')];}
function bodyPoint(target,name){return target[rows.findIndex(r=>r[0]===name)];}
function pawPixels(pixels,tip){
 const x0=Math.max(0,Math.floor(tip[0]-31)),x1=Math.min(C-1,Math.ceil(tip[0]+12)),y0=Math.max(0,Math.floor(tip[1]-16)),y1=Math.min(C-1,Math.ceil(tip[1]+19));let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,count=0;
 for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(pixels[(y*C+x)*4+3]>40){count++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
 return{roi:[x0,y0,x1+1,y1+1],alphaThreshold:40,pixels:count,bounds:count?[minX,minY,maxX+1,maxY+1]:null,rightmostAlpha:count?maxX:null,sisalGap:count?BOARD.sisalLeft-(maxX+1):null,woodGap:count?BOARD.woodLeft-(maxX+1):null};
}
function drawBoard(g,board){g.drawImage(board,BOARD.x,BOARD.y,BOARD.width,BOARD.height);}
function annotate(g,pose){
 g.save();g.strokeStyle='rgba(63,108,104,.55)';g.lineWidth=1;g.setLineDash([3,3]);g.beginPath();g.moveTo(BOARD.sisalLeft,45);g.lineTo(BOARD.sisalLeft,240);g.stroke();g.setLineDash([]);
 for(const side of['near','far']){const tip=tipFromTarget(pose.target,side);g.fillStyle=side==='near'?'#c17444':'#417b91';g.strokeStyle='#fff';g.lineWidth=1;g.beginPath();g.arc(...tip,2.7,0,Math.PI*2);g.fill();g.stroke();}g.restore();
}
async function main(){
 const rawPath=path.join(ASSETS,'raw','scratch-fullbody-pull.png'),source=await loadImage(rawPath),board=await loadImage(path.join(ASSETS,'scratch-board.png'));
 if(source.width!==1150||source.height!==1367)throw Error('Raw B source differs from the measured 83-landmark source.');
 const scale=330/1272,x=332-1133*scale,y=366-1296*scale,groundCorrection=3*scale,normalized=createCanvas(C,C),ng=normalized.getContext('2d');ng.drawImage(source,x,y+groundCorrection,source.width*scale,source.height*scale);const src=ng.getImageData(0,0,C,C).data;
 function renderPose(pose){const pixels=warped(src,BS,pose.target),canvas=createCanvas(C,C);canvas.getContext('2d').putImageData(new ImageData(pixels,C,C),0,0);const areas=triangles.map(t=>orient(...t.map(i=>pose.target[i])));return{pose,canvas,pixels,minArea:Math.min(...areas),negative:areas.filter(a=>a<=0).length,nearPixels:pawPixels(pixels,tipFromTarget(pose.target,'near')),farPixels:pawPixels(pixels,tipFromTarget(pose.target,'far'))};}
 const atlas=createCanvas(CELL*6,CELL*20),ag=atlas.getContext('2d'),loop=createCanvas(CELL*6,CELL*10),lg=loop.getContext('2d'),infos=[],hashes=[];
 for(let i=0;i<120;i++){
  const r=renderPose(framePose(i)),cell=createCanvas(CELL,CELL),g=cell.getContext('2d');g.drawImage(r.canvas,0,0,CELL,CELL);ag.drawImage(cell,i%6*CELL,Math.floor(i/6)*CELL);if(i>=30&&i<90)lg.drawImage(cell,(i-30)%6*CELL,Math.floor((i-30)/6)*CELL);
  const raw=g.getImageData(0,0,CELL,CELL).data;hashes.push(crypto.createHash('sha256').update(raw).digest('hex'));
  const qa=createCanvas(C,C),qg=qa.getContext('2d');qg.fillStyle='#f6f0e6';qg.fillRect(0,0,C,C);drawBoard(qg,board);qg.drawImage(r.canvas,0,0);fs.writeFileSync(path.join(OUT,'frames',`frame-${String(i).padStart(3,'0')}.png`),qa.toBuffer('image/png'));
  infos.push({frame:i,section:i<30?'enter':i<90?'loop':'exit',loopTime:i>=30&&i<90?(i-30)/30:0,amplitude:r.pose.amplitude,minArea:r.minArea,negative:r.negative,near:{...r.pose.near,actualTip:tipFromTarget(r.pose.target,'near'),alpha:r.nearPixels},far:{...r.pose.far,actualTip:tipFromTarget(r.pose.target,'far'),alpha:r.farPixels},nearShoulder:bodyPoint(r.pose.target,'near-shoulder'),farShoulder:bodyPoint(r.pose.target,'far-shoulder'),head:bodyPoint(r.pose.target,'nose'),hip:bodyPoint(r.pose.target,'hip'),nearFoot:bodyPoint(r.pose.target,'near-foot-bottom'),farFoot:bodyPoint(r.pose.target,'far-foot-bottom')});
 }
 fs.writeFileSync(path.join(OUT,'scratch-contact-atlas.png'),atlas.toBuffer('image/png'));fs.writeFileSync(path.join(OUT,'scratch-contact-loop.png'),loop.toBuffer('image/png'));
 const times=[0,.20,.40,.50,.68,.90,1.05,1.20,1.42,1.62,1.80,1.96],contact=createCanvas(1600,3*500),cg=contact.getContext('2d');cg.fillStyle='#f6f0e6';cg.fillRect(0,0,contact.width,contact.height);
 const closeups=createCanvas(1600,3*390),cl=closeups.getContext('2d');cl.fillStyle='#f6f0e6';cl.fillRect(0,0,closeups.width,closeups.height);
 const detailInfo=[];
 for(let i=0;i<times.length;i++){
  const t=times[i],r=renderPose(poseAt(t)),xx=i%4*400,yy=Math.floor(i/4)*500;drawBoardInCell(cg,board,xx,yy);cg.drawImage(r.canvas,xx,yy);cg.save();cg.translate(xx,yy);annotate(cg,r.pose);cg.restore();cg.strokeStyle='#cfc4b2';cg.strokeRect(xx+.5,yy+.5,399,499);cg.fillStyle='#574632';cg.font='16px Arial';cg.fillText(`${t.toFixed(2)}s | N ${r.pose.near.stage}`,xx+10,yy+422);cg.fillText(`F ${r.pose.far.stage}`,xx+10,yy+444);cg.font='14px Arial';cg.fillText(`N tip ${r.pose.near.tip.map(v=>v.toFixed(1))} | gap ${r.nearPixels.sisalGap?.toFixed(1)}`,xx+10,yy+466);cg.fillText(`F tip ${r.pose.far.tip.map(v=>v.toFixed(1))} | gap ${r.farPixels.sisalGap?.toFixed(1)}`,xx+10,yy+486);
  const plain=createCanvas(C,C),pg=plain.getContext('2d');pg.fillStyle='#f6f0e6';pg.fillRect(0,0,C,C);drawBoard(pg,board);pg.drawImage(r.canvas,0,0);
  const cx=i%4*400,cy=Math.floor(i/4)*390;cl.fillStyle='#574632';cl.font='15px Arial';cl.fillText(`${t.toFixed(2)}s | actual cat + board alpha`,cx+8,cy+19);
  for(const [j,side]of['far','near'].entries()){const tip=tipFromTarget(r.pose.target,side),box=[275,tip[1]-25,78,56];cl.drawImage(plain,...box,cx+8,cy+28+j*176,390,168);cl.strokeStyle='#cfc4b2';cl.strokeRect(cx+8,cy+28+j*176,390,168);cl.fillStyle='#574632';cl.font='12px Arial';cl.fillText(side+' '+r.pose[side].stage,cx+10,cy+193+j*176);}
  fs.writeFileSync(path.join(OUT,`local-${String(i).padStart(2,'0')}.png`),plain.toBuffer('image/png'));detailInfo.push({time:t,near:{state:r.pose.near,alpha:r.nearPixels},far:{state:r.pose.far,alpha:r.farPixels}});
 }
 function drawBoardInCell(g,b,x,y){g.save();g.translate(x,y);drawBoard(g,b);g.restore();}
 fs.writeFileSync(path.join(OUT,'contact.png'),contact.toBuffer('image/png'));fs.writeFileSync(path.join(OUT,'paw-board-closeups.png'),closeups.toBuffer('image/png'));
 const loopInfo=infos.slice(30,90),range=(list,key)=>[Math.min(...list.map(x=>key(x))),Math.max(...list.map(x=>key(x)))],evidence={};
 for(const side of['near','far']){const hook=loopInfo.filter(f=>f[side].stage==='hook-hold'),pause=loopInfo.filter(f=>f[side].stage==='pull-pause'),lift=loopInfo.filter(f=>f[side].stage==='return-lift');evidence[side]={hookFrames:hook.map(f=>f.frame),hookTipX:range(hook,f=>f[side].actualTip[0]),hookTipY:range(hook,f=>f[side].actualTip[1]),pauseTipX:range(pause,f=>f[side].actualTip[0]),pauseTipY:range(pause,f=>f[side].actualTip[1]),shoulderYWhileHooked:range(hook,f=>f[side+'Shoulder'][1]),returnLiftPixelSisalGap:range(lift,f=>f[side].alpha.sisalGap),returnLiftPixelWoodGap:range(lift,f=>f[side].alpha.woodGap)};}
 const endpoints={firstLast:hashes[0]===hashes[119],enterLoop:hashes[29]===hashes[30],loopExit:hashes[90]===hashes[30]},negativeMax=Math.max(...infos.map(f=>f.negative));
 const layout={candidateOnly:true,mode:'Contact-driven asymmetric independent paw holds/pulls and delayed whole-body reaction; B full texture and alpha; one connected anatomy mesh',limitations:'Small 2D deformation remains. Contact markers are geometric claw proxies; actual visible alpha separations are recorded and included in unannotated closeups. Naturalness is assessed visually, not inferred from fps or hashes.',cell:CELL,columns:6,rows:20,frames:120,fps:30,duration:4,sections:{enter:{start:0,count:30},loop:{start:30,count:60,duration:2},exit:{start:90,count:30}},source:{file:'assets/raw/scratch-fullbody-pull.png',sha256:crypto.createHash('sha256').update(fs.readFileSync(rawPath)).digest('hex'),size:[source.width,source.height],qaAnnotatedImageUsed:false},normalization:{scale,x,y,groundCorrection},boardDrawRect:BOARD,profiles,landmarks:rows.map((r,i)=>({name:r[0],source:BS[i],restTarget:B[i]})),triangles,endpointEquality:endpoints,minArea:Math.min(...infos.map(f=>f.minArea)),negativeMax,contactEvidence:evidence,frameInfo:infos,detailInfo};
 fs.writeFileSync(path.join(OUT,'scratch-contact-layout.json'),JSON.stringify(layout,null,2)+'\n');
 const csv=['frame,section,time,nearStage,nearContact,nearTipX,nearTipY,nearPixelRight,nearSisalGap,farStage,farContact,farTipX,farTipY,farPixelRight,farSisalGap,minArea,negative',...infos.map(f=>[f.frame,f.section,f.loopTime,f.near.stage,f.near.contact,...f.near.actualTip,f.near.alpha.rightmostAlpha,f.near.alpha.sisalGap,f.far.stage,f.far.contact,...f.far.actualTip,f.far.alpha.rightmostAlpha,f.far.alpha.sisalGap,f.minArea,f.negative].join(','))].join('\n');fs.writeFileSync(path.join(OUT,'phase-contact.csv'),csv+'\n');
 console.log(JSON.stringify({output:OUT,contact:path.join(OUT,'contact.png'),closeups:path.join(OUT,'paw-board-closeups.png'),minArea:layout.minArea,negativeMax,endpointEquality:endpoints,contactEvidence:evidence}));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exit(1);});
module.exports={poseAt,pawState,profiles,rows,BS,B,triangles,orient};
