"""Pack the ImageGen complete-body poses. Crop/resize only; no morphs or fades."""
from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np
import json
from scipy import ndimage

ROOT=Path(__file__).resolve().parent
ASSETS=ROOT/'assets'
QA=ROOT.parent/'qa'
CELL=400

def poses(path):
    src=Image.open(path).convert('RGBA')
    a=np.asarray(src)
    body=a[:,:,3]>16
    labels,n=ndimage.label(body)
    sizes=ndimage.sum(body,labels,range(1,n+1))
    selected=(np.argsort(sizes)[::-1][:16]+1).tolist()
    items=[]
    for lab in selected:
        ys,xs=np.where((labels==lab)&body)
        if len(xs)<1000:raise ValueError('Missing complete pose')
        items.append((int(lab),float(np.median(xs)),float(np.median(ys))))
    vertical=sorted(items,key=lambda i:i[2])
    ordered=[]
    for row in range(4):ordered+=sorted(vertical[row*4:row*4+4],key=lambda i:i[1])
    owner=np.zeros(labels.shape,dtype=np.int16)
    for i,(lab,_,_) in enumerate(ordered):owner[labels==lab]=i+1
    distance,indices=ndimage.distance_transform_edt(owner==0,return_indices=True)
    nearest=owner[indices[0],indices[1]]
    out=[]
    for i in range(16):
        member=(nearest==i+1)&(distance<=5)&(a[:,:,3]>4)
        ys,xs=np.where(member)
        x0,y0,x1,y1=int(xs.min()),int(ys.min()),int(xs.max())+1,int(ys.max())+1
        crop=a[y0:y1,x0:x1].copy()
        crop[~member[y0:y1,x0:x1]]=0
        out.append(Image.fromarray(crop))
    return out

def main():
    QA.mkdir(parents=True,exist_ok=True)
    manifest={'cell':400,'columns':4,'frames':32,'actions':{}}
    sheet=Image.new('RGBA',(1600,3200))
    neutral=Image.open(ASSETS/'motions.png').crop((0,0,400,400))
    raw=json.loads((ROOT/'relax-prompts.json').read_text(encoding='utf-8'))
    for name,offset in [('yawn',0),('roll',16)]:
        source=ASSETS/'raw'/raw[name]['file']
        images=poses(source)
        # Fixed physical scale per sequence; no per-pose height normalization.
        scale=min(320/images[0].height,358/max(im.width for im in images),350/max(im.height for im in images))
        entries=[]
        for i,img in enumerate(images):
            tile=Image.new('RGBA',(400,400))
            size=(round(img.width*scale),round(img.height*scale))
            resized=img.resize(size,Image.Resampling.LANCZOS)
            pos=(round(200-size[0]/2),366-size[1])
            tile.alpha_composite(resized,pos)
            # The original resting image remains the exact entry/exit pose.
            if i in (0,15):tile=neutral.copy()
            sheet.alpha_composite(tile,((offset+i)%4*400,(offset+i)//4*400))
            entries.append({'frame':offset+i,'size':size,'position':pos,'neutral':i in (0,15)})
        manifest['actions'][name]={'source':source.name,'scale':scale,'frames':entries}
    staged=ASSETS/'relax.next.png'
    sheet.save(staged,optimize=True)
    with Image.open(staged) as check:check.load()
    staged.replace(ASSETS/'relax.png')
    (ASSETS/'relax-layout.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    # A downscaled overview for visual QA, not a separate user deliverable.
    contact=Image.new('RGB',(1000,1000),'#eee8de')
    d=ImageDraw.Draw(contact)
    for row,name in enumerate(['yawn','roll']):
        for col,n in enumerate([0,3,5,7,9,11,13,15]):
            idx=row*16+n
            thumb=sheet.crop(((idx%4)*400,(idx//4)*400,(idx%4+1)*400,(idx//4+1)*400)).resize((240,240))
            x=(col%4)*250;y=row*500+(col//4)*250
            contact.paste(thumb,(x,y),thumb)
            d.text((x+5,y+4),name+' '+str(n),fill='#332d27')
    contact.save(QA/'relax-contact.jpg',quality=90)
    print('Packed',ASSETS/'relax.png', 'bytes',(ASSETS/'relax.png').stat().st_size)

if __name__=='__main__':main()
