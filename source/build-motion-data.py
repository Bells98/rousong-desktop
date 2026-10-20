"""Generate identical web/Desktop animation timing from one source of truth."""
from pathlib import Path
import json

root = Path(__file__).resolve().parent
data = json.loads((root / 'motion-data.json').read_text())
js = 'const motionData = ' + json.dumps(data, separators=(',', ':')) + ';\n'
js += '''const motionDuration = Object.fromEntries(Object.entries(motionData).map(([k,v])=>[k,v.duration]));
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
'''
(root / 'motion-web.js').write_text(js)
cs = '''using System;
namespace RousongDesktop {
 public class MotionPose {
  public int Frame,ScratchFrame,RelaxFrame; public bool UseMotion,UseScratch,UseRelax;
  public double Dx,Hop,PropX,PropY,PropAlpha,PropWing=1,PropRotation;
 }
 public static class MotionData {
'''
board=data['scratch']['render']['boardRect']
cs += '  public const double ' + ','.join('ScratchBoard'+name+'='+str(value) for name,value in zip(['X','Y','Width','Height'],board)) + ';\n'
for name, action in [('stretch', 'Stretch'), ('butterfly', 'Butterfly'), ('ball', 'Ball'), ('scratch', 'Scratch'), ('yawn', 'Yawn'), ('roll', 'Roll')]:
    cs += f'  static readonly double[][] {action}Keys = new double[][] {{\n'
    cs += ',\n'.join('   new double[]{' + ','.join(str(v) for v in row) + '}' for row in data[name]['keys'])
    cs += '\n  };\n'
cs += '  public static double Duration(Activity action){\n'
for name, action in [('stretch', 'Stretch'), ('butterfly', 'Butterfly'), ('ball', 'Ball'), ('scratch', 'Scratch'), ('yawn', 'Yawn'), ('roll', 'Roll')]:
    cs += f'   if(action==Activity.{action})return {data[name]["duration"]};\n'
cs += '   return 8;\n  }\n'
cs += '''  public static MotionPose At(Activity action,double t){
   var p=new MotionPose();double[][] keys;double duration;
   if(action==Activity.Stretch){keys=StretchKeys;duration=7;}
   else if(action==Activity.Butterfly){keys=ButterflyKeys;duration=12;}
   else if(action==Activity.Ball){keys=BallKeys;duration=11;}
   else if(action==Activity.Scratch){keys=ScratchKeys;duration=11;}
   else if(action==Activity.Yawn){keys=YawnKeys;duration=Duration(action);}
   else if(action==Activity.Roll){keys=RollKeys;duration=Duration(action);}
   else return p;
   t=Double.IsNaN(t)||Double.IsInfinity(t)?0:Math.Max(0,Math.Min(duration,t));
   int i=0;while(i+1<keys.Length&&t>=keys[i+1][0])i++;
   double[] a=keys[i],b=keys[Math.Min(i+1,keys.Length-1)];
   double u=b[0]==a[0]?0:Smooth((t-a[0])/(b[0]-a[0]));
   p.UseMotion=true;p.Frame=(int)a[1];p.Dx=Mix(a,b,2,u);p.Hop=Mix(a,b,3,u);
   if(action==Activity.Yawn||action==Activity.Roll){p.UseRelax=true;p.RelaxFrame=(int)a[1];return p;}
   if(action==Activity.Scratch){
    p.PropAlpha=Mix(a,b,6,u);
    __SCRATCH_SAMPLING__
   }
   else if(action!=Activity.Stretch){
    bool butterfly=action==Activity.Butterfly;
    p.PropX=Mix(a,b,4,u)+(butterfly?6*Math.Sin(t*4):0);
    p.PropY=Mix(a,b,5,u)+(butterfly?8*Math.Sin(t*3):0);p.PropAlpha=Mix(a,b,6,u);
    p.PropWing=.2+.8*Math.Abs(Math.Sin(t*18));
    p.PropRotation=(butterfly?.24*Math.Sin(t*3):t*3)*180/Math.PI;
   }
   return p;
  }
  static double Smooth(double n){n=Math.Max(0,Math.Min(1,n));return n*n*(3-2*n);}
  static double Mix(double[] a,double[] b,int c,double u){return a[c]+(b[c]-a[c])*u;}
 }
}
'''
r=data['scratch']['render']
enter=round(r['enterSeconds']*r['fps']);loop=round(r['loopSeconds']*r['fps']);until=round(r['loopUntil']*r['fps'])
selection=f"int tick=(int)Math.Floor(t*{r['fps']}+1e-7);\n    p.UseScratch=true;p.ScratchFrame=tick<{enter}?tick:tick<{until}?{enter}+(tick-{enter})%{loop}:{enter+loop}+Math.Min({r['frames']-enter-loop-1},tick-{until});"
cs=cs.replace('__SCRATCH_SAMPLING__',selection)
(root / 'MotionData.cs').write_text(cs)
preview=root / 'preview.js'
text=preview.read_text()
start=text.index('  const motionData = ')
end=text.index('  // Source rectangles',start)
preview.write_text(text[:start]+'  '+js+'\n'+text[end:])
print('Generated matching web and desktop motion data.')
