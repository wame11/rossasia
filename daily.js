/* ============================================================
   Asia 2026 — Kimbap's daily challenge + the walking leaderboard
   Both live on the Map tab, under the player HUD.
   ============================================================ */
const DAILY_CHALLENGES=[
  ['🙏','Say "arigatou gozaimasu" (or "kamsahamnida") to five different people today.'],
  ['🥤','Find a vending machine that sells HOT drinks. Photo of the red "hot" label.'],
  ['🚉','Spot a train that arrives EXACTLY on the minute the board says. Photo of the clock and the train.'],
  ['🍙','Try a konbini food none of us has had before. Photo of the wrapper.'],
  ['🐱','Find a lucky cat (maneki-neko) somewhere that isn’t a shop selling them.'],
  ['🗺️','Lead the family for one whole train journey — right line, right platform, right exit — without a grown-up checking.'],
  ['🔢','Learn to count to ten in today’s language and say it to Dad without looking.'],
  ['📸','Take a photo where every single family member is in it AND smiling.'],
  ['🧘','Sit somewhere for five whole minutes without a phone. Just look. Then tell everyone one thing you noticed.'],
  ['🎁','Buy one tiny souvenir for someone who is NOT on this trip, under £3.'],
  ['⛩️','Do the shrine bow-clap-bow properly, in order, without being told.'],
  ['🍜','Order a whole meal for yourself in Japanese or Korean (pointing counts, but say the words).'],
  ['🧹','Carry your own rubbish for the whole day — there are almost no bins. Show it to the boss at dinner.'],
  ['👟','Walk 12,000 steps today (check the Health app).'],
  ['🎌','Spot the Japanese or Korean flag in the wild (not on a phone screen). Photo.'],
  ['🚻','Find and use a toilet with a control panel of at least six buttons. Report back.'],
  ['🥢','Eat an entire meal with chopsticks only. No fork, no fingers.'],
  ['🌸','Find something pink and something gold in the same photo.'],
  ['🗣️','Ask a local a real question in their language (where is…, how much…) and understand the answer.'],
  ['🎎','Spot three different things with a cartoon mascot on them (trains, police, food, anything).'],
  ['💴','Pay for something entirely in coins, exact money, no change.'],
  ['🌙','Be the first one ready to leave the hotel tomorrow morning — bag packed, shoes on.'],
  ['🦊','Find an animal statue (fox, dog, deer, dragon, lion-dog) and copy its pose in a photo.'],
  ['📝','Write tonight’s line in the family diary before anyone asks.'],
];
const DAILY_CHIPS=15,WALK_AWARD=25,STEPS_PER_KM=1300;
function todayKey(d){d=d||new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function dailyFor(key){return DAILY_CHALLENGES[seedFrom('a26-daily|'+key)%DAILY_CHALLENGES.length];}

function renderDaily(){
  const host=document.getElementById('dailyBox');if(!host)return;
  if(!session||isAdmin()){host.classList.add('hidden');return;}host.classList.remove('hidden');
  const key=todayKey(),[ic,text]=dailyFor(key);progress.daily=progress.daily||{};const done=!!progress.daily[key];
  host.innerHTML='<div class="daily-head"><span class="daily-ic">'+ic+'</span><div><div class="daily-eyebrow">🐒 Kimbap’s challenge today · +'+DAILY_CHIPS+' chips</div><div class="daily-text">'+escapeHtml(text)+'</div></div></div>'+
    (done?'<div class="daily-done">✅ Done — '+DAILY_CHIPS+' chips banked. New challenge tomorrow!</div>'
         :'<label class="btn btn-primary daily-claim">📸 Done it — snap proof &amp; claim<input type="file" accept="image/*" capture="environment" hidden></label><p class="daily-note">Kimbap trusts you… mostly. A photo or a grown-up’s nod is the proof.</p>');
  host.querySelector('.daily-claim input')?.addEventListener('change',e=>{if(!e.target.files[0])return;
    progress.daily[key]=true;progress.chips=(progress.chips||0)+DAILY_CHIPS;grantEarn(DAILY_CHIPS);saveProgress();updateChips();syncPlayer();sfx('win');
    bearCelebrate('Challenge done! +'+DAILY_CHIPS+' chips 🐒🪙');burst(host);renderDaily();});
}

/* ---------- steps ---------- */
function stepsOf(p){try{const c=JSON.parse(p.character||'{}');return c&&c.steps&&typeof c.steps==='object'?c.steps:{};}catch(_){return {};}}
let walkWatch=null,walkKm=0,walkLast=null;
function renderSteps(){
  const host=document.getElementById('stepsBox');if(!host)return;
  if(!session||session.test){host.classList.add('hidden');return;}host.classList.remove('hidden');
  const key=todayKey(),yk=todayKey(new Date(Date.now()-86400000));progress.steps=progress.steps||{};
  /* everyone's steps: mine from my phone, theirs from the sheet */
  const all={};(shared.players||[]).forEach(p=>{if(p.username)all[p.username]=stepsOf(p);});
  if(!isAdmin())all[session.username]=progress.steps;
  const rows=PLAYER_NAMES.map(n=>({n,today:Number((all[n]||{})[key]||0),yest:Number((all[n]||{})[yk]||0),total:Object.values(all[n]||{}).reduce((s,v)=>s+Number(v||0),0)})).sort((a,b)=>b.today-a.today||b.total-a.total);
  /* yesterday's top walker gets chips, once, on their own phone */
  if(!isAdmin()){const ys=rows.filter(r=>r.yest>0).sort((a,b)=>b.yest-a.yest);progress.walkAward=progress.walkAward||{};
    if(ys.length>=2&&ys[0].n===session.username&&ys[0].yest>ys[1].yest&&!progress.walkAward[yk]){progress.walkAward[yk]=true;progress.chips=(progress.chips||0)+WALK_AWARD;grantEarn(WALK_AWARD);saveProgress();updateChips();syncPlayer();setTimeout(()=>bearCelebrate('🥇 Top walker yesterday! +'+WALK_AWARD+' chips'),1500);}}
  const mine=progress.steps[key]||0;
  host.innerHTML='<div class="steps-head"><h3>👟 Walking leaderboard</h3><span class="steps-sub">Top walker each day wins +'+WALK_AWARD+' chips</span></div>'+
    (isAdmin()?'':'<div class="steps-entry"><label>My steps today <small>(Health app → Steps)</small></label><div class="tr-row"><input class="steps-in" type="number" inputmode="numeric" min="0" max="99999" value="'+(mine||'')+'" placeholder="e.g. 11200"><button type="button" class="btn btn-primary steps-save">Save</button></div>'+
      '<div class="tr-row steps-gps"><button type="button" class="btn btn-quiet steps-track">'+(walkWatch?'⏹ Stop tracking':'📍 Track this walk')+'</button><span class="steps-km">'+(walkKm?walkKm.toFixed(2)+' km ≈ '+Math.round(walkKm*STEPS_PER_KM).toLocaleString()+' steps':'')+'</span>'+(walkKm>0.05&&!walkWatch?'<button type="button" class="btn btn-quiet steps-add">+ Add to today</button>':'')+'</div></div>')+
    '<div class="table-wrap"><table class="steps-table"><thead><tr><th>#</th><th>Name</th><th>Today</th><th>Yesterday</th><th>Trip total</th></tr></thead><tbody>'+
    rows.map((r,i)=>'<tr'+(r.n===session.username?' class="me"':'')+'><td>'+(i===0&&r.today?'👑':i+1)+'</td><td>'+escapeHtml(r.n)+'</td><td>'+(r.today?r.today.toLocaleString():'—')+'</td><td>'+(r.yest?r.yest.toLocaleString():'—')+'</td><td>'+(r.total?r.total.toLocaleString():'—')+'</td></tr>').join('')+'</tbody></table></div>';
  host.querySelector('.steps-save')?.addEventListener('click',()=>{const v=Math.max(0,Math.min(99999,Math.round(Number(host.querySelector('.steps-in').value)||0)));progress.steps[key]=v;saveProgress();syncPlayer();sfx('coin');toast('👟 '+v.toLocaleString()+' steps saved');renderSteps();});
  host.querySelector('.steps-add')?.addEventListener('click',()=>{progress.steps[key]=(progress.steps[key]||0)+Math.round(walkKm*STEPS_PER_KM);walkKm=0;saveProgress();syncPlayer();sfx('coin');renderSteps();});
  host.querySelector('.steps-track')?.addEventListener('click',()=>{
    if(walkWatch){navigator.geolocation.clearWatch(walkWatch);walkWatch=null;walkLast=null;renderSteps();return;}
    if(!navigator.geolocation){toast('No GPS on this device');return;}
    walkKm=0;walkLast=null;
    walkWatch=navigator.geolocation.watchPosition(pos=>{if(pos.coords.accuracy>40)return;const here=[pos.coords.latitude,pos.coords.longitude];
      if(walkLast){const d=haversine(walkLast,here);if(d>0.004&&d<0.3)walkKm+=d;}walkLast=here;const el=host.querySelector('.steps-km');if(el)el.textContent=walkKm.toFixed(2)+' km ≈ '+Math.round(walkKm*STEPS_PER_KM).toLocaleString()+' steps (keep the screen on)';},
      ()=>{toast('Location blocked — allow it in Settings');walkWatch=null;renderSteps();},{enableHighAccuracy:true,maximumAge:2000,timeout:15000});
    renderSteps();});
}
