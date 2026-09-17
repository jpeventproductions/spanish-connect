(function (root) {
  'use strict';
  const normalize = text => text.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  function shuffle(items, random = Math.random) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
    return copy;
  }
  function chooseRound(pool, progress, size = 6, random = Math.random) {
    // Retry bucket first, then unseen phrases, then the least-recently practiced.
    const ranked = shuffle(pool, random).sort((a, b) => Number(!!progress[b.id]?.needsReview) - Number(!!progress[a.id]?.needsReview) || (progress[a.id]?.lastSeen || 0) - (progress[b.id]?.lastSeen || 0));
    const en = new Set(), es = new Set(), chosen = [];
    for (const item of ranked) {
      if (en.has(normalize(item.en)) || es.has(normalize(item.es))) continue;
      chosen.push(item); en.add(normalize(item.en)); es.add(normalize(item.es));
      if (chosen.length === size) break;
    }
    return chosen;
  }
  function createRound(items, random = Math.random) {
    return {items, left: shuffle(items, random), right: shuffle(items, random), selected: null, matched: [], missed: [], attempts: 0};
  }
  function select(round, side, id) {
    if (!['en', 'es'].includes(side) || !round.items.some(x => x.id === id) || round.matched.includes(id)) return {type:'ignored'};
    if (!round.selected || round.selected.side === side) {
      round.selected = round.selected?.id === id && round.selected?.side === side ? null : {side,id};
      return {type:'selected'};
    }
    const first = round.selected;
    round.selected = null; round.attempts++;
    if (first.id === id) {round.matched.push(id); return {type:'match', id, complete:round.matched.length === round.items.length};}
    round.missed = [...new Set([...round.missed, first.id, id])];
    return {type:'miss', first, second:{side,id}};
  }
  function createSession(items, random = Math.random) {
    return {...createRound(items, random), runningSince:null, elapsedMs:0, firstTaps:{}, seen:items.map(p=>p.id), matches:[]};
  }
  function elapsed(session, now) { return session.elapsedMs + (session.runningSince === null ? 0 : Math.max(0,now-session.runningSince)); }
  function resume(session, now) { if(session.runningSince === null) session.runningSince=now; }
  function pause(session, now) {session.elapsedMs=elapsed(session,now);session.runningSince=null;}
  function selectTimed(session, side, id, now) {
    if(session.runningSince===null || !session.items.some(p=>p.id===id) || session.matched.includes(id) || !['en','es'].includes(side))return {type:'ignored'};
    const time=elapsed(session,now);
    if(session.firstTaps[id]===undefined)session.firstTaps[id]=time;
    const result=select(session,side,id);
    if(result.type==='match'){
      const p=session.items.find(p=>p.id===id);
      const record={id,ms:Math.max(0,time-session.firstTaps[id]),clean:!session.missed.includes(id),words:(p.es.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)||[]).length};
      session.matches.push(record);return {...result,record};
    }
    return result;
  }
  function replacePair(session, id, pool, progress, random = Math.random) {
    if(!session.matched.includes(id))return null;
    const current=session.items.filter(p=>p.id!==id);
    const en=new Set(current.map(p=>normalize(p.en))), es=new Set(current.map(p=>normalize(p.es)));
    const candidates=pool.filter(p=>!session.seen.includes(p.id)&&!en.has(normalize(p.en))&&!es.has(normalize(p.es)));
    const next=chooseRound(candidates,progress,1,random)[0]||null;
    session.items=session.items.filter(p=>p.id!==id);
    const index=session.left.findIndex(p=>p?.id===id);
    if(index>=0)session.left[index]=next;
    session.right=session.right.map(p=>p?.id===id?next:p);
    if(next){session.items.push(next);session.seen.push(next.id);}
    // Shuffle the Spanish side so newly filled positions do not reveal the answer.
    session.right=shuffle(session.right,random);
    return next;
  }
  function nextLimit(seconds,matches,attempts) {return matches>=6&&matches===attempts?Math.max(20,seconds-5):seconds;}
  const api = {normalize, shuffle, chooseRound, createRound, select,createSession,elapsed,resume,pause,selectTimed,replacePair,nextLimit};
  root.SpanishEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
