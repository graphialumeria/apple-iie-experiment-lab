'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');const {AppleIIe,OPS,textAddress}=require('./core.js');const {renderSpeaker}=require('./speaker.js');
const rom=fs.readFileSync(__dirname+'/color-music.rom');assert.equal(rom.length,12288);const m=new AppleIIe();m.main.fill(0xa5);m.aux.fill(0x5a);m.loadROM(rom);assert.equal(m.cpu.pc,0xd000);
const edges=[],notes=[],seen=new Set(),writes=new Set();let note=null;const originalWrite=m.write.bind(m);m.write=(a,v)=>{writes.add(a);originalWrite(a,v);};m.onSpeaker=(cycle,level)=>{edges.push([cycle,level]);if(note)note.edges.push(cycle);};
const palette=[1,9,13,12,4,14,6,2,3,7,15,11,10,5,8,0];
while(m.cpu.cycles<9*1020484){
 const op=m.read(m.cpu.pc);seen.add(op);assert.ok(OPS[op],'Only documented NMOS opcodes');
 if(m.cpu.pc===0xd200&&(!note||note.index!==m.main[7]||note.phase!==m.main[2])){
  note={index:m.main[7],phase:m.main[2],pattern:m.main[4],start:m.cpu.cycles,edges:[]};notes.push(note);
  assert.equal(m.text,false);assert.equal(m.mixed,false);assert.equal(m.hires,false);assert.equal(m.col80,false);assert.equal(m.page2,false);assert.equal(m.lcRead,false);
  for(let row=0;row<24;row++)for(let col=0;col<40;col++){
   const r=Math.floor(row/4),c=Math.floor(col/5);const idx=((note.pattern===0?r+c:note.pattern===1?c:r)+note.phase)&15;
   assert.equal(m.main[textAddress(row,col)],palette[idx]*17,`screen row ${row} col ${col} note ${note.index}`);
  }
 }
 m.cpu.step();
}
assert.ok(notes.length>32,'Melody wraps and keeps playing');assert.deepEqual([...new Set(notes.map(n=>n.pattern))].sort(),[0,1,2]);
for(const n of notes.slice(0,32)){
 const intervals=n.edges.slice(1).map((cycle,i)=>cycle-n.edges[i]).sort((a,b)=>a-b);const median=intervals[Math.floor(intervals.length/2)];n.hz=1020484/(2*median);const length=n.edges.length;assert.equal(length%2,0,'Even edge count returns speaker to initial level');assert.ok(length>=150&&length<=450);const duration=(n.edges.at(-1)-n.edges[0])/1020484;assert.ok(duration>.195&&duration<.205,'Steady 200 ms tones');
}
const midi=[72,76,79,84,83,79,76,79,69,72,76,81,79,76,72,76,77,69,72,77,76,72,69,72,67,71,74,79,77,74,71,67];notes.slice(0,32).forEach((n,i)=>assert.ok(Math.abs(n.hz/(440*2**((midi[i]-69)/12))-1)<.008,'Pitch within 0.8%'));
assert.ok([...writes].every(a=>a<0x800||[0xc000,0xc002,0xc004,0xc008,0xc00c].includes(a)),'Only zero page, stack, main display and memory switches are written');
const test=renderSpeaker([[0,1],[5,0]],0,10,2,10,0);assert.deepEqual([...test.samples],[1,-1]);const fractional=renderSpeaker([[2,1],[4,0]],0,5,1,5,0);assert.ok(Math.abs(fractional.samples[0]+.2)<1e-6,'Audio averages partial-sample edges');
// A listening preview is rendered from actual emulated speaker accesses.
const end=8*1020484,events=edges.filter(([cycle])=>cycle<end);const {samples}=renderSpeaker(events,0,end,44100,1020484,0);const wav=Buffer.alloc(44+samples.length*2);wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(44100,24);wav.writeUInt32LE(88200,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples.length*2,40);let prev=0,out=0;for(let i=0;i<samples.length;i++){out=.994*(out+samples[i]-prev);prev=samples[i];wav.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(out*6000))),44+i*2);}fs.writeFileSync(__dirname+'/color-music-preview.wav',wav);
console.log(`PASS ROM reset, ${seen.size} official opcodes, ${notes.length} notes, all 3 complete screen layouts, repeating melody, pitch/duration, hardware write bounds, speaker waveform averaging.`);
console.log('PASS 8-second WAV preview generated from ROM speaker transitions.');
