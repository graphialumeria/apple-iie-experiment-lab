#!/usr/bin/env python3
"""Small, two-pass assembler for color-music.asm. Python standard library only."""
from pathlib import Path
import re, json
BASE = Path(__file__).resolve().parent
# Only official NMOS 6502 opcodes used by this ROM.
OP = {
 ('SEI','imp'):0x78,('CLD','imp'):0xd8,('TXS','imp'):0x9a,('RTS','imp'):0x60,('RTI','imp'):0x40,
 ('CLC','imp'):0x18,('INX','imp'):0xe8,('INY','imp'):0xc8,('DEX','imp'):0xca,
 ('ASL','acc'):0x0a,('TAX','imp'):0xaa,
 ('LDA','imm'):0xa9,('LDA','zp'):0xa5,('LDA','ax'):0xbd,('LDA','ay'):0xb9,
 ('LDX','imm'):0xa2,('LDX','zp'):0xa6,('LDY','imm'):0xa0,
 ('STA','zp'):0x85,('STA','abs'):0x8d,('STA','iy'):0x91,
 ('STX','zp'):0x86,('INC','zp'):0xe6,('DEC','zp'):0xc6,
 ('ADC','zp'):0x65,('ADC','imm'):0x69,('AND','imm'):0x29,
 ('ORA','zp'):0x05,('CMP','imm'):0xc9,('CPX','imm'):0xe0,('CPY','imm'):0xc0,
 ('BIT','abs'):0x2c,('JSR','abs'):0x20,('JMP','abs'):0x4c,
 ('BNE','rel'):0xd0,('BEQ','rel'):0xf0,
}
SIZES={'imp':1,'acc':1,'imm':2,'zp':2,'iy':2,'rel':2,'abs':3,'ax':3,'ay':3}
def operand_mode(name,arg):
 if name in ('BEQ','BNE'):return 'rel',arg
 if not arg:return 'imp','0'
 if arg.upper()=='A':return 'acc','0'
 if arg.startswith('#'):return 'imm',arg[1:]
 if re.fullmatch(r'\(\$[0-9a-fA-F]{2}\),Y',arg):return 'iy',arg[1:-3]
 if arg.endswith(',X'):return 'ax',arg[:-2]
 if arg.endswith(',Y'):return 'ay',arg[:-2]
 return ('zp' if re.fullmatch(r'\$[0-9a-fA-F]{1,2}',arg) else 'abs'),arg

def assemble():
 lines=[(i+1,line.split(';')[0].strip()) for i,line in enumerate((BASE/'color-music.asm').read_text().splitlines())]
 labels={};image=bytearray([0xea]*0x3000);listing=[]
 def value(s,passno):
  s=s.strip();part=s[1:] if s.startswith(('<','>')) else s
  if part.startswith('$'):v=int(part[1:],16)
  elif part.isdecimal():v=int(part)
  elif part in labels:v=labels[part]
  elif passno==1:v=0
  else:raise ValueError(f'Unknown symbol {part}')
  return v&255 if s.startswith('<') else v>>8 if s.startswith('>') else v
 for passno in (1,2):
  pc=0xd000
  for lineno,line in lines:
   if not line:continue
   original=line
   if ':' in line:
    label,line=line.split(':',1);line=line.strip()
    if passno==1:
     if label in labels:raise ValueError('Duplicate label '+label)
     labels[label]=pc
    if not line:continue
   fields=line.split(None,1);name=fields[0].upper();arg=fields[1] if len(fields)>1 else ''
   if name=='.ORG':pc=value(arg,passno);continue
   if name in ('.BYTE','.WORD'):
    data=[]
    for expr in arg.split(','):
     v=value(expr,passno)
     if name=='.BYTE':
      if passno==2 and not 0<=v<=255:raise ValueError(f'Byte out of range on line {lineno}')
      data.append(v&255)
     else:data.extend((v&255,v>>8))
   else:
    mode,expr=operand_mode(name,arg);code=OP.get((name,mode))
    if code is None:raise ValueError(f'Unknown instruction line {lineno}: {line}')
    n=SIZES[mode];v=value(expr,passno);data=[code]
    if mode=='rel':
     offset=v-(pc+2)
     if passno==2 and not -128<=offset<=127:raise ValueError(f'Branch out of range at line {lineno}')
     data.append(offset&255)
    elif n>1:
     data.append(v&255)
     if n==3:data.append(v>>8)
   if passno==2:
    if pc<0xd000 or pc+len(data)>0x10000:raise ValueError('ROM bounds exceeded')
    image[pc-0xd000:pc-0xd000+len(data)]=bytes(data)
    listing.append(f'{pc:04X}  {bytes(data).hex(" ").upper():<30} {original}')
   pc+=len(data)
 (BASE/'color-music.rom').write_bytes(image)
 (BASE/'color-music.lst').write_text('\n'.join(listing)+'\n')
 (BASE/'rom-data.js').write_text('globalThis.ColorMusicROM = new Uint8Array('+json.dumps(list(image),separators=(',',':'))+');\n')
 print(f'Built {len(image)} bytes, reset ${labels["reset"]:04X}, tone ${labels["tone"]:04X}.')
 return labels
def bundle():
 html=(BASE/'index.html').read_text()
 for name in ('core.js','speaker.js','rom-data.js'):
  html=html.replace(f'<script src="{name}"></script>','<script>\n'+(BASE/name).read_text()+'\n</script>')
 output=BASE/'dist'
 output.mkdir(exist_ok=True)
 (output/'index.html').write_text(html)
 player=html.replace('</script></body></html>',"bootColorMusic();status('Color / Pulse is running. Click Play colors + music to enable the speaker.');\n</script></body></html>")
 (output/'color-music.html').write_text(player)
 (output/'.nojekyll').write_text('')
 for name in ('color-music.rom','color-music.asm','color-music-preview.wav'):
  (output/name).write_bytes((BASE/name).read_bytes())
if __name__=='__main__':
 assemble()
 bundle()
