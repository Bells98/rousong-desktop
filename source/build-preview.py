"""Embed the current production script and assets in both offline previews."""
from pathlib import Path
import base64,re

source=Path(__file__).resolve().parent
project=source.parent.parent
preview=project/'Rousong-Preview.html'
html=preview.read_text()
script=(source/'preview.js').read_text()
html=re.sub(r'<script>[\s\S]*?</script>',lambda m:'<script>'+script+'</script>',html,count=1)
motions='data:image/png;base64,'+base64.b64encode((source/'assets/motions.png').read_bytes()).decode()
img='<img id="motionsAsset" alt="" src="'+motions+'">'
if 'id="motionsAsset"' in html:
    html=re.sub(r'<img id="motionsAsset"[^>]*>',lambda m:img,html,count=1)
else:
    html=html.replace('<script>',img+'<script>',1)
board='data:image/png;base64,'+base64.b64encode((source/'assets/scratch-board.png').read_bytes()).decode()
board_img='<img id="scratchBoardAsset" alt="" src="'+board+'">'
if 'id="scratchBoardAsset"' in html:
    html=re.sub(r'<img id="scratchBoardAsset"[^>]*>',lambda m:board_img,html,count=1)
else:
    html=html.replace('<script>',board_img+'<script>',1)
html=re.sub(r'#spriteAsset(?:,#motionsAsset)?\{display:none\}', '#spriteAsset,#motionsAsset,#scratchBoardAsset{display:none}', html)
smooth='data:image/png;base64,'+base64.b64encode((source/'assets/scratch-smooth.png').read_bytes()).decode()
smooth_img='<img id="scratchSmoothAsset" alt="" src="'+smooth+'">'
if 'id="scratchSmoothAsset"' in html:
    html=re.sub(r'<img id="scratchSmoothAsset"[^>]*>',lambda m:smooth_img,html,count=1)
else:
    html=html.replace('<script>',smooth_img+'<script>',1)
html=re.sub(r'#spriteAsset(?:,#motionsAsset)?(?:,#scratchBoardAsset)?(?:,#scratchSmoothAsset)?\{display:none\}', '#spriteAsset,#motionsAsset,#scratchBoardAsset,#scratchSmoothAsset{display:none}', html)
relax='data:image/png;base64,'+base64.b64encode((source/'assets/relax.png').read_bytes()).decode()
relax_img='<img id="relaxAsset" alt="" src="'+relax+'">'
if 'id="relaxAsset"' in html:
    html=re.sub(r'<img id="relaxAsset"[^>]*>',lambda m:relax_img,html,count=1)
else:
    html=html.replace('<script>',relax_img+'<script>',1)
if '#relaxAsset{display:none}' not in html:
    html=html.replace('</style>','#relaxAsset{display:none}</style>',1)
new='<div class="toy-actions" aria-label="肉松的小动作"><button data-action="stretch">伸懒腰</button><button data-action="butterfly">追蝴蝶</button><button data-action="ball">玩小球</button><button data-action="scratch">磨磨爪</button><button data-action="yawn">打哈欠</button><button data-action="roll">躺下打滚</button></div>'
html=re.sub(r'<div class="toy-actions"[^>]*>[\s\S]*?</div>',lambda m:new,html,count=1)
html=html.replace('.toy-actions{display:flex;', '.toy-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));')
preview.write_text(html)
(source.parent/'Rousong-Preview.html').write_text(html)
assert html.count('id="motionsAsset"')==1
assert html.count('data-action="stretch"')==1
assert html.count('id="scratchBoardAsset"')==1
assert html.count('id="scratchSmoothAsset"')==1
assert html.count('data-action="scratch"')==1
assert html.count('data-action="yawn"')==1
assert html.count('data-action="roll"')==1
assert html.count('id="relaxAsset"')==1
print('Built both standalone previews:',preview.stat().st_size,'bytes each')
