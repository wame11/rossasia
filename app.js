/* ===== Asia 2026 Family Challenge — Japan & South Korea — ARCADE EDITION =====
   Same engine, same backend, same logins as the Route 66 build. ===== */
const ACCOUNTS={
  Jacob:{role:'player',hash:'03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4'},
  Lily:{role:'player',hash:'fe2592b42a727e977f055947385b709cc82b16b9a87f88c6abf3900d65d0cdc3'},
  Hannah:{role:'player',hash:'9975baa75e1603273cbd3d94746a0442e22d5dc0268750dd45229f343f53fe19'},
  Ethan:{role:'player',hash:'08f61ac43fc9a9d5bd3d41f6dc2976ad27d8d5d8422e2ac87c12b98364a331fe'},
  Mark:{role:'player',hash:'9975baa75e1603273cbd3d94746a0442e22d5dc0268750dd45229f343f53fe19'},
  admin:{role:'admin',hash:'7f3d56bb44da1a1f5239ac9db712488db90f135d999290ed9104eba8691096e2'}
};
/* Paste your Google Apps Script /exec URL into sheetEndpoint to sync across devices. */
const DATA_VERSION='asia-2026-10-B'; /* bump this to force every device to start fresh */
const CONFIG={sheetEndpoint:'https://script.google.com/macros/s/AKfycbx_qOmtVWPm7BuClVf1Yj-w4pV7OyWgEzxntc89hgxNeQ9FB-acd6j5NcC0rO7wgkGy/exec',sheetUrl:''};
/* Departure: 16 Oct 2026, 19:35 UK time (BST = UTC+1) — KE908 LHR → ICN */
const DEPARTURE=Date.UTC(2026,9,16,18,35,0);
const SCORE_PER_STOP=100;
/* SEASON START: the spreadsheet is shared with the Route 66 game, so anything on it older than this
   (submissions, chip grants, player chip counts) is ignored. The admin RESET button moves it forward. */
const SEASON_START=Date.parse('2026-09-22T21:00:00Z');
const RESET_MARKER='__RESET__';
const START_CHIPS=0;
const CONTENT_VERSION=3; /* bump when stop games, hunts or quizzes are rebuilt */
const PLAYER_NAMES=Object.keys(ACCOUNTS).filter(n=>ACCOUNTS[n].role==='player');
/* ⚠️ RESET SWITCH: change v4 -> v5 -> v6 ... to wipe EVERY device's saved progress automatically */
const STORAGE={session:'asia26-session-v1',shared:'asia26-shared-v1',progressPrefix:'asia26-progress-v1-'};
/* clear any older-version data so phones don't hoard dead photos */
try{Object.keys(localStorage).forEach(k=>{if(/^(route66|asia26-(session|shared|progress)-v0)/.test(k))localStorage.removeItem(k);});}catch(_){}
const RESET_KEY='asia26-resetstamp';
/* wipes EVERYTHING stored on this device for the game */
function wipeLocal(keepStamp){
  const stamp=keepStamp||localStorage.getItem(RESET_KEY)||'';
  const kill=[];
  for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&(k.indexOf('asia26')===0||k.indexOf('a26-')===0||k.indexOf('route66')===0||k.indexOf('r66-')===0))kill.push(k);}
  kill.forEach(k=>localStorage.removeItem(k));
  if(stamp)localStorage.setItem(RESET_KEY,stamp);
}
/* ?reset=1 in the address bar wipes this device instantly */
try{if(new URLSearchParams(location.search).get('reset')==='1'){wipeLocal();location.replace(location.pathname);}}catch(_){/**/}
const AVATARS={Jacob:'🐉',Lily:'🌸',Hannah:'🦊',Ethan:'🚄',Mark:'🗻',admin:'👑',test:'🧪'};

let session=null,progress=freshProgress(),shared=freshShared(),currentLevel=null,countdownTimer=null,activeGame=null;
const $=s=>document.querySelector(s);
const els={
  login:$('#login'),site:$('#site'),loginForm:$('#loginForm'),username:$('#username'),password:$('#password'),loginError:$('#loginError'),
  who:$('#who'),homeView:$('#homeView'),levelView:$('#levelView'),levelBody:$('#levelBody'),backBtn:$('#backBtn'),
  countdown:$('#countdown'),map:$('#map'),mapProgress:$('#mapProgress'),
  hud:$('#hud'),hudName:$('#hudName'),hudFill:$('#hudFill'),hudCaption:$('#hudCaption'),hudScore:$('#hudScore'),hudAvatar:$('#hudAvatar'),
  reward:$('#reward'),rewardText:$('#rewardText'),amazonBtn:$('#amazonBtn'),voucher:$('#voucher'),
  adminPanel:$('#adminPanel'),adminRows:$('#adminRows'),adminEmpty:$('#adminEmpty'),sheetStatus:$('#sheetStatus'),
  leaderboard:$('#leaderboard'),leaderboardRows:$('#leaderboardRows'),leaderboardEmpty:$('#leaderboardEmpty'),
  syncBtn:$('#syncBtn'),logoutBtn:$('#logoutBtn'),adminRefreshBtn:$('#adminRefreshBtn'),exportCsvBtn:$('#exportCsvBtn')
};

/* ---------- storage ---------- */
/* one-time hard reset across all devices */
(function hardReset(){
  try{
    if(localStorage.getItem('asia26-data-version')===DATA_VERSION)return;
    /* wipe EVERY key this app has ever used (route66-*, r66-*) */
    Object.keys(localStorage).filter(k=>/^(asia26|a26|route66|r66)/i.test(k)).forEach(k=>localStorage.removeItem(k));
    try{sessionStorage.clear();}catch(_){/**/}
    localStorage.setItem('asia26-data-version',DATA_VERSION);
    console.log('[A26] fresh start applied');
  }catch(_){/**/}
})();
function freshProgress(){return {completed:{},submitted:{},photos:{},hunt:{},huntPhotos:{},game:{},quiz:{},points:{},chips:START_CHIPS,chipGrant:{},contentVer:CONTENT_VERSION};}
function freshShared(){return {submissions:[],updatedAt:null,players:[],grants:[],seasonStart:SEASON_START};}
function readJson(k,f=null){try{const v=localStorage.getItem(k);return v?JSON.parse(v):f;}catch{return f;}}
function writeJson(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch{return false;}}
function progressKey(){return STORAGE.progressPrefix+(session?.username||'guest');}
function loadProgress(){progress=mergeProgress(readJson(progressKey(),null));if(session&&session.test)progress.chips=999999;
  const cv=progress.contentVer||1;
  if(cv<3&&cv>=2){
    /* v3 (5 Oct plan): only the stops that changed lose their game/hunt/quiz state. Chips untouched. */
    ['shibuya','shinjuku','odaiba','imperial','kanda','akihabara','ikseondong','insadong','jogyesa','seongsu','starfield','disneysea','nara','sanjusangendo'].forEach(id=>{
      delete progress.game[id];delete progress.quiz[id];delete progress.hunt[id];delete progress.huntPhotos[id];
      Object.keys(progress.chipGrant||{}).forEach(k=>{if(k.startsWith(id+'-'))delete progress.chipGrant[k];});});
    progress.contentVer=CONTENT_VERSION;saveProgress();}
  if(cv<2){
    /* the per-stop games, hunt lists and quiz questions changed, so old answers/wins no longer line up.
       Photos, character and submissions are kept. */
    progress.game={};progress.quiz={};progress.hunt={};progress.huntPhotos={};progress.chipGrant={};
    /* chips were inflated by a loading bug that re-paid grants and streak bonuses — start clean once.
       Admin grants since the season start are paid again exactly once (grantsApplied cleared). */
    progress.chips=START_CHIPS;progress.chipsEarned=0;progress.seasonClaimed=[];progress.grantsApplied={};progress.invest={};
    progress.contentVer=CONTENT_VERSION;saveProgress();}}
function saveProgress(){
  if(session?.role==='admin')return;
  if(writeJson(progressKey(),progress))return;
  /* Storage full: photos for stops already sent/approved are safely on the server,
     so drop them locally (oldest first) and try again. */
  if(purgeOldPhotos()&&writeJson(progressKey(),progress)){toast('📦 Freed up space — older photos are safe on the server.');return;}
  if(purgeOldPhotos(true)&&writeJson(progressKey(),progress)){toast('📦 Freed up space — photos are safe on the server.');return;}
  toast('⚠️ Storage still full. Tap SYNC, then reopen the app.',5000);
}
/* Remove locally-cached photos we no longer need. aggressive=also clear pending ones. */
function purgeOldPhotos(aggressive){
  let freed=false;
  const order=STOPS.map(s=>s.id);
  order.forEach(id=>{
    const st=statusForStop(id);
    const safe=aggressive?(st==='approved'||st==='pending'):(st==='approved');
    if(!safe)return;
    if(progress.photos&&progress.photos[id]&&progress.photos[id].dataUrl){
      progress.photos[id]={name:progress.photos[id].name||'',dataUrl:'',onServer:true};freed=true;}
    const hp=progress.huntPhotos&&progress.huntPhotos[id];
    if(hp)Object.keys(hp).forEach(k=>{if(hp[k]&&hp[k].dataUrl){hp[k]={dataUrl:'',onServer:true};freed=true;}});
  });
  return freed;
}
/* keep EVERYTHING that was saved (character, investments, streak, grants already paid, captions…) and only
   repair the core fields. The old version dropped unknown keys, so grants and streak bonuses re-paid on every reload. */
function mergeProgress(s){const m=freshProgress();if(!s||typeof s!=='object')return m;const out={...s};
  Object.keys(m).forEach(k=>{if(k==='chips'){out.chips=Number.isFinite(s.chips)?s.chips:START_CHIPS;}else if(k==='contentVer'){out.contentVer=s.contentVer||1;}else{out[k]=s[k]&&typeof s[k]==='object'?s[k]:m[k];}});return out;}
function loadShared(){shared=normaliseShared(readJson(STORAGE.shared,freshShared()));}
function saveShared(){shared.updatedAt=new Date().toISOString();writeJson(STORAGE.shared,shared);}

/* ---------- helpers ---------- */
async function sha256(t){const b=new TextEncoder().encode(t);const d=await crypto.subtle.digest('SHA-256',b);return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('');}
function normalName(n){const c=n.trim().toLowerCase();return Object.keys(ACCOUNTS).find(a=>a.toLowerCase()===c);}
function isAdmin(){return session?.role==='admin';}
/* every date in the game runs on JAPAN time (UTC+9 — Korea is the same), whatever the phone's own clock says */
const JST_MS=9*3600000;
function jstDate(ms){const d=new Date((ms??Date.now())+JST_MS);return new Date(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate());}
function today(){return jstDate();}
function dateObj(v){const [y,m,d]=v.split('-').map(Number);return new Date(y,m-1,d);}
function stopById(id){return STOPS.find(s=>s.id===id);}
function timestamp(v){const t=Date.parse(v||'');return Number.isFinite(t)?t:0;}
function latestSubmission(u,id){return shared.submissions.filter(i=>i.username===u&&i.stopId===id).sort((a,b)=>timestamp(b.updatedAt)-timestamp(a.updatedAt))[0]||null;}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

/* ---------- PER-PLAYER TASKS (seeded picks so everyone gets different tasks) ---------- */
function seedFrom(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
function pickFor(user,stopId,arr,n){
  const rnd=mulberry(seedFrom(user+'|'+stopId));
  const idx=arr.map((_,i)=>i);
  for(let i=idx.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[idx[i],idx[j]]=[idx[j],idx[i]];}
  return idx.slice(0,n).sort((a,b)=>a-b).map(i=>arr[i]);
}
function myHunt(stop){return pickFor(session?.username||'test',stop.id,stop.huntPool,5);}
function myQuiz(stop){return pickFor(session?.username||'test',stop.id,stop.quizPool,5);}
/* answer options in a per-player shuffled order, so the right answer isn't always first */
function quizOptions(stop,q,i){const opts=(q[2]||['true','false']).slice();if(!q[2])return opts;
  const rnd=mulberry(seedFrom((session?.username||'test')+'|'+stop.id+'|q'+i+'|'+q[0]));
  for(let k=opts.length-1;k>0;k--){const j=Math.floor(rnd()*(k+1));[opts[k],opts[j]]=[opts[j],opts[k]];}return opts;}

/* ---------- status / unlock ---------- */
function statusForStop(id){
  if(session?.test)return 'approved';
  if(isAdmin())return 'admin';
  const latest=latestSubmission(session?.username,id);
  if(latest?.status==='approved'||progress.completed[id])return 'approved';
  if(latest?.status==='pending'||progress.submitted[id]?.status==='pending')return 'pending';
  if(latest?.status==='rejected'||progress.submitted[id]?.status==='rejected')return 'rejected';
  return 'ready';
}
/* each day opens on its own date; only stops on the SAME day go in order */
function sameDayBefore(index){const prev=STOPS[index-1];return prev&&prev.unlock===STOPS[index].unlock?prev:null;}
function unlocked(index){
  if(session?.test||isAdmin())return true;
  if(today()<dateObj(STOPS[index].unlock))return false;
  const prev=sameDayBefore(index);
  return !prev||statusForStop(prev.id)==='approved';
}
function lockReason(index){
  if(today()<dateObj(STOPS[index].unlock))return 'Opens on '+STOPS[index].day+'.';
  const prev=sameDayBefore(index);
  if(prev)return 'Clear '+prev.title+' first to unlock this.';
  return '';
}
function scoreWithBonus(i){return Number(i.score||SCORE_PER_STOP)+Number(i.bonus||0);}
function applySharedToProgress(){
  if(!session||session.test||isAdmin())return;
  STOPS.forEach(stop=>{
    const latest=latestSubmission(session.username,stop.id);
    if(!latest)return;
    progress.submitted[stop.id]={id:latest.id,status:latest.status};
    if(latest.status==='approved'){progress.completed[stop.id]=true;progress.points[stop.id]=scoreWithBonus(latest);}
    if(latest.status==='rejected'){delete progress.completed[stop.id];delete progress.points[stop.id];}
  });
  saveProgress();
}
function playerPoints(u){
  const t=shared.submissions.filter(i=>i.username===u&&i.status==='approved').reduce((s,i)=>s+scoreWithBonus(i),0);
  if(t)return t;
  return Object.values(progress.points).reduce((s,v)=>s+Number(v||0),0);
}

/* ---------- countdown ---------- */
function renderCountdown(){
  const diff=DEPARTURE-Date.now();
  if(diff<=0){els.countdown.innerHTML='<span class="cd-label">✈️ We are on our way to Japan! Have an amazing trip!</span>';return;}
  const days=Math.floor(diff/86400000),hrs=Math.floor(diff%86400000/3600000),mins=Math.floor(diff%3600000/60000);
  els.countdown.innerHTML='<span class="cd-label">🛫 Countdown to Japan!</span><div class="cd-units">'+
    '<div class="cd-unit"><b>'+days+'</b><span>days</span></div>'+
    '<div class="cd-unit"><b>'+hrs+'</b><span>hours</span></div>'+
    '<div class="cd-unit"><b>'+mins+'</b><span>mins</span></div></div>';
}

/* ---------- views ---------- */
function stopGame(){if(activeGame?.stop)activeGame.stop();activeGame=null;}
function showHome(){
  showSubmitBar(false);CURRENT_LEVEL=null;
  stopGame();currentLevel=null;
  els.levelView.classList.add('hidden');els.homeView.classList.remove('hidden');
  renderHome();window.scrollTo(0,0);
}
function openLevel(index){
  if(!unlocked(index)&&!isAdmin())return;
  stopGame();currentLevel=index;
  els.homeView.classList.add('hidden');els.levelView.classList.remove('hidden');
  renderLevel(index);window.scrollTo(0,0);
}
function renderHome(){
  els.who.textContent=session.test?'test mode':isAdmin()?'admin':session.username;
  renderCountdown();renderMap();
  els.adminPanel.classList.toggle('hidden',!isAdmin());
  els.leaderboard.classList.toggle('hidden',!isAdmin());
  els.hud.classList.toggle('hidden',isAdmin());
  renderAdminPanel();renderChipGrant();renderResetBox();renderLeaderboard();renderReward();
  try{renderDaily();renderSteps();}catch(e){console.error('[A26] daily/steps',e);}
  if(!isAdmin()){
    const done=STOPS.filter(s=>statusForStop(s.id)==='approved').length;
    const pct=Math.round(done/STOPS.length*100);
    els.mapProgress.textContent=done>=STOPS.length?'Every stop cleared! 🏆':'Tap the glowing stop to play!';
    els.hudName.textContent=session.test?'Test pilot':session.username;
    els.hudAvatar.textContent=AVATARS[session.username]||'🚄';
    els.hudFill.style.width=pct+'%';
    els.hudCaption.textContent=done+' / '+STOPS.length+' stops cleared · '+pct+'%';
    els.hudScore.textContent=playerPoints(session.username)+(progress.playBonus||0);updateChips();
  }else els.mapProgress.textContent='Admin view — approve missions below.';
}
function renderMap(){
  els.map.innerHTML='';
  let nextIndex=-1;
  for(let i=0;i<STOPS.length;i++){if(unlocked(i)&&!['approved','admin'].includes(statusForStop(STOPS[i].id))){nextIndex=i;break;}}
  STOPS.forEach((stop,index)=>{
    const status=statusForStop(stop.id),isLocked=!unlocked(index);
    const node=document.createElement('div');
    node.className='level-node '+(index%2===0?'up':'down')+' '+status+(isLocked?' is-locked':'')+(index===nextIndex&&!isLocked?' is-next':'');
    const sub=isLocked?stop.day:status==='approved'?'✓ Cleared!':status==='pending'?'⏳ In review':'Play';
    node.innerHTML='<div class="level-circle" role="button" tabindex="0"><span class="level-num">'+(index+1)+'</span><span class="level-emoji">'+stop.emoji+'</span></div>'+
      (index===nextIndex&&!isLocked?'<div class="mascot">🚄</div>':'')+
      '<div class="level-stars">'+(status==='approved'?'★★★':status==='pending'?'⏳':'')+'</div>'+
      '<div class="level-title"></div><div class="level-sub">'+sub+'</div>';
    node.querySelector('.level-title').textContent=stop.title;
    if(!isLocked){
      const c=node.querySelector('.level-circle');
      const go=()=>openLevel(index);
      c.addEventListener('click',go);
      c.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}});
    }
    els.map.appendChild(node);
  });
}

/* ===== STICKY SUBMIT BAR — wired once at startup, immune to render errors ===== */
function showSubmitBar(on){
  const bar=document.getElementById('submitBar');if(!bar)return;
  bar.classList.toggle('hidden',!on);
  document.body.classList.toggle('has-submit-bar',!!on);
}
function updateSubmitBar(){
  const bar=document.getElementById('submitBar');if(!bar||!CURRENT_LEVEL)return;
  const stop=CURRENT_LEVEL.stop,st=statusForStop(stop.id);
  const cnt=document.getElementById('sbCount'),hint=document.getElementById('sbHint'),btn=document.getElementById('sbBtn');
  if(session&&session.test){cnt.textContent='TEST';hint.textContent='Submit any time';btn.disabled=false;btn.textContent='📤 Submit for review';bar.classList.remove('sb-ready');return;}
  if(st==='approved'){cnt.textContent='✓';hint.textContent='Mission cleared!';btn.disabled=true;btn.textContent='⭐ Cleared';return;}
  const steps=missionSteps(stop),done=steps.filter(s=>s.ok).length;
  cnt.textContent=done+'/'+steps.length;
  const miss=steps.find(s=>!s.ok);
  hint.textContent=st==='pending'?'In review — tap to resend':(miss?'Next: '+miss.label:'All done — submit it!');
  btn.disabled=false;
  btn.textContent=st==='pending'?'⏳ Resend for review':'📤 Submit for review';
  bar.classList.toggle('sb-ready',done===steps.length);
}
/* attached at load — can never be lost by a broken section */
document.addEventListener('DOMContentLoaded',wireSubmitBar);
wireSubmitBar();
function wireSubmitBar(){
  const btn=document.getElementById('sbBtn');if(!btn||btn.dataset.on)return;btn.dataset.on='1';
  btn.onclick=function(){
    if(!CURRENT_LEVEL){toast('Open a stop first.');return;}
    toast('Checking your mission…');
    submitStop(CURRENT_LEVEL.stop,CURRENT_LEVEL.index,CURRENT_LEVEL.cs,CURRENT_LEVEL.root);
  };
}

/* big centre-screen message — so a button tap always shows something */
function toast(msg,ms){
  let t=document.getElementById('a26toast');
  if(!t){t=document.createElement('div');t.id='a26toast';t.className='a26toast';document.body.appendChild(t);}
  t.textContent=msg;t.classList.add('show');
  clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('show'),ms||2600);
}

/* ---------- LEVEL PAGE ---------- */
function renderLevel(index){
  const stop=STOPS[index];
  const status=statusForStop(stop.id),locked=!unlocked(index);
  const labels={approved:['Mission cleared ⭐','🏆','You smashed it!'],
    pending:['⏳ ON HOLD — waiting for admin approval','🕵️','The boss is checking every photo and your answers. You\u2019ll get your points once it\u2019s approved.'],
    rejected:['Mission failed — retry!','💥','Have another go and resubmit.'],
    ready:['Mission briefing','🎯','Complete all objectives, then submit!'],
    admin:['Admin view','👑','Approve from the map screen.']};
  const [pillText,statusEmoji,statusCopy]=labels[status]||labels.ready;
  const taskSection=(step,title,tag,cls,body)=>('<section class="task-block '+cls+'"><div class="task-head"><span class="task-step">'+step+'</span><h3>'+title+'</h3>'+
    (tag?'<span class="tag-pill">'+tag+'</span>':'')+'<span class="task-done-tag">Done ✓</span></div><div class="task-body">'+body+'</div></section>');

  const root=document.createElement('div');
  root.className='level-card';
  root.innerHTML=
    '<div class="level-head"><div class="hero-emoji">'+stop.emoji+'</div><div><h1 class="game-title"></h1><p class="hero-meta"></p><span class="level-pill">'+escapeHtml(pillText)+'</span></div></div>'+
    '<div class="level-pad">'+
      '<div class="approval-box '+(locked?'':status)+'"><span class="approval-emoji">'+(locked?'🔒':statusEmoji)+'</span><div><strong>'+escapeHtml(locked?'Locked':pillText)+'</strong><span>'+escapeHtml(locked?lockReason(index):statusCopy)+'</span></div></div>'+
      taskSection(1,'Intel — fun facts','','intel','<ul class="facts"></ul>')+
      taskSection(2,'Arrival photo','required','proof','<p class="hint">📸 Snap a photo of YOU at this stop!</p><input class="photo" type="file" accept="image/*" capture="environment"><img class="proof-preview hidden" alt="your photo"><p class="proofStatus"></p>')+
      taskSection(3,'Scavenger hunt','photo each one!','hunt-sec','<p class="hint">These are YOUR 5 targets — everyone gets different ones. Snap a photo of each!</p><div class="hunt"></div>')+
      taskSection(4,'<span class="game-name"></span>','arcade','arcade-sec','<p class="hint game-prompt"></p><div class="arcade"></div>')+
      taskSection(5,'Boss quiz','beat it!','quiz-sec','<p class="hint">Your questions — no copying, everyone gets different ones!</p><div class="quiz"></div><button class="btn btn-secondary check" type="button">Check answers</button><p class="quizResult"></p>')+
      '<div class="mission-check"></div>'+
      '<div class="complete-row"><button class="btn btn-primary submit" type="button">📤 Submit for review</button><span class="completeStatus"></span></div>'+
    '</div>';
  root.querySelector('h1').textContent=stop.title;
  root.querySelector('.hero-meta').textContent='Level '+(index+1)+' · '+stop.day+' · '+stop.loc;
  root.querySelector('.facts').innerHTML=stop.facts.map(f=>'<li>'+escapeHtml(f)+'</li>').join('');
  root.querySelector('.game-name').textContent='Arcade — '+(stop.games||[]).length+' games';
  root.querySelector('.game-prompt').textContent='Pick a game below. Win any ONE to clear this objective — beat more for bonus points!';
  root.querySelector('.intel').classList.add('task-complete');

  els.levelBody.innerHTML='';els.levelBody.appendChild(root);

  /* WIRE THE BUTTON FIRST — so a failure in any section below can never kill it */
  const submit=root.querySelector('.submit'),cs=root.querySelector('.completeStatus');
  CURRENT_LEVEL={stop:stop,index:index,cs:cs,root:root};
  wireSubmitBar();showSubmitBar(!isAdmin());setTimeout(updateSubmitBar,0);
  if(isAdmin())submit.classList.add('hidden');
  submit.dataset.wired='1';
  submit.onclick=function(){toast('Checking your mission…');submitStop(stop,index,cs,root);};
  submit.addEventListener('click',()=>{},{passive:true});

  /* each section is isolated: one broken part can't break the others */
  const safe=(name,fn)=>{try{fn();}catch(err){console.error('[A26] '+name+' failed:',err);
    const w=root.querySelector('.'+name+'-sec')||root;const p=document.createElement('p');
    p.className='sec-error';p.textContent='⚠️ This bit had a hiccup — the rest still works.';w.appendChild(p);}};
  safe('proof',()=>renderProof(root,stop));
  safe('hunt',()=>renderHunt(root,stop));
  safe('arcade',()=>renderArcade(root,stop));
  safe('quiz',()=>renderQuiz(root,stop));
  safe('tags',()=>refreshTaskTags(root,stop));
  safe('bar',()=>updateSubmitBar());

  if(locked){submit.disabled=true;root.querySelectorAll('input,textarea,button,canvas').forEach(e=>{if(!e.classList.contains('submit'))e.disabled=true;});}
  if(status==='approved'){submit.disabled=true;submit.textContent='⭐ Mission cleared';}
  if(status==='pending'){submit.disabled=false;submit.textContent='⏳ Waiting for review — tap to resend';}
}
/* belt-and-braces: a delegated listener so the button works even if wiring failed */
let CURRENT_LEVEL=null;
document.addEventListener('click',e=>{
  const b=e.target&&e.target.closest&&e.target.closest('.submit');
  if(!b||b.disabled||!CURRENT_LEVEL)return;
  if(b.onclick)return;                    /* the direct handler already ran */
  submitStop(CURRENT_LEVEL.stop,CURRENT_LEVEL.index,CURRENT_LEVEL.cs,CURRENT_LEVEL.root);
});
function refreshTaskTags(root,stop){
  root.querySelector('.proof')?.classList.toggle('task-complete',Boolean(progress.photos[stop.id]?.dataUrl||progress.photos[stop.id]?.onServer));
  const hp=progress.huntPhotos[stop.id]||{};
  root.querySelector('.hunt-sec')?.classList.toggle('task-complete',myHunt(stop).every((_,i)=>hp[i]?.dataUrl||hp[i]?.onServer));
  root.querySelector('.arcade-sec')?.classList.toggle('task-complete',Boolean(progress.game[stop.id]?.complete));
  root.querySelector('.quiz-sec')?.classList.toggle('task-complete',Boolean(progress.quiz[stop.id]?.correct));
  renderMissionCheck(root,stop);
  try{updateSubmitBar();}catch(_){/**/}
}
/* live checklist so you can always see what's still missing */
function missionSteps(stop){
  const hp=progress.huntPhotos[stop.id]||{};
  const hunt=myHunt(stop);
  const doneHunt=hunt.filter((_,i)=>hp[i]?.dataUrl||hp[i]?.onServer).length;
  return [
    {ok:Boolean(progress.photos[stop.id]?.dataUrl||progress.photos[stop.id]?.onServer),label:'Arrival photo',sel:'.proof'},
    {ok:doneHunt===hunt.length,label:'Hunt photos ('+doneHunt+'/'+hunt.length+')',sel:'.hunt-sec'},
    {ok:Boolean(progress.game[stop.id]?.complete),label:'Win 1 arcade game',sel:'.arcade-sec'},
    {ok:Boolean(progress.quiz[stop.id]?.correct),label:'Beat the boss quiz',sel:'.quiz-sec'}
  ];
}
function renderMissionCheck(root,stop){
  const box=root.querySelector('.mission-check');if(!box)return;
  if(session.test){box.innerHTML='<div class="mc-title">🧪 Test account — submit any time.</div>';return;}
  const steps=missionSteps(stop);
  const left=steps.filter(s=>!s.ok).length;
  box.innerHTML='<div class="mc-title">'+(left?'⚠️ '+left+' thing'+(left>1?'s':'')+' left before you can submit:':'✅ All done — hit Complete Mission!')+'</div>'+
    '<div class="mc-list">'+steps.map(s=>'<span class="mc-item'+(s.ok?' ok':'')+'">'+(s.ok?'✅':'⬜')+' '+s.label+'</span>').join('')+'</div>';
  box.classList.toggle('mc-ready',left===0);
}

/* ---------- photo proof ---------- */
function renderProof(root,stop){
  const input=root.querySelector('.photo'),prev=root.querySelector('.proof-preview'),st=root.querySelector('.proofStatus');
  const saved=progress.photos[stop.id];
  if(saved?.dataUrl){prev.src=saved.dataUrl;prev.classList.remove('hidden');st.textContent='Photo locked in ✓';}
  input.addEventListener('change',async e=>{
    const file=e.target.files[0];if(!file)return;
    st.textContent='Saving…';
    try{const dataUrl=await imageToThumb(file,400,0.5);progress.photos[stop.id]={name:file.name,dataUrl};prev.src=dataUrl;prev.classList.remove('hidden');st.textContent='Photo locked in ✓';saveProgress();refreshTaskTags(root,stop);}
    catch{st.textContent='Could not read that image — try another.';}
  });
}

/* ---------- scavenger hunt: photo per item, per-player items ---------- */
function renderHunt(root,stop){
  const wrap=root.querySelector('.hunt');
  const items=myHunt(stop);
  const saved=progress.huntPhotos[stop.id]||{};
  items.forEach((item,i)=>{
    const box=document.createElement('div');
    box.className='hunt-item'+(saved[i]?.dataUrl?' done':'');
    box.innerHTML='<div class="hunt-item-head"><span class="hunt-check">'+(saved[i]?.dataUrl?'✓':(i+1))+'</span><span class="hunt-text"></span></div>'+
      '<input type="file" accept="image/*" capture="environment"><img class="hunt-thumb'+(saved[i]?.dataUrl?' show':'')+'" alt="">';
    box.querySelector('.hunt-text').textContent=item;
    const thumb=box.querySelector('.hunt-thumb');
    if(saved[i]?.dataUrl)thumb.src=saved[i].dataUrl;
    box.querySelector('input').addEventListener('change',async e=>{
      const file=e.target.files[0];if(!file)return;
      try{
        const dataUrl=await imageToThumb(file,300,0.55);
        progress.huntPhotos[stop.id]={...(progress.huntPhotos[stop.id]||{}),[i]:{dataUrl}};
        thumb.src=dataUrl;thumb.classList.add('show');box.classList.add('done');
        box.querySelector('.hunt-check').textContent='✓';
        saveProgress();refreshTaskTags(root,stop);
      }catch{box.querySelector('.hunt-check').textContent='!';}
    });
    wrap.appendChild(box);
  });
}

/* ARCADE: the activity games live in games.js */
function burstNear(host){burst(host.closest('.task-block')||host);}
/* confetti burst */
function burst(host){
  const b=document.createElement('div');b.className='burst';
  for(let i=0;i<18;i++){const s=document.createElement('span');s.style.setProperty('--dx',(Math.random()*260-130)+'px');s.style.setProperty('--dy',(-80-Math.random()*160)+'px');s.style.setProperty('--c',['#00e5ff','#1f6fe0','#ff3d8b','#ffd23f'][i%4]);s.style.animationDelay=(Math.random()*0.15)+'s';b.appendChild(s);}
  host.appendChild(b);setTimeout(()=>b.remove(),1600);
}

/* ---------- quiz (per-player questions) ---------- */
function renderQuiz(root,stop){
  const wrap=root.querySelector('.quiz'),res=root.querySelector('.quizResult');
  const quiz=myQuiz(stop);
  const saved=progress.quiz[stop.id]||{answers:{},checked:false,correct:false};
  quiz.forEach((q,i)=>{
    const block=document.createElement('div');block.className='question';
    const p=document.createElement('p');p.textContent=(i+1)+'. '+q[0];
    const opts=document.createElement('div');opts.className='options';
    quizOptions(stop,q,i).forEach(val=>{
      const l=document.createElement('label'),inp=document.createElement('input'),sp=document.createElement('span');
      inp.type='radio';inp.name=stop.id+'-'+i;inp.value=val;inp.checked=saved.answers[i]===val;
      sp.textContent=val==='true'?'True':val==='false'?'False':val;
      inp.addEventListener('change',()=>{const cur=progress.quiz[stop.id]||{answers:{}};cur.answers[i]=val;cur.checked=false;cur.correct=false;progress.quiz[stop.id]=cur;saveProgress();});
      l.append(inp,sp);opts.appendChild(l);
    });
    block.append(p,opts);wrap.appendChild(block);
  });
  if(saved.checked)res.textContent=saved.correct?'Boss defeated! ✓':'Not quite — try again!';
  root.querySelector('.check').addEventListener('click',()=>{
    const cur=progress.quiz[stop.id]||{answers:{}};
    if(quiz.some((_,i)=>cur.answers[i]===undefined)){res.textContent='Answer every question first.';return;}
    const right=quiz.map((q,i)=>cur.answers[i]===q[1]);const correct=right.every(Boolean);
    progress.quiz[stop.id]={answers:cur.answers,checked:true,correct};saveProgress();
    wrap.querySelectorAll('.question').forEach((b,i)=>{b.classList.toggle('q-right',right[i]);b.classList.toggle('q-wrong',!right[i]);});
    const n=right.filter(Boolean).length;
    res.textContent=correct?'Boss defeated! 5 out of 5 ✓':(n+' out of '+quiz.length+' right — the red ones are wrong. Change them and check again!');
    refreshTaskTags(root,stop);
  });
}

/* ---------- submit ---------- */
function validateStop(stop,index){
  if(!unlocked(index))return lockReason(index);
  if(session.test)return '';
  if(!(progress.photos[stop.id]?.dataUrl||progress.photos[stop.id]?.onServer))return '📸 Arrival photo needed first!';
  const hp=progress.huntPhotos[stop.id]||{};
  if(!myHunt(stop).every((_,i)=>hp[i]?.dataUrl||hp[i]?.onServer))return 'Snap a photo for every scavenger target first.';
  if(!progress.game[stop.id]?.complete)return '🕹️ Win at least ONE arcade game first!';
  if(!progress.quiz[stop.id]?.checked)return 'Check the quiz answers first.';
  if(!progress.quiz[stop.id]?.correct)return 'Beat the boss quiz first.';
  return '';
}
function arcadeSummary(stop){const st=gameState(stop.id);const games=gamesFor(stop);
  return 'Games won '+winsCount(stop)+'/5 · '+games.map((g,i)=>g.n+': '+(st.perGame[i]?.best||0)+(st.perGame[i]?.won?'🏆':'')).join(' · ');}
function suggestedBonus(stop){return Math.min(25,Math.max(0,(winsCount(stop)-1))*WIN_BONUS_PER_EXTRA);}
async function submitStop(stop,index,cs,root){
  try{ await submitStopInner(stop,index,cs,root); }
  catch(err){
    console.error('[A26] submit failed:',err);
    toast('⚠️ Submit error: '+(err&&err.message?err.message:'unknown'),5000);
    if(cs)cs.textContent='Submit error — tell Ethan: '+(err&&err.message);
  }
}
async function submitStopInner(stop,index,cs,root){
  if(session.test){progress.completed[stop.id]=true;progress.points[stop.id]=SCORE_PER_STOP;saveProgress();burst(root);setTimeout(showHome,900);return;}
  const problem=validateStop(stop,index);
  if(problem){
    cs.textContent=problem;toast(problem,3200);
    const miss=missionSteps(stop).find(s=>!s.ok);
    const sec=miss&&root.querySelector(miss.sel);
    if(sec){sec.scrollIntoView({behavior:'smooth',block:'center'});sec.classList.add('flash-need');setTimeout(()=>sec.classList.remove('flash-need'),1600);}
    sfx('lose');bearShout(problem);
    return;
  }
  const photo=progress.photos[stop.id]||{};
  /* every hunt-item photo goes to the boss too, labelled with the task */
  const hp=progress.huntPhotos[stop.id]||{};
  const tasks=myHunt(stop);
  const huntImages=Object.keys(hp).map(k=>({index:Number(k),label:tasks[Number(k)]||('Item '+(Number(k)+1)),dataUrl:hp[k]?.dataUrl||''})).filter(x=>x.dataUrl);
  const sub={id:session.username+'-'+stop.id+'-'+Date.now(),username:session.username,stopId:stop.id,stopTitle:stop.title,day:stop.day,hotel:stop.hotel,
    score:SCORE_PER_STOP,bonus:0,status:'pending',submittedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
    proofName:photo.name||'',proofImage:photo.dataUrl||'',activity:arcadeSummary(stop),chips:Number(progress.chips||0),playBonus:Number(progress.playBonus||0),suggestBonus:suggestedBonus(stop),
    huntImages:huntImages};
  /* keep the local copy light (photos live on the backend) so storage never fills */
  const localCopy={...sub,huntImages:huntImages.map(h=>({index:h.index,label:h.label,url:''}))};
  const i=shared.submissions.findIndex(x=>x.username===sub.username&&x.stopId===sub.stopId&&x.status==='pending');
  if(i>=0)shared.submissions[i]=localCopy;else shared.submissions.push(localCopy);
  saveShared();
  progress.submitted[stop.id]={id:sub.id,status:'pending'};saveProgress();
  cs.textContent='Mission sent to the boss! 🎉';toast('✅ Sent for review!');try{purgeOldPhotos(true);saveProgress();}catch(_){/**/}burst(root);bearCelebrate('MISSION COMPLETE! Legend! 🏆');syncPlayer();
  await postRemote({action:'submit',submission:sub});
  setTimeout(showHome,900);
}

/* ---------- admin / leaderboard / reward ---------- */
/* ---- tap any admin photo to see it full-size ---- */
function bigPhoto(src,label){
  if(!src)return;
  const o=document.createElement('div');o.className='lightbox';
  o.innerHTML='<div class="lightbox-inner"><img alt="photo"><p></p><button type="button" class="btn btn-quiet">✕ Close</button></div>';
  o.querySelector('img').src=src;o.querySelector('p').textContent=label||'';
  o.querySelector('button').addEventListener('click',()=>o.remove());
  o.addEventListener('click',e=>{if(e.target===o)o.remove();});
  document.body.appendChild(o);
}

/* ---- ADMIN: give bonus chips to any player ---- */
async function resetEverything(){
  if(!isAdmin())return;
  if(!confirm('RESET EVERYTHING?\n\nEvery player goes back to 0 chips, 0 points and no stops cleared, on EVERY device.\n\nThis cannot be undone.'))return;
  if(!confirm('Really sure? Last chance.'))return;
  const st=document.querySelector('.reset-status');
  if(st)st.textContent='Resetting…';
  /* the backend has no reset action, so drop a marker row in ChipGrants — every app ignores anything older */
  const r=await apiPost({action:'grantChips',username:RESET_MARKER,amount:0,reason:'RESET EVERYTHING',createdBy:session.username,adminKey:session.adminKey});
  if(r&&r.ok){
    if(st)st.textContent='✅ Everything reset. Other devices wipe themselves next time they open the app.';
    wipeLocal(String(r.id||Date.now()));
    setTimeout(()=>location.reload(),1500);
  } else if(st)st.textContent='❌ Could not reach the server'+(r&&r.error?' — '+r.error:'')+'.';
}
function renderResetBox(){
  if(!isAdmin())return;
  const host=document.getElementById('resetBox');if(!host)return;
  host.innerHTML='<h3>🧹 Danger zone</h3>'+
    '<p class="grant-note">Wipes saved progress, photos, chips and logins <b>on THIS device</b>. Each phone needs it done once. It does NOT delete rows in your Google Sheet — do that from the sheet.</p>'+
    '<div class="grant-row"><button type="button" class="btn btn-danger reset-go">🧹 Reset this device</button>'+
    '<button type="button" class="btn btn-quiet reset-shared">♻️ Clear cached submissions only</button></div>'+
    '<p class="grant-status reset-status"></p>';
  host.querySelector('.reset-go').addEventListener('click',()=>{
    if(!confirm('Wipe ALL saved data on this device?\n\nEveryone signed in on this phone starts from zero (0 chips, 0 points).'))return;
    try{
      Object.keys(localStorage).filter(k=>/^(asia26|a26|route66|r66)/i.test(k)).forEach(k=>localStorage.removeItem(k));
      sessionStorage.clear();
      host.querySelector('.reset-status').textContent='✅ Wiped. Reloading…';
      setTimeout(()=>location.reload(),700);
    }catch(e){host.querySelector('.reset-status').textContent='❌ '+e.message;}
  });
  host.querySelector('.reset-shared').addEventListener('click',()=>{
    try{localStorage.removeItem(STORAGE.shared);shared=freshShared();saveShared();
      host.querySelector('.reset-status').textContent='✅ Cached submissions cleared. Pulling fresh from the sheet…';
      syncShared();
    }catch(e){host.querySelector('.reset-status').textContent='❌ '+e.message;}
  });
}
function renderChipGrant(){
  if(!isAdmin())return;
  const host=document.getElementById('chipGrantBox');if(!host)return;
  const chips=chipStandings();
  host.innerHTML='<h3>🪙 Give bonus chips</h3>'+
    '<p class="grant-note">Reward good behaviour, spotting things, being helpful — anything you like. Chips count toward the Chip Champion prize.</p>'+
    '<div class="grant-row">'+
      '<select class="grant-who">'+PLAYER_NAMES.map(n=>'<option>'+escapeHtml(n)+'</option>').join('')+'</select>'+
      '<input class="grant-amt" type="number" value="10" min="-500" max="500" step="5">'+
      '<input class="grant-why" placeholder="Reason (optional)">'+
      '<button type="button" class="btn btn-primary grant-go">Give</button>'+
    '</div>'+
    '<div class="grant-quick">'+[5,10,25,50].map(n=>'<button type="button" class="grant-chip" data-n="'+n+'">+'+n+'</button>').join('')+
      '<button type="button" class="grant-chip grant-minus" data-n="-10">−10 (fine)</button></div>'+
    '<p class="grant-status"></p>'+
    '<div class="reset-zone"><button type="button" class="btn btn-danger reset-all">♻️ RESET EVERYTHING (all players, all devices)</button><p class="reset-status"></p></div>'+'<div class="grant-standings">Current chips — '+(chips.size?[...chips.entries()].sort((a,b)=>b[1]-a[1]).map(([n,c])=>escapeHtml(n)+': <b>'+c+'</b>').join(' · '):'none reported yet')+'</div>';
  host.querySelectorAll('.grant-chip').forEach(b=>b.addEventListener('click',()=>{host.querySelector('.grant-amt').value=b.dataset.n;}));
  host.querySelector('.reset-all')?.addEventListener('click',resetEverything);
  host.querySelector('.grant-go').addEventListener('click',async()=>{
    const who=host.querySelector('.grant-who').value;
    const amt=Number(host.querySelector('.grant-amt').value)||0;
    const why=host.querySelector('.grant-why').value.trim();
    const st=host.querySelector('.grant-status');
    if(!amt){st.textContent='Enter an amount first.';return;}
    st.textContent='Sending…';
    const r=await apiPost({action:'grantChips',username:who,amount:amt,reason:why,createdBy:session.username,adminKey:session.adminKey});
    if(r&&r.ok){st.textContent='✅ '+(amt>0?'Gave ':'Took ')+Math.abs(amt)+' chips '+(amt>0?'to ':'from ')+who+(why?' — "'+why+'"':'')+'. They get it next time they open the app.';
      host.querySelector('.grant-why').value='';shared.grants=r.grants?normaliseShared({grants:r.grants}).grants:shared.grants;saveShared();toast('✅ Chips sent to '+who);}
    else {const msg=(r&&r.error)?r.error:'Unknown error';st.textContent='❌ '+msg;toast('❌ '+msg,5000);console.error('[A26] grantChips failed:',r);}
  });
}

/* ---- PLAYER: pick up any chips the boss granted ---- */
function applyGrants(){
  if(!session||isAdmin()||session.test)return;
  const list=(shared.grants||[]).filter(g=>g.username===session.username);
  if(!list.length)return;
  progress.grantsApplied=progress.grantsApplied||{};
  let total=0,reasons=[];
  list.forEach(g=>{
    if(progress.grantsApplied[g.id])return;
    progress.grantsApplied[g.id]=true;
    const amt=Number(g.amount||0);
    progress.chips=Math.max(0,(progress.chips||0)+amt);
    if(amt>0)grantEarn(amt);
    total+=amt;if(g.reason)reasons.push(g.reason);
  });
  if(total!==0){
    saveProgress();updateChips();syncPlayer();
    const msg=(total>0?'🎁 The boss gave you +'+total+' chips!':'😬 The boss took '+Math.abs(total)+' chips.')+(reasons.length?' ('+reasons.join(', ')+')':'');
    setTimeout(()=>{bearCelebrate(msg);sfx(total>0?'jackpot':'lose');},1200);
  }
}

function renderAdminPanel(){
  if(!isAdmin())return;
  const pending=shared.submissions.filter(i=>i.status==='pending');
  els.adminRows.innerHTML='';
  pending.forEach(item=>{
    const stop=stopById(item.stopId);
    const row=document.createElement('article');row.className='admin-row';
    const hunts=Array.isArray(item.huntImages)?item.huntImages.filter(h=>h&&(h.url||h.dataUrl)):[];
    row.innerHTML='<div><div class="admin-title"></div><div class="admin-meta"></div></div><div class="admin-photo"></div>'+
      '<div class="admin-hunt"></div>'+
      '<div class="admin-controls"><label>Bonus pts <input class="bonus" type="number" min="0" max="25" step="5" value="0"></label>'+
      '<button class="btn btn-primary approve" type="button">Approve</button><button class="btn btn-danger reject" type="button">Reject</button></div>';
    row.querySelector('.admin-title').textContent=item.username+' — '+(stop?.title||item.stopTitle);
    row.querySelector('.admin-meta').textContent=(item.activity||'')+(item.proofImage?'':' · (no arrival photo)')+
      ' · hunt photos: '+hunts.length+(item.suggestBonus?' · suggested bonus: '+item.suggestBonus:'');
    if(item.suggestBonus)row.querySelector('.bonus').value=item.suggestBonus;
    if(item.proofImage){const img=document.createElement('img');img.src=item.proofImage;img.alt='arrival photo';img.addEventListener('click',()=>bigPhoto(item.proofImage,'Arrival photo'));row.querySelector('.admin-photo').appendChild(img);}
    const hw=row.querySelector('.admin-hunt');
    if(hunts.length){
      hw.innerHTML='<div class="admin-hunt-lbl">📸 Scavenger hunt photos — tap any to enlarge & check:</div><div class="admin-hunt-grid"></div>';
      const grid=hw.querySelector('.admin-hunt-grid');
      hunts.forEach(h=>{
        const src=h.url||h.dataUrl;
        const cell=document.createElement('figure');cell.className='hunt-thumb';
        cell.innerHTML=(src?'<img alt="hunt photo">':'<span class="hunt-missing">on server</span>')+'<figcaption></figcaption>';
        cell.querySelector('figcaption').textContent=h.label||'';
        const im=cell.querySelector('img');
        if(im){im.src=src;im.addEventListener('click',()=>bigPhoto(src,h.label||''));}
        grid.appendChild(cell);
      });
    } else hw.innerHTML='<div class="admin-hunt-lbl">No hunt photos attached to this submission.</div>';
    row.querySelector('.approve').addEventListener('click',()=>approveSubmission(item.id,row.querySelector('.bonus').value));
    row.querySelector('.reject').addEventListener('click',()=>rejectSubmission(item.id));
    els.adminRows.appendChild(row);
  });
  els.adminEmpty.classList.toggle('hidden',pending.length>0);
}
function chipStandings(){
  const latest=new Map();
  (shared.players||[]).forEach(p=>{if(p.username)latest.set(p.username,Number(p.chips||0));});
  [...shared.submissions].sort((a,b)=>timestamp(a.updatedAt)-timestamp(b.updatedAt)).forEach(i=>{if(i.username&&!latest.has(i.username))latest.set(i.username,Number(i.chips||0));});
  if(session&&!isAdmin()&&!session.test)latest.set(session.username,Number(progress.chips||0));
  return latest;
}
function renderChipChamp(){
  const el=document.getElementById('chipChamp');if(!el)return;
  const m=chipStandings();
  if(!m.size){el.textContent='🪙 Chip Champion: no chip counts reported yet.';return;}
  const rows=[...m.entries()].sort((a,b)=>b[1]-a[1]);
  const [name,chips]=rows[0];
  el.innerHTML='🪙 <b>Chip Champion: '+escapeHtml(name)+' ('+chips+' chips)</b> — wins an EXTRA £15 — the 30-second Don Quijote dash (grab anything up to £15)! ('+rows.map(r=>escapeHtml(r[0])+': '+r[1]).join(' · ')+')';
}
function renderLeaderboard(){
  const chips=chipStandings();
  const m=new Map();PLAYER_NAMES.forEach(n=>m.set(n,{username:n,points:0,stops:0}));
  shared.submissions.forEach(i=>{if(i.status!=='approved')return;const r=m.get(i.username)||{username:i.username,points:0,stops:0};r.points+=scoreWithBonus(i);r.stops+=1;m.set(i.username,r);});
  const rows=[...m.values()].sort((a,b)=>b.points-a.points||a.username.localeCompare(b.username));
  els.leaderboardRows.innerHTML='';
  const pb=new Map();shared.submissions.forEach(i=>{pb.set(i.username,Math.max(pb.get(i.username)||0,Number(i.playBonus||0)));});
  rows.forEach(r=>r.points+=pb.get(r.username)||0);
  rows.sort((a,b)=>b.points-a.points||a.username.localeCompare(b.username));
  rows.forEach((r,i)=>{const tr=document.createElement('tr');tr.innerHTML='<td></td><td></td><td></td><td></td><td></td>';
    tr.children[0].textContent=i+1;tr.children[1].textContent=r.username;tr.children[2].textContent=r.points;tr.children[3].textContent=r.stops;tr.children[4].textContent=chips.get(r.username)??'—';
    els.leaderboardRows.appendChild(tr);});
  renderChipChamp();
  els.leaderboardEmpty.classList.toggle('hidden',rows.some(r=>r.points>0));
}
async function approveSubmission(id,bonus){
  const b=Math.max(0,Math.min(25,Number(bonus)||0));
  updateSub(id,{status:'approved',bonus:b,approvedAt:new Date().toISOString(),approvedBy:session.username,updatedAt:new Date().toISOString()});
  renderHome();await postRemote({action:'approve',id,bonus:b,approvedBy:session.username,adminKey:session.adminKey});
}
async function rejectSubmission(id){
  updateSub(id,{status:'rejected',approvedBy:session.username,updatedAt:new Date().toISOString()});
  renderHome();await postRemote({action:'reject',id,approvedBy:session.username,adminKey:session.adminKey});
}
function updateSub(id,u){const i=shared.submissions.findIndex(x=>x.id===id);if(i<0)return;shared.submissions[i]={...shared.submissions[i],...u};saveShared();}
function renderReward(){
  const done=!isAdmin()&&STOPS.every(s=>statusForStop(s.id)==='approved');
  els.amazonBtn.disabled=!done;
  els.rewardText.textContent=done?'You finished the whole adventure! Crack the vault! 🏆':'Clear every stop to crack the vault — £15 cash to spend in Japan or Korea!';
}

/* ---------- sync (Google Apps Script) ---------- */
async function syncShared(){
  /* reset check runs first */
  if(!CONFIG.sheetEndpoint){loadShared();applySharedToProgress();renderHome();return;}
  try{const url=new URL(CONFIG.sheetEndpoint);url.searchParams.set('action','state');url.searchParams.set('t',Date.now());
    const r=await fetch(url.toString());const raw=await r.json();
    const fresh=normaliseShared(raw);
    if(checkRemoteReset(fresh))return;
    shared=fresh;saveShared();}catch{loadShared();}
  applySharedToProgress();applyGrants();
  try{if(purgeOldPhotos()){writeJson(progressKey(),progress);}}catch(_){/**/}
  renderHome();syncPlayer();
}
async function postRemote(payload){
  if(!CONFIG.sheetEndpoint)return null;
  try{const r=await fetch(CONFIG.sheetEndpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)});
    const data=await r.json();if(data?.submissions){shared=normaliseShared(data);saveShared();}return data;}catch{return null;}
}
/* ===== API helpers for players + rooms ===== */
async function apiPost(payload){
  if(!CONFIG.sheetEndpoint)return {ok:false,error:'No backend URL set in app.js (CONFIG.sheetEndpoint).'};
  try{
    const r=await fetch(CONFIG.sheetEndpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)});
    const text=await r.text();
    try{return JSON.parse(text);}
    catch(_){
      /* Apps Script returns an HTML page when the script throws */
      const m=text.match(/(Bad admin key|Missing submission fields|Exception:[^<]{0,120}|Error:[^<]{0,120})/i);
      return {ok:false,error:m?m[0]:'Server sent a non-JSON reply (HTTP '+r.status+'). Redeploy the Apps Script as a NEW VERSION with access "Anyone".'};
    }
  }catch(e){return {ok:false,error:'Network error: '+(e&&e.message?e.message:'offline?')};}
}
async function apiGet(params){if(!CONFIG.sheetEndpoint)return null;try{const u=new URL(CONFIG.sheetEndpoint);Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v));u.searchParams.set('t',Date.now());const r=await fetch(u.toString());return await r.json();}catch(_){return null;}}
/* push this player's live stats so admin sees them */
let _syncT=null;
function syncPlayer(){
  if(!session||isAdmin()||session.test||!CONFIG.sheetEndpoint)return;
  clearTimeout(_syncT);
  _syncT=setTimeout(()=>{
    const seasonTier=(typeof SEASON_REWARDS!=='undefined')?SEASON_REWARDS.filter(r=>totalEarned()>=r[0]).length:0;
    apiPost({action:'savePlayer',player:{
      username:session.username,
      points:playerPoints(session.username)+(progress.playBonus||0),
      chips:progress.chips||0,
      chipsEarned:progress.chipsEarned||0,
      seasonTier:seasonTier,
      stops:STOPS.filter(s=>statusForStop(s.id)==='approved').length,
      character:JSON.stringify({equip:(progress.char&&progress.char.equip)||{},steps:progress.steps||{}})
    }});
  },1500);
}
function checkRemoteReset(data){
  const stamp=data&&data.resetStamp?String(data.resetStamp):'';
  if(!stamp)return false;
  const mine=localStorage.getItem(RESET_KEY)||'';
  if(mine!==stamp){wipeLocal(stamp);location.reload();return true;}
  return false;
}
function normaliseShared(data){
  const c=freshShared();c.updatedAt=data?.updatedAt||null;
  /* the admin RESET writes a marker row into ChipGrants; the newest one starts a fresh season */
  const rawGrants=Array.isArray(data?.grants)?data.grants:[];
  const markers=rawGrants.filter(g=>g&&g.username===RESET_MARKER).sort((a,b)=>timestamp(b.createdAt)-timestamp(a.createdAt));
  const since=Math.max(SEASON_START,markers.length?timestamp(markers[0].createdAt):0,Number(data?.seasonStart)||0);
  c.seasonStart=since;
  c.resetStamp=markers.length?String(markers[0].id):(data?.resetStamp||null);
  c.players=(Array.isArray(data?.players)?data.players:[]).filter(p=>p&&timestamp(p.updatedAt)>=since);
  c.grants=rawGrants.filter(g=>g&&g.username!==RESET_MARKER&&timestamp(g.createdAt)>=since);
  c.submissions=Array.isArray(data?.submissions)?data.submissions.map(i=>({
    id:String(i.id||i.ID||''),username:String(i.username||i.Username||''),stopId:String(i.stopId||i.StopID||''),
    stopTitle:String(i.stopTitle||i.StopTitle||''),day:String(i.day||i.Day||''),hotel:String(i.hotel||i.Hotel||''),
    score:Number(i.score||i.Score||SCORE_PER_STOP),bonus:Number(i.bonus||i.Bonus||0),status:String(i.status||i.Status||'pending').toLowerCase(),
    submittedAt:String(i.submittedAt||i.SubmittedAt||''),updatedAt:String(i.updatedAt||i.UpdatedAt||''),approvedAt:String(i.approvedAt||i.ApprovedAt||''),
    approvedBy:String(i.approvedBy||i.ApprovedBy||''),suggestBonus:Number(i.suggestBonus||i.SuggestBonus||0),chips:Number(i.chips||i.Chips||0),playBonus:Number(i.playBonus||i.PlayBonus||0),proofName:String(i.proofName||i.ProofName||''),proofImage:String(i.proofImage||i.ProofImage||''),activity:String(i.activity||i.Activity||'')
  })).filter(i=>i.id&&i.username&&i.stopId&&stopById(i.stopId)&&timestamp(i.submittedAt||i.updatedAt)>=since):[];
  return c;
}
function exportCsv(){
  const rows=[['ID','Username','Stop','Status','Score','Bonus','Notes']];
  shared.submissions.forEach(i=>rows.push([i.id,i.username,i.stopTitle,i.status,i.score,i.bonus,i.activity]));
  const csv=rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\n');
  const b=new Blob([csv],{type:'text/csv'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='asia2026-scores.csv';a.click();URL.revokeObjectURL(a.href);
}

/* ---------- image compression ---------- */
function imageToThumb(file,max,q){return new Promise((res,rej)=>{const rd=new FileReader();rd.onload=()=>{const im=new Image();im.onload=()=>{const sc=Math.min(1,(max||480)/Math.max(im.width,im.height));const c=document.createElement('canvas');c.width=Math.round(im.width*sc);c.height=Math.round(im.height*sc);c.getContext('2d').drawImage(im,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',q||0.6));};im.onerror=rej;im.src=rd.result;};rd.onerror=rej;rd.readAsDataURL(file);});}

/* ---------- auth / boot ---------- */
async function doLogin(name,password){
  if(name.trim().toLowerCase()==='test'){session={username:'test',role:'player',test:true};sessionStorage.setItem(STORAGE.session,JSON.stringify(session));await openSite();return true;}
  const acc=normalName(name);if(!acc)return false;
  const account=ACCOUNTS[acc];if(await sha256(password)!==account.hash)return false;
  session={username:acc,role:account.role,test:false};if(account.role==='admin')session.adminKey=password;
  sessionStorage.setItem(STORAGE.session,JSON.stringify(session));await openSite();return true;
}
async function openSite(){
  loadProgress();loadShared();
  els.login.classList.add('hidden');els.site.classList.remove('hidden');document.getElementById('cornerMascot')?.classList.remove('hidden');startBear();wireBear();
  showHome();
  if(countdownTimer)clearInterval(countdownTimer);
  countdownTimer=setInterval(renderCountdown,30000);
  setTimeout(()=>bearCelebrate(isAdmin()?'The boss has arrived! 👑':'WELCOME BACK, CHAMPION! 🎉'),700);checkStreak();document.getElementById('journey')?.classList.remove('hidden');
  await syncShared();
}
els.loginForm.addEventListener('submit',async e=>{e.preventDefault();els.loginError.textContent='';if(!await doLogin(els.username.value,els.password.value))els.loginError.textContent='Wrong name or password.';});
els.logoutBtn.addEventListener('click',()=>{sessionStorage.removeItem(STORAGE.session);session=null;stopGame();els.site.classList.add('hidden');els.login.classList.remove('hidden');document.getElementById('cornerMascot')?.classList.add('hidden');clearInterval(bearTimer);});
els.backBtn.addEventListener('click',showHome);
els.syncBtn.addEventListener('click',()=>{checkForUpdate(true);syncShared();});
els.adminRefreshBtn.addEventListener('click',syncShared);
els.exportCsvBtn.addEventListener('click',exportCsv);
els.amazonBtn.addEventListener('click',()=>{if(!els.amazonBtn.disabled)jackpot(()=>els.voucher.classList.remove('hidden'));});
/* ===== 10-second NEON JACKPOT sequence ===== */
function jackpot(done){
  if(document.querySelector('.jackpot'))return;
  const o=document.createElement('div');o.className='jackpot';
  o.innerHTML='<div class="jp-lights"></div>'+
    '<div class="jp-inner">'+
      '<div class="jp-reels"><span>7</span><span>7</span><span>7</span></div>'+
      '<div class="jp-title">JACKPOT!</div>'+
      '<div class="jp-sub">ASIA 2026 CHAMPION</div>'+
      '<div class="jp-count">$<b>0</b></div>'+
    '</div>';
  document.body.appendChild(o);sfx('jackpot');
  /* coin + confetti rain */
  const EM=['🪙','💰','⭐','💎','🎉','🌸','🔔'];
  const rain=setInterval(()=>{for(let i=0;i<6;i++){const s=document.createElement('span');s.className='jp-coin';s.textContent=EM[Math.floor(Math.random()*EM.length)];
    s.style.left=Math.random()*100+'vw';s.style.animationDuration=(1.6+Math.random()*1.8)+'s';s.style.fontSize=(1.2+Math.random()*2)+'rem';
    o.appendChild(s);setTimeout(()=>s.remove(),3600);}},130);
  /* money counter rolls up to 1,000,000 over ~6s... then reality hits */
  const cEl=o.querySelector('.jp-count b');const t0=Date.now();
  const count=setInterval(()=>{const p=Math.min(1,(Date.now()-t0)/6000);
    cEl.textContent=Math.floor(1000000*p*p).toLocaleString();
    if(p>=1){clearInterval(count);
      setTimeout(()=>{o.querySelector('.jp-count').classList.add('crash');cEl.textContent='15';
        o.querySelector('.jp-title').textContent='OK... £15';
        o.querySelector('.jp-sub').textContent='TO SPEND IN TOKYO 🗼';
      },900);}
  },50);
  /* reels land one by one */
  const reels=[...o.querySelectorAll('.jp-reels span')];
  reels.forEach((r,i)=>{r.classList.add('spin');setTimeout(()=>{r.classList.remove('spin');r.classList.add('land');},900+i*800);});
  setTimeout(()=>o.querySelector('.jp-title').classList.add('show'),3400);
  setTimeout(()=>o.querySelector('.jp-sub').classList.add('show'),4100);
  /* end after 10s */
  setTimeout(()=>{clearInterval(rain);o.classList.add('out');setTimeout(()=>{o.remove();if(done)done();},600);},10000);
}
function updateChips(){const el=document.getElementById('hudChips');if(el)el.textContent=(progress.chips||0);const d=document.querySelector('.den-balance b');if(d)d.textContent=(progress.chips||0);const cc=document.getElementById('charChips');if(cc)cc.textContent=(progress.chips||0);}
function bearCelebrate(msg){
  const m=document.getElementById('cornerMascot');if(!m)return;
  m.classList.remove('mega');void m.offsetWidth; /* restart animation */
  m.classList.add('mega');setTimeout(()=>m.classList.remove('mega'),1900);
  if(msg)bearShout(msg);
}
function bearShout(msg){const b=document.getElementById('bearBubble');if(!b)return;b.textContent=msg;b.classList.add('show');clearTimeout(bearShout._t);bearShout._t=setTimeout(()=>b.classList.remove('show'),4200);}
/* talking lucky-cat mascot */
const BEAR_LINES=['Tap the glowing stop!','Snap those photos! \ud83d\udcf8','Beat my high score\u2026 if you can!','Win a game, win 10 chips. \ud83e\ude99','TAP ME for the Neon Den. \ud83c\udfb0','Photo of EVERY hunt item \u2014 no cheating!','Bonus points for extra wins!','I am the house. The house wins.','Feeling lucky? Tap me.','Most chips at the end wins REAL money. \ud83d\udcb7','Sugoi! Nice work, team!','Hot spring after this, I reckon.'];
let bearTimer=null,bearIdx=-1;
function bearSay(){const b=document.getElementById('bearBubble');if(!b)return;let i;do{i=Math.floor(Math.random()*BEAR_LINES.length);}while(i===bearIdx);bearIdx=i;b.textContent=BEAR_LINES[i];b.classList.add('show');setTimeout(()=>b.classList.remove('show'),4600);}
function wireBear(){const m=document.getElementById('cornerMascot');
  if(m&&!m.dataset.wired){m.dataset.wired='1';m.style.pointerEvents='auto';m.style.cursor='pointer';
    m.addEventListener('click',e=>{e.preventDefault();sfx('click');openDen();});
    if(!document.getElementById('bearAcc')){const a=document.createElement('span');a.id='bearAcc';a.className='bear-acc';m.appendChild(a);}}}
/* Kimbap only pipes up occasionally — event messages (wins, chips, warnings) still fire instantly */
function startBear(){clearInterval(bearTimer);bearTimer=setInterval(bearSay,75000);wireBear();}
/* ===== MOCHI'S NEON DEN — gamble your chips ===== */
let denWager=5;
function openDen(){
  if(isAdmin()){bearShout('Admins don’t gamble. House rules!');return;}
  if(document.querySelector('.den'))return;
  const o=document.createElement('div');o.className='den';
  o.innerHTML='<div class="den-card">'+
    '<button type="button" class="den-close">✕</button>'+
    '<div class="den-head">🐒 KIMBAP’S NEON DEN</div>'+
    '<div class="den-balance">🪙 Chips: <b>'+(progress.chips||0)+'</b></div>'+
    '<div class="den-wager">'+
      '<span class="den-wager-lbl">Your bet</span>'+
      '<div class="den-amt-row">'+
        '<button type="button" class="den-step" data-d="-5" aria-label="Lower bet">−</button>'+
        '<input class="den-amt" type="number" inputmode="numeric" pattern="[0-9]*" min="1" step="1" value="10" aria-label="Bet amount">'+
        '<button type="button" class="den-step" data-d="5" aria-label="Raise bet">+</button>'+
      '</div>'+
      '<button type="button" class="den-bet den-allin" data-v="all">ALL IN</button>'+
    '</div>'+
    '<div class="den-games">'+

      '<div class="den-game"><h4>🪙 Coin Flip ×2</h4>'+
        '<div class="den-coin">?</div>'+
        '<div class="den-row"><button type="button" class="btn btn-primary den-flip" data-p="H">Heads</button>'+
        '<button type="button" class="btn btn-secondary den-flip" data-p="T">Tails</button></div>'+
        '<p class="den-mini">Call it. Right = double your bet.</p></div>'+

      '<div class="den-game"><h4>🐉 Dragon Tower</h4>'+
        '<div class="tower"></div>'+
        '<div class="den-row"><button type="button" class="btn btn-primary tower-go">Start climb</button>'+
        '<button type="button" class="btn btn-secondary tower-out" disabled>Cash out</button></div>'+
        '<p class="den-mini">Three doors a floor, one is a dud. Climb for ×1.6 each time — or take the money and run.</p></div>'+

      '<div class="den-game"><h4>🀄 Mahjong Pairs ×3</h4>'+
        '<div class="mj-grid"></div>'+
        '<div class="den-row"><button type="button" class="btn btn-primary mj-go">Deal tiles</button></div>'+
        '<p class="den-mini">Six tiles, three picks. Find the matching pair.</p></div>'+

      '<div class="den-game"><h4>🥢 Chopstick Draw ×4</h4>'+
        '<div class="sticks"></div>'+
        '<div class="den-row"><button type="button" class="btn btn-primary stick-go">New draw</button></div>'+
        '<p class="den-mini">One of the four is long. Pick it and win four times your bet.</p></div>'+

      '<div class="den-game"><h4>🎁 Gachapon</h4>'+
        '<div class="gacha">🎁</div>'+
        '<div class="den-row"><button type="button" class="btn btn-primary gacha-go">Turn the handle</button></div>'+
        '<p class="den-mini">One capsule, one prize. Usually rubbish. Sometimes ×50.</p></div>'+

      '<div class="den-game"><h4>🧧 Lucky Envelope</h4>'+
        '<div class="env-row"></div>'+
        '<div class="den-row"><button type="button" class="btn btn-primary env-go">New envelopes</button></div>'+
        '<p class="den-mini">Six envelopes. Two are empty, one pays ×10.</p></div>'+

    '</div>'+
    '<p class="den-msg">Type how much you want to bet, then choose a game.</p>'+
    '<p class="den-instr">📖 HOW IT WORKS: set your bet, then play. Win = your bet multiplied. Lose = bet gone. MOST CHIPS AT THE END OF THE TRIP = EXTRA £15! (30-second shop dash — grab anything up to £15!)</p>'+
  '</div>';
  document.body.appendChild(o);
  const msg=o.querySelector('.den-msg');
  /* ---- bet: type any amount, or go ALL IN ---- */
  const amtEl=o.querySelector('.den-amt'),allBtn=o.querySelector('.den-allin');
  let denAllIn=false;
  const purse=()=>Math.max(0,progress.chips||0);
  function clampAmt(){
    let v=Math.floor(Number(amtEl.value));
    if(!Number.isFinite(v)||v<1)v=1;
    const c=purse(); if(c>0&&v>c)v=c;
    return v;
  }
  function syncWager(write){
    amtEl.max=Math.max(1,purse());
    if(denAllIn){
      denWager='all';allBtn.classList.add('on');amtEl.readOnly=true;amtEl.value=purse();
    }else{
      const v=clampAmt();denWager=String(v);allBtn.classList.remove('on');amtEl.readOnly=false;
      if(write)amtEl.value=v;
    }
  }
  amtEl.addEventListener('input',()=>{denAllIn=false;syncWager(false);});
  amtEl.addEventListener('change',()=>{denAllIn=false;syncWager(true);});
  amtEl.addEventListener('focus',()=>{if(denAllIn){denAllIn=false;syncWager(true);}amtEl.select();});
  o.querySelectorAll('.den-step').forEach(b=>b.addEventListener('click',()=>{
    denAllIn=false;
    amtEl.value=Math.max(1,clampAmt()+Number(b.dataset.d));
    syncWager(true);sfx('click');
  }));
  allBtn.addEventListener('click',()=>{denAllIn=!denAllIn;syncWager(true);sfx('click');});
  amtEl.value=Math.min(10,Math.max(1,purse()||10));
  syncWager(true);
  function stake(){const c=purse();const w=denAllIn?c:Math.min(Number(denWager)||0,c);
    if(w<=0){msg.textContent='No chips! Beat an arcade game (+10) and come back.';return 0;}
    return w;}
  function pay(delta){progress.chips=Math.max(0,(progress.chips||0)+delta);saveProgress();updateChips();syncPlayer();syncWager(true);}
  function settle(win,w,mult,label){
    pay(win?(w*mult-w):-w);
    msg.textContent=win?('🎉 '+label+' You win '+Math.round(w*mult-w)+' chips!'):('💀 '+label+' Lost '+w+' chips.');
    burst(o.querySelector('.den-card'));
    if(!win){const card=o.querySelector('.den-card');card.classList.add('shake');setTimeout(()=>card.classList.remove('shake'),400);}
    if(win){sfx('win');bearCelebrate('NOO! My chips! 😭');}else{sfx('lose');bearShout('The house thanks you. 😏');}
    denReact(win);
  }
  let busy=false;

  /* ---------- 1. COIN FLIP (unchanged favourite) ---------- */
  o.querySelectorAll('.den-flip').forEach(b=>b.addEventListener('click',()=>{
    if(busy)return;const w=stake();if(!w)return;busy=true;
    const coin=o.querySelector('.den-coin');coin.classList.add('flip');let t=0;
    const iv=setInterval(()=>{coin.textContent=Math.random()<0.5?'H':'T';if(++t>=12){clearInterval(iv);coin.classList.remove('flip');
      const res=Math.random()<0.5?'H':'T';coin.textContent=res;settle(res===b.dataset.p,w,2,'Coin says '+res+'.');busy=false;}},100);}));

  /* ---------- 2. DRAGON TOWER — climb or cash out ---------- */
  const tower=o.querySelector('.tower'),tGo=o.querySelector('.tower-go'),tOut=o.querySelector('.tower-out');
  let tStake=0,tFloor=0,tLive=false;
  function towerPaint(pick,bad){
    const mult=Math.pow(1.6,tFloor);
    tower.innerHTML='<div class="tower-mult">'+(tLive?'Floor '+tFloor+' · pot <b>'+Math.round(tStake*mult)+'</b> chips':'Not climbing')+'</div>'+
      '<div class="tower-doors">'+[0,1,2].map(i=>'<button type="button" class="tower-door'+
        (pick===i?(bad?' dud':' safe'):'')+'" data-i="'+i+'" '+(tLive?'':'disabled')+'>'+
        (pick===i?(bad?'💥':'🐉'):'🚪')+'</button>').join('')+'</div>';
    tower.querySelectorAll('.tower-door').forEach(d=>d.addEventListener('click',()=>towerPick(+d.dataset.i)));
  }
  function towerPick(i){
    if(!tLive||busy)return;
    const dud=Math.floor(Math.random()*3);
    if(i===dud){tLive=false;towerPaint(i,true);tOut.disabled=true;tGo.textContent='Start climb';
      msg.textContent='💥 Dud door on floor '+(tFloor+1)+'! Lost '+tStake+' chips.';
      sfx('lose');bearShout('The dragon says thanks. 😏');denReact(false);
      const card=o.querySelector('.den-card');card.classList.add('shake');setTimeout(()=>card.classList.remove('shake'),400);
      return;}
    tFloor++;towerPaint(i,false);
    msg.textContent='⬆️ Floor '+tFloor+'! Pot is '+Math.round(tStake*Math.pow(1.6,tFloor))+' chips. Climb again or cash out?';
    sfx('coin');
  }
  tGo.addEventListener('click',()=>{
    if(tLive||busy)return;const w=stake();if(!w)return;
    pay(-w);tStake=w;tFloor=0;tLive=true;tOut.disabled=false;tGo.textContent='Climbing…';
    towerPaint(-1,false);msg.textContent='Climbing! Pick a door.';
  });
  tOut.addEventListener('click',()=>{
    if(!tLive)return;
    const won=Math.round(tStake*Math.pow(1.6,tFloor));
    tLive=false;tOut.disabled=true;tGo.textContent='Start climb';
    pay(won);towerPaint(-1,false);
    if(tFloor>0){msg.textContent='💰 Cashed out on floor '+tFloor+' — +'+(won-tStake)+' chips!';sfx('win');burst(o.querySelector('.den-card'));bearCelebrate('Coward! A rich coward. 🐉');denReact(true);}
    else msg.textContent='Bet returned — you did not climb.';
  });
  towerPaint(-1,false);

  /* ---------- 3. MAHJONG PAIRS ---------- */
  const mj=o.querySelector('.mj-grid');
  const MJ_FACES=['🀄','🌸','🎋','🍙','🏮','🍵'];
  let mjTiles=[],mjPicks=0,mjStake=0,mjLive=false,mjFound={};
  function mjPaint(){
    mj.innerHTML=mjTiles.map((f,i)=>'<button type="button" class="mj-tile'+(mjFound[i]?' up':'')+'" data-i="'+i+'" '+(mjLive?'':'disabled')+'>'+(mjFound[i]?f:'🁆')+'</button>').join('');
    mj.querySelectorAll('.mj-tile').forEach(t=>t.addEventListener('click',()=>mjPick(+t.dataset.i)));
  }
  function mjPick(i){
    if(!mjLive||mjFound[i])return;
    mjFound[i]=true;mjPicks++;mjPaint();sfx('click');
    const up=Object.keys(mjFound).map(k=>mjTiles[k]);
    const pair=up.some((f,a)=>up.indexOf(f)!==a);
    if(pair){mjLive=false;mj.querySelectorAll('.mj-tile').forEach(t=>t.disabled=true);settle(true,mjStake,3,'Matching pair in '+mjPicks+'!');return;}
    if(mjPicks>=3){mjLive=false;mjTiles.forEach((f,k)=>mjFound[k]=true);mjPaint();mj.querySelectorAll('.mj-tile').forEach(t=>t.disabled=true);settle(false,mjStake,3,'No pair in three picks.');return;}
    msg.textContent='Pick '+mjPicks+'/3 — no pair yet…';
  }
  o.querySelector('.mj-go').addEventListener('click',()=>{
    if(busy)return;const w=stake();if(!w)return;
    const faces=[...MJ_FACES].sort(()=>Math.random()-0.5).slice(0,3);
    mjTiles=[faces[0],faces[0],faces[1],faces[2],faces[1],faces[2]].sort(()=>Math.random()-0.5);
    mjStake=w;mjPicks=0;mjFound={};mjLive=true;mjPaint();
    msg.textContent='Three picks to find a pair. Go.';
  });
  mjTiles=['🁆','🁆','🁆','🁆','🁆','🁆'];mjPaint();

  /* ---------- 4. CHOPSTICK DRAW ---------- */
  const sticks=o.querySelector('.sticks');
  let stkLong=0,stkLive=false,stkStake=0;
  function stkPaint(reveal){
    sticks.innerHTML=[0,1,2,3].map(i=>'<button type="button" class="stick'+
      (reveal?(i===stkLong?' long':' short'):'')+'" data-i="'+i+'" '+(stkLive?'':'disabled')+'><span></span></button>').join('');
    sticks.querySelectorAll('.stick').forEach(b=>b.addEventListener('click',()=>{
      if(!stkLive)return;stkLive=false;const i=+b.dataset.i;stkPaint(true);
      sticks.querySelectorAll('.stick')[i].classList.add('chosen');
      settle(i===stkLong,stkStake,4,i===stkLong?'The long one!':'Short straw.');
    }));
  }
  o.querySelector('.stick-go').addEventListener('click',()=>{
    if(busy)return;const w=stake();if(!w)return;
    stkStake=w;stkLong=Math.floor(Math.random()*4);stkLive=true;stkPaint(false);
    msg.textContent='Four chopsticks. One is long. Choose.';
  });
  stkPaint(false);

  /* ---------- 5. GACHAPON ---------- */
  const gacha=o.querySelector('.gacha');
  o.querySelector('.gacha-go').addEventListener('click',()=>{
    if(busy)return;const w=stake();if(!w)return;busy=true;
    const PRIZES=[[0,'🪨 A pebble. Nothing.',45],[1.5,'🧸 Keyring — ×1.5',30],[3,'🎎 Rare figure — ×3',18],[10,'💎 Gold capsule — ×10!',6],[50,'👑 SECRET GRAND PRIZE — ×50!!',1]];
    let t=0;const spin=setInterval(()=>{gacha.textContent=['🎁','🫙','✨','🎰'][t%4];
      if(++t>=14){clearInterval(spin);
        let r=Math.random()*100,pick=PRIZES[0];
        for(const pz of PRIZES){if(r<pz[2]){pick=pz;break;}r-=pz[2];}
        gacha.textContent=pick[0]>=10?'💎':pick[0]>0?'🧸':'🪨';
        if(pick[0]>0)settle(true,w,pick[0],pick[1]);
        else settle(false,w,0,pick[1]);
        busy=false;}},90);
  });

  /* ---------- 6. LUCKY ENVELOPE ---------- */
  const envRow=o.querySelector('.env-row');
  let envVals=[],envLive=false,envStake=0;
  function envPaint(reveal,chosen){
    envRow.innerHTML=envVals.map((v,i)=>'<button type="button" class="env'+(reveal?' open':'')+(chosen===i?' chosen':'')+'" data-i="'+i+'" '+(envLive?'':'disabled')+'>'+
      (reveal?(v?'×'+v:'∅'):'🧧')+'</button>').join('');
    envRow.querySelectorAll('.env').forEach(b=>b.addEventListener('click',()=>{
      if(!envLive)return;envLive=false;const i=+b.dataset.i;envPaint(true,i);
      const v=envVals[i];
      if(v>0)settle(true,envStake,v,'Envelope paid ×'+v+'!');
      else settle(false,envStake,0,'Empty envelope.');
    }));
  }
  o.querySelector('.env-go').addEventListener('click',()=>{
    if(busy)return;const w=stake();if(!w)return;
    envStake=w;envVals=[0,0,1,2,3,10].sort(()=>Math.random()-0.5);envLive=true;envPaint(false,-1);
    msg.textContent='Six envelopes. Pick one.';
  });
  envVals=[0,0,1,2,3,10];envPaint(false,-1);

  o.querySelector('.den-close').addEventListener('click',()=>o.remove());
  o.addEventListener('click',e=>{if(e.target===o)o.remove();});
}
/* ============================================================
   SELF-UPDATE — the app notices a new build and refreshes itself.
   version.json is fetched with no-store, so it is never a cached answer.
   Guarded by a per-build sessionStorage flag so it can never loop.
   ?fresh=1 in the address bar force-wipes every cache and the worker.
   ============================================================ */
const BUILD=(typeof window!=='undefined'&&window.__BUILD__)||'dev';
function nukeCaches(){
  const jobs=[];
  try{if(window.caches&&caches.keys)jobs.push(caches.keys().then(ks=>Promise.all(ks.map(k=>caches.delete(k)))));}catch(_){/**/}
  try{if(navigator.serviceWorker&&navigator.serviceWorker.getRegistrations)
    jobs.push(navigator.serviceWorker.getRegistrations().then(rs=>Promise.all(rs.map(r=>r.unregister()))));}catch(_){/**/}
  return Promise.all(jobs).catch(()=>{});
}
function checkForUpdate(loud){
  return fetch('version.json?t='+Date.now(),{cache:'no-store'})
    .then(r=>r.json())
    .then(d=>{
      if(!d||!d.build)return false;
      if(d.build===BUILD){if(loud)toast('✅ You are on the latest version.');return false;}
      let tried='';
      try{tried=sessionStorage.getItem('a26-updating')||'';}catch(_){/**/}
      if(tried===d.build&&!loud)return false;
      try{sessionStorage.setItem('a26-updating',d.build);}catch(_){/**/}
      if(loud)toast('⬇️ New version found — updating…',4000);
      return nukeCaches().then(()=>{setTimeout(()=>location.reload(),loud?700:0);return true;});
    })
    .catch(()=>false);
}
try{
  if(new URLSearchParams(location.search).get('fresh')==='1'){
    nukeCaches().then(()=>location.replace(location.pathname));
  }else{
    setTimeout(()=>checkForUpdate(false),1200);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')checkForUpdate(false);});
  }
}catch(_){/**/}

/* ---- neon skyline backdrop: build the skyscrapers once ---- */
function buildCity(){
  document.querySelectorAll('.city').forEach(city=>{
    if(city.dataset.built)return;city.dataset.built='1';
    const rnd=mulberry(seedFrom('asia26-city'));
    let x=-3;
    while(x<103){
      const w=4+Math.floor(rnd()*8), h=18+Math.floor(rnd()*58);
      const b=document.createElement('b');
      b.style.left=x+'%';b.style.width=w+'%';b.style.height=h+'%';
      if(rnd()<0.28)b.style.borderRadius='3px 3px 0 0';
      city.appendChild(b);
      x+=w+(rnd()<0.5?0.6:1.8);
    }
    for(let i=0;i<10;i++){
      const g=document.createElement('i');
      g.style.left=(4+rnd()*92)+'%';g.style.height=(18+rnd()*52)+'%';
      city.appendChild(g);
    }
  });
}
buildCity();
document.addEventListener('DOMContentLoaded',buildCity);

const pp=new URLSearchParams(location.search);
if(pp.get('preview')==='test'){session={username:'test',role:'player',test:true};sessionStorage.setItem(STORAGE.session,JSON.stringify(session));openSite();}
else{try{const s=JSON.parse(sessionStorage.getItem(STORAGE.session)||'null');if(s?.username){session=s;openSite();}}catch{}}

/* ================================================================
   HUB MODULE — Game Zone, Music, Postcards, Journey GPS, Streaks,
   Mystery Boxes, SFX, cat moods/name, Ceremony, play-time points
   ================================================================ */
let BEAR_NAME='Kimbap';
const BEAR_NAMES=['Kimbap','Momo','Yuki','Bento','Ramen','Kimchi','Tofu','Saru'];
function setBearName(n){BEAR_NAME=n;localStorage.setItem('a26-catname',n);bearCelebrate('Call me '+n+'! 🐱');}
/* ---- SFX + haptics (34) ---- */
let muted=localStorage.getItem('a26-muted')==='1';let audioCtx=null;
function sfx(kind){
  if(muted)return;
  try{audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();
    const t=audioCtx.currentTime,o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(audioCtx.destination);
    const P={win:[[523,0],[659,.09],[784,.18],[1047,.27]],lose:[[300,0],[220,.12],[150,.24]],coin:[[988,0],[1319,.07]],click:[[600,0]],jackpot:[[523,0],[659,.1],[784,.2],[1047,.3],[1319,.4],[1568,.5]]}[kind]||[[440,0]];
    o.type='square';g.gain.setValueAtTime(.06,t);
    P.forEach(([f,d])=>o.frequency.setValueAtTime(f,t+d));
    g.gain.exponentialRampToValueAtTime(.001,t+(P[P.length-1][1]+.15));o.start(t);o.stop(t+P[P.length-1][1]+.2);
  }catch(_){/**/}
  try{if(navigator.vibrate){const V={win:[40,30,40],lose:[120],coin:[20],jackpot:[60,40,60,40,120]};navigator.vibrate(V[kind]||20);}}catch(_){/**/}
}
document.getElementById('muteBtn')?.addEventListener('click',()=>{muted=!muted;localStorage.setItem('a26-muted',muted?'1':'0');document.getElementById('muteBtn').textContent=muted?'🔇':'🔊';});
if(document.getElementById('muteBtn'))document.getElementById('muteBtn').textContent=muted?'🔇':'🔊';

/* ===== DOODLE DUEL (1) — pass & play ===== */
const DOODLE_WORDS=['torii gate','bullet train','Mount Fuji','sushi','ramen bowl','neon sign','pagoda','lucky cat','vending machine','monkey','fox statue','lantern','kimono','skyscraper','chopsticks','koi carp','castle','suitcase','camera','bubble tea'];
function hubDoodle(body){
  const word=DOODLE_WORDS[Math.floor(Math.random()*DOODLE_WORDS.length)];
  body.innerHTML='<div class="game-hud">✏️ Drawer: peek at the word, draw it. Others guess out loud! Tap NEW for another.</div>'+
    '<div class="doodle-word">Tap to reveal word 👁️</div>'+
    '<canvas class="doodle-canvas" width="600" height="360"></canvas>'+
    '<div class="den-row"><button class="btn btn-secondary doodle-clear" type="button">🧹 Clear</button><button class="btn btn-primary doodle-new" type="button">🔄 New word</button></div>';
  const wEl=body.querySelector('.doodle-word'),c=body.querySelector('.doodle-canvas'),ctx=c.getContext('2d');
  let revealed=false,cur=word;
  ctx.fillStyle='#fff';ctx.fillRect(0,0,600,360);ctx.strokeStyle='#241a22';ctx.lineWidth=4;ctx.lineCap='round';ctx.lineJoin='round';
  wEl.addEventListener('click',()=>{revealed=!revealed;wEl.textContent=revealed?('✏️ Draw: '+cur):'Tap to reveal word 👁️';});
  let drawing=false;
  function pos(e){const r=c.getBoundingClientRect();return [(e.clientX-r.left)*600/r.width,(e.clientY-r.top)*360/r.height];}
  c.addEventListener('pointerdown',e=>{e.preventDefault();drawing=true;try{c.setPointerCapture(e.pointerId);}catch(_){}const[x,y]=pos(e);ctx.beginPath();ctx.moveTo(x,y);});
  c.addEventListener('pointermove',e=>{if(!drawing)return;e.preventDefault();const[x,y]=pos(e);ctx.lineTo(x,y);ctx.stroke();});
  c.addEventListener('pointerup',()=>drawing=false);c.addEventListener('pointerleave',()=>drawing=false);
  c.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});
  body.querySelector('.doodle-clear').addEventListener('click',()=>{ctx.fillStyle='#fff';ctx.fillRect(0,0,600,360);});
  body.querySelector('.doodle-new').addEventListener('click',()=>{cur=DOODLE_WORDS[Math.floor(Math.random()*DOODLE_WORDS.length)];revealed=false;wEl.textContent='Tap to reveal word 👁️';ctx.fillStyle='#fff';ctx.fillRect(0,0,600,360);sfx('click');});
}

/* ===== INVESTING BOARD — tap the chip to invest ===== */
const MARKET=[
  {sym:'GOLD',name:'Gold',cg:null,base:2350,emoji:'🥇'},
  {sym:'SILVER',name:'Silver',cg:null,base:30,emoji:'🥈'},
  {sym:'OIL',name:'Crude Oil',cg:null,base:80,emoji:'🛢️'},
  {sym:'BTC',name:'Bitcoin',cg:'bitcoin',base:65000,emoji:'₿'},
  {sym:'ETH',name:'Ethereum',cg:'ethereum',base:3200,emoji:'💎'},
  {sym:'SPX',name:'S&P 500',cg:null,base:5400,emoji:'📈'},
  {sym:'TSLA',name:'Tesla',cg:null,base:250,emoji:'🚗'},
  {sym:'AMZN',name:'Amazon',cg:null,base:185,emoji:'📦'},
  {sym:'RKLB',name:'Rocket Lab',cg:null,base:8,emoji:'🚀'},
  {sym:'AAPL',name:'Apple',cg:null,base:220,emoji:'🍎'},
  {sym:'NVDA',name:'Nvidia',cg:null,base:125,emoji:'🎮'},
  {sym:'GOOG',name:'Google',cg:null,base:180,emoji:'🔍'},
  {sym:'MSFT',name:'Microsoft',cg:null,base:440,emoji:'🪟'},
  {sym:'NFLX',name:'Netflix',cg:null,base:680,emoji:'🍿'},
  {sym:'DIS',name:'Disney',cg:null,base:95,emoji:'🏰'},
  {sym:'MCD',name:'McDonald\u2019s',cg:null,base:290,emoji:'🍔'},
  {sym:'KO',name:'Coca-Cola',cg:null,base:63,emoji:'🥤'},
  {sym:'NKE',name:'Nike',cg:null,base:75,emoji:'👟'},
  {sym:'NTDOY',name:'Nintendo',cg:null,base:19,emoji:'🍄'},
  {sym:'SONY',name:'Sony',cg:null,base:98,emoji:'🎮'},
  {sym:'SSNLF',name:'Samsung',cg:null,base:52,emoji:'📱'},
  {sym:'TM',name:'Toyota',cg:null,base:185,emoji:'🚙'},
  {sym:'HYMTF',name:'Hyundai',cg:null,base:44,emoji:'🚗'},
  {sym:'UNIQLO',name:'Uniqlo (Fast Retailing)',cg:null,base:340,emoji:'👕'},
  {sym:'HYBE',name:'HYBE (BTS label)',cg:null,base:170,emoji:'🎤'}
];
/* price = base * (1 + daily wiggle). Crypto pulled live from CoinGecko (free, no key); rest simulated with a seeded daily drift so it feels real and consistent within a day. */
function marketPrice(m){
  if(m.live)return m.live;
  const daySeed=seedFrom(m.sym+jstDate().toDateString());
  const drift=(mulberry(daySeed)()-0.5)*0.12; // ±6% "today"
  return +(m.base*(1+drift)).toFixed(2);
}
async function refreshCrypto(){
  const ids=MARKET.filter(m=>m.cg).map(m=>m.cg).join(',');
  try{const r=await fetch('https://api.coingecko.com/api/v3/simple/price?ids='+ids+'&vs_currencies=usd');
    const d=await r.json();MARKET.forEach(m=>{if(m.cg&&d[m.cg])m.live=d[m.cg].usd;});return true;}catch(_){return false;}
}
function invPortfolio(){progress.invest=progress.invest||{};return progress.invest;}
function invValue(){const p=invPortfolio();return Object.entries(p).reduce((s,[sym,units])=>{const m=MARKET.find(x=>x.sym===sym);return s+(m?units*marketPrice(m):0);},0);}
function openInvest(){
  if(document.querySelector('.inv'))return;
  const o=document.createElement('div');o.className='inv';
  o.innerHTML='<div class="inv-card"><button class="inv-close" type="button">✕</button>'+
    '<div class="inv-head">📈 Kimbap\u2019s Trading Floor</div>'+
    '<div class="inv-bal">🪙 Chips: <b class="inv-chips">'+(progress.chips||0)+'</b> · Portfolio: <b class="inv-pv">0</b> chips</div>'+
    '<p class="inv-note">Invest chips in REAL markets. Crypto prices are LIVE; others use today\u2019s realistic estimate. Prices change daily — buy low, sell high! <b>This is pretend money for fun.</b></p>'+
    '<div class="inv-status"></div><div class="inv-list"></div></div>';
  document.body.appendChild(o);
  const list=o.querySelector('.inv-list'),status=o.querySelector('.inv-status');
  function paint(){
    o.querySelector('.inv-chips').textContent=(progress.chips||0);
    o.querySelector('.inv-pv').textContent=Math.round(invValue());
    const p=invPortfolio();
    list.innerHTML=MARKET.map(m=>{const price=marketPrice(m);const held=p[m.sym]||0;
      return '<div class="inv-row"><span class="inv-sym">'+m.emoji+' '+m.name+(m.live?' <i class="inv-live">LIVE</i>':'')+'</span>'+
        '<span class="inv-price">'+price.toLocaleString()+' ch</span>'+
        '<span class="inv-held">'+(held?held.toFixed(3)+' units':'—')+'</span>'+
        '<span class="inv-btns"><button class="inv-buy" data-s="'+m.sym+'">Buy 10</button><button class="inv-sell" data-s="'+m.sym+'" '+(held?'':'disabled')+'>Sell all</button></span></div>';
    }).join('');
    list.querySelectorAll('.inv-buy').forEach(b=>b.addEventListener('click',()=>{
      const m=MARKET.find(x=>x.sym===b.dataset.s),price=marketPrice(m),spend=10;
      if((progress.chips||0)<spend){status.textContent='Not enough chips! Win some first.';return;}
      progress.chips-=spend;p[m.sym]=(p[m.sym]||0)+spend/price;saveProgress();updateChips();paint();sfx('coin');status.textContent='Bought '+spend+' chips of '+m.name+'.';}));
    list.querySelectorAll('.inv-sell').forEach(b=>b.addEventListener('click',()=>{
      const m=MARKET.find(x=>x.sym===b.dataset.s),price=marketPrice(m),units=p[m.sym]||0;if(!units)return;
      const got=Math.round(units*price);progress.chips=(progress.chips||0)+got;delete p[m.sym];saveProgress();updateChips();paint();sfx('win');
      status.textContent='Sold '+m.name+' for '+got+' chips!';bearShout(got>0?'Cha-ching! 📈':'Oof, sold at a loss. 📉');}));
  }
  paint();status.textContent='Fetching live crypto prices…';
  refreshCrypto().then(ok=>{status.textContent=ok?'Live crypto prices loaded ✓':'Offline — using today\u2019s estimates.';paint();});
  o.querySelector('.inv-close').addEventListener('click',()=>o.remove());
  o.addEventListener('click',e=>{if(e.target===o)o.remove();});
}
/* make the HUD chip tappable */
document.addEventListener('click',e=>{const c=e.target.closest('.hud-chips');if(c&&!isAdmin()){openInvest();}});

/* ===== CHARACTER + ITEM SHOP + SEASON PASS ===== */
/* Items: id, name, price, category, and how they paint on the avatar. rarity sets the card colour. */
/* ============================================================
   WARDROBE 3.0 — generated: 180+ items, Fortnite-style shaded avatar
   ============================================================ */
const COLORS={red:'#d94f3d',orange:'#e8651f',gold:'#f0a830',green:'#5f8a4a',teal:'#3aa79a',blue:'#3a6fd5',navy:'#2c3e6b',purple:'#8a4d9e',pink:'#e86fae',black:'#26262e',white:'#f2efe8',brown:'#8a5a33'};
const HAIR_COLORS={brown:'#5a3a1a',black:'#1c1c22',blonde:'#e6c86a',ginger:'#c0431a',red:'#a8331a',pink:'#e86fae',blue:'#3a6fd5',purple:'#8a4d9e',silver:'#c9c9d4'};
function rarFor(p){return p===0?'free':p<40?'common':p<80?'rare':p<140?'epic':'legendary';}
const SHOP_ITEMS=[];
function addItem(o){o.rar=rarFor(o.price);SHOP_ITEMS.push(o);}
/* Body — 6 tones, free */
[['light','#f1c9a5'],['fair','#eab98a'],['tan','#e0ac69'],['olive','#c68e5a'],['brown','#a56b46'],['deep','#7a4a2b']].forEach(([n,v])=>addItem({id:'skin_'+n,cat:'Body',name:n[0].toUpperCase()+n.slice(1),price:0,skin:v}));
/* Hair — 8 styles × 9 colors = 72 */
{const styles=[['short','Short',0],['buzz','Buzz Cut',10],['wavy','Wavy',20],['long','Long',25],['pony','Ponytail',35],['bun','Bun',35],['curly','Curls',55],['spike','Spikes',85]];
Object.entries(HAIR_COLORS).forEach(([cn,cv])=>styles.forEach(([sid,sn,base])=>addItem({id:'hair_'+sid+'_'+cn,cat:'Hair',name:cn[0].toUpperCase()+cn.slice(1)+' '+sn,price:(cn==='brown'&&sid==='short')?0:base+(['silver','pink','blue','purple'].includes(cn)?30:0),hair:cv,hairstyle:sid})));}
/* Tops — 5 styles × 12 colors = 60 */
{const styles=[['tee','Tee',10],['vest','Vest',20],['hoodie','Hoodie',45],['jacket','Jacket',70],['dress','Dress',50]];
Object.entries(COLORS).forEach(([cn,cv])=>styles.forEach(([sid,sn,base])=>addItem({id:'top_'+sid+'_'+cn,cat:'Tops',name:cn[0].toUpperCase()+cn.slice(1)+' '+sn,price:(cn==='red'&&sid==='tee')?0:base+(cn==='gold'?60:0),top:sid,color:cv,dress:sid==='dress'})));}
addItem({id:'top_gold_suit',cat:'Tops',name:'Golden Suit ✨',price:180,top:'jacket',color:'#f0a830',glow:true});
/* Bottoms — 4 styles × 8 colors */
{const styles=[['jeans','Jeans',10],['shorts','Shorts',15],['skirt','Skirt',20],['joggers','Joggers',25]];
['blue','navy','black','red','green','purple','pink','gold'].forEach(cn=>styles.forEach(([sid,sn,base])=>addItem({id:'btm_'+sid+'_'+cn,cat:'Bottoms',name:cn[0].toUpperCase()+cn.slice(1)+' '+sn,price:(cn==='blue'&&sid==='jeans')?0:base+(cn==='gold'?50:0),btm:sid,color:COLORS[cn]})));}
/* Shoes — 3 styles × 8 colors */
{const styles=[['sneaker','Sneakers',10],['boot','Boots',25],['hitop','Hi-Tops',40]];
['white','black','red','blue','pink','green','purple','gold'].forEach(cn=>styles.forEach(([sid,sn,base])=>addItem({id:'shoe_'+sid+'_'+cn,cat:'Shoes',name:cn[0].toUpperCase()+cn.slice(1)+' '+sn,price:(cn==='white'&&sid==='sneaker')?0:base+(cn==='gold'?40:0),shoe:sid,color:COLORS[cn]})));}
/* Hats */
[['none','No Hat',0,null],['cap','Baseball Cap',30,'cap'],['beanie','Ski Beanie',35,'beanie'],['bow','Sakura Bow 🌸',35,'bow'],['cowboy','Samurai Kabuto ⛩️',45,'cowboy'],['party','Party Hat',45,'party'],['flower','Blossom Crown 🌸',60,'flower'],['headphones','Headphones',75,'phones'],['wizard','Wizard Hat 🧙',120,'wizard'],['crown','Golden Crown 👑',200,'crown']].forEach(([id,n,p,k])=>addItem({id:'hat_'+id,cat:'Hat',name:n,price:p,hat:k}));
/* Face */
[['none','None',0,null],['glasses','Round Glasses',25,'glasses'],['tache','Silly Moustache',30,'tache'],['freckles','Freckles',20,'freckles'],['sun','Sunglasses 😎',45,'sun'],['star','Star Face Paint ⭐',55,'star'],['heart','Heart Face Paint 💖',55,'heart'],['warpaint','War Paint',65,'warpaint']].forEach(([id,n,p,k])=>addItem({id:'acc_'+id,cat:'Face',name:n,price:p,acc:k}));
/* Pets */
[['none','No Pet',0,null],['dog','Shiba Inu 🐕',60,'🐕'],['cat','Lucky Cat 🐈',60,'🐈'],['lizard','Gecko 🦎',70,'🦎'],['snake','Snake 🐍',75,'🐍'],['scorpion','Koi Carp 🐟',75,'🐟'],['burro','Sika Deer 🦌',90,'🦌'],['eagle','Crane 🕊️',90,'🕊️'],['bear','Mini Kimbap 🐒',110,'🐒'],['ufo','UFO Buddy 🛸',130,'🛸'],['unicorn','Unicorn 🦄',140,'🦄'],['dragon','Dragon 🐉',160,'🐉']].forEach(([id,n,p,e])=>addItem({id:'pet_'+id,cat:'Pet',name:n,price:p,pet:e}));
/* Auras / Scenes / Nameplates */
[['none','None',0,null],['gold','Golden Glow',80,'gold'],['stars','Star Sparkle ✨',100,'stars'],['fire','Fire Ring 🔥',120,'fire'],['ice','Ice Mist ❄️',120,'ice'],['rainbow','Rainbow Aura 🌈',180,'rainbow']].forEach(([id,n,p,a])=>addItem({id:'aura_'+id,cat:'Aura',name:n,price:p,aura:a}));
[['locker','Locker Room',0,'locker'],['route','Tokyo Neon 🏙️',50,'tokyo'],['canyon','Kyoto Sunset ⛩️',60,'kyoto'],['beach','Mount Fuji 🗻',70,'fuji'],['vegas','Seoul Nights 🌃',90,'seoul'],['space','Outer Space 🌌',110,'space']].forEach(([id,n,p,s])=>addItem({id:'scene_'+id,cat:'Scene',name:n,price:p,scene:s}));
[['plain','Classic',0,'plain'],['gold','Gold Bar',60,'gold'],['neon','Neon Sign',90,'neon'],['royal','Royal Banner 👑',150,'royal']].forEach(([id,n,p,k])=>addItem({id:'name_'+id,cat:'Nameplate',name:n,price:p,plate:k}));

const SHOP_CATS=['Body','Hair','Tops','Bottoms','Shoes','Hat','Face','Pet','Aura','Scene','Nameplate'];
const RAR_LABEL={free:'FREE',common:'Common',rare:'Rare',epic:'Epic',legendary:'Legendary'};
function char(){
  progress.char=progress.char||{owned:{},equip:{}};
  const c=progress.char;c.owned=c.owned||{};c.equip=c.equip||{};
  SHOP_ITEMS.forEach(i=>{if(i.price===0)c.owned[i.id]=1;});
  const defaults={Body:'skin_tan',Hair:'hair_short_brown',Tops:'top_tee_red',Bottoms:'btm_jeans_blue',Shoes:'shoe_sneaker_white',Hat:'hat_none',Face:'acc_none',Pet:'pet_none',Aura:'aura_none',Scene:'scene_locker',Nameplate:'name_plain'};
  SHOP_CATS.forEach(cat=>{if(!c.equip[cat]||!SHOP_ITEMS.find(i=>i.id===c.equip[cat]&&i.cat===cat))c.equip[cat]=defaults[cat];});
  return c;
}
function equipped(cat){const it=SHOP_ITEMS.find(i=>i.id===char().equip[cat]);return it||SHOP_ITEMS.find(i=>i.cat===cat);}

/* ---------- Fortnite-style shaded human ---------- */
function shade(hex,f){const n=parseInt(hex.slice(1),16);let r=(n>>16)&255,g=(n>>8)&255,b=n&255;
  r=Math.max(0,Math.min(255,Math.round(r*f)));g=Math.max(0,Math.min(255,Math.round(g*f)));b=Math.max(0,Math.min(255,Math.round(b*f)));
  return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);}
function grad(id,c){return '<linearGradient id="'+id+'" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="'+shade(c,1.18)+'"/><stop offset=".55" stop-color="'+c+'"/><stop offset="1" stop-color="'+shade(c,0.66)+'"/></linearGradient>';}
function avatarSVG(){
  const body=equippedView('Body'),hair=equippedView('Hair'),top=equippedView('Tops'),btm=equippedView('Bottoms'),shoe=equippedView('Shoes'),hat=equippedView('Hat'),face=equippedView('Face'),pet=equippedView('Pet');
  const S=body.skin||'#e0ac69',H=hair.hair||'#5a3a1a',T=top.color||'#d94f3d',B=btm.color||'#3a6fd5',SH=shoe.color||'#f2efe8';
  const OUT='#1f1620',LW=2.6;
  const defs='<defs>'+grad('gS',S)+grad('gT',T)+grad('gB',B)+grad('gSh',SH)+grad('gH',H)+
    '<radialGradient id="gFace" cx="42%" cy="35%" r="75%"><stop offset="0" stop-color="'+shade(S,1.16)+'"/><stop offset=".7" stop-color="'+S+'"/><stop offset="1" stop-color="'+shade(S,0.8)+'"/></radialGradient></defs>';
  const isDress=!!top.dress,isShorts=btm.btm==='shorts',isSkirt=btm.btm==='skirt';
  /* legs + bottoms */
  let legs='';
  const legSkin='fill="url(#gS)" stroke="'+OUT+'" stroke-width="'+LW+'"';
  if(isDress){
    legs='<rect x="82" y="196" width="14" height="52" rx="7" '+legSkin+'/><rect x="104" y="196" width="14" height="52" rx="7" '+legSkin+'/>';
  }else if(isShorts){
    legs='<path d="M76 168h48l-4 34h-15l-5-20-5 20h-15z" fill="url(#gB)" stroke="'+OUT+'" stroke-width="'+LW+'"/>'+
      '<rect x="82" y="200" width="14" height="48" rx="7" '+legSkin+'/><rect x="104" y="200" width="14" height="48" rx="7" '+legSkin+'/>';
  }else if(isSkirt){
    legs='<path d="M76 168h48l8 30H68z" fill="url(#gB)" stroke="'+OUT+'" stroke-width="'+LW+'"/>'+
      '<rect x="82" y="196" width="14" height="52" rx="7" '+legSkin+'/><rect x="104" y="196" width="14" height="52" rx="7" '+legSkin+'/>';
  }else{ /* jeans / joggers */
    const cuff=btm.btm==='joggers'?'<rect x="80" y="240" width="18" height="8" rx="4" fill="'+shade(B,0.7)+'"/><rect x="102" y="240" width="18" height="8" rx="4" fill="'+shade(B,0.7)+'"/>':'';
    legs='<path d="M76 168h48l-2 82h-18l-4-58-4 58H78z" fill="url(#gB)" stroke="'+OUT+'" stroke-width="'+LW+'"/>'+cuff;
  }
  /* shoes */
  let shoes='';
  const shoeH=shoe.shoe==='boot'?18:shoe.shoe==='hitop'?16:12;
  shoes='<path d="M78 '+(258-shoeH)+'h20a6 6 0 016 6v6a4 4 0 01-4 4H76a4 4 0 01-4-4v-4a8 8 0 016-8z" fill="url(#gSh)" stroke="'+OUT+'" stroke-width="'+LW+'"/>'+
        '<path d="M102 '+(258-shoeH)+'h20a6 6 0 016 6v6a4 4 0 01-4 4h-24a4 4 0 01-4-4v-4a8 8 0 016-8z" fill="url(#gSh)" stroke="'+OUT+'" stroke-width="'+LW+'"/>'+
        '<rect x="72" y="268" width="30" height="5" rx="2.5" fill="'+shade(SH,0.55)+'"/><rect x="98" y="268" width="30" height="5" rx="2.5" fill="'+shade(SH,0.55)+'"/>';
  /* torso + arms */
  let torso='',arms='';
  const sleeve=top.top==='vest'?0:(top.top==='tee'||isDress)?1:2; /* 0 none,1 short,2 long */
  if(isDress){
    torso='<path d="M74 108c0-10 52-10 52 0l12 88H62z" fill="url(#gT)" stroke="'+OUT+'" stroke-width="'+LW+'"/>'+
      '<path d="M74 132h52" stroke="'+shade(T,0.75)+'" stroke-width="2"/>';
  }else{
    torso='<path d="M72 106c0-12 56-12 56 0v56a10 10 0 01-10 10H82a10 10 0 01-10-10z" fill="url(#gT)" stroke="'+OUT+'" stroke-width="'+LW+'"/>';
    if(top.top==='hoodie')torso+='<path d="M84 150h32v14H84z" rx="6" fill="'+shade(T,0.8)+'"/><path d="M92 108v14M108 108v14" stroke="'+shade(T,0.6)+'" stroke-width="3"/>';
    if(top.top==='jacket')torso+='<path d="M100 106v66" stroke="'+shade(T,0.55)+'" stroke-width="4"/><path d="M84 106l16 22 16-22" fill="none" stroke="'+shade(T,0.7)+'" stroke-width="3"/>';
  }
  const armSkin='url(#gS)',armCloth='url(#gT)';
  const upperFill=sleeve>=1?armCloth:armSkin, lowerFill=sleeve===2?armCloth:armSkin;
  arms='<g>'+
    '<path d="M72 112c-10 2-16 14-16 30v18a7 7 0 0014 0v-16c0-10 2-18 6-22z" fill="'+upperFill+'" stroke="'+OUT+'" stroke-width="'+LW+'"/>'+
    (sleeve===1?'<path d="M56 142v18a7 7 0 0014 0v-16z" fill="'+armSkin+'" stroke="'+OUT+'" stroke-width="'+LW+'"/>':'')+
    '<circle cx="63" cy="166" r="7.5" fill="url(#gS)" stroke="'+OUT+'" stroke-width="'+LW+'"/>'+
    '<path d="M128 112c10 2 16 14 16 30v18a7 7 0 01-14 0v-16c0-10-2-18-6-22z" fill="'+upperFill+'" stroke="'+OUT+'" stroke-width="'+LW+'"/>'+
    (sleeve===1?'<path d="M144 142v18a7 7 0 01-14 0v-16z" fill="'+armSkin+'" stroke="'+OUT+'" stroke-width="'+LW+'"/>':'')+
    '<circle cx="137" cy="166" r="7.5" fill="url(#gS)" stroke="'+OUT+'" stroke-width="'+LW+'"/></g>';
  /* head */
  const head='<path d="M92 96h16v14c0 6-16 6-16 0z" fill="url(#gS)" stroke="'+OUT+'" stroke-width="'+LW+'"/>'+
    '<ellipse cx="100" cy="62" rx="30" ry="33" fill="url(#gFace)" stroke="'+OUT+'" stroke-width="'+LW+'"/>'+
    '<ellipse cx="69" cy="64" rx="5" ry="7" fill="url(#gS)" stroke="'+OUT+'" stroke-width="2"/>'+
    '<ellipse cx="131" cy="64" rx="5" ry="7" fill="url(#gS)" stroke="'+OUT+'" stroke-width="2"/>';
  /* face detail */
  let faceD='<g><ellipse cx="88" cy="62" rx="4.5" ry="6" fill="#1c1420"/><ellipse cx="112" cy="62" rx="4.5" ry="6" fill="#1c1420"/>'+
    '<circle cx="89.6" cy="59.6" r="1.7" fill="#fff"/><circle cx="113.6" cy="59.6" r="1.7" fill="#fff"/>'+
    '<path d="M81 51c3-3 9-3 13-1M106 50c4-2 10-2 13 1" stroke="'+shade(H,0.85)+'" stroke-width="3.4" fill="none" stroke-linecap="round"/>'+
    '<path d="M98 66c1 4 1 6-2 8" stroke="'+shade(S,0.7)+'" stroke-width="2.4" fill="none" stroke-linecap="round"/>'+
    '<path d="M90 82c5 5 15 5 20 0" stroke="#8a3a2e" stroke-width="3.4" fill="none" stroke-linecap="round"/>'+
    '<ellipse cx="80" cy="74" rx="5" ry="3" fill="#e88" opacity=".28"/><ellipse cx="120" cy="74" rx="5" ry="3" fill="#e88" opacity=".28"/></g>';
  if(face.acc==='sun')faceD+='<g fill="#241a22"><rect x="78" y="55" width="18" height="12" rx="5"/><rect x="104" y="55" width="18" height="12" rx="5"/><rect x="95" y="59" width="10" height="3"/></g>';
  if(face.acc==='glasses')faceD+='<g fill="none" stroke="#241a22" stroke-width="2.6"><circle cx="88" cy="61" r="9"/><circle cx="112" cy="61" r="9"/><path d="M97 61h6"/></g>';
  if(face.acc==='tache')faceD+='<path d="M88 78c4-4 8-4 12 0 4-4 8-4 12 0-4 4-8 3-12 0-4 3-8 4-12 0z" fill="'+shade(H,0.8)+'"/>';
  if(face.acc==='freckles')faceD+='<g fill="'+shade(S,0.72)+'"><circle cx="82" cy="72" r="1.4"/><circle cx="87" cy="75" r="1.4"/><circle cx="113" cy="75" r="1.4"/><circle cx="118" cy="72" r="1.4"/></g>';
  if(face.acc==='star')faceD+='<text x="72" y="52" font-size="13">⭐</text>';
  if(face.acc==='heart')faceD+='<text x="115" y="52" font-size="13">💖</text>';
  if(face.acc==='warpaint')faceD+='<path d="M76 70l10 3M124 70l-10 3" stroke="#c1440e" stroke-width="4" stroke-linecap="round"/>';
  /* hair styles */
  let hairEl='';const hg='url(#gH)';
  const st=hair.hairstyle;
  if(st==='short')hairEl='<path d="M70 56c-2-22 62-22 60 0-1 6-4 7-4 7 0-14-52-14-52 0 0 0-3-1-4-7z" fill="'+hg+'" stroke="'+OUT+'" stroke-width="2"/>';
  else if(st==='buzz')hairEl='<path d="M72 52c0-16 56-16 56 0l-2 5c-4-10-48-10-52 0z" fill="'+hg+'" opacity=".9"/>';
  else if(st==='wavy')hairEl='<path d="M70 58c-4-26 64-26 60 0-1 7-5 9-5 9 2-8-2-12-6-8-3-8-9-10-13-5-4-6-12-6-16 0-4-5-10-3-13 5-4-4-8 0-6 8 0 0-1-2-1-9z" fill="'+hg+'" stroke="'+OUT+'" stroke-width="2"/>';
  else if(st==='long')hairEl='<path d="M68 58c-4-26 68-26 64 0l-2 46c0 8-12 8-12 0V70c-2-12-34-12-36 0v34c0 8-12 8-12 0z" fill="'+hg+'" stroke="'+OUT+'" stroke-width="2"/>';
  else if(st==='pony')hairEl='<path d="M70 56c-2-22 62-22 60 0-1 6-4 7-4 7 0-14-52-14-52 0 0 0-3-1-4-7z" fill="'+hg+'" stroke="'+OUT+'" stroke-width="2"/><path d="M128 52c16 6 20 34 10 58-5-2-9-5-11-9 7-16 6-36-3-42z" fill="'+hg+'" stroke="'+OUT+'" stroke-width="2"/>';
  else if(st==='bun')hairEl='<circle cx="100" cy="26" r="12" fill="'+hg+'" stroke="'+OUT+'" stroke-width="2"/><path d="M70 56c-2-22 62-22 60 0-1 6-4 7-4 7 0-14-52-14-52 0 0 0-3-1-4-7z" fill="'+hg+'" stroke="'+OUT+'" stroke-width="2"/>';
  else if(st==='curly')hairEl='<g fill="'+hg+'" stroke="'+OUT+'" stroke-width="2"><circle cx="74" cy="48" r="11"/><circle cx="88" cy="38" r="12"/><circle cx="103" cy="35" r="12"/><circle cx="118" cy="40" r="11"/><circle cx="128" cy="52" r="9"/></g>';
  else if(st==='spike')hairEl='<path d="M68 58l10-24 9 16 11-22 10 20 11-18 9 22 6-12 -2 18c-4-12-58-12-64 0z" fill="'+hg+'" stroke="'+OUT+'" stroke-width="2"/>';
  /* hats */
  let hatEl='';
  if(hat.hat==='cowboy')hatEl='<path d="M70 40c0-20 60-20 60 0z" fill="#1f3a6b" stroke="'+OUT+'" stroke-width="2"/><path d="M64 40h72l-6 7H70z" fill="#16294d" stroke="'+OUT+'" stroke-width="2"/><path d="M84 22l16-14 16 14" fill="none" stroke="#ffd23f" stroke-width="5" stroke-linecap="round"/>';
  else if(hat.hat==='cap')hatEl='<path d="M72 38c0-18 56-18 56 0z" fill="#d94f3d" stroke="'+OUT+'" stroke-width="2"/><ellipse cx="136" cy="39" rx="18" ry="5" fill="#a83a2c" stroke="'+OUT+'" stroke-width="2"/>';
  else if(hat.hat==='beanie')hatEl='<path d="M72 42c0-24 56-24 56 0z" fill="#3aa79a" stroke="'+OUT+'" stroke-width="2"/><rect x="70" y="39" width="60" height="9" rx="4.5" fill="#2a7d72" stroke="'+OUT+'" stroke-width="2"/>';
  else if(hat.hat==='bow')hatEl='<g fill="#e86fae" stroke="'+OUT+'" stroke-width="2"><path d="M88 32l-18-9v18z"/><path d="M112 32l18-9v18z"/><circle cx="100" cy="32" r="7"/></g>';
  else if(hat.hat==='party')hatEl='<path d="M100 4l18 34H82z" fill="#8a4d9e" stroke="'+OUT+'" stroke-width="2"/><circle cx="100" cy="5" r="5" fill="#f0a830"/>';
  else if(hat.hat==='flower')hatEl='<g font-size="13"><text x="72" y="40">🌸</text><text x="92" y="33">🌼</text><text x="113" y="40">🌸</text></g>';
  else if(hat.hat==='phones')hatEl='<path d="M70 60c-4-30 64-30 60 0" fill="none" stroke="#26262e" stroke-width="7"/><rect x="62" y="54" width="12" height="20" rx="6" fill="#26262e"/><rect x="126" y="54" width="12" height="20" rx="6" fill="#26262e"/>';
  else if(hat.hat==='wizard')hatEl='<path d="M100 -2l22 42H78z" fill="#3b1a47" stroke="'+OUT+'" stroke-width="2"/><ellipse cx="100" cy="40" rx="30" ry="6" fill="#5b2a6b" stroke="'+OUT+'" stroke-width="2"/><text x="93" y="26" font-size="12">✨</text>';
  else if(hat.hat==='crown')hatEl='<path d="M76 36l8-20 12 12 4-16 4 16 12-12 8 20z" fill="#f0a830" stroke="#c1440e" stroke-width="2.4"/><circle cx="100" cy="16" r="4" fill="#e0654f"/>';
  const glow=top.glow?'<ellipse cx="100" cy="150" rx="85" ry="120" fill="#f0a830" opacity=".14"/>':'';
  const petEl=pet.pet?'<text x="152" y="230" font-size="34">'+pet.pet+'</text>':'';
  return '<svg viewBox="0 0 200 280" width="100%" height="100%">'+defs+glow+petEl+
    legs+shoes+torso+arms+head+faceD+hairEl+hatEl+'</svg>';
}
let previewItem=null; /* item being tried on but not owned */
function equippedView(cat){
  if(previewItem&&previewItem.cat===cat)return previewItem;
  return equipped(cat);
}
function playerTitle(){
  const t=totalEarned();
  return t>=1000?'🌟 ASIA MASTER':t>=500?'⛩️ Shrine Legend':t>=200?'🚄 Bullet Runner':'🎒 Rookie Explorer';
}
/* 3D locker stage: idle spin + drag to rotate */
let charRot=0,charDrag=null,charIdle=null;
function applyCharRot(){
  const box=document.getElementById('charAvatar');if(!box)return;
  const r=((charRot%360)+360)%360;
  const deg=(r>180?r-360:r)*0.4;
  box.style.transform='perspective(760px) rotateY('+deg+'deg)';
}
function wireCharStage(){
  const box=document.getElementById('charAvatar');if(!box||box.dataset.wired)return;box.dataset.wired='1';
  clearInterval(charIdle);
  charIdle=setInterval(()=>{if(charDrag===null){charRot+=0.4;applyCharRot();}},50);
  box.addEventListener('pointerdown',e=>{e.preventDefault();charDrag=e.clientX;try{box.setPointerCapture(e.pointerId);}catch(_){/**/}});
  box.addEventListener('pointermove',e=>{if(charDrag===null)return;charRot+=(e.clientX-charDrag)*0.7;charDrag=e.clientX;applyCharRot();});
  box.addEventListener('pointerup',()=>charDrag=null);
  box.addEventListener('pointerleave',()=>charDrag=null);
  box.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});
}
function renderCharacter(){
  const box=document.getElementById('charAvatar');
  const stage=document.querySelector('.char-stage');
  const aura=(equippedView('Aura')||{}).aura,scene=(equippedView('Scene')||{}).scene||'locker',plate=(equippedView('Nameplate')||{}).plate||'plain';
  if(stage){stage.className='char-stage scene-'+scene;}
  if(box){box.innerHTML=avatarSVG();box.classList.toggle('previewing',!!previewItem);box.dataset.aura=aura||'';}
  const nm2=document.getElementById('charName');if(nm2)nm2.dataset.plate=plate;
  const cc=document.getElementById('charChips');if(cc)cc.textContent=session&&session.test?'∞':(progress.chips||0);
  const nm=document.getElementById('charName');if(nm)nm.textContent=(session?session.username:'')+' · '+playerTitle();
  const bar=document.getElementById('charBuyBar');
  if(bar){
    if(previewItem){bar.classList.remove('hidden');
      bar.innerHTML='<span>Trying on: <b>'+previewItem.name+'</b></span>'+
        '<button type="button" class="btn btn-primary char-buy">🪙 Buy for '+previewItem.price+'</button>'+
        '<button type="button" class="btn btn-quiet char-cancel">Cancel</button>';
      bar.querySelector('.char-buy').addEventListener('click',()=>{const it=previewItem;previewItem=null;buyOrWear(it.id);});
      bar.querySelector('.char-cancel').addEventListener('click',()=>{previewItem=null;renderCharacter();renderShop();sfx('click');});
    } else bar.classList.add('hidden');
  }
}
let shopCat='Hair';
function renderShop(){
  const tabs=document.getElementById('shopTabs'),grid=document.getElementById('shopGrid');if(!tabs||!grid)return;
  tabs.innerHTML=SHOP_CATS.map(c=>'<button type="button" class="shop-tab'+(c===shopCat?' on':'')+'" data-c="'+c+'">'+c+'</button>').join('');
  tabs.querySelectorAll('.shop-tab').forEach(b=>b.addEventListener('click',()=>{shopCat=b.dataset.c;renderShop();}));
  const owned=char().owned,equip=char().equip;
  grid.innerHTML=SHOP_ITEMS.filter(i=>i.cat===shopCat).map(i=>{
    const have=owned[i.id],on=equip[i.cat]===i.id,pv=previewItem&&previewItem.id===i.id;
    return '<div class="shop-item rar-'+i.rar+(on?' equipped':'')+(pv?' previewing':'')+'">'+
      '<div class="shop-rar">'+RAR_LABEL[i.rar]+'</div>'+
      '<div class="shop-name">'+i.name+'</div>'+
      '<button type="button" class="shop-act" data-id="'+i.id+'">'+(on?'Wearing ✓':have?'Wear':(i.price>0?('👀 Try · 🪙 '+i.price):'Wear'))+'</button></div>';
  }).join('');
  grid.querySelectorAll('.shop-act').forEach(b=>b.addEventListener('click',()=>tryOrWear(b.dataset.id)));
}
function tryOrWear(id){
  const it=SHOP_ITEMS.find(i=>i.id===id);if(!it)return;const c=char();
  if(c.owned[id]){previewItem=null;c.equip[it.cat]=id;saveProgress();renderCharacter();renderShop();syncPlayer();sfx('click');return;}
  /* not owned: try it on first — SEE it before you buy */
  previewItem=it;renderCharacter();renderShop();sfx('click');
  bearShout('Looking good! Buy it or keep browsing. 🐒');
}
function buyOrWear(id){
  const it=SHOP_ITEMS.find(i=>i.id===id);if(!it)return;const c=char();
  if(!c.owned[id]){
    if(!(session&&session.test)&&(progress.chips||0)<it.price){bearShout('Not enough chips! Go win some. 🐒');previewItem=null;renderCharacter();renderShop();return;}
    if(it.price>0 && !confirm('Spend '+it.price+' chips on '+it.name+'?\n\nRemember: chips can win you REAL money (the £15 shop dash) — spend them on outfits only if you\u2019re sure!')) {previewItem=null;renderCharacter();renderShop();return;}
    if(!(session&&session.test))progress.chips-=it.price;
    c.owned[id]=1;sfx('coin');bearCelebrate('Nice '+it.name+'! Looking good! 🐒');
  }
  c.equip[it.cat]=id;saveProgress();updateChips();renderCharacter();renderShop();syncPlayer();sfx('click');
}
/* ===== SEASON PASS (28) — driven by TOTAL chips ever earned ===== */
/* Season pass: a tier EVERY 10 chips earned — 40 tiers */
const SEASON_ITEM_DROPS=['hat_beanie','acc_glasses','shoe_hitop_red','hair_wavy_blonde','hat_cap','acc_sun','btm_joggers_black','pet_lizard','top_hoodie_purple','scene_route','hat_cowboy','aura_gold','pet_burro','name_gold','top_jacket_navy','scene_vegas','aura_stars','hat_headphones','pet_bear','name_neon','aura_fire','scene_space','hat_wizard','pet_ufo','top_gold_suit','aura_rainbow','name_royal','hat_crown'];
const SEASON_REWARDS=(function(){
  const out=[];let drop=0;
  for(let t=1;t<=40;t++){
    const req=t*10;
    if(t%3===0&&drop<SEASON_ITEM_DROPS.length){const id=SEASON_ITEM_DROPS[drop++];const it=SHOP_ITEMS.find(i=>i.id===id);
      out.push([req,(it?it.name:'Mystery item')+' 🎁','item',id]);}
    else out.push([req,'🪙 +'+(5+Math.floor(t/8)*5)+' chips','chips',5+Math.floor(t/8)*5]);
  }
  return out;
})();
function totalEarned(){return progress.chipsEarned||0;}
function grantEarn(n){progress.chipsEarned=(progress.chipsEarned||0)+n;checkSeason();}
function checkSeason(){
  const t=totalEarned();progress.seasonClaimed=progress.seasonClaimed||[];
  SEASON_REWARDS.forEach((r,idx)=>{
    if(t>=r[0]&&!progress.seasonClaimed.includes(idx)){
      progress.seasonClaimed.push(idx);
      if(r[2]==='chips'){progress.chips=(progress.chips||0)+r[3];}
      else if(r[2]==='item'){char().owned[r[3]]=1;}
      saveProgress();updateChips();setTimeout(()=>bearCelebrate('🎟️ Season tier '+(idx+1)+'! Unlocked: '+r[1]),1500);
    }
  });
}
function renderSeason(){
  const track=document.getElementById('seasonTrack'),lbl=document.getElementById('seasonTierLbl');if(!track)return;
  const t=totalEarned(),claimed=progress.seasonClaimed||[];
  const tier=SEASON_REWARDS.filter(r=>t>=r[0]).length;
  if(lbl)lbl.textContent='Tier '+tier+' / '+SEASON_REWARDS.length+' · '+t+' chips earned';
  track.innerHTML=SEASON_REWARDS.map((r,idx)=>{const done=t>=r[0];
    return '<div class="season-node'+(done?' done':'')+'"><div class="season-req">'+r[0]+'</div><div class="season-rew">'+r[1]+'</div></div>';
  }).join('');
}
/* ---- view switching ---- */
const VIEWS=['homeView','gamesView','translateView','postView'];
function showView(id){
  showSubmitBar(false);CURRENT_LEVEL=null;stopGame();stopHeadsUp();
  document.getElementById('levelView').classList.add('hidden');
  VIEWS.forEach(v=>document.getElementById(v)?.classList.toggle('hidden',v!==id));
  document.querySelectorAll('.vtab').forEach(b=>b.classList.toggle('active',b.dataset.view===id));
  if(id==='gamesView')renderHub();
  if(id==='postView')renderPostcards();
  if(id==='translateView')renderTranslate();

  if(id==='homeView')renderHome();
  window.scrollTo(0,0);
}
document.querySelectorAll('.vtab').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));

/* ---- play-time points: 5 min in Game Zone = +5 points ---- */
setInterval(()=>{
  if(!session||isAdmin())return;
  const gv=document.getElementById('gamesView');
  if(!gv||gv.classList.contains('hidden')||document.visibilityState!=='visible')return;
  progress.playSecs=(progress.playSecs||0)+1;
  if(progress.playSecs%60===0){progress.playBonus=(progress.playBonus||0)+5;sfx('coin');bearCelebrate('+5 points for playing! Keep going! ⏱️');updateHUDPoints();}
  const pc=document.getElementById('playClock');
  if(pc){const s=progress.playSecs%60;pc.textContent='0:'+String(s).padStart(2,'0')+' → next +5';}
  if(progress.playSecs%15===0)saveProgress();
},1000);
function updateHUDPoints(){if(els.hudScore&&session&&!isAdmin())els.hudScore.textContent=playerPoints(session.username)+(progress.playBonus||0);}

/* ---- streaks (20) ---- */
function checkStreak(){
  if(!session||isAdmin()||session.test)return;
  const today=jstDate().toDateString(),last=progress.lastDay;
  if(last===today)return;
  const yest=jstDate(Date.now()-86400000).toDateString();
  progress.streak=(last===yest)?(progress.streak||0)+1:1;
  progress.lastDay=today;
  const bonus=Math.min(25,progress.streak*5);
  progress.chips=(progress.chips||0)+bonus;saveProgress();updateChips();
  setTimeout(()=>bearCelebrate('🔥 Day '+progress.streak+' streak! +'+bonus+' chips!'),2600);
}

/* ---- mystery boxes (22): every 3rd first-win ---- */
function maybeMysteryBox(){
  const wins=Object.keys(progress.chipGrant||{}).length;
  if(wins===0||wins%3!==0)return;
  if(progress.lastBoxAt===wins)return;
  progress.lastBoxAt=wins;saveProgress();
  openMysteryBox();
}
function openMysteryBox(){
  if(document.querySelector('.mbox'))return;
  sfx('jackpot');
  const o=document.createElement('div');o.className='mbox';
  o.innerHTML='<div class="mbox-card"><div class="mbox-title">🎁 MYSTERY BOX TIME!</div><p>Pick ONE box… it could be glorious. Or not.</p><div class="mbox-row">'+
    [0,1,2].map(i=>'<button type="button" class="mbox-box" data-i="'+i+'">🎁</button>').join('')+'</div><p class="mbox-msg"></p></div>';
  document.body.appendChild(o);
  const prizes=[['+25 chips!',25],['+50 CHIPS!! 💎',50],['-10 chips… ouch',-10],['+15 chips',15],['+5 points! 🌟','pts']];
  o.querySelectorAll('.mbox-box').forEach(b=>b.addEventListener('click',()=>{
    if(o.dataset.done)return;o.dataset.done='1';
    const p=prizes[Math.floor(Math.random()*prizes.length)];
    b.textContent='📦';b.classList.add('open');
    o.querySelector('.mbox-msg').textContent=p[0];
    if(p[1]==='pts'){progress.playBonus=(progress.playBonus||0)+5;updateHUDPoints();}
    else{progress.chips=Math.max(0,(progress.chips||0)+p[1]);updateChips();}
    saveProgress();sfx(p[1]==='pts'||p[1]>0?'win':'lose');burst(o.querySelector('.mbox-card'));
    setTimeout(()=>o.remove(),2200);
  }));
}

/* ---- GAME ZONE hub (9,11,13 + Heads Up + multiplayer) ---- */
const HUB_GAMES=[
  {id:'doodle',n:'✏️ Doodle Duel',d:'One draws, the rest guess. Pass-and-play!'},
  {id:'headsup',n:'🙆 Heads Up!',d:'Phone on forehead — family shouts clues! (landscape)'},
  {id:'breaker',n:'🧱 Neon Breaker',d:'Smash the neon bricks — classic breaker!'},
  {id:'roadle',n:'🟩 Asiadle',d:'Wordle, Japan & Korea edition. 6 guesses!'},
  {id:'dash',n:'🚄 Shinkansen Dash',d:'Three-lane endless runner. Swipe to dodge, jump and slide!'},
  {id:'invaders',n:'👾 Neon Invaders',d:'Drag to fly, auto-fire, power-ups and a boss every 5 waves.'},
  {id:'hockey',n:'🏒 Air Hockey',d:'TWO PLAYERS on one iPad, or you vs Kimbap. First to 7.'},
  {id:'pool',n:'🎱 Neon Pool',d:'Pull back and shoot. Pot all 9 balls in the fewest shots.'},
  {id:'sweeper',n:'💣 Torii Sweeper',d:'Minesweeper with foxes. Tap to reveal, hold to flag.'},
  {id:'sumo',n:'🥋 Sumo Smash',d:'TWO PLAYERS tap-battle, or you vs Kimbap. Best of 3.'},
  {id:'slice',n:'🍣 Sushi Slice',d:'Swipe through the fish. Never the shellfish, never the bomb.'},
  {id:'taiko',n:'🥁 Taiko Beat',d:'Rhythm drums — red taps left, blue taps right. 60 seconds.'},
  {id:'chop',n:'🥢 Chopstick Catch',d:'Pinch two fingers (or tap) to catch the falling food.'},
  {id:'crossing',n:'🚦 Crossing Rush',d:'Send 20 people across Shibuya Crossing through the traffic.'},
  {id:'vend',n:'🥤 Vending Frenzy',d:'Hit the right drink before the timer runs out. It gets fast.'},
  {id:'gacha',n:'🎰 Gachapon Tower',d:'Drop swinging capsules into a tower — don’t let it lean!'},
  {id:'ninja',n:'🥷 Ninja Wall Jump',d:'One thumb: tap to leap wall to wall, dodge spikes and shuriken.'},
];
function renderHub(){
  const grid=document.getElementById('hubGrid');if(!grid)return;
  document.getElementById('hubStage').classList.add('hidden');grid.classList.remove('hidden');
  grid.innerHTML=HUB_GAMES.map(g=>'<button type="button" class="hub-card" data-g="'+g.id+'"><span class="hub-name">'+g.n+'</span><span class="hub-desc">'+g.d+'</span></button>').join('');
  grid.querySelectorAll('.hub-card').forEach(b=>b.addEventListener('click',()=>openHubGame(b.dataset.g)));
}
document.getElementById('hubBack')?.addEventListener('click',()=>{stopGame();stopHeadsUp();renderHub();});
function openHubGame(id){
  stopGame();sfx('click');
  document.getElementById('hubGrid').classList.add('hidden');
  const st=document.getElementById('hubStage');st.classList.remove('hidden');
  const body=document.getElementById('hubBody');body.innerHTML='';
  const dispatch={breaker:hubBreaker,roadle:hubRoadle,headsup:hubHeadsUp,doodle:hubDoodle,dash:hubDash,invaders:hubInvaders,hockey:hubHockey,pool:hubPool,sweeper:hubSweeper,sumo:hubSumo,slice:hubSlice,taiko:hubTaiko,chop:hubChop,crossing:hubCross,vend:hubVend,gacha:hubGacha,ninja:hubNinja};dispatch[id](body);
  window.scrollTo(0,0);
}
/* --- Brick breaker (9) --- */
function hubBreaker(body){
  body.innerHTML='<div class="game-hud"></div>';
  const hud=body.querySelector('.game-hud'),c=makeCanvas(body,340),ctx=c.getContext('2d');
  let raf,run=false,px=300,bx=300,by=300,vx=3.4,vy=-3.4,lives=3,score=0,bricks=[];
  const COLS=['#00e5ff','#38c6ff','#ff3d8b','#12b38a','#ffd23f'];
  function deal(){bricks=[];for(let r=0;r<5;r++)for(let col=0;col<8;col++)bricks.push({x:14+col*72,y:30+r*26,w:64,h:20,c:COLS[r],hit:false});}
  function frame(){
    bx+=vx;by+=vy;
    if(bx<8||bx>592)vx=-vx;if(by<8)vy=-vy;
    if(by>310&&Math.abs(bx-px)<52&&vy>0){vy=-Math.abs(vy)*1.02;vx+=(bx-px)/14;sfx('click');}
    if(by>345){lives--;sfx('lose');if(lives<=0)return over();bx=px;by=300;vx=3.4;vy=-3.4;}
    bricks.forEach(k=>{if(!k.hit&&bx>k.x&&bx<k.x+k.w&&by>k.y&&by<k.y+k.h){k.hit=true;vy=-vy;score+=10;sfx('coin');}});
    if(bricks.every(k=>k.hit)){deal();vy*=1.15;score+=50;}
    ctx.clearRect(0,0,600,340);ctx.fillStyle='#050b18';ctx.fillRect(0,0,600,340);
    bricks.forEach(k=>{if(k.hit)return;ctx.fillStyle=k.c;ctx.fillRect(k.x,k.y,k.w,k.h);});
    ctx.fillStyle='#00e5ff';ctx.beginPath();ctx.arc(bx,by,8,0,7);ctx.fill();
    ctx.fillStyle='#fff';ctx.fillRect(px-52,318,104,12);
    hud.innerHTML='Score <b>'+score+'</b> · '+hearts(lives)+' · 📖 Slide to move the paddle, don\u2019t drop the ball!';
    raf=requestAnimationFrame(frame);
  }
  function over(){run=false;cancelAnimationFrame(raf);ctx.fillStyle='rgba(0,0,0,.7)';ctx.fillRect(0,0,600,340);ctx.fillStyle='#00e5ff';ctx.font='bold 30px sans-serif';ctx.textAlign='center';ctx.fillText('Game over! '+score,300,160);ctx.font='bold 16px sans-serif';ctx.fillText('Tap to play again',300,195);}
  c.addEventListener('pointermove',e=>{e.preventDefault();const r=c.getBoundingClientRect();px=(e.clientX-r.left)*600/r.width;});
  c.addEventListener('pointerdown',e=>{e.preventDefault();try{c.setPointerCapture(e.pointerId);}catch(_){/**/}
    const r=c.getBoundingClientRect();px=(e.clientX-r.left)*600/r.width;
    if(!run){deal();lives=3;score=0;bx=px;by=300;vx=3.4;vy=-3.4;run=true;frame();}});
  c.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});
  ctx.fillStyle='#050b18';ctx.fillRect(0,0,600,340);ctx.fillStyle='#00e5ff';ctx.font='bold 24px sans-serif';ctx.textAlign='center';ctx.fillText('Tap to start!',300,170);
  hud.textContent='📖 Slide to move the paddle. 3 lives. Clear the wall — it refills faster!';
  activeGame={stop(){run=false;cancelAnimationFrame(raf);}};
}
/* --- Roadle (11) --- */
const ROADLE_WORDS=['TOKYO','KYOTO','SEOUL','SUSHI','RAMEN','TORII','NEONS','MOCHI','UDONS','HOTEL','TRAIN','PLANE','NIGHT','LIGHT','TOWER','SNACK','PHOTO','QUEST','PRIZE','CHIPS','BONUS','COINS','STARS','FOXES','PANDA','RIVER','OCEAN','CLOUD','LOTUS','CRANE','PEARL','JEWEL','SHRNE','BENTO','KIMBP','SAKES','MIYKO','GEISH','SUMOS','WASBI'];
function hubRoadle(body){
  const word=ROADLE_WORDS[Math.floor(Math.random()*ROADLE_WORDS.length)];
  let row=0,cur='';
  body.innerHTML='<div class="game-hud">📖 Guess the 5-letter road-trip word. 🟩 right spot · 🟨 wrong spot · ⬛ not in word.</div>'+
    '<div class="roadle-grid">'+Array.from({length:30},(_,i)=>'<span class="rl-cell" data-i="'+i+'"></span>').join('')+'</div>'+
    '<div class="roadle-keys">'+['QWERTYUIOP','ASDFGHJKL','⏎ZXCVBNM⌫'].map(r=>'<div class="rl-row">'+[...r].map(k=>'<button type="button" class="rl-key" data-k="'+k+'">'+k+'</button>').join('')+'</div>').join('')+'</div><p class="game-hud rl-msg"></p>';
  const cells=[...body.querySelectorAll('.rl-cell')],msg=body.querySelector('.rl-msg');
  function paint(){for(let i=0;i<5;i++)cells[row*5+i].textContent=cur[i]||'';}
  function submit(){
    if(cur.length!==5){msg.textContent='Need 5 letters!';return;}
    const g=cur,target=[...word];let marks=Array(5).fill('b');
    for(let i=0;i<5;i++)if(g[i]===word[i]){marks[i]='g';target[i]=null;}
    for(let i=0;i<5;i++)if(marks[i]==='b'){const j=target.indexOf(g[i]);if(j>-1){marks[i]='y';target[j]=null;}}
    for(let i=0;i<5;i++){const cell=cells[row*5+i];cell.classList.add(marks[i]==='g'?'rl-g':marks[i]==='y'?'rl-y':'rl-b');
      const key=body.querySelector('.rl-key[data-k="'+g[i]+'"]');if(key&&marks[i]==='g')key.classList.add('rl-g');else if(key&&marks[i]==='y'&&!key.classList.contains('rl-g'))key.classList.add('rl-y');else if(key&&!key.classList.contains('rl-g')&&!key.classList.contains('rl-y'))key.classList.add('rl-b');}
    if(g===word){msg.textContent='🏆 '+word+'! Legend!';sfx('win');burst(body);return done();}
    row++;cur='';
    if(row>=6){msg.textContent='💀 It was '+word+'. Tap ⏎ for a new word.';sfx('lose');done();}
  }
  let finished=false;function done(){finished=true;}
  body.querySelectorAll('.rl-key').forEach(k=>k.addEventListener('click',()=>{
    if(finished){hubRoadle(body);return;}
    const v=k.dataset.k;sfx('click');
    if(v==='⏎')return submit();
    if(v==='⌫'){cur=cur.slice(0,-1);paint();return;}
    if(cur.length<5){cur+=v;paint();}
  }));
  activeGame={stop(){}};
}
/* --- Heads Up (custom) --- */
const HEADSUP_DECKS={
  '🦊 Animals':['Fox','Deer','Monkey','Koi carp','Crane','Tanuki','Shiba Inu','Cat','Panda','Owl','Turtle','Dragon','Rabbit','Penguin','Jellyfish','Frog'],
  '🗾 Our Trip':['Mount Fuji','Bullet train','Tokyo Skytree','Shibuya Crossing','Torii gate','teamLab','Disneyland','Fushimi Inari','Nara deer','Monkey park','Pirate ship','Black eggs','DMZ tunnel','Rainbow fountain','Vending machine','Konbini','Airport security'],
  '🎬 Act It Out':['Bowing','Taking a selfie','Ninja','Sleeping on a train','Plane taking off','Slot machine','Eating ramen','Using chopsticks','Packing a suitcase','Riding a bullet train','Hiking a shrine path','Karaoke','Jet lag','Swimming','K-pop dance','Sumo wrestler'],
  '🍜 Food':['Ramen','Sushi','Gimbap','Mochi','Hotteok','Matcha','Tempura','Kimchi','Bibimbap','Melon pan','Taiyaki','Udon','Onigiri','Bubble tea','Dumplings','Tamagoyaki'],
};
let headsUpTimer=null;
function stopHeadsUp(){clearInterval(headsUpTimer);headsUpTimer=null;document.querySelector('.hu-full')?.remove();}
function hubHeadsUp(body){
  body.innerHTML='<div class="game-hud">📖 Pick a deck → hold the phone on your FOREHEAD (landscape!). Family describes the word — tap GREEN if you guess it, RED to pass. 90 seconds!</div>'+
    '<div class="hu-decks">'+Object.keys(HEADSUP_DECKS).map(d=>'<button type="button" class="btn btn-primary hu-deck">'+d+'</button>').join('')+'</div>';
  body.querySelectorAll('.hu-deck').forEach(b=>b.addEventListener('click',()=>startHeadsUp(b.textContent)));
  activeGame={stop(){stopHeadsUp();}};
}
function startHeadsUp(deck){
  const words=[...HEADSUP_DECKS[deck]].sort(()=>Math.random()-0.5);
  let i=0,score=0,time=90;
  const o=document.createElement('div');o.className='hu-full';
  o.innerHTML='<div class="hu-top"><span class="hu-time">90</span><span class="hu-score">✓ 0</span></div><div class="hu-word"></div><div class="hu-btns"><button type="button" class="hu-pass">PASS ⏭️</button><button type="button" class="hu-got">GOT IT ✓</button></div>';
  document.body.appendChild(o);
  const wEl=o.querySelector('.hu-word'),tEl=o.querySelector('.hu-time'),sEl=o.querySelector('.hu-score');
  function show(){if(i>=words.length)i=0;wEl.textContent=words[i];}
  headsUpTimer=setInterval(()=>{time--;tEl.textContent=time;if(time<=0)finish();},1000);
  function finish(){clearInterval(headsUpTimer);wEl.textContent='🏁 '+score+' correct!';sfx('win');
    o.querySelector('.hu-btns').innerHTML='<button type="button" class="hu-got">DONE</button>';
    o.querySelector('.hu-got').addEventListener('click',()=>o.remove());}
  o.querySelector('.hu-got').addEventListener('click',()=>{score++;sEl.textContent='✓ '+score;sfx('coin');i++;show();});
  o.querySelector('.hu-pass').addEventListener('click',()=>{sfx('click');i++;show();});
  show();
}
/* ---- JOURNEY BAR with GPS (36) ---- */
function haversine(a,b){const R=6371,toR=x=>x*Math.PI/180;const dLat=toR(b[0]-a[0]),dLon=toR(b[1]-a[1]);const h=Math.sin(dLat/2)**2+Math.cos(toR(a[0]))*Math.cos(toR(b[0]))*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(h));}
document.getElementById('journeyBtn')?.addEventListener('click',()=>{
  const txt=document.getElementById('journeyText');txt.textContent='📡 Finding you…';
  if(!navigator.geolocation){txt.textContent='Location not available on this device.';return;}
  navigator.geolocation.getCurrentPosition(pos=>{
    const me=[pos.coords.latitude,pos.coords.longitude];
    const route=STOPS.filter(s=>typeof s.lat==='number');
    let best=0,bestD=1e9;route.forEach((s,i)=>{const d=haversine(me,[s.lat,s.lng]);if(d<bestD){bestD=d;best=i;}});
    const pct=Math.round(best/(route.length-1)*100);
    const next=route[Math.min(best+1,route.length-1)];
    const dNext=haversine(me,[next.lat,next.lng]);
    document.getElementById('journeyFill').style.width=pct+'%';
    document.getElementById('journeyBear').style.left='calc('+pct+'% - 12px)';
    txt.textContent='📍 Nearest: '+route[best].title+' · '+pct+'% of the route · '+(best<route.length-1?Math.round(dNext)+' km to '+next.title:'FINAL STOP! 🏁');
    sfx('coin');
  },()=>{txt.textContent='Location denied — allow it in Settings to see route progress.';},{enableHighAccuracy:false,timeout:12000,maximumAge:120000});
});

/* ---- POSTCARDS (37) ---- */
function renderPostcards(){
  const grid=document.getElementById('postGrid');if(!grid)return;
  const withPhotos=STOPS.filter(s=>progress.photos[s.id]?.dataUrl);
  if(!withPhotos.length){grid.innerHTML='<p class="empty">No arrival photos yet — complete a stop and your postcards appear here! 📮</p>';return;}
  grid.innerHTML='';
  withPhotos.forEach(s=>{
    const cap=(progress.captions||{})[s.id]||'';
    const card=document.createElement('div');card.className='post-card';
    card.innerHTML='<img alt="'+escapeHtml(s.title)+'"><div class="post-meta"><b>'+escapeHtml(s.title)+'</b><span>'+escapeHtml(s.day)+'</span></div>'+
      '<input class="post-cap" placeholder="Write a caption…" maxlength="60"><button type="button" class="btn btn-primary post-dl">'+
      '📸 Save to Photos'+'</button><p class="post-hint"></p>';
    const img=card.querySelector('img');img.src=progress.photos[s.id].dataUrl;
    const inp=card.querySelector('.post-cap');inp.value=cap;
    inp.addEventListener('change',()=>{progress.captions=progress.captions||{};progress.captions[s.id]=inp.value;saveProgress();});
    card.querySelector('.post-dl').addEventListener('click',()=>savePostcard(s,inp.value,img,card.querySelector('.post-hint')));
    grid.appendChild(card);
  });
}
/* Draws the postcard from the already-loaded <img> (synchronous, so iOS keeps the
   tap "user activation" alive) and hands it to the share sheet — on a phone that
   gives you "Save Image", which puts it in Photos, not Files. */
function savePostcard(s,caption,imgEl,hintEl){
  const setHint=t=>{if(hintEl)hintEl.textContent=t;};
  try{
    const img=(imgEl&&imgEl.complete&&imgEl.naturalWidth)?imgEl:null;
    if(!img){setHint('Photo still loading — try again in a second.');return;}
    const c=document.createElement('canvas');c.width=900;c.height=700;const x=c.getContext('2d');
    x.fillStyle='#eaf3fd';x.fillRect(0,0,900,700);
    const sc=Math.max(820/img.naturalWidth,480/img.naturalHeight);
    const w=img.naturalWidth*sc,h=img.naturalHeight*sc;
    x.save();x.beginPath();x.rect(40,40,820,480);x.clip();x.drawImage(img,40+(820-w)/2,40+(480-h)/2,w,h);x.restore();
    x.strokeStyle='#0a1428';x.lineWidth=8;x.strokeRect(40,40,820,480);
    x.fillStyle='#0d3f8f';x.font='bold 44px Trebuchet MS';x.fillText(s.title.toUpperCase(),48,590);
    x.fillStyle='#5d7690';x.font='bold 26px Trebuchet MS';x.fillText(s.day+' · Asia 2026',48,628);
    x.fillStyle='#0b1b36';x.font='italic 30px Georgia';x.fillText(caption||'Wish you were here!',48,672);
    x.fillStyle='#1f6fe0';x.font='bold 60px Georgia';x.textAlign='right';x.fillText('26',860,660);x.textAlign='left';

    const dataUrl=c.toDataURL('image/jpeg',0.9);
    const name='postcard-'+s.id+'.jpg';
    /* dataURL -> Blob, synchronously, so the tap gesture is still valid on iOS */
    const bin=atob(dataUrl.split(',')[1]);
    const bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    const blob=new Blob([bytes],{type:'image/jpeg'});
    const file=new File([blob],name,{type:'image/jpeg'});

    if(canShareFile(file)){
      setHint('Choose "Save Image" to put it in Photos…');
      navigator.share({files:[file],title:s.title})
        .then(()=>{setHint('✅ Choose "Save Image" — it goes straight into Photos.');sfx('coin');})
        .catch(err=>{
          if(err&&err.name==='AbortError'){setHint('');return;}
          /* the home-screen web app sometimes refuses the share sheet — never download, show it to save instead */
          setHint('');postcardViewer(dataUrl,file,s.title);
        });
      return;
    }
    setHint('');postcardViewer(dataUrl,file,s.title);
  }catch(e){
    console.error('[A26] postcard failed:',e);
    setHint('⚠️ Could not build that postcard — tell Ethan.');
  }
}
function canShareFile(file){try{return !!(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]}));}catch(_){return false;}}
/* Full-screen postcard. Press-and-hold the picture gives iPhone's "Save to Photos" —
   this works inside the home-screen web app too, where downloads end up in Files. */
function postcardViewer(dataUrl,file,title){
  document.querySelector('.pc-view')?.remove();
  const o=document.createElement('div');o.className='pc-view';
  o.innerHTML='<div class="pc-inner"><img class="pc-img" alt="Postcard"><p class="pc-tip">📸 <b>Press and hold the postcard</b>, then tap <b>Save to Photos</b>.</p>'+
    '<div class="pc-actions">'+(canShareFile(file)?'<button type="button" class="btn btn-primary pc-share">📤 Share / Save Image</button>':'')+
    '<button type="button" class="btn btn-quiet pc-close">Done</button></div></div>';
  o.querySelector('.pc-img').src=dataUrl;
  o.querySelector('.pc-img').alt=title||'Postcard';
  o.querySelector('.pc-share')?.addEventListener('click',()=>{navigator.share({files:[file],title:title||'Postcard'}).catch(()=>{});});
  o.querySelector('.pc-close').addEventListener('click',()=>o.remove());
  o.addEventListener('click',e=>{if(e.target===o)o.remove();});
  document.body.appendChild(o);
}

/* ---- MOCHI MOODS (32) + name + den reactions (33) ---- */
function bearMood(){
  const h=new Date(Date.now()+JST_MS).getUTCHours();
  if(h>=21||h<7)return {acc:'💤',lines:['*yaaaawn* five more stations…','Wake me at the next hotel. 😴','Night trains? Brave.','Zzz… huh? Oh. Hi.']};
  if(statusForStop&&stopById('seoul')&&statusForStop('seoul')!=='ready'&&today()>=dateObj('2026-10-27'))return {acc:'🕶️',lines:['SEOUL BABY! 😎','The den never closes in Seoul!','K-pop monkey, reporting in!','I look GOOD in shades.']};
  if(h>=11&&h<=16)return {acc:'🍜',lines:['It\u2019s ramen o\u2019clock. 🍜','Anyone got a melon soda? 🥤','Konbini run? I\u2019m in.','I\u2019m basically a cushion right now.']};
  return null;
}
const _origBearSay=bearSay;
bearSay=function(){
  const mood=bearMood();
  const b=document.getElementById('bearBubble');if(!b)return;
  let line;
  if(mood&&Math.random()<0.4)line=mood.lines[Math.floor(Math.random()*mood.lines.length)];
  else{let i;do{i=Math.floor(Math.random()*BEAR_LINES.length);}while(i===bearIdx);bearIdx=i;line=BEAR_LINES[i];}
  if(Math.random()<0.25)line+=' — '+BEAR_NAME;
  b.textContent=line;b.classList.add('show');setTimeout(()=>b.classList.remove('show'),4600);
  const acc=document.getElementById('bearAcc');if(acc)acc.textContent=mood?mood.acc:'';
};
/* den streak reactions */
const _origSettleHook=true;
function denReact(win){
  progress.denW=win?(progress.denW||0)+1:0;
  progress.denL=win?0:(progress.denL||0)+1;saveProgress();
  if(progress.denL===3)setTimeout(()=>bearShout('Three losses?! Want insurance? I don\u2019t sell it. 😈'),1500);
  if(progress.denL>=5)setTimeout(()=>bearShout('Maybe… stop? Says the casino owner. 😅'),1500);
  if(progress.denW===3)setTimeout(()=>bearShout('Three in a row?! I\u2019m watching you… 👀'),1500);
  if(progress.denW>=5)setTimeout(()=>bearShout('CHEATER! Nobody beats '+BEAR_NAME+' five times! 🚨'),1500);
}

/* ---- FINAL AWARDS CEREMONY (40) ---- */
document.getElementById('ceremonyBtn')?.addEventListener('click',startCeremony);
function startCeremony(){
  const chips=chipStandings();
  const pts=new Map();PLAYER_NAMES.forEach(n=>pts.set(n,0));
  shared.submissions.forEach(i=>{if(i.status==='approved')pts.set(i.username,(pts.get(i.username)||0)+scoreWithBonus(i));});
  const rows=[...pts.entries()].sort((a,b)=>b[1]-a[1]);
  const chipRows=[...chips.entries()].sort((a,b)=>b[1]-a[1]);
  const steps=[
    '<div class="cer-big">🏆 ASIA 2026</div><div class="cer-sub">THE FINAL AWARDS CEREMONY</div><div class="cer-tap">tap to begin…</div>',
    '<div class="cer-sub">🪙 CHIP CHAMPION</div><div class="cer-big">'+escapeHtml(chipRows[0]?.[0]||'—')+'</div><div class="cer-sub">'+(chipRows[0]?.[1]||0)+' chips — wins the EXTRA £15 SHOP DASH! 🏃💨</div><div class="cer-tap">tap…</div>',
    '<div class="cer-sub">🥉 THIRD PLACE</div><div class="cer-big">'+escapeHtml(rows[2]?.[0]||'—')+'</div><div class="cer-sub">'+(rows[2]?.[1]||0)+' points</div><div class="cer-tap">tap…</div>',
    '<div class="cer-sub">🥈 SECOND PLACE</div><div class="cer-big">'+escapeHtml(rows[1]?.[0]||'—')+'</div><div class="cer-sub">'+(rows[1]?.[1]||0)+' points</div><div class="cer-tap">tap…</div>',
    '<div class="cer-sub">👑 ASIA 2026 CHAMPION 👑</div><div class="cer-big gold">'+escapeHtml(rows[0]?.[0]||'—')+'</div><div class="cer-sub">'+(rows[0]?.[1]||0)+' points — £15 CHAMPION! 💰</div><div class="cer-tap">tap to finish</div>'
  ];
  let i=0;
  const o=document.createElement('div');o.className='ceremony';
  document.body.appendChild(o);
  function show(){o.innerHTML='<div class="cer-inner">'+steps[i]+'</div>';sfx(i===steps.length-1?'jackpot':'win');burst(o);if(i===steps.length-1)bearCelebrate('WHAT A TRIP! 🎉');}
  o.addEventListener('click',()=>{i++;if(i>=steps.length){o.remove();return;}show();});
  show();
}

/* ---- hooks: settle→denReact + mystery box after grants ---- */
