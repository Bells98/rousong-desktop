"""Build one offline HTML from the small source preview; leave source files intact."""
from pathlib import Path
import base64
import re

source = Path(__file__).resolve().parent
project = source.parent
html = (project / 'Rousong-Preview.html').read_text(encoding='utf-8')
script = (source / 'preview.js').read_text(encoding='utf-8')
html, count = re.subn(
    r'<script src="source/preview\.js"></script>',
    lambda match: '<script>' + script + '</script>', html,
)
assert count == 1, 'The source preview must reference source/preview.js exactly once.'
assets = {
    'spriteAsset': 'atlas.png',
    'motionsAsset': 'motions.png',
    'scratchBoardAsset': 'scratch-board.png',
    'scratchSmoothAsset': 'scratch-smooth.png',
    'relaxAsset': 'relax.png',
}
for asset_id, filename in assets.items():
    encoded = base64.b64encode((source / 'assets' / filename).read_bytes()).decode('ascii')
    pattern = rf'(<img\b[^>]*\bid="{asset_id}"[^>]*\bsrc=")source/assets/{re.escape(filename)}("[^>]*>)'
    html, count = re.subn(
        pattern, lambda match: match[1] + 'data:image/png;base64,' + encoded + match[2], html,
    )
    assert count == 1, f'The source preview must reference {asset_id} exactly once.'
for action in ('stretch', 'butterfly', 'ball', 'scratch', 'yawn', 'roll'):
    assert html.count(f'data-action="{action}"') == 1, f'Duplicate action: {action}'
preview = project / 'dist' / 'Rousong-Preview.html'
preview.parent.mkdir(parents=True, exist_ok=True)
preview.write_text(html, encoding='utf-8')
print('Built standalone preview:', preview, preview.stat().st_size, 'bytes')
