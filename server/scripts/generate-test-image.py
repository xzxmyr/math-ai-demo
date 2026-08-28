"""
生成数学作业测试图 (题目 + 函数图像 + 手写解答 三区), 用于端到端测试
用法: python3 scripts/generate-test-image.py [输出路径]
依赖: PIL (pip install pillow)
"""
import sys
from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1] if len(sys.argv) > 1 else 'test-assets/math-homework-test.png'

W, H = 1400, 1900
img = Image.new('RGB', (W, H), 'white')
d = ImageDraw.Draw(img)

title_font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Songti.ttc', 52)
math_font  = ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 56)
label_font = ImageFont.truetype('/System/Library/Fonts/STHeiti Light.ttc', 34)

# ---------- ① 题目区 (印刷体) ----------
d.text((80, 120),  '题目', font=label_font, fill=(20, 20, 20))
d.text((80, 190),  '已知函数 f(x) = x² + 2x，', font=title_font, fill=(10, 10, 10))
d.text((80, 280),  '求它在区间 [0, 2] 上的定积分。', font=title_font, fill=(10, 10, 10))
d.line([(80, 430), (1320, 430)], fill=(180, 180, 180), width=3)

# ---------- ② 图像区 (函数图像) ----------
d.text((80, 480),  '图像', font=label_font, fill=(20, 20, 20))
ox, oy, scale = 640, 920, 140

def f(x):
    return x * x + 2 * x

d.line([(ox - 300, oy), (ox + 340, oy)], fill=(60, 60, 60), width=4)
d.line([(ox, oy + 260), (ox, oy - 300)], fill=(60, 60, 60), width=4)
prev = None
for x in [i / 100 for i in range(-280, 241)]:
    px, py = ox + x * scale, oy - f(x) * scale
    if prev and -300 < py - oy < 260 and abs(px - ox) < 340:
        d.line([prev, (px, py)], fill=(200, 30, 60), width=5)
    prev = (px, py)
d.rectangle([ox, oy - f(0) * scale, ox + 2 * scale, oy], fill=(120, 160, 255))
d.text((ox - 20, oy + 20), 'O', font=label_font, fill=(60, 60, 60))
d.text((ox + 2 * scale + 8, oy + 20), '2', font=label_font, fill=(60, 60, 60))
d.text((ox + 260, oy - 250), 'y = x² + 2x', font=label_font, fill=(200, 30, 60))
d.line([(80, 1320), (1320, 1320)], fill=(180, 180, 180), width=3)

# ---------- ③ 解答区 (学生手写解答) ----------
try:
    hand = ImageFont.truetype('/System/Library/Fonts/Apple Chancery.ttf', 64)
    hand_cn = ImageFont.truetype('/System/Library/Fonts/STHeiti Light.ttc', 58)
except Exception:
    hand = hand_cn = ImageFont.truetype('/System/Library/Fonts/STHeiti Light.ttc', 58)
d.text((80, 1370), '解：', font=hand_cn, fill=(30, 30, 200))
d.text((190, 1370), '∫₀² (x²+2x) dx', font=hand, fill=(30, 30, 200))
d.text((80, 1480), '= [ x³/3 + x² ]₀²', font=hand, fill=(30, 30, 200))
d.text((80, 1590), '= (8/3 + 4) - 0', font=hand, fill=(30, 30, 200))
d.text((80, 1700), '= 20/3', font=hand, fill=(30, 30, 200))

import os
os.makedirs(os.path.dirname(OUT) or '.', exist_ok=True)
img.save(OUT)
print('saved', OUT, img.size)
