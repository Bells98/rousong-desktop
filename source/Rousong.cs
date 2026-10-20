using System;
using System.IO;
using System.Reflection;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Threading;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;
using Forms = System.Windows.Forms;

namespace RousongDesktop {
 [DataContract] public class PetState {
  [DataMember] public double Food=82, Water=86, Energy=78, Mood=88;
  [DataMember] public bool Sleeping=false, Wander=true, Pin=true;
  [DataMember] public bool Playful=true;
  [OnDeserializing] void BeforeRead(StreamingContext context){Playful=true;}
  [DataMember] public double Size=1, X=-1, Y=-1;
  [DataMember] public long Saved=DateTime.UtcNow.Ticks;
  [DataMember] public int Meals, Drinks, Pats;
  public static double Clamp(double v) {return Double.IsNaN(v)||Double.IsInfinity(v)?50:Math.Max(0,Math.Min(100,v));}
  public void Normalize() {Food=Clamp(Food);Water=Clamp(Water);Energy=Clamp(Energy);Mood=Clamp(Mood);Size=Double.IsNaN(Size)||Double.IsInfinity(Size)?1:Math.Max(.75,Math.Min(1.35,Size));if(Double.IsNaN(X)||Double.IsInfinity(X))X=-1;if(Double.IsNaN(Y)||Double.IsInfinity(Y))Y=-1;}
  public void Advance(double hours,bool offline) {hours=Math.Max(0,Math.Min(offline?8:24,hours));Food=Clamp(Food-hours*6);Water=Clamp(Water-hours*9);Energy=Clamp(Energy+hours*(Sleeping?28:-6));Mood=Clamp(Mood-hours*(Sleeping?1:3));if(offline){Food=Math.Max(15,Food);Water=Math.Max(15,Water);Energy=Math.Max(15,Energy);Mood=Math.Max(25,Mood);}}
  public void Feed(){Food=Clamp(Food+28);Mood=Clamp(Mood+3);Meals++;}
  public void Drink(){Water=Clamp(Water+35);Mood=Clamp(Mood+2);Drinks++;}
  public void Pet(){Mood=Clamp(Mood+8);Pats++;}
 }
 public class StateStore {
  readonly string path; public string Warning;
  public StateStore(string p){path=p;}
  PetState Read(string p){using(var s=File.OpenRead(p)){var v=(PetState)new DataContractJsonSerializer(typeof(PetState)).ReadObject(s);v.Normalize();v.Advance((DateTime.UtcNow.Ticks-v.Saved)/(double)TimeSpan.TicksPerHour,true);return v;}}
  public PetState Load(){if(!File.Exists(path)&&!File.Exists(path+".bak"))return new PetState();try{return Read(path);}catch{try{var b=Read(path+".bak");Warning="已从上一份存档恢复。";return b;}catch{Warning="存档暂时无法读取，已开始新的小日子。";return new PetState();}}}
  public bool Save(PetState v){try{Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path)));v.Normalize();v.Saved=DateTime.UtcNow.Ticks;string tmp=path+".tmp";using(var s=File.Create(tmp))new DataContractJsonSerializer(typeof(PetState)).WriteObject(s,v);if(File.Exists(path))File.Replace(tmp,path,path+".bak");else File.Move(tmp,path);Warning=null;return true;}catch{Warning="没有保存成功，请把肉松放到可写入的文件夹。";return false;}}
 }
 public enum Activity {Idle,Walk,Groom,Eat,Drink,Sleep,Stretch,Play,Butterfly,Ball,Scratch,Yawn,Roll}
 public static class ToyScene {
  public static bool IsToy(Activity a){return a==Activity.Butterfly||a==Activity.Ball;}
  public static bool IsPlay(Activity a){return IsToy(a)||a==Activity.Scratch||a==Activity.Roll;}
 }
 public static class RelaxScene {
  public static bool IsRelax(Activity a){return a==Activity.Yawn||a==Activity.Roll;}
 }
 // Measured against the adult tabby atlas (1254 x 1254), not the earlier kitten sheet.
 public static class SpriteLayout {
  public const double CanvasSize=240, Scale=.564, Ground=228;
  public static readonly int[] Rows={0,373,631,976}, Heights={373,258,345,278};
  public static readonly double[,] Centers={{198,197,197,194},{160,160.5,159,157},{168,168,167,167.5},{163.5,162,162,161}};
  public static readonly int[,] Baselines={{356,356,356,352},{236,234,235,237},{323,323,323,323},{192,192,192,192}};
  public static Int32Rect Cell(int row,int frame){int x=frame*314;return new Int32Rect(x,Rows[row],Math.Min(314,1254-x),Heights[row]);}
  public static Rect Destination(int row,int frame,double ground){var cell=Cell(row,frame);return new Rect(CanvasSize/2-Centers[row,frame]*Scale,ground-Baselines[row,frame]*Scale,cell.Width*Scale,cell.Height*Scale);}
 }
 public class Sprite : FrameworkElement {
  readonly BitmapSource[,] frames=new BitmapSource[4,4];
  readonly BitmapSource[] motionFrames=new BitmapSource[32];
  readonly BitmapSource[] scratchFrames=new BitmapSource[120];
  readonly BitmapSource[] relaxFrames=new BitmapSource[32];
  readonly BitmapSource scratchBoard;
  public Activity Action; public double Time;public int Direction=1;
  public Sprite(){
   Width=SpriteLayout.CanvasSize;Height=SpriteLayout.CanvasSize;ClipToBounds=true;
   using(var s=Assembly.GetExecutingAssembly().GetManifestResourceStream("Rousong.Atlas")){
    if(s==null)throw new InvalidDataException("找不到小猫图集，请重新完整解压后启动。");
    var b=new BitmapImage();b.BeginInit();b.CacheOption=BitmapCacheOption.OnLoad;b.StreamSource=s;b.EndInit();b.Freeze();
    if(b.PixelWidth!=1254||b.PixelHeight!=1254)throw new InvalidDataException("小猫图集尺寸不符，应为 1254 × 1254。");
    for(int row=0;row<4;row++)for(int frame=0;frame<4;frame++){var crop=new CroppedBitmap(b,SpriteLayout.Cell(row,frame));crop.Freeze();frames[row,frame]=crop;}
   }
   // Each normalized cell uses the same body center and paw baseline as the web preview.
   // Cache all independent poses once; no old idle/cleaning frame substitutes for a motion.
   using(var s=Assembly.GetExecutingAssembly().GetManifestResourceStream("Rousong.Motions")){
    if(s==null)throw new InvalidDataException("找不到动作图集，请重新完整解压后启动。");
    var b=new BitmapImage();b.BeginInit();b.CacheOption=BitmapCacheOption.OnLoad;b.StreamSource=s;b.EndInit();b.Freeze();
    if(b.PixelWidth!=1600||b.PixelHeight!=3200)throw new InvalidDataException("动作图集尺寸不符，应为 1600 × 3200。");
    for(int i=0;i<motionFrames.Length;i++){var crop=new CroppedBitmap(b,new Int32Rect((i%4)*400,(i/4)*400,400,400));crop.Freeze();motionFrames[i]=crop;}
   }
   // Continuous scratching poses include coordinated limb, torso, head and tail motion:
   // 120 immutable 320px cat-only cells (30 enter, 60 loop and 30 exit poses).
   // All slices are cached once, so redraws allocate neither images nor file streams.
   using(var s=Assembly.GetExecutingAssembly().GetManifestResourceStream("Rousong.ScratchSmooth")){
    if(s==null)throw new InvalidDataException("找不到连续磨爪图集，请重新完整解压后启动。");
    var b=new BitmapImage();b.BeginInit();b.CacheOption=BitmapCacheOption.OnLoad;b.StreamSource=s;b.EndInit();b.Freeze();
    if(b.PixelWidth!=1920||b.PixelHeight!=6400)throw new InvalidDataException("连续磨爪图集尺寸不符，应为 1920 × 6400。");
    for(int i=0;i<scratchFrames.Length;i++){var crop=new CroppedBitmap(b,new Int32Rect((i%6)*320,(i/6)*320,320,320));crop.Freeze();scratchFrames[i]=crop;}
   }
   // The upright board is a stationary prop. Load once, detach from its stream and
   // release that stream after construction; the cat animation never moves it.
   using(var s=Assembly.GetExecutingAssembly().GetManifestResourceStream("Rousong.ScratchBoard")){
    if(s==null)throw new InvalidDataException("找不到猫抓板图像，请重新完整解压后启动。");
    var b=new BitmapImage();b.BeginInit();b.CacheOption=BitmapCacheOption.OnLoad;b.StreamSource=s;b.EndInit();b.Freeze();
    if(b.PixelWidth!=400||b.PixelHeight!=400)throw new InvalidDataException("猫抓板图像尺寸不符，应为 400 × 400。");
    scratchBoard=b;
   }
   // The yawning and rolling sheet contains complete body poses in 400px cells.
   // The 4-column sheet has 16 yawning poses and 16 lying/rolling poses.
   using(var s=Assembly.GetExecutingAssembly().GetManifestResourceStream("Rousong.Relax")){
    if(s==null)throw new InvalidDataException("找不到打哈欠与打滚图集，请重新完整解压后启动。");
    var b=new BitmapImage();b.BeginInit();b.CacheOption=BitmapCacheOption.OnLoad;b.StreamSource=s;b.EndInit();b.Freeze();
    if(b.PixelWidth!=1600||b.PixelHeight!=3200)throw new InvalidDataException("放松动作图集尺寸不符，应为 1600 × 3200。");
    for(int i=0;i<relaxFrames.Length;i++){var crop=new CroppedBitmap(b,new Int32Rect((i%4)*400,(i/4)*400,400,400));crop.Freeze();relaxFrames[i]=crop;}
   }
   RenderOptions.SetBitmapScalingMode(this,BitmapScalingMode.HighQuality);Cursor=Cursors.Hand;
  }
  protected override void OnRender(DrawingContext g){
   base.OnRender(g);g.DrawRectangle(Brushes.Transparent,null,new Rect(0,0,240,240));
   double t=Math.Max(0,Time);var pose=MotionData.At(Action,t);
   if(pose.UseRelax){
    g.PushTransform(new TranslateTransform(pose.Dx*.6,-pose.Hop*.6));
    g.DrawImage(relaxFrames[pose.RelaxFrame],new Rect(0,8.4,240,240));g.Pop();
    return;
   }
   if(pose.UseMotion){
    // Mapping 400px at .6 plus 8.4 keeps y366 aligned with the old paw baseline228.
    // The cat's coordinated motion is prebaked into each pose. Apply only shared
    // scene travel and jump height here, with no additional whole-body rocking.
    if(Action==Activity.Scratch){
     g.PushOpacity(pose.PropAlpha);g.DrawImage(scratchBoard,new Rect(MotionData.ScratchBoardX*.6,MotionData.ScratchBoardY*.6+8.4,MotionData.ScratchBoardWidth*.6,MotionData.ScratchBoardHeight*.6));g.Pop();
    }
    g.PushTransform(new TranslateTransform(pose.Dx*.6,-pose.Hop*.6));
    g.DrawImage(pose.UseScratch?scratchFrames[pose.ScratchFrame]:motionFrames[pose.Frame],new Rect(0,8.4,240,240));g.Pop();
    if(Action==Activity.Butterfly||Action==Activity.Ball)DrawToy(g,pose);
    return;
   }
   int row=0,frame=0;double bottom=SpriteLayout.Ground,sy=1,flip=1;
   if(Action==Activity.Walk){row=1;frame=(int)(t/.18)%4;flip=Direction<0?-1:1;}
   else if(Action==Activity.Groom||Action==Activity.Eat||Action==Activity.Drink){row=2;frame=(int)(t/.32)%4;}
   else if(Action==Activity.Sleep){row=3;frame=(int)(t/1.9)%4;sy=1+Math.Sin(t*1.6)*.012;}
   else{
    double blink=t%6.5;frame=blink<.12?1:blink<.25?2:blink<.38?1:0;
    sy=1+Math.Sin(t*1.8)*.007;
    if(Action==Activity.Play)bottom-=Math.Abs(Math.Sin(t*3.5))*7;
   }
   // Keep the visible body's center and lowest paw anchored across uneven sheet cells.
   // Scale only around the ground so breathing never makes the cat float.
   g.PushTransform(new ScaleTransform(flip,sy,120,bottom));
   g.DrawImage(frames[row,frame],SpriteLayout.Destination(row,frame,bottom));g.Pop();
   if(Action==Activity.Eat||Action==Activity.Drink){bool water=Action==Activity.Drink;g.DrawRoundedRectangle(UI.B(water?"#8BAEB4":"#C29470"),null,new Rect(174,211,53,22),7,7);g.DrawEllipse(UI.B(water?"#D0E6E8":"#8F6142"),null,new Point(200.5,213),26.5,7);g.DrawEllipse(UI.B("#66FFFFFF"),null,new Point(198,211),12,1.5);}
   if(Action==Activity.Play||Action==Activity.Sleep){var f=new FormattedText(Action==Activity.Play?"♥":"z Z",System.Globalization.CultureInfo.CurrentCulture,FlowDirection.LeftToRight,new Typeface("Microsoft YaHei UI"),20,UI.B("#B78F68"));g.DrawText(f,new Point(182,45-Math.Sin(t*2)*4));}
  }
  void DrawToy(DrawingContext g,MotionPose p){
   g.PushOpacity(p.PropAlpha);g.PushTransform(new TranslateTransform(0,8.4));g.PushTransform(new ScaleTransform(.6,.6));
   if(Action==Activity.Ball){
    g.DrawEllipse(UI.B("#225B4935"),null,new Point(p.PropX,369),13,3);
    g.PushTransform(new TranslateTransform(p.PropX,p.PropY));g.PushTransform(new RotateTransform(p.PropRotation));
    var fill=new RadialGradientBrush(UI.B("#ECD8AF").Color,UI.B("#B67D50").Color);fill.GradientOrigin=new Point(.3,.25);
    g.DrawEllipse(fill,null,new Point(0,0),12,12);var seam=new Pen(UI.B("#F6E8CB"),2);g.DrawEllipse(null,seam,new Point(0,0),5,11);g.DrawLine(seam,new Point(-11,0),new Point(11,0));g.Pop();g.Pop();
   }else{
    g.PushTransform(new TranslateTransform(p.PropX,p.PropY));g.PushTransform(new RotateTransform(p.PropRotation));g.PushTransform(new ScaleTransform(p.PropWing,1));
    foreach(int side in new int[]{-1,1}){g.PushTransform(new RotateTransform(side*28,side*7,-4));g.DrawEllipse(UI.B("#C3A0CD"),new Pen(UI.B("#96769E"),.9),new Point(side*7,-4),8,11);g.Pop();g.DrawEllipse(UI.B("#E5C6BB"),null,new Point(side*5,7),5,6);}
    g.Pop();var body=new Pen(UI.B("#796878"),1.5);g.DrawLine(body,new Point(0,-8),new Point(0,11));g.DrawLine(body,new Point(0,-7),new Point(-5,-14));g.DrawLine(body,new Point(0,-7),new Point(5,-14));g.Pop();g.Pop();
   }g.Pop();g.Pop();g.Pop();
  }
 }

 public static class UI {
  public static SolidColorBrush B(string c){var b=(SolidColorBrush)new BrushConverter().ConvertFromString(c);b.Freeze();return b;}
  public static TextBlock T(string text,double size,string color){return new TextBlock{Text=text,FontSize=size,Foreground=B(color),FontFamily=new FontFamily("Microsoft YaHei UI"),TextWrapping=TextWrapping.Wrap};}
  public static Button Btn(string text,Action action,string color){var b=new Button{Content=text,Padding=new Thickness(11,9,11,9),Margin=new Thickness(3),FontFamily=new FontFamily("Microsoft YaHei UI"),FontSize=12,Background=B(color),Foreground=B("#584B3B"),BorderThickness=new Thickness(0),Cursor=Cursors.Hand};var template=new ControlTemplate(typeof(Button));var border=new FrameworkElementFactory(typeof(Border));border.SetValue(Border.CornerRadiusProperty,new CornerRadius(10));border.SetValue(Border.BackgroundProperty,new TemplateBindingExtension(Control.BackgroundProperty));var content=new FrameworkElementFactory(typeof(ContentPresenter));content.SetValue(FrameworkElement.MarginProperty,new TemplateBindingExtension(Control.PaddingProperty));content.SetValue(FrameworkElement.HorizontalAlignmentProperty,HorizontalAlignment.Center);border.AppendChild(content);template.VisualTree=border;b.Template=template;b.MouseEnter+=(o,e)=>b.Opacity=.78;b.MouseLeave+=(o,e)=>b.Opacity=1;b.Click+=(o,e)=>action();return b;}
 }
 public class PetWindow : Window {
  public PetState State;readonly StateStore store;readonly Sprite sprite=new Sprite();readonly Canvas scene=new Canvas{Width=240,Height=282};readonly TextBlock message=UI.T("你好，我是肉松。",12,"#6D5C45"),badge=UI.T("陪着你",10,"#94816A");readonly Border speech=new Border();readonly Random random=new Random();readonly DispatcherTimer timer=new DispatcherTimer();readonly System.Diagnostics.Stopwatch clock=System.Diagnostics.Stopwatch.StartNew();
  double start,end=8,last,saveAt,speechUntil=6,nextNeed=60,nextToy;Activity lastToy=Activity.Idle;Activity action=Activity.Idle;bool pressed,dragged,quitting,renderingSubscribed;TimeSpan lastRenderTime=TimeSpan.MinValue;Point pressedAt;double ox,oy;CareWindow care;Forms.NotifyIcon tray;
  public PetWindow(PetState state,StateStore storage){State=state;store=storage;Title="肉松 · 桌面小猫";WindowStyle=WindowStyle.None;AllowsTransparency=true;Background=Brushes.Transparent;ResizeMode=ResizeMode.NoResize;ShowInTaskbar=false;Topmost=State.Pin;Width=240*State.Size;Height=282*State.Size;Content=new Viewbox{Child=scene};Canvas.SetTop(sprite,20);scene.Children.Add(sprite);
   sprite.MouseLeftButtonDown+=Down;sprite.MouseMove+=Move;sprite.MouseLeftButtonUp+=Up;sprite.LostMouseCapture+=(o,e)=>pressed=false;
   var context=new ContextMenu();Menu(context,"照顾肉松",ShowCare);Menu(context,"喂食",()=>Act(Activity.Eat));Menu(context,"喂水",()=>Act(Activity.Drink));Menu(context,"伸懒腰",()=>Act(Activity.Stretch));Menu(context,"打哈欠",()=>Act(Activity.Yawn));Menu(context,"躺下打滚",()=>Act(Activity.Roll));Menu(context,"追蝴蝶",()=>Act(Activity.Butterfly));Menu(context,"玩小球",()=>Act(Activity.Ball));Menu(context,"挠猫抓板",()=>Act(Activity.Scratch));Menu(context,"睡觉 / 叫醒",ToggleSleep);Menu(context,"回到屏幕角落",Home);Menu(context,"退出并保存",Quit);sprite.ContextMenu=context;
   var nameplate=new Border{Background=UI.B("#F4FFF9EE"),CornerRadius=new CornerRadius(15),Padding=new Thickness(10,5,6,5)};var row=new StackPanel{Orientation=Orientation.Horizontal};var name=UI.T("肉松",12,"#6C573C");name.FontWeight=FontWeights.SemiBold;row.Children.Add(name);badge.Margin=new Thickness(7,2,7,0);row.Children.Add(badge);var button=UI.Btn("照顾",ShowCare,"#EADCC7");button.Padding=new Thickness(8,2,8,2);button.FontSize=10;button.Margin=new Thickness(0);row.Children.Add(button);nameplate.Child=row;Canvas.SetLeft(nameplate,39);Canvas.SetTop(nameplate,250);scene.Children.Add(nameplate);
   speech.Background=UI.B("#F5FFFBF2");speech.CornerRadius=new CornerRadius(13);speech.Padding=new Thickness(11,7,11,7);speech.MaxWidth=230;speech.Child=message;speech.IsHitTestVisible=false;Canvas.SetLeft(speech,5);Canvas.SetTop(speech,0);scene.Children.Add(speech);
   if(State.Sleeping){action=Activity.Sleep;sprite.Action=Activity.Sleep;}
   Loaded+=(o,e)=>{if(State.X>=0&&State.Y>=0){Left=State.X;Top=State.Y;Clamp();}else Home();SetupTray();if(store.Warning!=null)Speak(store.Warning);UpdateRenderingSubscription();};
   IsVisibleChanged+=(o,e)=>UpdateRenderingSubscription();
   Unloaded+=(o,e)=>StopRendering();
   Closed+=(o,e)=>{StopRendering();timer.Stop();timer.Tick-=Tick;};
   timer.Interval=TimeSpan.FromMilliseconds(50);timer.Tick+=Tick;timer.Start();Closing+=(o,e)=>{if(!quitting){e.Cancel=true;Hide();if(care!=null)care.Hide();return;}StopRendering();Save();timer.Stop();if(tray!=null)tray.Dispose();};
  }
  // Keep care/state work on the existing 50 ms timer, while visual time follows
  // the compositor cadence and the monotonic stopwatch rather than timer steps.
  void UpdateRenderingSubscription(){
   if(IsLoaded&&IsVisible&&!quitting){
    if(!renderingSubscribed){lastRenderTime=TimeSpan.MinValue;CompositionTarget.Rendering+=RenderFrame;renderingSubscribed=true;}
   }else StopRendering();
  }
  void StopRendering(){if(renderingSubscribed){CompositionTarget.Rendering-=RenderFrame;renderingSubscribed=false;}}
  void RenderFrame(object sender,EventArgs e){
   if(!IsVisible||quitting)return;
   var rendering=e as RenderingEventArgs;
   if(rendering!=null){if(rendering.RenderingTime==lastRenderTime)return;lastRenderTime=rendering.RenderingTime;}
   sprite.Time=Math.Max(0,clock.Elapsed.TotalSeconds-start);sprite.InvalidateVisual();
  }
  void Menu(ContextMenu m,string label,Action callback){var item=new MenuItem{Header=label};item.Click+=(o,e)=>callback();m.Items.Add(item);}
  void SetupTray(){tray=new Forms.NotifyIcon{Text="肉松 · 桌面小猫",Icon=System.Drawing.SystemIcons.Application,Visible=true};var m=new Forms.ContextMenuStrip();m.Items.Add("显示肉松",null,(o,e)=>Dispatcher.Invoke(new Action(()=>{Show();Home();})));m.Items.Add("照顾肉松",null,(o,e)=>Dispatcher.Invoke(new Action(()=>{Show();ShowCare();})));m.Items.Add("暂时收起",null,(o,e)=>Dispatcher.Invoke(new Action(()=>{Hide();if(care!=null)care.Hide();})));m.Items.Add("退出并保存",null,(o,e)=>Dispatcher.Invoke(new Action(Quit)));tray.ContextMenuStrip=m;tray.DoubleClick+=(o,e)=>Dispatcher.Invoke(new Action(()=>{Show();Home();}));}
  void Down(object o,MouseButtonEventArgs e){if(action==Activity.Stretch||RelaxScene.IsRelax(action)||ToyScene.IsPlay(action))Start(Activity.Idle,8);pressed=true;dragged=false;pressedAt=PointToScreen(e.GetPosition(this));ox=Left;oy=Top;sprite.CaptureMouse();e.Handled=true;}
  void Move(object o,MouseEventArgs e){if(!pressed)return;var d=PointToScreen(e.GetPosition(this))-pressedAt;var src=PresentationSource.FromVisual(this);if(src!=null)d=src.CompositionTarget.TransformFromDevice.Transform(d);if(Math.Abs(d.X)+Math.Abs(d.Y)>5)dragged=true;if(dragged){Left=ox+d.X;Top=oy+d.Y;Clamp();PositionCare();}}
  void Up(object o,MouseButtonEventArgs e){if(!pressed)return;pressed=false;sprite.ReleaseMouseCapture();if(!dragged){State.Pet();Speak(State.Sleeping?"呼噜……梦里也被摸摸了。":"呼噜呼噜，喜欢你摸摸。");if(!State.Sleeping&&action!=Activity.Eat&&action!=Activity.Drink)Start(Activity.Play,3);}Save();Refresh();dragged=false;}
  void Clamp(){var r=SystemParameters.WorkArea;Left=Math.Max(r.Left,Math.Min(r.Right-Width,Left));Top=Math.Max(r.Top,Math.Min(r.Bottom-Height,Top));}
  public void Home(){var r=SystemParameters.WorkArea;Left=r.Right-Width-25;Top=r.Bottom-Height-8;Clamp();PositionCare();}
  public void SetSize(double size){State.Size=size;Width=240*size;Height=282*size;Clamp();PositionCare();Save();}
  public void SetPin(bool pin){State.Pin=pin;Topmost=pin;if(care!=null)care.Topmost=pin;Save();}
  public void SetWander(bool value){State.Wander=value;if(!value&&action==Activity.Walk)Start(Activity.Idle,7);Save();}
  public void SetPlayful(bool value){State.Playful=value;if(!value&&ToyScene.IsPlay(action))Start(Activity.Idle,8);Save();}
  void Start(Activity a,double duration){action=a;start=clock.Elapsed.TotalSeconds;end=start+duration;sprite.Action=a;sprite.Time=0;if(ToyScene.IsPlay(a)){if(ToyScene.IsToy(a))lastToy=a;nextToy=start+35;}sprite.InvalidateVisual();}
  public void Act(Activity a){if(action==Activity.Eat||action==Activity.Drink){Speak("等我吃喝完这一口呀。");return;}if(a==Activity.Eat&&State.Food>=98){Speak("肚子圆圆的，饿了再吃吧。");return;}if(a==Activity.Drink&&State.Water>=98){Speak("水喝够啦，陪我待一会儿吧。");return;}if(ToyScene.IsPlay(a)){if(State.Sleeping){Speak("肉松睡着啦，醒来再一起玩。");return;}if(State.Energy<25){Speak("有点困了，休息一会儿再玩吧。");return;}Start(a,MotionData.Duration(a));Speak(a==Activity.Butterfly?"咦，小蝴蝶！让我轻轻扑一下。":a==Activity.Ball?"小球滚过来啦，拨一下，再拨一下。":a==Activity.Roll?"躺一躺，翻个身，把肚皮晒一会儿。":"伸出前爪，在猫抓板上磨一磨。");Refresh();return;}if(a==Activity.Stretch||a==Activity.Yawn){if(State.Sleeping){Speak(a==Activity.Yawn?"肉松睡着啦，醒来再打哈欠。":"肉松睡着啦，醒来再伸个懒腰。");return;}Start(a,MotionData.Duration(a));Speak(a==Activity.Yawn?"啊呜——打个哈欠，再陪你一会儿。":"前爪伸远一点，慢慢舒展一下。");Refresh();return;}State.Sleeping=false;if(a==Activity.Eat){State.Feed();Start(a,7);Speak("开饭啦！吧唧吧唧……");}else if(a==Activity.Drink){State.Drink();Start(a,6);Speak("咕嘟咕嘟，水真好喝。");}else if(a==Activity.Play){State.Mood=PetState.Clamp(State.Mood+10);State.Energy=PetState.Clamp(State.Energy-2);Start(a,4);Speak("陪你玩一小会儿！");}Save();Refresh();}
  public void ToggleSleep(){if(action==Activity.Eat||action==Activity.Drink){Speak("吃喝完再睡哦。");return;}State.Sleeping=!State.Sleeping;Start(State.Sleeping?Activity.Sleep:Activity.Stretch,State.Sleeping?8:7);Speak(State.Sleeping?"我先眯一会儿，陪你慢慢忙。":"睡醒啦，伸个懒腰。");Save();Refresh();}
  void Speak(string s){message.Text=s;speechUntil=clock.Elapsed.TotalSeconds+5;speech.Visibility=Visibility.Visible;if(care!=null)care.SetMessage(s);}
  void Tick(object o,EventArgs e){double now=clock.Elapsed.TotalSeconds;double dt=Math.Max(0,now-last);last=now;State.Advance(dt/3600,dt>120);
   if(!State.Sleeping&&now>=end&&!pressed){if(action!=Activity.Idle)Start(Activity.Idle,6+random.NextDouble()*8);else if(State.Energy<18){State.Sleeping=true;Start(Activity.Sleep,60);Speak("有点困了，我先打个盹。");}else{int n=random.Next(100);int relax=n<62?random.Next(100):-1;if(relax>=80)Start(Activity.Yawn,MotionData.Duration(Activity.Yawn));else if(relax>=65&&State.Playful&&State.Energy>=25&&now>=nextToy)Start(Activity.Roll,MotionData.Duration(Activity.Roll));else if(n>=62&&n<90&&State.Playful&&State.Energy>=25&&now>=nextToy){Activity toy=lastToy==Activity.Idle?(n<76?Activity.Butterfly:Activity.Ball):(lastToy==Activity.Ball?Activity.Butterfly:Activity.Ball);Start(toy,toy==Activity.Butterfly?12:11);}else if(n>=90&&State.Playful&&State.Energy>=25&&now>=nextToy)Start(Activity.Scratch,11);else if(n<24&&State.Wander){sprite.Direction=random.Next(2)==0?-1:1;Start(Activity.Walk,3+random.NextDouble()*4);}else if(n<46)Start(Activity.Groom,5);else if(n<62)Start(Activity.Stretch,7);else Start(Activity.Idle,9);}}
   if(action==Activity.Walk&&!pressed&&IsVisible&&(care==null||!care.IsVisible)){Left+=sprite.Direction*Math.Min(dt,.25)*22;var r=SystemParameters.WorkArea;if(Left<r.Left+3||Left+Width>r.Right-3){sprite.Direction=-sprite.Direction;Clamp();}}
   if(now>nextNeed&&!State.Sleeping){nextNeed=now+180;if(State.Water<25)Speak("想喝水了，给我一点水好不好？");else if(State.Food<25)Speak("肚子咕咕叫，想吃饭啦。");}
   sprite.Action=action==Activity.Walk&&(pressed||(care!=null&&care.IsVisible))?Activity.Idle:action;speech.Visibility=now<speechUntil?Visibility.Visible:Visibility.Collapsed;badge.Text=action==Activity.Sleep?"睡梦中":action==Activity.Walk?"散散步":action==Activity.Groom?"洗洗脸":action==Activity.Eat?"吃饭中":action==Activity.Drink?"喝水中":action==Activity.Butterfly?"追蝴蝶":action==Activity.Ball?"玩小球":action==Activity.Stretch?"伸懒腰":action==Activity.Yawn?"打哈欠":action==Activity.Roll?"露露肚皮":action==Activity.Scratch?"磨磨爪":State.Water<25?"想喝水":State.Food<25?"肚子饿":"陪着你";
   if(now-saveAt>20){Save();saveAt=now;Refresh();}
  }
  public void ShowCare(){if(care==null){care=new CareWindow(this);care.Closed+=(o,e)=>care=null;}care.Topmost=Topmost;PositionCare();care.Show();care.Activate();Refresh();}
  void PositionCare(){if(care==null)return;var r=SystemParameters.WorkArea;care.Left=Left>r.Left+335?Left-328:Math.Min(r.Right-318,Left+Width+7);care.Top=Math.Max(r.Top+8,Math.Min(r.Bottom-care.Height-8,Top-140));}
  void Refresh(){if(care!=null)care.Refresh();}
  public void Save(){State.X=Left;State.Y=Top;if(!store.Save(State)&&care!=null)care.SetMessage(store.Warning);}
  public void Quit(){quitting=true;if(care!=null)care.Close();Close();Application.Current.Shutdown();}
 }
 public class CareWindow : Window {
  readonly PetWindow pet;readonly ProgressBar[] bars=new ProgressBar[4];readonly TextBlock[] values=new TextBlock[4];readonly TextBlock note=UI.T("摸摸小猫，日子慢一点。",12,"#88765E"),counts=UI.T("",10,"#A08D73");readonly Button sleep;
  public CareWindow(PetWindow owner){pet=owner;Owner=owner;Title="照顾肉松";Width=318;Height=638;MaxHeight=Math.Max(280,SystemParameters.WorkArea.Height-16);WindowStyle=WindowStyle.None;AllowsTransparency=true;Background=Brushes.Transparent;ResizeMode=ResizeMode.NoResize;ShowInTaskbar=false;var card=new Border{Background=UI.B("#FFFBF3"),CornerRadius=new CornerRadius(21),BorderBrush=UI.B("#DFD3C0"),BorderThickness=new Thickness(1),Padding=new Thickness(20)};Content=card;var stack=new StackPanel();card.Child=new ScrollViewer{Content=stack,VerticalScrollBarVisibility=ScrollBarVisibility.Auto,HorizontalScrollBarVisibility=ScrollBarVisibility.Disabled};
   var header=new DockPanel();var close=UI.Btn("×",()=>Hide(),"#F0E7D8");close.FontSize=17;close.Padding=new Thickness(8,1,8,1);DockPanel.SetDock(close,Dock.Right);header.Children.Add(close);var title=UI.T("肉松的小日子",20,"#554633");title.FontWeight=FontWeights.SemiBold;header.Children.Add(title);stack.Children.Add(header);var sub=UI.T("一只只属于你的桌面小猫",11,"#9D896D");sub.Margin=new Thickness(0,5,0,18);stack.Children.Add(sub);
   string[] labels={"饱腹","饮水","精力","心情"},colors={"#CBA175","#8EB9B5","#AFBC90","#D7A08D"};for(int i=0;i<4;i++){var row=new Grid{Margin=new Thickness(0,0,0,11)};row.ColumnDefinitions.Add(new ColumnDefinition{Width=new GridLength(42)});row.ColumnDefinitions.Add(new ColumnDefinition());row.ColumnDefinitions.Add(new ColumnDefinition{Width=new GridLength(34)});row.Children.Add(UI.T(labels[i],12,"#7B6952"));bars[i]=new ProgressBar{Minimum=0,Maximum=100,Height=7,VerticalAlignment=VerticalAlignment.Center,Foreground=UI.B(colors[i]),Background=UI.B("#ECE3D6"),BorderThickness=new Thickness(0)};Grid.SetColumn(bars[i],1);row.Children.Add(bars[i]);values[i]=UI.T("",11,"#9C886D");values[i].HorizontalAlignment=HorizontalAlignment.Right;Grid.SetColumn(values[i],2);row.Children.Add(values[i]);stack.Children.Add(row);}
   var grid=new System.Windows.Controls.Primitives.UniformGrid{Columns=2,Margin=new Thickness(-3,3,-3,8)};grid.Children.Add(UI.Btn("喂食",()=>pet.Act(Activity.Eat),"#EFDDC6"));grid.Children.Add(UI.Btn("喂水",()=>pet.Act(Activity.Drink),"#DCECE7"));grid.Children.Add(UI.Btn("逗逗它",()=>pet.Act(Activity.Play),"#F0E0D6"));sleep=UI.Btn("睡一会儿",pet.ToggleSleep,"#E6EAD8");grid.Children.Add(sleep);grid.Children.Add(UI.Btn("追蝴蝶",()=>pet.Act(Activity.Butterfly),"#ECE1ED"));grid.Children.Add(UI.Btn("玩小球",()=>pet.Act(Activity.Ball),"#ECE3D4"));grid.Children.Add(UI.Btn("伸懒腰",()=>pet.Act(Activity.Stretch),"#E6EAD8"));grid.Children.Add(UI.Btn("挠猫抓板",()=>pet.Act(Activity.Scratch),"#F0E7D8"));grid.Children.Add(UI.Btn("打哈欠",()=>pet.Act(Activity.Yawn),"#EEE7DA"));grid.Children.Add(UI.Btn("躺下打滚",()=>pet.Act(Activity.Roll),"#F1E2D8"));stack.Children.Add(grid);
   stack.Children.Add(new Border{Background=UI.B("#F4ECDE"),CornerRadius=new CornerRadius(12),Padding=new Thickness(11),MinHeight=55,Margin=new Thickness(0,0,0,13),Child=note});
   var options=new StackPanel{Orientation=Orientation.Horizontal};var wander=new CheckBox{Content="自己走走",IsChecked=pet.State.Wander,FontSize=11,Foreground=UI.B("#8B775E"),Margin=new Thickness(0,0,20,0)};wander.Checked+=(o,e)=>pet.SetWander(true);wander.Unchecked+=(o,e)=>pet.SetWander(false);options.Children.Add(wander);var pin=new CheckBox{Content="总在最前",IsChecked=pet.State.Pin,FontSize=11,Foreground=UI.B("#8B775E")};pin.Checked+=(o,e)=>pet.SetPin(true);pin.Unchecked+=(o,e)=>pet.SetPin(false);options.Children.Add(pin);stack.Children.Add(options);var playful=new CheckBox{Content="偶尔自己玩一会儿",IsChecked=pet.State.Playful,FontSize=11,Foreground=UI.B("#8B775E"),Margin=new Thickness(0,9,0,0)};playful.Checked+=(o,e)=>pet.SetPlayful(true);playful.Unchecked+=(o,e)=>pet.SetPlayful(false);stack.Children.Add(playful);
   var sizing=new DockPanel{Margin=new Thickness(0,12,0,9)};var sizeLabel=UI.T("小猫大小",11,"#8B775E");sizeLabel.Margin=new Thickness(0,0,13,0);DockPanel.SetDock(sizeLabel,Dock.Left);sizing.Children.Add(sizeLabel);var slider=new Slider{Minimum=.75,Maximum=1.35,Value=pet.State.Size,TickFrequency=.1,IsSnapToTickEnabled=true};slider.ValueChanged+=(o,e)=>pet.SetSize(e.NewValue);sizing.Children.Add(slider);stack.Children.Add(sizing);stack.Children.Add(counts);
   var footer=new DockPanel{Margin=new Thickness(0,7,0,0)};var quit=UI.Btn("退出",pet.Quit,"#FFFBF3");quit.FontSize=10;quit.Padding=new Thickness(4);DockPanel.SetDock(quit,Dock.Right);footer.Children.Add(quit);var hint=UI.T("拖动移动 · 点击摸摸 · 右键照顾",10,"#AA997F");hint.VerticalAlignment=VerticalAlignment.Center;footer.Children.Add(hint);stack.Children.Add(footer);Refresh();
  }
  public void Refresh(){double[] n={pet.State.Food,pet.State.Water,pet.State.Energy,pet.State.Mood};for(int i=0;i<4;i++){bars[i].Value=n[i];values[i].Text=Math.Round(n[i]).ToString();}sleep.Content=pet.State.Sleeping?"叫醒肉松":"睡一会儿";counts.Text=String.Format("吃过 {0} 顿饭 · 喝过 {1} 次水 · 被摸过 {2} 次",pet.State.Meals,pet.State.Drinks,pet.State.Pats);}
  public void SetMessage(string text){note.Text=text;}
 }
 public static class Program {
  [STAThread] public static int Main(string[] args){
   bool testing=args.Length>0&&args[0]=="--self-test";
   try{
    if(testing){SelfTest();return 0;}
    bool first;using(var mutex=new Mutex(true,"Local\\RousongPetV1",out first)){
     if(!first){MessageBox.Show("肉松已经在陪你啦，可以在系统托盘里找到它。","肉松");return 0;}
     var app=new Application{ShutdownMode=ShutdownMode.OnExplicitShutdown};
     var store=new StateStore(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"Data","state.json"));
     var pet=new PetWindow(store.Load(),store);app.Run(pet);
    }
    return 0;
   }catch(Exception ex){
    if(testing){try{string folder=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"TestResults");Directory.CreateDirectory(folder);File.WriteAllText(Path.Combine(folder,"FAIL.txt"),ex.ToString());}catch{}return 1;}
    MessageBox.Show("肉松暂时没能启动：\n"+ex.Message,"肉松");return 1;
   }
  }
  static void Check(bool ok,string message){if(!ok)throw new Exception(message);}
  static void SelfTest(){
   string folder=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"TestResults");Directory.CreateDirectory(folder);
   foreach(string name in new string[]{"PASS.txt","FAIL.txt"}){string p=Path.Combine(folder,name);if(File.Exists(p))File.Delete(p);}
   var v=new PetState();v.Advance(1,false);Check(v.Food==76&&v.Water==77&&v.Energy==72,"状态衰减");
   v.Feed();v.Drink();v.Pet();Check(v.Food==100&&v.Water==100&&v.Mood<=100&&v.Meals==1&&v.Drinks==1&&v.Pats==1,"喂养边界与次数");
   v.Sleeping=true;double energy=v.Energy;v.Advance(.5,false);Check(v.Energy>energy,"睡眠恢复");
   v.Advance(999,true);Check(v.Food>=15&&v.Water>=15&&v.Energy<=100&&v.Mood>=25,"离线保护");
   var shortOffline=new PetState();var longOffline=new PetState();shortOffline.Advance(8,true);longOffline.Advance(999,true);
   Check(shortOffline.Food==longOffline.Food&&shortOffline.Water==longOffline.Water&&shortOffline.Energy==longOffline.Energy,"离线最多计算八小时");
   double food=v.Food;v.Advance(-24,true);Check(v.Food==food,"时钟回拨保护");
   var invalid=new PetState{Food=Double.NaN,Water=Double.PositiveInfinity,Size=99,X=Double.NaN};invalid.Normalize();
   Check(invalid.Food==50&&invalid.Water==50&&invalid.Size==1.35&&invalid.X==-1,"损坏数值保护");
   string statePath=Path.Combine(folder,"state.json");var store=new StateStore(statePath);Check(store.Save(v),"保存");
   v.Water=44;Check(store.Save(v),"原子替换");Check(Math.Abs(store.Load().Water-44)<.1,"读回");
   v.Water=63;Check(store.Save(v),"第二次原子替换");File.WriteAllText(statePath,"invalid json");
   Check(Math.Abs(store.Load().Water-44)<.1&&store.Warning!=null,"损坏存档回退");
   File.Delete(statePath);Check(Math.Abs(store.Load().Water-44)<.1&&store.Warning!=null,"缺失主存档回退");
   // Construction checks four embedded atlases, 200 cached source rectangles and the separate board.
   var sprite=new Sprite();sprite.Measure(new Size(240,240));sprite.Arrange(new Rect(0,0,240,240));
   foreach(Activity a in Enum.GetValues(typeof(Activity))){
    sprite.Action=a;sprite.Time=1.5;sprite.InvalidateVisual();sprite.UpdateLayout();
    var render=new RenderTargetBitmap(240,240,96,96,PixelFormats.Pbgra32);render.Render(sprite);
    byte[] pixels=new byte[240*240*4];render.CopyPixels(pixels,240*4,0);bool visible=false;for(int i=3;i<pixels.Length;i+=4)if(pixels[i]>30){visible=true;break;}Check(visible,"动作渲染为空");
    var encoder=new PngBitmapEncoder();encoder.Frames.Add(BitmapFrame.Create(render));
    using(var stream=File.Create(Path.Combine(folder,a.ToString()+".png")))encoder.Save(stream);
   }
   for(int row=0;row<4;row++)for(int frame=0;frame<4;frame++){
    var cell=SpriteLayout.Cell(row,frame);Check(cell.X>=0&&cell.Y>=0&&cell.X+cell.Width<=1254&&cell.Y+cell.Height<=1254,"图集裁切边界");
    var rect=SpriteLayout.Destination(row,frame,SpriteLayout.Ground);
    Check(Math.Abs(rect.X+SpriteLayout.Centers[row,frame]*SpriteLayout.Scale-120)<.0001,"小猫居中");
    Check(Math.Abs(rect.Y+SpriteLayout.Baselines[row,frame]*SpriteLayout.Scale-SpriteLayout.Ground)<.0001,"脚掌落地");
   }
   // Capture each upgraded scene throughout its duration, including the last frame.
   // These PNGs let a Windows user inspect paw/prop contact and complete body poses.
   foreach(Activity a in new Activity[]{Activity.Stretch,Activity.Butterfly,Activity.Ball,Activity.Scratch}){
    double duration=a==Activity.Stretch?7:a==Activity.Butterfly?12:11;
    int first=a==Activity.Stretch?0:a==Activity.Butterfly?8:a==Activity.Ball?16:24;
    for(int sample=0;sample<8;sample++){
     double t=duration*sample/7;var pose=MotionData.At(a,t);
     Check(pose.UseMotion&&pose.Frame>=first&&pose.Frame<first+8,"独立动作图集范围");
     Check(!Double.IsNaN(pose.Dx)&&!Double.IsNaN(pose.Hop)&&pose.PropAlpha>=0&&pose.PropAlpha<=1,"动作坐标与透明度");
     sprite.Action=a;sprite.Time=t;sprite.InvalidateVisual();sprite.UpdateLayout();
     var render=new RenderTargetBitmap(240,240,96,96,PixelFormats.Pbgra32);render.Render(sprite);
     byte[] pixels=new byte[240*240*4];render.CopyPixels(pixels,240*4,0);int visible=0;
     for(int i=3;i<pixels.Length;i+=4)if(pixels[i]>30)visible++;
     Check(visible>500,"独立姿态没有完整渲染");
     var encoder=new PngBitmapEncoder();encoder.Frames.Add(BitmapFrame.Create(render));
     using(var stream=File.Create(Path.Combine(folder,a.ToString()+"-"+sample+".png")))encoder.Save(stream);
    }
   }
   // Representative continuous poses cover reaching, stroke boundaries and final hold.
   // Sample inside each frame interval so floating-point boundary rounding is irrelevant.
   double[] scratchTimes={0,29.5/30,1+.5/30,1+59.5/30,9+.5/30,10.5};
   int[] scratchExpected={0,29,30,89,90,119};
   for(int sample=0;sample<scratchTimes.Length;sample++){
    var pose=MotionData.At(Activity.Scratch,scratchTimes[sample]);
    Check(pose.UseMotion&&pose.UseScratch&&pose.ScratchFrame==scratchExpected[sample],"连续磨爪姿态时间表");
    sprite.Action=Activity.Scratch;sprite.Time=scratchTimes[sample];sprite.InvalidateVisual();sprite.UpdateLayout();
    var render=new RenderTargetBitmap(240,240,96,96,PixelFormats.Pbgra32);render.Render(sprite);
    byte[] pixels=new byte[240*240*4];render.CopyPixels(pixels,240*4,0);int visible=0;
    for(int i=3;i<pixels.Length;i+=4)if(pixels[i]>30)visible++;
    Check(visible>500,"连续磨爪姿态没有完整渲染");
    var encoder=new PngBitmapEncoder();encoder.Frames.Add(BitmapFrame.Create(render));
    using(var stream=File.Create(Path.Combine(folder,"ScratchSmooth-"+scratchExpected[sample]+".png")))encoder.Save(stream);
   }
   // Capture complete yawn/roll timelines, including both ends and exposed-belly holds.
   // Each sample must select the correct new atlas half, with no stale old-motion pose.
   foreach(Activity a in new Activity[]{Activity.Yawn,Activity.Roll}){
    double duration=MotionData.Duration(a);int first=a==Activity.Yawn?0:16;
    Check(duration>0&&duration<=15,"放松动作时长");
    for(int sample=0;sample<16;sample++){
     double t=duration*sample/15;var pose=MotionData.At(a,t);
     Check(pose.UseRelax&&pose.RelaxFrame>=first&&pose.RelaxFrame<first+16,"放松动作图集范围");
     Check(!Double.IsNaN(pose.Dx)&&!Double.IsInfinity(pose.Dx)&&!Double.IsNaN(pose.Hop)&&!Double.IsInfinity(pose.Hop),"放松动作坐标");
     sprite.Action=a;sprite.Time=t;sprite.InvalidateVisual();sprite.UpdateLayout();
     var render=new RenderTargetBitmap(240,240,96,96,PixelFormats.Pbgra32);render.Render(sprite);
     byte[] pixels=new byte[240*240*4];render.CopyPixels(pixels,240*4,0);int visible=0;
     for(int i=3;i<pixels.Length;i+=4)if(pixels[i]>30)visible++;
     Check(visible>500,"放松姿态没有完整渲染");
     var encoder=new PngBitmapEncoder();encoder.Frames.Add(BitmapFrame.Create(render));
     using(var stream=File.Create(Path.Combine(folder,a.ToString()+"-"+sample+".png")))encoder.Save(stream);
    }
   }
   File.WriteAllText(Path.Combine(folder,"PASS.txt"),"PASS: decay, care bounds and counters, sleep, eight-hour offline cap, clock rollback, invalid data, atomic save, backup recovery, 200 atlas cells, a stationary scratch board, centered ground anchors, thirteen rendered activities, 64 motion scene snapshots and six continuous scratch poses. Desktop interaction and tray behavior still require manual checks.");
  }
 }
}
