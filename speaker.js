/* The browser audio backend consumes CPU-timed speaker edges, not a MIDI melody. */
(function(root){
'use strict';
function renderSpeaker(events,start,end,rate,clock,initial=0){
 const count=Math.max(1,Math.round((end-start)*rate/clock));const samples=new Float32Array(count);let event=0,level=initial;
 // Average each sample's high/low time, including edges within that sample.
 for(let i=0;i<count;i++){
  const left=start+(end-start)*i/count,right=start+(end-start)*(i+1)/count;let cursor=left,total=0;
  while(event<events.length&&events[event][0]<=left)level=events[event++][1];
  while(event<events.length&&events[event][0]<right){const [cycle,next]=events[event++];total+=(cycle-cursor)*(level?1:-1);cursor=cycle;level=next;}
  total+=(right-cursor)*(level?1:-1);samples[i]=total/(right-left);
 }
 while(event<events.length)level=events[event++][1];return {samples,level};
}
class SpeakerAudio{
 constructor(){this.enabled=false;this.context=null;this.sources=new Set();this.next=0;}
 async enable(){const AudioContext=root.AudioContext||root.webkitAudioContext;if(!AudioContext)throw Error('Web Audio is unavailable in this browser.');if(!this.context){this.context=new AudioContext();this.gain=this.context.createGain();this.gain.gain.value=0.10;const high=this.context.createBiquadFilter();high.type='highpass';high.frequency.value=40;const low=this.context.createBiquadFilter();low.type='lowpass';low.frequency.value=6000;high.connect(low);low.connect(this.gain);this.gain.connect(this.context.destination);this.input=high;}await this.context.resume();if(this.context.state!=='running')throw Error('Click Sound on to allow browser audio.');this.enabled=true;this.flush();}
 flush(){for(const source of this.sources){try{source.stop();}catch{}}this.sources.clear();this.next=0;}
 disable(){this.enabled=false;this.flush();}
 play(events,start,end,clock,initial){if(!this.enabled||!this.context||end<=start)return;const ctx=this.context;if(ctx.state!=='running')return;const {samples}=renderSpeaker(events,start,end,ctx.sampleRate,clock,initial);const buffer=ctx.createBuffer(1,samples.length,ctx.sampleRate);buffer.getChannelData(0).set(samples);const source=ctx.createBufferSource();source.buffer=buffer;source.connect(this.input);if(this.next>ctx.currentTime+0.25)this.flush();this.next=Math.max(this.next,ctx.currentTime+0.04);this.sources.add(source);source.onended=()=>{this.sources.delete(source);source.disconnect();};source.start(this.next);this.next+=buffer.duration;}
}
const api={renderSpeaker,SpeakerAudio};root.AppleSpeaker=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
