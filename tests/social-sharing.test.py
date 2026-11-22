#!/usr/bin/env python3
"""Focused checks for server-rendered social sharing and the welcome/install path."""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/"index.html").read_text(encoding="utf-8")
expected={
'property="og:type"':"website",
'property="og:title"':"Aaria's Magical Piano Kingdom",
'property="og:description"':"Learn, play and create music in Aaria's Magical Piano Kingdom!",
'property="og:url"':"https://chinkk-git.github.io/aaria-magical-piano-kingdom/",
'property="og:image"':"https://chinkk-git.github.io/aaria-magical-piano-kingdom/assets/social/aaria-piano-share.jpg",
'property="og:image:width"':"1200",'property="og:image:height"':"630",
'property="og:image:alt"':"Aaria playing piano in her Magical Piano Kingdom",
'name="twitter:card"':"summary_large_image",
'name="twitter:title"':"Aaria's Magical Piano Kingdom",
'name="twitter:description"':"Learn, play and create music in Aaria's Magical Piano Kingdom!",
'name="twitter:image"':"https://chinkk-git.github.io/aaria-magical-piano-kingdom/assets/social/aaria-piano-share.jpg"}
for key,value in expected.items():
    found=re.findall(r'<meta\s+'+re.escape(key)+r'\s+content="([^"]*)"',html,re.I)
    assert found==[value],f"{key}: expected exactly {value!r}, got {found!r}"
for required in ("get('welcome')==='1'","Install App","Open in Browser","beforeinstallprompt","WhatsApp","Safari","navigator.standalone","searchParams.delete('welcome')"):
    assert required in html,f"missing welcome/install behavior: {required}"
assert html.index('property="og:title"')<html.lower().index("</head>"),"metadata must be server-rendered"
assert html.count('id="welcomeInstallApp"')==1 and html.count('id="welcomeOpenApp"')==1
data=(ROOT/"assets/social/aaria-piano-share.jpg").read_bytes()
assert data.startswith(bytes((255,216,255))),"sharing image must be JPEG"
assert len(data)<=500_000,f"image too large: {len(data)} bytes"
def jpeg_size(blob):
    i=2
    while i<len(blob):
        if blob[i]!=0xFF:i+=1;continue
        while i<len(blob) and blob[i]==0xFF:i+=1
        marker=blob[i];i+=1
        if marker in (0xD8,0xD9) or 0xD0<=marker<=0xD7:continue
        length=int.from_bytes(blob[i:i+2],"big")
        if marker in (0xC0,0xC1,0xC2,0xC3,0xC5,0xC6,0xC7,0xC9,0xCA,0xCB,0xCD,0xCE,0xCF):
            return int.from_bytes(blob[i+5:i+7],"big"),int.from_bytes(blob[i+3:i+5],"big")
        i+=length
    raise AssertionError("JPEG dimensions not found")
assert jpeg_size(data)==(1200,630),f"unexpected dimensions: {jpeg_size(data)}"
print(f"PASS: OG/Twitter metadata, welcome/install wiring, JPEG 1200x630 ({len(data)} bytes)")
