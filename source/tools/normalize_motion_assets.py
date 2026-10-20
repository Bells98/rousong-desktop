#!/usr/bin/env python3
"""Extract and pack the generated cat poses without editing source colors.

The opaque-enough alpha bodies define eight connected sprite islands, rather
than assuming the generated sheet follows an exact 4x2 grid. A nearest-island
ownership map keeps soft source edge pixels with their own cat, including the
first airborne butterfly pose which crosses the nominal row boundary.

Only component extraction, cropping, whole-pose uniform resizing, and packing
are performed. Raw PNGs are never overwritten. No recoloring is performed.
"""
from pathlib import Path
import json
import hashlib
import argparse
import shutil
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

SCRIPT=Path(__file__).resolve()
if (SCRIPT.parent/'assets').is_dir():
 ROOT=SCRIPT.parent
 OUT=ROOT/'assets'
 QA=ROOT/'qa'
 SOURCES=OUT/'raw'
elif (SCRIPT.parent.parent/'assets').is_dir():
 ROOT=SCRIPT.parent.parent
 OUT=ROOT/'assets'
 QA=ROOT/'qa'
 SOURCES=OUT/'raw'
else:
 ROOT=SCRIPT.parents[1]
 SOURCES=ROOT.parent/'generated_images'
 OUT=ROOT/'desktop/source/assets'
 QA=ROOT/'qa'
SHEET_NAMES={
 'stretch':'exec-8edb3008-416f-42d7-9b25-67a0d8931a09.png',
 'butterfly':'exec-4d22340a-c737-4803-a94e-a670d6142783.png',
 'ball':'exec-96bab6e8-3ce8-46cc-bfea-ff5ffb15e38c.png',
}
NAMES={
 'stretch':['neutral','rise','reach','press','long-stretch','release','sit','neutral'],
 'butterfly':['neutral','watch','crouch','rear','leap','reach-in-air','land','neutral'],
 'ball':['neutral','look-down','touch','bat','follow','pin','settle','neutral'],
}
CELL=400; CENTER=200; GROUND=366; MAX_DX=16; HOP=35

def bbox(a,threshold=16):
 ys,xs=np.where(a>threshold)
 return [int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)] if len(xs) else [0,0,0,0]

def sha(path):
 return hashlib.sha256(path.read_bytes()).hexdigest()

def extract(path):
 image=Image.open(path).convert('RGBA'); arr=np.array(image); alpha=arr[:,:,3]
 body=alpha>8
 labels,n=ndimage.label(ndimage.binary_dilation(body,iterations=2))
 sizes=ndimage.sum(body,labels,range(1,n+1))
 selected=(np.argsort(sizes)[::-1][:8]+1).tolist()
 # Determine row by centers, not the top edge: airborne sprite five starts
 # above the nominal row boundary.
 items=[]
 for lab in selected:
  ys,xs=np.where((labels==lab)&body)
  items.append({'label':lab,'center':[float(np.median(xs)),float(np.median(ys))]})
 rows=sorted(items,key=lambda item:item['center'][1])
 ordered=sorted(rows[:4],key=lambda item:item['center'][0])+sorted(rows[4:],key=lambda item:item['center'][0])
 owner=np.zeros_like(labels,dtype=np.int16)
 for i,item in enumerate(ordered):owner[labels==item['label']]=i+1
 distance,indices=ndimage.distance_transform_edt(owner==0,return_indices=True)
 nearest=owner[indices[0],indices[1]]
 poses=[]
 for i,item in enumerate(ordered):
  # Soft-alpha edge pixels are copied verbatim within 8px of the segmented
  # sprite island. This rejects distant 1/255-alpha sheet speckles.
  member=(nearest==i+1)&(distance<=8)&(alpha>0)
  ys,xs=np.where(member)
  box=[int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)]
  x0,y0,x1,y1=box
  crop=arr[y0:y1,x0:x1].copy(); inside=member[y0:y1,x0:x1]
  crop[~inside]=0
  core=bbox(crop[:,:,3],16)
  red=(crop[:,:,0]>200)&(crop[:,:,1]<90)&(crop[:,:,2]<90)&(crop[:,:,3]>0)
  poses.append({'image':Image.fromarray(crop),'bounds':box,'core':core,
                'islandLabel':int(item['label']),'redEdgePixels':int(red.sum()),
                'redOpaquePixels':int((red&(crop[:,:,3]>127)).sum()),
                'visiblePixelCount':int((crop[:,:,3]>0).sum())})
 return poses,{'file':str(path.relative_to(ROOT.parent)),'sha256':sha(path),'size':list(image.size),
               'transparentPixels':int((alpha==0).sum()),'partialAlphaPixels':int(((alpha>0)&(alpha<255)).sum()),
               'opaquePixels':int((alpha==255).sum())}


def build_base():
 atlas=Image.new('RGBA',(CELL*4,CELL*6))
 manifest={'version':1,'tileWidth':CELL,'tileHeight':CELL,'columns':4,'rows':6,
  'anchor':[CENTER,GROUND],'motionBounds':{'maximumDx':MAX_DX,'maximumButterflyHop':HOP},
  'method':'Connected-alpha component extraction, crop, and whole-pose uniform resize. Original colors retained.',
  'neutral':{'source':'atlas.png','sourceRect':[0,0,314,373],'scale':.94,'anchor':[198,356]},
  'actions':{}}
 base=Image.open(OUT/'atlas.png').convert('RGBA').crop((0,0,314,373))
 neutral=Image.new('RGBA',(CELL,CELL))
 neutral_resize=base.resize((round(base.width*.94),round(base.height*.94)),Image.Resampling.LANCZOS)
 neutral_position=[round(CENTER-198*.94),round(GROUND-356*.94)]
 neutral.alpha_composite(neutral_resize,tuple(neutral_position))
 neutral_bounds=bbox(np.asarray(neutral)[:,:,3],16)
 target_height=neutral_bounds[3]-neutral_bounds[1]
 manifest['neutral'].update({'renderedVisibleBounds':neutral_bounds,'renderedVisibleHeight':target_height,
  'packedPosition':neutral_position,'pixelSha256':hashlib.sha256(neutral.tobytes()).hexdigest()})

 for action_index,action in enumerate(['stretch','butterfly','ball']):
  path=SOURCES/SHEET_NAMES[action]; poses,source_info=extract(path)
  first=poses[0]['core']; desired=target_height/(first[3]-first[1])
  safety=[]
  for i,p in enumerate(poses[1:7],start=1):
   w,h=p['image'].size; x0,y0,x1,y1=p['core']; core_height=y1-y0
   # Center the visible body, then keep its entire soft edge inside dx margins.
   center=(x0+x1)/2
   safety.append((CENTER-MAX_DX-2)/max(center,w-center))
   top_distance=y1
   hop=HOP if action=='butterfly' and i in [4,5] else 0
   safety.append((GROUND-hop-2)/top_distance)
  scale=min(desired,*safety)
  action_info={'source':source_info,'scale':scale,'referenceScale':desired,
               'scaleCappedForCanvas':scale<desired,
               'sourceComponents':[{'index':i,'sourceBounds':p['bounds'],'sourceCoreBounds':p['core'],
                'islandLabel':p['islandLabel'],'visiblePixelCount':p['visiblePixelCount'],
                'redEdgePixels':p['redEdgePixels'],'redOpaquePixels':p['redOpaquePixels']}
                for i,p in enumerate(poses)],'frames':[]}
  for i,p in enumerate(poses):
   tile_index=action_index*8+i; tx=(tile_index%4)*CELL; ty=(tile_index//4)*CELL
   if i in [0,7]:
    tile=neutral.copy(); final=bbox(np.asarray(tile)[:,:,3],16)
    info={'index':i,'tileIndex':tile_index,'name':NAMES[action][i],'source':'atlas.png',
          'sourceBounds':[0,0,314,373],'scale':.94,'renderedBounds':final,
          'groundAnchor':[CENTER,GROUND],'neutralIdentitySha256':manifest['neutral']['pixelSha256']}
   else:
    raw=p['image']; x0,y0,x1,y1=p['core']; resized=raw.resize((round(raw.width*scale),round(raw.height*scale)),Image.Resampling.LANCZOS)
    x=round(CENTER-(x0+x1)/2*scale); y=round(GROUND-y1*scale)
    tile=Image.new('RGBA',(CELL,CELL)); tile.alpha_composite(resized,(x,y))
    final=bbox(np.asarray(tile)[:,:,3],16); full=bbox(np.asarray(tile)[:,:,3],0)
    hop=HOP if action=='butterfly' and i in [4,5] else 0
    assert final[0]>=2 and final[2]+MAX_DX<=398,(action,i,final)
    assert final[1]-hop>=2,(action,i,final,hop)
    info={'index':i,'tileIndex':tile_index,'name':NAMES[action][i],
     'source':source_info['file'],'sourceBounds':p['bounds'],'sourceCoreBounds':p['core'],
     'scale':scale,'packedPosition':[x,y],'renderedBounds':final,'renderedFullAlphaBounds':full,
     'groundAnchor':[CENTER,GROUND],'maximumHop':hop,'redEdgePixels':p['redEdgePixels'],
     'redOpaquePixels':p['redOpaquePixels']}
   atlas.alpha_composite(tile,(tx,ty)); action_info['frames'].append(info)
  manifest['actions'][action]=action_info
 OUT.mkdir(parents=True,exist_ok=True); QA.mkdir(parents=True,exist_ok=True)
 atlas.save(OUT/'motions.png')
 manifest['output']={'size':list(atlas.size),'sha256':sha(OUT/'motions.png')}
 (OUT/'motion-layout.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')

 font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',16)
 small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',13)
 contact=Image.new('RGB',(CELL*4,440*6),'#f6f0e6'); draw=ImageDraw.Draw(contact)
 for action_index,action in enumerate(['stretch','butterfly','ball']):
  for info in manifest['actions'][action]['frames']:
   idx=info['tileIndex']; x=(idx%4)*CELL; y=(idx//4)*440
   tile=atlas.crop((x,(idx//4)*CELL,x+CELL,(idx//4)*CELL+CELL))
   contact.paste(tile,(x,y),tile)
   draw.line((x, y+GROUND, x+CELL, y+GROUND),fill='#ddd3c3',width=1)
   draw.rectangle((x,y,x+CELL-1,y+439),outline='#d2c6b5',width=1)
   draw.text((x+10,y+405),f"{action} {info['index']}: {info['name']}",font=font,fill='#3e362e')
   draw.text((x+10,y+427),f"bbox {info['renderedBounds']} / scale {info['scale']:.3f}",font=small,fill='#756451')
 contact.save(QA/'motion-contact.png')
 for action in manifest['actions']:
  a=manifest['actions'][action]
  print(action,'scale',round(a['scale'],6),'reference',round(a['referenceScale'],6),'bounds',[p['renderedBounds'] for p in a['frames']])
 print('Saved',OUT/'motions.png',OUT/'motion-layout.json',QA/'motion-contact.png')

SCRATCH_CAT_NAME='exec-62ad0ef5-c7d6-4ae5-8347-b3d1b6f5b343.png'
SCRATCH_BOARD_NAME='exec-4db9c19d-a90f-44d9-9984-b9b8c69cfe51.png'

def append_scratch():
 """Append eight tiles while preserving the existing first 24 tile pixels.

 Standing source frames are translated by a fixed x42, rather than centered
 by their varying bboxes. Their hind-paw bases align with y366. This keeps the
 body in place as the forelegs alternately stretch and pull against the fixed
 sisal face. Whole-cat scale is a constant .8 in all six generated poses.
 """
 cat_path=OUT/'raw'/SCRATCH_CAT_NAME; board_path=OUT/'raw'/SCRATCH_BOARD_NAME
 poses,source_info=extract(cat_path)
 original=Image.open(OUT/'motions.png').convert('RGBA')
 assert original.width==1600 and original.height>=2400,original.size
 prefix=original.crop((0,0,1600,2400))
 prefix_hash=hashlib.sha256(prefix.tobytes()).hexdigest()
 neutral=prefix.crop((0,0,400,400)); neutral_hash=hashlib.sha256(neutral.tobytes()).hexdigest()
 atlas=Image.new('RGBA',(1600,3200));atlas.paste(prefix,(0,0))
 manifest=json.loads((OUT/'motion-layout.json').read_text())
 names=['neutral','approach','place-paws','right-paw-high','left-paw-high','both-paws-up','release','neutral']
 # Measured contact edges in cropped source coordinates. Their 400px positions
 # lie on the face or its left timber edge; no individual legs are warped.
 contact_source={2:[[350,124],[338,172]],3:[[350,61],[333,181]],
                 4:[[348,43],[330,164]],5:[[313,32],[339,49]]}
 action={'source':source_info,'scale':.8,'alignment':'fixed x42; source paw base to y366',
  'groundY':366,'referenceCatX':42,'stationaryMotion':True,
  'sourceComponents':[{'index':i,'sourceBounds':p['bounds'],'sourceCoreBounds':p['core'],
                      'islandLabel':p['islandLabel'],'visiblePixelCount':p['visiblePixelCount'],
                      'redEdgePixels':p['redEdgePixels'],'redOpaquePixels':p['redOpaquePixels']}
                      for i,p in enumerate(poses)],
  'sourceEdgeNote':'Source frame 3 ear tip lies close to the source top edge: alpha>16 starts at y3. Its complete extracted pixels remain inside the normalized 400x400 tile. No regeneration or repaint performed.',
  'frames':[]}
 for i,p in enumerate(poses):
  tile_index=24+i;tx=(tile_index%4)*400;ty=(tile_index//4)*400
  if i in [0,7]:
   tile=neutral.copy()
   info={'index':i,'tileIndex':tile_index,'name':names[i],'source':'motions.png tile0',
    'scale':1,'renderedBounds':bbox(np.asarray(tile)[:,:,3],16),'neutralIdentitySha256':neutral_hash,
    'groundAnchor':[200,366]}
  else:
   scale=.8;raw=p['image'];x=42;y=round(366-p['core'][3]*scale)
   resized=raw.resize((round(raw.width*scale),round(raw.height*scale)),Image.Resampling.LANCZOS)
   y=366-bbox(np.asarray(resized)[:,:,3],16)[3]
   # Entire source crop stays inside the tile; alpha pixels are not cut at an edge.
   assert x>=0 and y>=0 and x+resized.width<=400 and y+resized.height<=400,(i,x,y,resized.size)
   tile=Image.new('RGBA',(400,400));tile.alpha_composite(resized,(x,y))
   final=bbox(np.asarray(tile)[:,:,3],16);full=bbox(np.asarray(tile)[:,:,3],0)
   source_alpha=np.asarray(raw)[:,:,3];source_base=p['core'][3]
   _,feet_x=np.where(source_alpha[source_base-4:source_base,:]>127)
   foot_x=float(np.median(feet_x))
   info={'index':i,'tileIndex':tile_index,'name':names[i],'source':source_info['file'],
    'sourceBounds':p['bounds'],'sourceCoreBounds':p['core'],'scale':scale,'packedPosition':[x,y],
    'renderedBounds':final,'renderedFullAlphaBounds':full,'groundAnchor':[round(x+foot_x*scale,2),366],
    'rearFootSourceAnchor':[foot_x,source_base],
    'forepawSourceContacts':contact_source.get(i,[]),
    'forepawContacts':[[round(x+px*scale,2),round(y+py*scale,2)] for px,py in contact_source.get(i,[])],
    'maximumHop':0,'redEdgePixels':p['redEdgePixels'],'redOpaquePixels':p['redOpaquePixels']}
  atlas.paste(tile,(tx,ty));action['frames'].append(info)
 # The board is cropped and uniformly scaled; its source alpha is preserved.
 board_raw=Image.open(board_path).convert('RGBA')
 board_crop_bounds=[264,21,870,1373];board_core_source=[268,25,866,1369]
 board_crop=board_raw.crop(tuple(board_crop_bounds));board_scale=338/1344
 board_resize=board_crop.resize((round(board_crop.width*board_scale),round(board_crop.height*board_scale)),Image.Resampling.LANCZOS)
 board=Image.new('RGBA',(400,400));board.alpha_composite(board_resize,(238,27))
 board.save(OUT/'scratch-board.png')
 manifest['version']=2;manifest['rows']=8;manifest['actions']['scratch']=action
 manifest['scratchBoard']={'source':str(board_path.relative_to(ROOT.parent)),'sourceSha256':sha(board_path),
  'sourceSize':list(board_raw.size),'cropBounds':board_crop_bounds,'sourceCoreBounds':board_core_source,
  'scale':board_scale,'packedPosition':[238,27],'renderedBounds':bbox(np.asarray(board)[:,:,3],16),
  'renderedFullAlphaBounds':bbox(np.asarray(board)[:,:,3],0),'sisalFaceX':[286,335],
  'woodLeftFrameX':282,'groundY':366,'renderLayer':'behind cat',
  'output':'scratch-board.png','outputSha256':sha(OUT/'scratch-board.png')}
 manifest['preservedPrefix']={'tileCount':24,'size':[1600,2400],'pixelSha256':prefix_hash}
 # Exact pixel preservation, including transparent pixels and neutral endpoints.
 assert np.array_equal(np.asarray(atlas)[:2400],np.asarray(prefix))
 for idx in [24,31]:
  assert np.array_equal(np.asarray(atlas.crop(((idx%4)*400,(idx//4)*400,(idx%4+1)*400,(idx//4+1)*400))),np.asarray(neutral))
 atlas.save(OUT/'motions.png')
 manifest['output']={'size':list(atlas.size),'sha256':sha(OUT/'motions.png')}
 (OUT/'motion-layout.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 QA.mkdir(parents=True,exist_ok=True)
 font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',16)
 small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',13)
 contact=Image.new('RGB',(1600,440*8),'#f6f0e6');draw=ImageDraw.Draw(contact)
 for a in manifest['actions'].values():
  for info in a['frames']:
   idx=info['tileIndex'];x=(idx%4)*400;y=(idx//4)*440
   cat=atlas.crop((x,(idx//4)*400,x+400,(idx//4+1)*400))
   tile=board.copy() if idx>=24 else Image.new('RGBA',(400,400));tile.alpha_composite(cat)
   contact.paste(tile,(x,y),tile)
   draw.line((x,y+366,x+400,y+366),fill='#ddd3c3',width=1)
   draw.rectangle((x,y,x+399,y+439),outline='#d2c6b5',width=1)
   label=('scratch ' if idx>=24 else '')+str(info['index'])+': '+info['name']
   draw.text((x+10,y+405),label,font=font,fill='#3e362e')
   draw.text((x+10,y+427),f"bbox {info['renderedBounds']} / scale {info['scale']:.3f}",font=small,fill='#756451')
 contact.save(QA/'motion-contact.png')
 contact.crop((0,440*6,1600,440*8)).save(QA/'scratch-contact.png')
 print('scratch appended:',OUT/'motions.png',atlas.size,'prefix_pixels_sha256',prefix_hash)
 print('scratch board:',manifest['scratchBoard']['renderedBounds'],'face',manifest['scratchBoard']['sisalFaceX'])
 for f in action['frames']:print('frame',f['index'],'bounds',f['renderedBounds'],'ground',f['groundAnchor'],'contacts',f.get('forepawContacts',[]))

if __name__=='__main__':
 parser=argparse.ArgumentParser(description='Normalize Rousong generated assets. Default appends scratch to the existing 24 tiles.')
 parser.add_argument('--base',action='store_true',help='Explicitly rebuild the three original 8-frame motion sets.')
 parser.add_argument('--scratch',action='store_true',help='Append scratch only, preserving the existing original 24 tiles.')
 args=parser.parse_args()
 if args.base:build_base()
 if args.scratch or not args.base:append_scratch()
