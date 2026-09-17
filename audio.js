(function(root){
'use strict';
class Pronunciation {
  constructor(settings,onStatus=()=>{}){this.settings=settings;this.onStatus=onStatus;this.player=new Audio();this.sequence=0;this.voices=[];this.refreshVoices();if('speechSynthesis'in root)root.speechSynthesis.addEventListener('voiceschanged',()=>{this.refreshVoices();root.dispatchEvent(new Event('spanish-voices-ready'));});}
  refreshVoices(){this.voices='speechSynthesis'in root?root.speechSynthesis.getVoices():[];}
  stop(){this.sequence++;this.player.pause();this.player.removeAttribute('src');if('speechSynthesis'in root)root.speechSynthesis.cancel();}
  speak(phrase,side='es',force=false){
    if(!phrase||(!this.settings().audio&&!force))return;
    this.stop();const token=this.sequence,settings=this.settings(),clip=root.SPANISH_AUDIO?.[phrase.id];
    if(side==='es'&&settings.voiceEs==='recorded'&&clip){
      this.player.src=clip;this.player.playbackRate=settings.rate;this.player.onended=()=>{if(token===this.sequence)this.onStatus('Ready. Tap any phrase to hear it.');};
      this.player.play().then(()=>{if(token===this.sequence)this.onStatus('Playing recorded Spanish.');}).catch(()=>{if(token===this.sequence)this.device(phrase,side,token,'Recording unavailable; using device Spanish.');});return;
    }
    this.device(phrase,side,token,side==='es'&&settings.voiceEs==='recorded'?'Using device Spanish while this recording is unavailable.':null);
  }
  device(phrase,side,token,status){
    if(!('speechSynthesis'in root)){this.onStatus('Device speech is unavailable. Spanish recordings still play when available.');return;}
    this.refreshVoices();const settings=this.settings(),preference=side==='es'?settings.voiceEs:settings.voiceEn;
    const list=this.voices.filter(v=>v.lang.startsWith(side));
    const voice=list.find(v=>v.voiceURI===preference)||list.find(v=>/Natural|Premium|Enhanced|Google|Online/i.test(v.name))||list.find(v=>v.name===(side==='es'?'Paulina':'Samantha'))||list.find(v=>v.lang===(side==='es'?'es-MX':'en-US'))||list[0];
    const text=phrase[side].replace(/\s*\((?:one person|plural|singular|informal|formal)[^)]*\)/gi,'');
    const utterance=new SpeechSynthesisUtterance(text);utterance.lang=voice?.lang||(side==='es'?'es-MX':'en-US');if(voice)utterance.voice=voice;utterance.rate=settings.rate;utterance.onstart=()=>{if(token===this.sequence)this.onStatus(status||`Playing ${side==='es'?'Spanish':'English'} device voice.`);};
    utterance.onerror=e=>{if(token===this.sequence&&!['interrupted','canceled'].includes(e.error))this.onStatus('Device voice could not play. Try another voice in Audio settings.');};
    root.speechSynthesis.speak(utterance);
  }
}
root.Pronunciation=Pronunciation;
})(window);
