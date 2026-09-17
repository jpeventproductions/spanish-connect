(function(){
'use strict';
const E=window.SpanishEngine,phrases=window.SPANISH_PHRASES,$=id=>document.getElementById(id);
const categories={connectors:'Connecting words',patterns:'Word endings',present:'Present tense',past:'Past tense',future:'Future tense',everyday:'Everyday phrases',mixed:'All phrases',review:'Retry bucket'};
const key='spanish-connect-v1';
const fresh=()=>({version:2,progress:{},history:[],matchLog:[],attempts:0,correct:0,topic:'connectors',duration:60,audio:true,voiceEs:'auto',voiceEn:'auto',rate:1,activeIds:[]});
let saved=fresh(),session,phase='ready',lockedUntil=0,transitionAt=0,serial=0,lastPhrase=null,storageOK=true,missStreak=0;
if(!E||!Array.isArray(phrases)||phrases.length!==300){$('board').textContent='Phrase files did not load. Reload the page.';$('next-round').disabled=true;return;}
const byId=new Map(phrases.map(p=>[p.id,p]));
const nonnegative=(n,fallback=0)=>Number.isFinite(n)&&n>=0?n:fallback;
function sanitize(raw){
  if(!raw||![1,2].includes(raw.version)||typeof raw.progress!=='object'||!raw.progress||!Array.isArray(raw.history))throw new Error('Choose a Spanish Connect progress file.');
  const value=fresh();
  for(const p of phrases){const v=raw.progress[p.id];if(!v||typeof v!=='object')continue;if((v.revision||1)!==(p.revision||1))continue;value.progress[p.id]={clean:!!v.clean,needsReview:!!v.needsReview,lastSeen:nonnegative(v.lastSeen),revision:p.revision||1,bestMs:Number.isFinite(v.bestMs)?nonnegative(v.bestMs):null,lastMs:Number.isFinite(v.lastMs)?nonnegative(v.lastMs):null};}
  value.history=raw.history.filter(h=>h&&Number.isFinite(h.at)&&Number.isInteger(h.clean)&&h.clean>=0&&h.clean<=300&&Number.isInteger(h.matched)&&h.matched>=0&&h.matched<=300&&Number.isFinite(h.seconds)).slice(-5000).map(h=>({at:h.at,clean:h.clean,matched:h.matched,seconds:Math.min(90,nonnegative(h.seconds)),avgMs:Number.isFinite(h.avgMs)?nonnegative(h.avgMs):null,pace:Number.isFinite(h.pace)?nonnegative(h.pace):null,words:nonnegative(h.words),reason:String(h.reason||'completed').slice(0,30),topic:Object.hasOwn(categories,h.topic)?h.topic:'mixed'}));
  value.matchLog=Array.isArray(raw.matchLog)?raw.matchLog.filter(m=>m&&byId.has(m.id)&&Number.isFinite(m.at)&&Number.isFinite(m.ms)&&m.ms>=0).slice(-10000).map(m=>({id:m.id,at:m.at,ms:m.ms,clean:!!m.clean,words:nonnegative(m.words)})):[];
  value.attempts=Number.isSafeInteger(raw.attempts)?Math.max(0,raw.attempts):0;value.correct=Number.isSafeInteger(raw.correct)?Math.max(0,Math.min(value.attempts,raw.correct)):0;
  value.topic=Object.hasOwn(categories,raw.topic)?raw.topic:'connectors';value.duration=Number.isInteger(raw.duration)&&raw.duration>=20&&raw.duration<=90&&raw.duration%5===0?raw.duration:60;
  // Upgrade defaults to audio on: pronunciation is now part of every card tap.
  value.audio=raw.version===1?true:raw.audio!==false;value.voiceEs=typeof raw.voiceEs==='string'&&raw.voiceEs!=='recorded'?raw.voiceEs:'auto';value.voiceEn=typeof raw.voiceEn==='string'?raw.voiceEn:'auto';value.rate=[.8,1,1.1].includes(raw.rate)?raw.rate:1;
  value.activeIds=Array.isArray(raw.activeIds)?[...new Set(raw.activeIds.filter(id=>byId.has(id)))]:[];
  return value;
}
try{const raw=localStorage.getItem(key);if(raw)saved=sanitize(JSON.parse(raw));}catch(_){storageOK=false;}
function markReview(id){const p=byId.get(id);if(p)saved.progress[id]={...saved.progress[id],clean:false,needsReview:true,lastSeen:Date.now(),revision:p.revision||1};}
for(const id of saved.activeIds)markReview(id);saved.activeIds=[];
function persist(){try{localStorage.setItem(key,JSON.stringify(saved));}catch(_){storageOK=false;}if(!storageOK)$('save-note').textContent='Progress could not be saved in this browser. Export a backup before closing.';}
const sound=new window.Pronunciation(()=>saved,message=>{$('audio-status').textContent=message;});
const cleanCount=()=>Object.values(saved.progress).filter(p=>p.clean&&!p.needsReview).length;
const retries=()=>phrases.filter(p=>saved.progress[p.id]?.needsReview);
const secondsLabel=ms=>`${(ms/1000).toFixed(1)}s`;
function feedback(title,note,type=''){$('feedback').className=`feedback ${type}`;$('feedback-title').textContent=title;$('feedback-note').textContent=note;document.querySelector('.feedback-icon').src=`assets/icons/${type==='error'?'retry':type==='success'?'check':'arrow'}.svg`;}
function eligible(){const selected=phrases.filter(p=>saved.topic==='mixed'||(saved.topic==='review'?saved.progress[p.id]?.needsReview:p.category===saved.topic));return [...new Map([...retries(),...selected].map(p=>[p.id,p])).values()];}
function setup(auto=false){
  serial++;missStreak=0;phase='ready';lockedUntil=0;lastPhrase=null;$('listen').hidden=true;session=E.createSession(E.chooseRound(eligible(),saved.progress));session.limit=saved.duration;
  $('round-title').textContent=categories[saved.topic];$('round-number').textContent=`Round ${saved.history.length+1}`;$('round-summary').textContent='Match as many as you can before time runs out.';
  $('adaptive-note').textContent=`Target: 6+ correct matches, no mistakes. A successful round removes 5 seconds from the next limit (minimum 20s).`;
  const retryCount=session.items.filter(p=>saved.progress[p.id]?.needsReview).length;
  $('instruction').textContent=`${retryCount?`${retryCount} retry ${retryCount===1?'pair':'pairs'} first. `:''}Six pairs on the board. Spanish positions shuffle after each match.`;
  feedback('Ready',`Start a ${saved.duration}-second round. Each tap plays that card’s pronunciation.`);
  if(!session.items.length)feedback('Retry bucket is empty','Choose another practice set.');
  renderBoard();controls();updateMetrics();if(auto&&session.items.length)start();
}
function phraseText(button,p,side){
  const text=document.createElement('span');text.className='phrase-text';const focus=p.focus?.[side],at=focus?p[side].toLocaleLowerCase().indexOf(focus.toLocaleLowerCase()):-1;
  if(at>=0){text.append(document.createTextNode(p[side].slice(0,at)));const mark=document.createElement('mark');mark.textContent=p[side].slice(at,at+focus.length);text.append(mark,document.createTextNode(p[side].slice(at+focus.length)));}else text.textContent=p[side];
  const img=document.createElement('img');img.src='assets/icons/volume.svg';img.alt='';img.className='card-speaker';button.append(text,img);
}
function renderBoard(){
  const board=$('board');board.replaceChildren();
  if(!session.items.length&&phase==='ready'){const empty=document.createElement('p');empty.className='empty-state';empty.textContent='No phrases to retry. Choose a practice set above.';board.append(empty);}
  else for(let i=0;i<session.left.length;i++)for(const[side,items]of[['en',session.left],['es',session.right]]){
    const p=items[i];if(!p){const empty=document.createElement('div');empty.className='phrase-tile pending';empty.textContent='Set completed';board.append(empty);continue;}
    const button=document.createElement('button');button.className='phrase-tile';button.dataset.id=p.id;button.dataset.side=side;button.lang=side;button.setAttribute('aria-label',p[side]);button.setAttribute('aria-pressed','false');phraseText(button,p,side);board.append(button);
  }
  drawState();
}
function drawState(){
  for(const b of $('board').querySelectorAll('button')){const matched=session.matched.includes(b.dataset.id),selected=session.selected?.id===b.dataset.id&&session.selected?.side===b.dataset.side;b.classList.toggle('matched',matched);b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));b.disabled=matched;}
  $('board').classList.toggle('is-paused',phase==='paused');
}
function buttonContent(id,icon,text){const b=$(id);b.replaceChildren();const img=document.createElement('img');img.src=`assets/icons/${icon}.svg`;img.alt='';const span=document.createElement('span');span.textContent=text;b.append(img,span);}
function controls(){
  const playing=phase==='playing',paused=phase==='paused';$('topic').disabled=playing;$('duration').disabled=playing;
  $('pause').hidden=!['playing','paused','transition'].includes(phase);buttonContent('pause',paused?'play':'pause',paused?'Resume':phase==='transition'?'Stop auto-play':'Pause');
  $('next-round').disabled=playing||(!session.items.length&&phase==='ready');buttonContent('next-round',phase==='ready'||paused?'play':'arrow',phase==='ready'?'Start round':paused?'Resume':'Next round');
}
function roundElapsed(){return Math.min(session.limit*1000,E.elapsed(session,Date.now()));}
function updateMetrics(){
  const elapsed=roundElapsed(),remaining=Math.max(0,session.limit*1000-elapsed),sec=Math.ceil(remaining/1000),matches=session.matches;
  $('timer').textContent=`${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;$('timer').classList.toggle('urgent',sec<=10&&phase==='playing');$('timer-label').textContent=phase==='playing'?'remaining':phase==='paused'?'paused':phase==='ready'?'ready':'finished';
  const track=document.querySelector('[role=progressbar]');track.setAttribute('aria-valuemax',session.limit);track.setAttribute('aria-valuenow',sec);track.classList.toggle('urgent',sec<=10&&phase==='playing');$('progress-fill').style.width=`${remaining/session.limit/10}%`;
  $('match-count').textContent=matches.length;$('match-speed').textContent=matches.length?(matches.reduce((n,m)=>n+m.ms,0)/matches.length/1000).toFixed(1):'—';
  $('pace').textContent=elapsed>0?(matches.length*60000/elapsed).toFixed(1):'0.0';$('word-pace').textContent=elapsed>0?Math.round(matches.reduce((n,m)=>n+m.words,0)*60000/elapsed):0;
  $('last-time').textContent=matches.length?secondsLabel(matches.at(-1).ms):'—';$('round-accuracy').textContent=session.attempts?`${Math.round(matches.length/session.attempts*100)}%`:'—';
}
function stats(){
  const review=retries();$('learned').textContent=cleanCount();$('total-fill').style.width=`${cleanCount()/3}%`;$('accuracy').textContent=saved.attempts?`${Math.round(saved.correct/saved.attempts*100)}%`:'—';$('review-count').textContent=review.length;$('retry-list').replaceChildren();
  for(const p of review.slice(0,3)){const row=document.createElement('div');row.className='retry-row';row.lang='es';row.textContent=p.es;$('retry-list').append(row);}if(review.length>3){const more=document.createElement('div');more.className='retry-more';more.textContent=`+ ${review.length-3} more`;$('retry-list').append(more);}
}
function syncPending(){saved.activeIds=session.items.filter(p=>!session.matched.includes(p.id)).map(p=>p.id);}
function start(){
  if(!session.items.length)return;phase='playing';E.resume(session,Date.now());syncPending();persist();drawState();controls();updateMetrics();feedback('Match the translation','Each correct pair is replaced. Missed pairs stay in the retry bucket.');
}
function pause(){
  if(phase==='playing'){if(roundElapsed()>=session.limit*1000){finish('time');return;}E.pause(session,Date.now());phase='paused';session.selected=null;sound.stop();feedback('Paused','Match timing and the round timer are paused.');}
  else if(phase==='paused'){start();return;}else if(phase==='transition'){phase='finished';$('round-summary').textContent='Auto-play stopped.';}
  controls();drawState();updateMetrics();
}
function finish(reason){
  if(!['playing','paused'].includes(phase))return;
  const elapsed=roundElapsed();E.pause(session,Date.now());session.elapsedMs=elapsed;
  if(reason!=='mastered')for(const p of session.items)if(!session.matched.includes(p.id))markReview(p.id);
  saved.activeIds=[];const matches=session.matches;const targetMet=matches.length>=6&&session.attempts===matches.length;const nextSeconds=E.nextLimit(session.limit,matches.length,session.attempts);saved.duration=nextSeconds;$('duration').value=nextSeconds;
  saved.history.push({at:Date.now(),clean:cleanCount(),matched:matches.length,seconds:elapsed/1000,avgMs:matches.length?matches.reduce((n,m)=>n+m.ms,0)/matches.length:null,pace:elapsed?matches.length*60000/elapsed:0,words:matches.reduce((n,m)=>n+m.words,0),reason,topic:saved.topic,limit:session.limit,nextLimit:nextSeconds,targetMet});saved.history=saved.history.slice(-5000);
  persist();stats();chart();historyTables();phase='finished';transitionAt=0;session.selected=null;controls();drawState();updateMetrics();
  feedback(reason==='time'?'Time is up':reason==='changed'?'Round saved':'Set completed',`${matches.length} correct ${matches.length===1?'match':'matches'} · ${elapsed?(matches.length*60000/elapsed).toFixed(1):0} per minute. ${retries().length} phrases to retry.`,'success');
  if(reason!=='changed')showResults(reason,targetMet,nextSeconds);
}
function showResults(reason,targetMet,nextSeconds){
  const mastered=cleanCount()===300;
  $('result-status').textContent=mastered?'ALL PHRASES MATCHED':targetMet?'TARGET MET':'TARGET NOT MET';
  $('result-title').textContent=mastered?'300 / 300 completed':targetMet?'Round complete':'Round incomplete';
  $('result-matches').textContent=session.matches.length;
  $('result-accuracy').textContent=session.attempts?`${Math.round(session.matches.length/session.attempts*100)}%`:'—';
  $('result-time').textContent=session.matches.length?secondsLabel(session.matches.reduce((n,m)=>n+m.ms,0)/session.matches.length):'—';
  $('result-retries').textContent=retries().length;
  $('result-next').textContent=targetMet?(nextSeconds<session.limit?`Next round: ${nextSeconds} seconds (5 seconds shorter).`:`Next round: ${nextSeconds} seconds. You are at the fastest level.`):(nextSeconds===20?'Next round: 20 seconds. Aim for at least 6 matches with no mistakes.':`Next round: ${nextSeconds} seconds. Match at least 6 phrases with no mistakes to shorten it.`);
  $('result-note').textContent=mastered?'All 300 phrases have a clean match. You can continue to improve your speed.':'Your progress and individual match times are saved. Retry phrases take priority next round.';
  $('results-dialog').classList.toggle('target-met',targetMet||mastered);$('results-dialog').showModal();
}
function performMatch(tile){
  const id=tile.dataset.id,side=tile.dataset.side,p=byId.get(id);
  sound.speak(p,side); // Pronunciation also works before a round and while paused.
  if(phase!=='playing'||Date.now()<lockedUntil)return;
  if(roundElapsed()>=session.limit*1000){finish('time');return;}
  const result=E.selectTimed(session,side,id,Date.now());drawState();
  if(result.type==='selected'){feedback(session.selected?'Select its translation':'Selection cleared',session.selected?'Match timing continues until the correct pair is selected.':'Tap any phrase to select it.');return;}
  if(result.type==='ignored')return;
  saved.attempts++;
  if(result.type==='miss'){
    missStreak++;
    for(const choice of[result.first,result.second]){markReview(choice.id);const b=$('board').querySelector(`[data-id="${choice.id}"][data-side="${choice.side}"]`);b?.classList.add('wrong');}
    if(navigator.vibrate&&!matchMedia('(prefers-reduced-motion: reduce)').matches)navigator.vibrate([60,35,60]);
    lockedUntil=Date.now()+430;const currentSerial=serial;setTimeout(()=>{if(serial===currentSerial)for(const b of $('board').querySelectorAll('.wrong'))b.classList.remove('wrong');},440);
    feedback('Incorrect match','Both phrases were added to your retry bucket. Try again.','error');
    if(missStreak>=3){
      missStreak=0;const hintId=result.second.id;
      for(const b of $('board').querySelectorAll('button'))if(b.dataset.id===hintId)b.classList.add('hint');
      feedback('Hint: match the glowing pair',`${byId.get(hintId).en} = ${byId.get(hintId).es}`,'hint');
      setTimeout(()=>{if(serial===currentSerial)for(const b of $('board').querySelectorAll('.hint'))b.classList.remove('hint');},4000);
    }
  }else{
    missStreak=0;for(const b of $('board').querySelectorAll('.hint'))b.classList.remove('hint');
    saved.correct++;lastPhrase=p;$('listen').hidden=false;const record={...result.record,at:Date.now()};saved.matchLog.push(record);saved.matchLog=saved.matchLog.slice(-10000);
    const old=saved.progress[id]||{};saved.progress[id]={...old,lastSeen:record.at,clean:record.clean,needsReview:!record.clean,revision:p.revision||1,lastMs:record.ms,bestMs:record.clean?Math.min(old.bestMs??Infinity,record.ms):old.bestMs??null};
    syncPending();feedback(`${secondsLabel(record.ms)} · ${p.es}`,p.note,'success');const currentSerial=serial;
    setTimeout(()=>{
      if(serial!==currentSerial||!['playing','paused'].includes(phase))return;
      const active=document.activeElement,focusWasCard=active?.dataset?.id===id;
      E.replacePair(session,id,eligible(),saved.progress);renderBoard();syncPending();persist();
      if(focusWasCard)$('board').querySelector('button')?.focus({preventScroll:true});
      if(!session.items.length)finish('set-complete');
    },300);
    historyTables();
    if(cleanCount()===300)finish('mastered');
  }
  persist();stats();updateMetrics();
}
$('board').addEventListener('click',event=>{const tile=event.target.closest('button[data-id]');if(tile)performMatch(tile);});
$('result-next-round').addEventListener('click',()=>{$('results-dialog').close();setup(true);});$('result-review').addEventListener('click',()=>$('results-dialog').close());
$('next-round').addEventListener('click',()=>{if(['ready','paused'].includes(phase))start();else setup(true);});$('pause').addEventListener('click',pause);
$('topic').value=saved.topic;for(let limit=20;limit<=90;limit+=5){const option=document.createElement('option');option.value=limit;option.textContent=`${limit} seconds`;$('duration').append(option);}$('duration').value=saved.duration;
$('topic').addEventListener('change',()=>{if(phase==='paused')finish('changed');saved.topic=$('topic').value;persist();setup();});
$('duration').addEventListener('change',()=>{if(phase==='paused')finish('changed');saved.duration=Number($('duration').value);persist();setup();});
setInterval(()=>{if(phase==='playing'){updateMetrics();if(roundElapsed()>=session.limit*1000)finish('time');}else if(phase==='transition'){const n=Math.max(0,Math.ceil((transitionAt-Date.now())/1000));$('round-summary').textContent=`Next round in ${n}s · retries first`;if(!n&&!document.hidden&&!$('library-dialog').open&&!$('settings-dialog').open)setup(true);}},100);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&phase==='playing'&&roundElapsed()>=session.limit*1000)finish('time');});
function audioUI(){buttonContent('sound-toggle',saved.audio?'volume':'mute',saved.audio?'Sound on':'Sound off');$('sound-toggle').setAttribute('aria-pressed',String(saved.audio));$('audio-rate').value=saved.rate;$('audio-source').textContent='Spanish and English use your device’s voices. Tap a card to hear it. Voice quality depends on the voices installed on your device.';}
function voicesUI(){sound.refreshVoices();for(const[side,id,value]of[['es','voice-es',saved.voiceEs],['en','voice-en',saved.voiceEn]]){const select=$(id);select.replaceChildren();const auto=document.createElement('option');auto.value='auto';auto.textContent=side==='es'?'Automatic Spanish voice':'Automatic English voice';select.append(auto);for(const v of sound.voices.filter(v=>v.lang.startsWith(side))){const option=document.createElement('option');option.value=v.voiceURI;option.textContent=`${v.name} · ${v.lang}`;select.append(option);}select.value=[...select.options].some(o=>o.value===value)?value:auto.value;}}
$('sound-toggle').addEventListener('click',()=>{saved.audio=!saved.audio;if(!saved.audio)sound.stop();audioUI();persist();});$('listen').addEventListener('click',()=>sound.speak(lastPhrase,'es',true));
$('settings-open').addEventListener('click',()=>{if(phase==='playing'||phase==='transition')pause();voicesUI();$('settings-dialog').showModal();});$('settings-close').addEventListener('click',()=>$('settings-dialog').close());
$('voice-es').addEventListener('change',()=>{saved.voiceEs=$('voice-es').value;persist();});$('voice-en').addEventListener('change',()=>{saved.voiceEn=$('voice-en').value;persist();});$('audio-rate').addEventListener('change',()=>{saved.rate=Number($('audio-rate').value);persist();});$('voice-sample').addEventListener('click',()=>sound.speak(byId.get('c006'),'es',true));window.addEventListener('spanish-voices-ready',voicesUI);
function renderLibrary(){
  const q=E.normalize($('phrase-search').value),found=phrases.filter(p=>E.normalize(`${p.en} ${p.es} ${p.note} ${categories[p.category]}`).includes(q));$('library-count').textContent=`${found.length} of 300 phrases`;$('library-list').replaceChildren();
  for(const p of found){const article=document.createElement('article');article.className='library-item';const label=document.createElement('span');label.className='eyebrow';label.textContent=categories[p.category];const en=document.createElement('h3');en.textContent=p.en;const es=document.createElement('p');es.className='translation';es.lang='es';es.textContent=p.es;const note=document.createElement('p');note.textContent=p.note;const listen=document.createElement('button');listen.className='icon-button';const img=document.createElement('img');img.src='assets/icons/volume.svg';img.alt='';listen.append(img,document.createTextNode('Listen in Spanish'));listen.addEventListener('click',()=>sound.speak(p,'es',true));article.append(label,en,es,note,listen);$('library-list').append(article);}
}
$('library-open').addEventListener('click',()=>{if(phase==='playing'||phase==='transition')pause();renderLibrary();$('library-dialog').showModal();});$('library-close').addEventListener('click',()=>$('library-dialog').close());$('phrase-search').addEventListener('input',renderLibrary);
function chart(){
  const key=$('chart-metric').value,labels={pace:'Matches per minute',avgMs:'Seconds per match',clean:'Phrases learned'},recent=saved.history.slice(-30),data=recent.map((h,i)=>({h,x:i,value:key==='avgMs'?(h.avgMs===null?null:h.avgMs/1000):h[key]})).filter(d=>Number.isFinite(d.value));
  $('progress-chart').replaceChildren();if(!data.length){const p=document.createElement('p');p.className='empty-chart';p.textContent='Finish a round to see your progress. Match speed will be recorded from this version onward.';$('progress-chart').append(p);return;}
  const width=Math.max(260,$('progress-chart').clientWidth-30),height=210,left=45,right=width-18,top=28,bottom=164,max=Math.max(key==='clean'?6:1,...data.map(d=>d.value))*1.1;
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('role','img');svg.setAttribute('aria-label',`${labels[key]} over the last ${recent.length} rounds. ${data.map(d=>d.value.toFixed(1)).join(', ')}`);
  const node=(tag,attrs,text)=>{const el=document.createElementNS(svg.namespaceURI,tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,v);if(text!==undefined)el.textContent=text;svg.append(el);return el;};
  node('text',{x:left,y:12,fill:'#43535b','font-size':11},labels[key]);
  for(const value of[0,max/2,max]){const y=bottom-value/max*(bottom-top);node('line',{x1:left,y1:y,x2:right,y2:y,stroke:'#d0d9d2'});node('text',{x:left-9,y:y+4,fill:'#52645a','font-size':11,'text-anchor':'end'},key==='clean'?Math.round(value):value.toFixed(1));}
  const points=data.map(d=>[left+d.x*(right-left)/Math.max(1,recent.length-1),bottom-d.value/max*(bottom-top)]);
  node('polyline',{points:points.map(p=>p.join(',')).join(' '),fill:'none',stroke:'#07579b','stroke-width':2.5});
  data.forEach((d,i)=>{const dot=node('circle',{cx:points[i][0],cy:points[i][1],r:4,fill:'#087849'}),title=document.createElementNS(svg.namespaceURI,'title');title.textContent=`${new Date(d.h.at).toLocaleString()}: ${d.value.toFixed(1)} ${labels[key].toLowerCase()}`;dot.append(title);});
  node('text',{x:left,y:193,fill:'#52645a','font-size':11},`Round ${saved.history.length-recent.length+1}`);node('text',{x:right,y:193,fill:'#52645a','font-size':11,'text-anchor':'end'},`Round ${saved.history.length}`);$('progress-chart').append(svg);
}
function table(container,caption,headers,rows){const t=document.createElement('table'),cap=document.createElement('caption');cap.textContent=caption;t.append(cap);const head=document.createElement('thead'),tr=document.createElement('tr');for(const text of headers){const th=document.createElement('th');th.textContent=text;tr.append(th);}head.append(tr);t.append(head);const body=document.createElement('tbody');for(const row of rows){const tr=document.createElement('tr');for(const text of row){const td=document.createElement('td');td.textContent=text;tr.append(td);}body.append(tr);}t.append(body);$(container).replaceChildren(t);}
function historyTables(){
  const date=at=>new Date(at).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  table('round-history','Recent rounds',['When','Matches','Per minute'],saved.history.slice(-5).reverse().map(h=>[date(h.at),h.matched,h.pace===null?'—':h.pace.toFixed(1)]));
  table('match-history','Recent match times',['Spanish phrase','Time','Result'],saved.matchLog.slice(-5).reverse().map(m=>[byId.get(m.id).es,secondsLabel(m.ms),m.clean?'Clean':'Retry needed']));
}
$('chart-metric').addEventListener('change',chart);let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(chart,150);});
$('export-progress').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(saved,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`spanish-connect-progress-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('progress-status').textContent='Progress exported, including phrase timings and round history.';});
$('import-progress').addEventListener('click',()=>{if(phase==='playing'||phase==='transition')pause();$('import-file').click();});
$('import-file').addEventListener('change',async()=>{const file=$('import-file').files[0];if(!file)return;try{if(file.size>5000000)throw new Error('Choose a file smaller than 5 MB.');const imported=sanitize(JSON.parse(await file.text()));if(!window.confirm('Replace this browser’s progress with the imported file? Export your current progress first if you want a backup.'))return;saved=imported;for(const id of saved.activeIds)markReview(id);saved.activeIds=[];persist();$('topic').value=saved.topic;$('duration').value=saved.duration;audioUI();voicesUI();stats();chart();historyTables();setup();$('progress-status').textContent='Progress restored.';}catch(e){$('progress-status').textContent=e instanceof SyntaxError?'This is not a valid JSON file.':e.message;}finally{$('import-file').value='';}});
window.addEventListener('pagehide',()=>{sound.stop();persist();});
persist();audioUI();voicesUI();stats();chart();historyTables();setup();
})();
