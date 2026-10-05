/* Original NMOS 6502 and an experimental Apple IIe memory/display bus. */
(function(root){
'use strict';
const C=1,Z=2,I=4,D=8,B=16,U=32,V=64,N=128;
const OPS=Array(256);
function group(name,modes,codes,cycles,extra=false){codes.split(' ').forEach((h,i)=>OPS[parseInt(h,16)]={name,mode:modes.split(' ')[i],cycles:cycles[i],extra});}
const readModes='ix zp imm abs iy zx ay ax';
for(const [n,c] of [['ORA','01 05 09 0d 11 15 19 1d'],['AND','21 25 29 2d 31 35 39 3d'],['EOR','41 45 49 4d 51 55 59 5d'],['ADC','61 65 69 6d 71 75 79 7d'],['LDA','a1 a5 a9 ad b1 b5 b9 bd'],['CMP','c1 c5 c9 cd d1 d5 d9 dd'],['SBC','e1 e5 e9 ed f1 f5 f9 fd']])group(n,readModes,c,[6,3,2,4,5,4,4,4],true);
group('STA','ix zp abs iy zx ay ax','81 85 8d 91 95 99 9d',[6,3,4,6,4,5,5]);
for(const [n,c] of [['ASL','0a 06 0e 16 1e'],['ROL','2a 26 2e 36 3e'],['LSR','4a 46 4e 56 5e'],['ROR','6a 66 6e 76 7e']])group(n,'acc zp abs zx ax',c,[2,5,6,6,7]);
for(const [n,c] of [['DEC','c6 ce d6 de'],['INC','e6 ee f6 fe']])group(n,'zp abs zx ax',c,[5,6,6,7]);
group('LDX','imm zp abs zy ay','a2 a6 ae b6 be',[2,3,4,4,4],true);
group('LDY','imm zp abs zx ax','a0 a4 ac b4 bc',[2,3,4,4,4],true);
group('STX','zp abs zy','86 8e 96',[3,4,4]);group('STY','zp abs zx','84 8c 94',[3,4,4]);
group('CPX','imm zp abs','e0 e4 ec',[2,3,4]);group('CPY','imm zp abs','c0 c4 cc',[2,3,4]);group('BIT','zp abs','24 2c',[3,4]);
for(const [n,h] of [['BPL','10'],['BMI','30'],['BVC','50'],['BVS','70'],['BCC','90'],['BCS','b0'],['BNE','d0'],['BEQ','f0']])group(n,'rel',h,[2]);
for(const [n,h,cy] of [['BRK','00',7],['PHP','08',3],['CLC','18',2],['JSR','20',6],['PLP','28',4],['SEC','38',2],['RTI','40',6],['PHA','48',3],['CLI','58',2],['RTS','60',6],['PLA','68',4],['SEI','78',2],['DEY','88',2],['TXA','8a',2],['TYA','98',2],['TXS','9a',2],['TAY','a8',2],['TAX','aa',2],['CLV','b8',2],['TSX','ba',2],['INY','c8',2],['DEX','ca',2],['CLD','d8',2],['INX','e8',2],['NOP','ea',2],['SED','f8',2]])group(n,n==='JSR'?'abs':'imp',h,[cy]);
group('JMP','abs ind','4c 6c',[3,5]);
class CPU6502{
 constructor(bus){this.bus=bus;this.a=this.x=this.y=0;this.sp=0xfd;this.p=U|I;this.pc=0;this.cycles=0;}
 r(a){return this.bus.read(a&65535);} w(a,v){this.bus.write(a&65535,v&255);} fetch(){const v=this.r(this.pc);this.pc=(this.pc+1)&65535;return v;} word(){const lo=this.fetch();return lo|(this.fetch()<<8);} push(v){this.w(0x100|this.sp,v);this.sp=(this.sp-1)&255;} pop(){this.sp=(this.sp+1)&255;return this.r(0x100|this.sp);}
 flag(f,v){this.p=v?this.p|f:this.p&~f;} nz(v){v&=255;this.flag(Z,v===0);this.flag(N,v&128);return v;}
 reset(){this.sp=0xfd;this.p=U|I;this.pc=this.r(0xfffc)|(this.r(0xfffd)<<8);this.cycles=7;}
 interrupt(vector=0xfffe){if(vector===0xfffe&&(this.p&I))return 0;this.push(this.pc>>8);this.push(this.pc);this.push((this.p&~B)|U);this.p|=I;this.pc=this.r(vector)|(this.r(vector+1)<<8);this.cycles+=7;return 7;}
 adc(v){const a=this.a,c=this.p&C;let sum=a+v+c;if(this.p&D){let lo=(a&15)+(v&15)+c;if(lo>9)lo+=6;let hi=(a>>4)+(v>>4)+(lo>15?1:0);this.flag(Z,(sum&255)===0);this.flag(N,hi&8);this.flag(V,(~(a^v)&(a^(hi<<4))&128));if(hi>9)hi+=6;this.flag(C,hi>15);this.a=((hi<<4)|(lo&15))&255;}else{this.flag(V,~(a^v)&(a^sum)&128);this.flag(C,sum>255);this.a=this.nz(sum);}}
 sbc(v){const a=this.a,borrow=(this.p&C)?0:1;const diff=a-v-borrow;this.flag(V,(a^v)&(a^diff)&128);this.flag(C,diff>=0);this.nz(diff);if(this.p&D){let lo=(a&15)-(v&15)-borrow,hi=(a>>4)-(v>>4);if(lo<0){lo-=6;hi--;}if(hi<0)hi-=6;this.a=((hi<<4)|(lo&15))&255;}else this.a=diff&255;}
 step(){const at=this.pc,op=this.fetch(),o=OPS[op];if(!o)throw new Error('Unsupported opcode $'+op.toString(16).padStart(2,'0')+' at $'+at.toString(16).padStart(4,'0'));let addr=0,base=0,cross=false,cy=o.cycles;
 switch(o.mode){case'imm':addr=this.pc;this.pc=(this.pc+1)&65535;break;case'zp':addr=this.fetch();break;case'zx':addr=(this.fetch()+this.x)&255;break;case'zy':addr=(this.fetch()+this.y)&255;break;case'abs':addr=this.word();break;case'ax':case'ay':base=this.word();addr=(base+(o.mode==='ax'?this.x:this.y))&65535;cross=(base&0xff00)!==(addr&0xff00);break;case'ix':base=(this.fetch()+this.x)&255;addr=this.r(base)|(this.r((base+1)&255)<<8);break;case'iy':base=this.fetch();base=this.r(base)|(this.r((base+1)&255)<<8);addr=(base+this.y)&65535;cross=(base&0xff00)!==(addr&0xff00);break;case'ind':base=this.word();addr=this.r(base)|(this.r((base&0xff00)|((base+1)&255))<<8);break;case'rel':base=this.fetch();addr=(this.pc+(base<128?base:base-256))&65535;break;}
 if(o.extra&&cross)cy++;const name=o.name;let v;
 if(['ORA','AND','EOR','ADC','SBC','LDA','LDX','LDY','CMP','CPX','CPY','BIT','ASL','LSR','ROL','ROR','INC','DEC'].includes(name))v=o.mode==='acc'?this.a:this.r(addr);
 const compare=(a,b)=>{this.flag(C,a>=b);this.nz(a-b);};
 switch(name){case'ORA':this.a=this.nz(this.a|v);break;case'AND':this.a=this.nz(this.a&v);break;case'EOR':this.a=this.nz(this.a^v);break;case'ADC':this.adc(v);break;case'SBC':this.sbc(v);break;case'LDA':this.a=this.nz(v);break;case'LDX':this.x=this.nz(v);break;case'LDY':this.y=this.nz(v);break;case'STA':this.w(addr,this.a);break;case'STX':this.w(addr,this.x);break;case'STY':this.w(addr,this.y);break;case'CMP':compare(this.a,v);break;case'CPX':compare(this.x,v);break;case'CPY':compare(this.y,v);break;case'BIT':this.flag(Z,(this.a&v)===0);this.flag(N,v&N);this.flag(V,v&V);break;
 case'ASL':case'LSR':case'ROL':case'ROR':case'INC':case'DEC':{let next;const carry=this.p&C;if(name==='ASL'){this.flag(C,v&128);next=v<<1;}if(name==='LSR'){this.flag(C,v&1);next=v>>1;}if(name==='ROL'){this.flag(C,v&128);next=(v<<1)|carry;}if(name==='ROR'){this.flag(C,v&1);next=(v>>1)|(carry<<7);}if(name==='INC')next=v+1;if(name==='DEC')next=v-1;next=this.nz(next);if(o.mode==='acc')this.a=next;else{this.w(addr,v);this.w(addr,next);}break;}
 case'JMP':this.pc=addr;break;case'JSR':base=(this.pc-1)&65535;this.push(base>>8);this.push(base);this.pc=addr;break;case'RTS':this.pc=((this.pop()|(this.pop()<<8))+1)&65535;break;case'RTI':this.p=(this.pop()&~B)|U;this.pc=this.pop()|(this.pop()<<8);break;case'BRK':this.pc=(this.pc+1)&65535;this.push(this.pc>>8);this.push(this.pc);this.push(this.p|B|U);this.p|=I;this.pc=this.r(0xfffe)|(this.r(0xffff)<<8);break;
 case'PHA':this.push(this.a);break;case'PHP':this.push(this.p|B|U);break;case'PLA':this.a=this.nz(this.pop());break;case'PLP':this.p=(this.pop()&~B)|U;break;
 case'CLC':this.p&=~C;break;case'SEC':this.p|=C;break;case'CLI':this.p&=~I;break;case'SEI':this.p|=I;break;case'CLD':this.p&=~D;break;case'SED':this.p|=D;break;case'CLV':this.p&=~V;break;
 case'TAX':this.x=this.nz(this.a);break;case'TAY':this.y=this.nz(this.a);break;case'TXA':this.a=this.nz(this.x);break;case'TYA':this.a=this.nz(this.y);break;case'TSX':this.x=this.nz(this.sp);break;case'TXS':this.sp=this.x;break;case'INX':this.x=this.nz(this.x+1);break;case'INY':this.y=this.nz(this.y+1);break;case'DEX':this.x=this.nz(this.x-1);break;case'DEY':this.y=this.nz(this.y-1);break;
 default:if(name!=='NOP'){const take={BPL:!(this.p&N),BMI:this.p&N,BVC:!(this.p&V),BVS:this.p&V,BCC:!(this.p&C),BCS:this.p&C,BNE:!(this.p&Z),BEQ:this.p&Z}[name];if(take){cy+=1+((this.pc&0xff00)!==(addr&0xff00)?1:0);this.pc=addr;}}}
 this.p=(this.p&~B)|U;this.cycles+=cy;return cy;
 }
}
const textAddress=(row,col,page=0x400)=>page+((row&7)<<7)+((row>>3)*40)+col;
class AppleIIe{
 constructor(){this.main=new Uint8Array(65536);this.aux=new Uint8Array(65536);this.rom=new Uint8Array(16384);this.lc=[new Uint8Array(0x4000),new Uint8Array(0x4000)];this.cpu=new CPU6502(this);this.resetSwitches();}
 resetSwitches(){Object.assign(this,{text:true,mixed:false,page2:false,hires:false,col80:false,store80:false,readAux:false,writeAux:false,altZp:false,altChar:false,intCx:true,slotC3:false,lcRead:false,lcWrite:false,lcPre:false,lcBank:1,key:0,speakerLevel:0});}
 bank(a,write=false){if(a<0x200)return this.altZp?this.aux:this.main;if(this.store80&&(a>=0x400&&a<0x800||this.hires&&a>=0x2000&&a<0x4000))return this.page2?this.aux:this.main;return (write?this.writeAux:this.readAux)?this.aux:this.main;}
 read(a){a&=65535;if(a>=0xc000&&a<0xc100)return this.io(a,false);if(a>=0xd000){if(this.lcRead)return this.lc[this.altZp?1:0][a<0xe000?(this.lcBank?0x1000:0)+(a-0xd000):a-0xc000];return this.rom[a-0xc000];}if(a>=0xc100)return this.rom[a-0xc000];return this.bank(a)[a];}
 write(a,v){a&=65535;v&=255;if(a>=0xc000&&a<0xc100){this.io(a,true,v);return;}if(a>=0xd000&&this.lcWrite){this.lc[this.altZp?1:0][a<0xe000?(this.lcBank?0x1000:0)+(a-0xd000):a-0xc000]=v;return;}if(a<0xc000)this.bank(a,true)[a]=v;}
 io(a,write,v=0){const n=a&255;if(write&&n<16){const fields=['store80','readAux','writeAux','intCx','altZp','slotC3','col80','altChar'];this[fields[n>>1]]=!!(n&1);return 0;}
 if(n===0x30){this.speakerLevel^=1;if(this.onSpeaker)this.onSpeaker(this.cpu.cycles,this.speakerLevel);return 0;}
 if(n===0)return this.key;if(n===0x10){this.key&=127;return this.key;}
 const statuses={0x11:this.lcBank===1,0x12:this.lcRead,0x13:this.readAux,0x14:this.writeAux,0x15:this.intCx,0x16:this.altZp,0x17:this.slotC3,0x18:this.store80,0x1a:this.text,0x1b:this.mixed,0x1c:this.page2,0x1d:this.hires,0x1e:this.altChar,0x1f:this.col80};if(n in statuses)return (this.key&127)|(statuses[n]?128:0);
 if(n>=0x50&&n<=0x57){const fields=['text','mixed','page2','hires'];this[fields[(n-0x50)>>1]]=!!(n&1);return 0;}
 if(n>=0x80&&n<=0x8f){this.lcBank=(n&8)?0:1;const mode=n&3;this.lcRead=mode===0||mode===3;if(n&1){if(!write&&this.lcPre)this.lcWrite=true;this.lcPre=!write;}else{this.lcWrite=false;this.lcPre=false;}return 0;}
 return 0;
 }
 keypress(code){this.key=(code&127)|128;}
 loadROM(bytes){if(bytes.length!==0x4000&&bytes.length!==0x3000)throw Error('Use a 16 KB ROM ($C000–$FFFF) or 12 KB ROM ($D000–$FFFF).');this.rom.fill(0);this.rom.set(bytes,0x4000-bytes.length);this.resetSwitches();this.cpu.reset();}
 demo(){this.main.fill(0);this.aux.fill(0);this.resetSwitches();for(let r=0;r<24;r++)for(let c=0;c<40;c++)this.main[textAddress(r,c)]=0xa0;
 const lines=['APPLE //E   EXPERIMENT LAB','','A REAL 6502 IS RUNNING THIS SCREEN.','','TYPE SOMETHING. WATCH MEMORY CHANGE.','','PAUSE + STEP TO EXPLORE INSTRUCTIONS.','','TRY THE GRAPHICS BUTTONS BELOW.'];lines.forEach((s,r)=>[...s].forEach((ch,c)=>this.main[textAddress(r,c)]=ch.charCodeAt(0)|128));
 // Poll keyboard, acknowledge its strobe, and write a wrapping line in text RAM.
 this.main.set([0xa2,0x00,0xad,0x00,0xc0,0x10,0xfb,0x8d,0x10,0xc0,0x9d,0x28,0x06,0xe8,0xe0,0x28,0xd0,0xf0,0xa2,0x00,0x4c,0x02,0x08],0x800);this.cpu.reset();this.cpu.pc=0x800;this.cpu.a=this.cpu.x=this.cpu.y=0;
 }
 graphics(kind){this.text=false;this.mixed=true;this.hires=kind==='hires';this.page2=false;for(let y=0;y<160;y++){if(this.hires){const base=0x2000+((y&7)<<10)+(((y>>3)&7)<<7)+(Math.floor(y/64)*40);for(let x=0;x<40;x++)this.main[base+x]=((x+Math.floor(y/8))%2)?0x55:0x2a;}else if(y<48){for(let x=0;x<40;x++){const a=textAddress(y>>1,x),color=(x+Math.floor(y/3))%16;this.main[a]=(y&1)?(this.main[a]&15)|(color<<4):(this.main[a]&240)|color;}}}}
}
const api={CPU6502,AppleIIe,OPS,textAddress};if(typeof module!=='undefined')module.exports=api;root.AppleEmulator=api;
})(typeof globalThis!=='undefined'?globalThis:this);
