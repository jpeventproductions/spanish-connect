(function(){
const $=id=>document.getElementById(id);
const progress=document.createElement('dialog');progress.id='progress-dialog';progress.setAttribute('aria-label','Your progress');progress.innerHTML='<div class="dialog-top"><h2>Your progress</h2><button class="icon-button" aria-label="Close progress"><img src="assets/icons/close.svg" alt=""></button></div>';
document.body.append(progress);
for(const selector of ['.side-panel','.growth-panel','.learning-note','#save-note'])progress.append(document.querySelector(selector));
progress.querySelector('button').onclick=()=>progress.close();
const settings=$('settings-dialog');settings.querySelector('h2').textContent='Practice settings';settings.querySelector('.dialog-top').after(document.querySelector('.settings-row'));document.querySelector('.settings-row').after(document.querySelector('#adaptive-note'));
const nav=document.createElement('nav');nav.className='app-nav';nav.setAttribute('aria-label','Game navigation');
for(const [name,icon,id]of[['Play','play','play'],['Progress','chart','progress'],['Library','book','library'],['Settings','settings','settings']]){const b=document.createElement('button');b.innerHTML=`<img src="assets/icons/${icon}.svg" alt=""><span>${name}</span>`;b.setAttribute('aria-label',name);b.className=id==='play'?'active':'';b.onclick=()=>{if(id==='play')return;if(id==='progress'){if(!$('pause').hidden&&$('pause').textContent.trim()!=='Resume')$('pause').click();progress.showModal();}else $(id+'-open').click();};nav.append(b);}document.body.append(nav);
$('result-review').addEventListener('click',()=>progress.showModal());
})();
