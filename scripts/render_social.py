#!/usr/bin/env python3
"""Generate Literature's deterministic 1200x630 social preview artwork."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "og-image.png"

def render():
    im = Image.new("RGB", (1200, 630), "#202236")
    d = ImageDraw.Draw(im)
    gold, parchment = "#d2ae72", "#f6ead2"
    d.rectangle((26, 26, 1174, 604), outline="#b99660", width=2)
    d.rectangle((38, 38, 1162, 592), outline="#514a44", width=1)
    d.rectangle((905, 38, 1162, 592), fill="#252a3d")
    for x, w, y1, y2 in [(924,44,144,472),(977,46,105,484),
                         (1030,40,159,475),(1082,53,126,479)]:
        d.rounded_rectangle((x,y1,x+w,y2),radius=4,
                            fill="#473a32",outline="#b99660",width=2)
        d.line((x+8,y1+20,x+w-8,y1+20),fill="#b99660",width=2)
        d.line((x+8,y2-20,x+w-8,y2-20),fill="#b99660",width=2)
        for k in (0,1,2):
            yy=y1+45+k*17
            d.line((x+11,yy,x+w-11,yy),fill="#8e7552",width=1)
    for y in (500,510):
        d.line((905,y,1141,y),fill="#b99660",width=3)
    base="/usr/share/fonts/truetype/dejavu/"
    def font(name,size):
        return ImageFont.truetype(base+name,size)
    serif="DejaVuSerif.ttf"
    sans="DejaVuSans.ttf"
    d.text((79,80),"11AM   /   DARAJA HADI ASHAR",font=font(sans,22),fill=gold)
    d.line((79,129,846,129),fill="#8d795c",width=2)
    d.text((73,165),"Literature",font=font(serif,96),fill=parchment)
    d.text((77,295),"Dossier Notes",font=font(serif,60),fill=gold)
    d.line((80,402,848,402),fill="#8d795c",width=2)
    d.text((80,438),"COMPLETE ACADEMIC STUDY COMPANION",
           font=font(sans,21),fill=parchment)
    d.text((80,478),"Readings  •  Analysis  •  Revision",
           font=font(serif,24),fill="#e0c99f")
    d.text((80,554),"READ ONLINE   •   INSTALL   •   STUDY OFFLINE",
           font=font(sans,15),fill="#b4a892")
    im.save(OUT,optimize=True)
    print("Generated",OUT.name,OUT.stat().st_size,"bytes")

if __name__=="__main__":
    render()
