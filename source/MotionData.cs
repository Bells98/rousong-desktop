using System;
namespace RousongDesktop {
 public class MotionPose {
  public int Frame,ScratchFrame,RelaxFrame; public bool UseMotion,UseScratch,UseRelax;
  public double Dx,Hop,PropX,PropY,PropAlpha,PropWing=1,PropRotation;
 }
 public static class MotionData {
  public const double ScratchBoardX=120,ScratchBoardY=0,ScratchBoardWidth=280,ScratchBoardHeight=400;
  static readonly double[][] StretchKeys = new double[][] {
   new double[]{0,0,0,0,0,0,0},
   new double[]{0.55,1,0,0,0,0,0},
   new double[]{1.1,2,0,0,0,0,0},
   new double[]{1.65,3,0,0,0,0,0},
   new double[]{2.4,4,0,0,0,0,0},
   new double[]{4.15,5,0,0,0,0,0},
   new double[]{5.35,6,0,0,0,0,0},
   new double[]{6.25,7,0,0,0,0,0},
   new double[]{7,7,0,0,0,0,0}
  };
  static readonly double[][] ButterflyKeys = new double[][] {
   new double[]{0,8,0,0,392,135,0},
   new double[]{0.7,9,0,0,322,120,1},
   new double[]{2.2,10,0,0,310,155,1},
   new double[]{3.6,11,2,0,312,130,1},
   new double[]{3.8,12,8,18,318,95,1},
   new double[]{4.05,13,16,35,340,72,1},
   new double[]{4.3,14,16,0,350,115,1},
   new double[]{4.9,9,6,0,316,155,1},
   new double[]{6,10,0,0,316,100,1},
   new double[]{6.75,11,2,0,314,130,1},
   new double[]{6.95,12,8,18,320,95,1},
   new double[]{7.2,13,16,35,343,70,1},
   new double[]{7.45,14,16,0,350,118,1},
   new double[]{8.2,9,6,0,312,125,1},
   new double[]{10.8,15,0,0,386,30,0},
   new double[]{12,15,0,0,400,-15,0}
  };
  static readonly double[][] BallKeys = new double[][] {
   new double[]{0,16,0,0,393,354,0},
   new double[]{0.7,17,0,0,325,354,1},
   new double[]{1.5,18,0,0,325,354,1},
   new double[]{2,19,0,0,325,354,1},
   new double[]{2.25,20,8,0,351,354,1},
   new double[]{2.9,21,16,0,336,354,1},
   new double[]{3.4,22,12,0,329,354,1},
   new double[]{3.65,19,8,0,329,354,1},
   new double[]{4.2,20,12,0,353,354,1},
   new double[]{5,21,16,0,338,354,1},
   new double[]{5.8,22,8,0,329,354,1},
   new double[]{6.2,19,8,0,329,354,1},
   new double[]{6.55,20,12,0,356,354,1},
   new double[]{7.4,21,16,0,338,354,1},
   new double[]{8.2,22,4,0,330,354,1},
   new double[]{9.1,23,0,0,350,354,0.9},
   new double[]{10.3,23,0,0,390,354,0},
   new double[]{11,23,0,0,399,354,0}
  };
  static readonly double[][] ScratchKeys = new double[][] {
   new double[]{0,24,0,0,0,0,0},
   new double[]{0.55,25,0,0,0,0,1},
   new double[]{1.15,26,0,0,0,0,1},
   new double[]{1.85,27,0,0,0,0,1},
   new double[]{2.2,28,0,0,0,0,1},
   new double[]{2.55,27,0,0,0,0,1},
   new double[]{2.9,28,0,0,0,0,1},
   new double[]{3.25,29,0,0,0,0,1},
   new double[]{4.05,27,0,0,0,0,1},
   new double[]{4.4,28,0,0,0,0,1},
   new double[]{4.75,27,0,0,0,0,1},
   new double[]{5.1,28,0,0,0,0,1},
   new double[]{5.45,29,0,0,0,0,1},
   new double[]{6.25,27,0,0,0,0,1},
   new double[]{6.6,28,0,0,0,0,1},
   new double[]{6.95,27,0,0,0,0,1},
   new double[]{7.3,28,0,0,0,0,1},
   new double[]{7.65,29,0,0,0,0,1},
   new double[]{8.45,26,0,0,0,0,1},
   new double[]{9.05,30,0,0,0,0,1},
   new double[]{9.75,31,0,0,0,0,1},
   new double[]{10.5,31,0,0,0,0,0},
   new double[]{11,31,0,0,0,0,0}
  };
  static readonly double[][] YawnKeys = new double[][] {
   new double[]{0,0,0,0,0,0,0},
   new double[]{0.4,1,0,0,0,0,0},
   new double[]{0.65,2,0,0,0,0,0},
   new double[]{0.8,3,0,0,0,0,0},
   new double[]{0.95,4,0,0,0,0,0},
   new double[]{1.1,5,0,0,0,0,0},
   new double[]{1.25,6,0,0,0,0,0},
   new double[]{1.4,7,0,0,0,0,0},
   new double[]{1.65,8,0,0,0,0,0},
   new double[]{1.85,9,0,0,0,0,0},
   new double[]{2,10,0,0,0,0,0},
   new double[]{2.15,11,0,0,0,0,0},
   new double[]{2.3,12,0,0,0,0,0},
   new double[]{2.6,13,0,0,0,0,0},
   new double[]{2.9,14,0,0,0,0,0},
   new double[]{3.2,15,0,0,0,0,0},
   new double[]{4.2,15,0,0,0,0,0}
  };
  static readonly double[][] RollKeys = new double[][] {
   new double[]{0,16,0,0,0,0,0},
   new double[]{0.35,17,0,0,0,0,0},
   new double[]{0.55,18,0,0,0,0,0},
   new double[]{0.75,19,0,0,0,0,0},
   new double[]{0.95,20,0,0,0,0,0},
   new double[]{1.12,21,0,0,0,0,0},
   new double[]{1.3,22,0,0,0,0,0},
   new double[]{1.5,23,0,0,0,0,0},
   new double[]{1.72,24,0,0,0,0,0},
   new double[]{2.2,25,0,0,0,0,0},
   new double[]{2.6,24,0,0,0,0,0},
   new double[]{2.95,25,0,0,0,0,0},
   new double[]{3.3,24,0,0,0,0,0},
   new double[]{3.65,25,0,0,0,0,0},
   new double[]{4,26,0,0,0,0,0},
   new double[]{4.5,27,0,0,0,0,0},
   new double[]{4.75,28,0,0,0,0,0},
   new double[]{5,29,0,0,0,0,0},
   new double[]{5.3,30,0,0,0,0,0},
   new double[]{5.6,31,0,0,0,0,0},
   new double[]{7.2,31,0,0,0,0,0}
  };
  public static double Duration(Activity action){
   if(action==Activity.Stretch)return 7;
   if(action==Activity.Butterfly)return 12;
   if(action==Activity.Ball)return 11;
   if(action==Activity.Scratch)return 11;
   if(action==Activity.Yawn)return 4.2;
   if(action==Activity.Roll)return 7.2;
   return 8;
  }
  public static MotionPose At(Activity action,double t){
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
    int tick=(int)Math.Floor(t*30+1e-7);
    p.UseScratch=true;p.ScratchFrame=tick<30?tick:tick<270?30+(tick-30)%60:90+Math.Min(29,tick-270);
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
