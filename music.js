(function(){
'use strict';
const panel=document.createElement('section');panel.className='music-panel';panel.setAttribute('aria-labelledby','music-title');
panel.innerHTML='<h3 id="music-title">Background music</h3><p>Choose a song from your device. It stays on your device.</p><label class="music-picker" for="music-file">♫ Choose music<input id="music-file" type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac,.flac"></label><p id="music-name" class="muted">No song selected</p><div class="music-actions"><button class="icon-button" id="music-toggle" disabled>Play music</button><button class="icon-button" id="music-clear" disabled>Remove</button></div><label for="music-volume">Music volume <span id="music-volume-label">25%</span><input id="music-volume" type="range" min="0" max="100" value="25"></label><p id="music-status" class="muted" role="status">Music loops while you practice. Choose it again when you reopen the page.</p>';
document.getElementById('settings-dialog').append(panel);
const $=id=>document.getElementById(id),player=new Audio();player.loop=true;player.volume=.25;let source=null,sequence=0;
function sync(){const loaded=!!source;$('music-toggle').disabled=!loaded;$('music-clear').disabled=!loaded;$('music-toggle').textContent=player.paused?'Play music':'Pause music';$('music-toggle').setAttribute('aria-pressed',String(!player.paused));}
function clear(){sequence++;player.pause();player.removeAttribute('src');player.load();if(source)URL.revokeObjectURL(source);source=null;$('music-file').value='';$('music-name').textContent='No song selected';sync();}
async function play(){const token=sequence;try{await player.play();if(token===sequence)$('music-status').textContent='Playing in the background · repeats automatically.';}catch(e){if(token===sequence)$('music-status').textContent='This audio could not play. Try an MP3 or another supported audio file.';}sync();}
$('music-file').addEventListener('change',()=>{const file=$('music-file').files[0];if(!file)return;clear();source=URL.createObjectURL(file);player.src=source;$('music-name').textContent=file.name;$('music-status').textContent='Song ready. Tap Play music to listen.';sync();});
$('music-toggle').addEventListener('click',()=>{if(player.paused)play();else{player.pause();$('music-status').textContent='Music paused.';sync();}});
$('music-clear').addEventListener('click',()=>{clear();$('music-status').textContent='Music removed. Choose another song any time.';});
$('music-volume').addEventListener('input',()=>{player.volume=Number($('music-volume').value)/100;$('music-volume-label').textContent=$('music-volume').value+'%';});
player.addEventListener('error',()=>{if(source)$('music-status').textContent='This file format is not supported here. Try an MP3.';sync();});
window.addEventListener('pagehide',()=>{player.pause();});sync();
})();
