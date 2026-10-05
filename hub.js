/* ============================================================
   Asia 2026 — GAME ZONE: the bigger games
   Touch-first, built for iPhone and iPad. Two-player games share one
   screen (each player gets a half) and use real multi-touch.
   Each game sets activeGame={stop()} so leaving the tab halts it.
   ============================================================ */

/* ---------- small shared bits ---------- */
function hubCanvas(body,w,h){const c=gCanvas(body,w,h);c.classList.add('hub-canvas');return c;}
function hubHud(body){return gHud(body);}
function hubChooser(body,title,opts,cb){
  const box=document.createElement('div');box.className='hub-choose';
  box.innerHTML='<h3>'+escapeHtml(title)+'</h3>'+opts.map((o,i)=>'<button type="button" class="btn btn-primary" data-i="'+i+'"><b>'+escapeHtml(o[0])+'</b><small>'+escapeHtml(o[1])+'</small></button>').join('');
  body.appendChild(box);
  box.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{sfx('click');box.remove();cb(+b.dataset.i);}));
}
function hubBest(key,score){const k='a26-hub-'+key;let best=0;try{best=+localStorage.getItem(k)||0;if(score>best){best=score;localStorage.setItem(k,String(score));}}catch(_){}return best;}

/* ============================================================
   1 · SHINKANSEN DASH — three-lane endless runner
   ============================================================ */
function hubDash(body){
  const W=400,H=600,hud=hubHud(body),c=hubCanvas(body,W,H),ctx=c.getContext('2d');
  const HOR=170,LANES=[-1,0,1];
  let lane,tx,y,vy,slide,slideT,objs,dist,coins,speed,run=false,over=false,t=0,best=hubBest('dash',0),shake=0;
  const loop=gLoop(tick);
  /* perspective: z=0 is the player, z=1 the horizon */
  function proj(z,laneX){const k=1-z;const sy=HOR+(H-HOR)*(k*k);const sx=W/2+laneX*k*k*150;return {x:sx,y:sy,s:Math.max(0.05,k*k)};}
  function spawn(){const r=Math.random();const l=gPick(LANES);
    if(r<0.3)objs.push({k:'coin',l,z:1,i:0});
    else if(r<0.55)objs.push({k:'low',l,z:1});       /* jump over */
    else if(r<0.75)objs.push({k:'high',l,z:1});      /* slide under */
    else objs.push({k:'train',l,z:1});               /* change lane */
    if(r>=0.75&&Math.random()<0.5){let l2;do{l2=gPick(LANES);}while(l2===l);objs.push({k:'train',l:l2,z:1.08});}}
  function reset(){lane=0;tx=0;y=0;vy=0;slide=false;slideT=0;objs=[];dist=0;coins=0;speed=0.42;t=0;over=false;}
  function tick(dt){t+=dt;dist+=speed*dt*60;speed=Math.min(1.1,0.42+dist/2500);
    tx+=(lane-tx)*Math.min(1,dt*12);
    vy-=28*dt;y=Math.max(0,y+vy*dt);if(y===0&&vy<0)vy=0;
    if(slide){slideT-=dt;if(slideT<=0)slide=false;}
    if(shake>0)shake-=dt;
    if(objs.length===0||objs[objs.length-1].z<0.78)if(Math.random()<dt*2.2)spawn();
    objs.forEach(o=>{o.z-=speed*dt*0.75;});
    for(const o of objs){if(o.z<0.2&&o.z>0.02&&!o.done&&o.l===lane){
        if(o.k==='coin'){o.done=true;coins++;sfx('coin');}
        else if(o.k==='low'&&y<1.2){return end();}
        else if(o.k==='high'&&!slide){return end();}
        else if(o.k==='train'){return end();}
        else o.done=true;}}
    objs=objs.filter(o=>o.z>0);
    draw();}
  function draw(){
    const sk=shake>0?gRand(-4,4):0;ctx.save();ctx.translate(sk,0);
    gSky(ctx,W,H,'#0b1b36','#2a1f6b');
    /* skyline */
    ctx.fillStyle='#120f3d';for(let i=0;i<14;i++){const bw=20+(i*37)%40,bh=40+(i*53)%90;ctx.fillRect(i*30-10,HOR-bh,bw,bh);}
    ctx.fillStyle='#ff3d8b';for(let i=0;i<14;i++){if(i%2)ctx.fillRect(i*30+2,HOR-30-(i*23)%60,4,4);}
    /* track */
    const g=ctx.createLinearGradient(0,HOR,0,H);g.addColorStop(0,'#1a2a4a');g.addColorStop(1,'#0d1f45');ctx.fillStyle=g;
    ctx.beginPath();ctx.moveTo(W/2-18,HOR);ctx.lineTo(W/2+18,HOR);ctx.lineTo(W/2+260,H);ctx.lineTo(W/2-260,H);ctx.fill();
    ctx.strokeStyle='rgba(0,229,255,.55)';ctx.lineWidth=2;[-1.5,-0.5,0.5,1.5].forEach(l=>{ctx.beginPath();ctx.moveTo(W/2+l*8,HOR);ctx.lineTo(W/2+l*210,H);ctx.stroke();});
    /* sleepers rushing past */
    ctx.strokeStyle='rgba(255,255,255,.12)';for(let i=0;i<12;i++){const z=((i/12)+ (dist*0.004)%(1/12))%1;const p=proj(z,0);ctx.lineWidth=1+3*(1-z);ctx.beginPath();ctx.moveTo(W/2-250*(1-z)*(1-z)-10,p.y);ctx.lineTo(W/2+250*(1-z)*(1-z)+10,p.y);ctx.stroke();}
    /* objects, far to near */
    [...objs].sort((a,b)=>b.z-a.z).forEach(o=>{if(o.done)return;const p=proj(Math.max(0,o.z),o.l);const s=p.s;
      if(o.k==='coin'){gEmoji(ctx,'🪙',p.x,p.y-40*s,46*s);}
      else if(o.k==='low'){ctx.fillStyle='#f0a830';gRR(ctx,p.x-50*s,p.y-26*s,100*s,26*s,6*s);ctx.fill();ctx.fillStyle='#0a1428';for(let i=0;i<4;i++)ctx.fillRect(p.x-44*s+i*26*s,p.y-22*s,12*s,18*s);}
      else if(o.k==='high'){ctx.fillStyle='#d7263d';gRR(ctx,p.x-56*s,p.y-150*s,112*s,56*s,8*s);ctx.fill();ctx.fillStyle='#fff';ctx.fillRect(p.x-60*s,p.y-96*s,6*s,96*s);ctx.fillRect(p.x+54*s,p.y-96*s,6*s,96*s);gText(ctx,'⛩',p.x,p.y-122*s,34*s,'#fff');}
      else{ctx.fillStyle='#e8eef6';gRR(ctx,p.x-52*s,p.y-120*s,104*s,120*s,18*s);ctx.fill();ctx.fillStyle='#1f6fe0';ctx.fillRect(p.x-52*s,p.y-60*s,104*s,14*s);ctx.fillStyle='#0a1428';gRR(ctx,p.x-38*s,p.y-104*s,76*s,30*s,8*s);ctx.fill();}});
    /* player */
    const pp=proj(0.11,tx);const py=pp.y-y*60;
    ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.ellipse(pp.x,pp.y,36,10,0,0,Math.PI*2);ctx.fill();
    gEmoji(ctx,slide?'🛷':'🏃',pp.x,py-34,slide?54:60);
    ctx.restore();
    gText(ctx,Math.floor(dist)+'m',14,24,22,'#fff','left');gText(ctx,'🪙 '+coins,W-14,24,20,'#ffd166','right');
    hud.innerHTML='Score <b>'+score()+'</b> · best <b>'+best+'</b>';
    if(!run)gOverlay(ctx,W,H,over?'💥 Crash!':'Shinkansen Dash',over?('Score '+score()):'Swipe ◀ ▶ lanes · ▲ jump · ▼ slide',over?'Tap to run again':'Tap to start');}
  function score(){return Math.floor(dist)+coins*25;}
  function end(){run=false;over=true;shake=0.4;loop.stop();best=hubBest('dash',score());sfx('lose');draw();}
  function jump(){if(run&&y===0&&!slide){vy=9.5;sfx('click');}}
  function duck(){if(run&&y===0){slide=true;slideT=0.75;sfx('click');}}
  function move(d){if(run){lane=Math.max(-1,Math.min(1,lane+d));sfx('click');}}
  c.addEventListener('pointerdown',()=>{if(!run){reset();run=true;loop.start();}});
  gSwipe(c,d=>({left:()=>move(-1),right:()=>move(1),up:jump,down:duck})[d](),18);
  c.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});
  const pad=gPad(body,[{label:'◀',fn:()=>move(-1),keys:['ArrowLeft']},{label:'▲ Jump',fn:jump,keys:['ArrowUp',' ']},{label:'▼ Slide',fn:duck,keys:['ArrowDown']},{label:'▶',fn:()=>move(1),keys:['ArrowRight']}]);
  reset();draw();
  activeGame={stop(){run=false;loop.stop();pad.remove();}};
}

/* ============================================================
   2 · NEON INVADERS — drag to fly, auto-fire, bosses
   ============================================================ */
function hubInvaders(body){
  const W=400,H=600,hud=hubHud(body),c=hubCanvas(body,W,H),ctx=c.getContext('2d');
  let px,shots,foes,bombs,parts,wave,lives,score,run=false,over=false,fireT=0,boss=null,power=0,powerT=0,shield=0,best=hubBest('invaders',0),drops=[],t=0;
  const loop=gLoop(tick);
  const FOE=['👾','🛸','🤖','👻','🐙'];
  function newWave(){wave++;foes=[];bombs=[];drops=[];boss=null;
    if(wave%5===0){boss={x:W/2,y:-80,hp:30+wave*4,max:30+wave*4,dir:1,e:gPick(['🐉','🦑','🤖','👹'])};return;}
    const rows=Math.min(5,2+Math.floor(wave/2)),cols=6;
    for(let r=0;r<rows;r++)for(let q=0;q<cols;q++)foes.push({x:50+q*60,y:-30-r*44,tx:50+q*60,ty:70+r*44,e:FOE[(r+wave)%FOE.length],hp:1+(wave>6?1:0),w:0});}
  function reset(){px=W/2;shots=[];parts=[];wave=0;lives=3;score=0;power=0;shield=0;over=false;t=0;newWave();}
  function boom(x,y,col,n){for(let i=0;i<(n||10);i++)parts.push({x,y,vx:gRand(-160,160),vy:gRand(-160,160),l:gRand(0.3,0.7),c:col});}
  function tick(dt){t+=dt;
    fireT-=dt;if(fireT<=0){fireT=power?0.14:0.24;shots.push({x:px,y:H-70});if(power)shots.push({x:px-14,y:H-62},{x:px+14,y:H-62});}
    if(powerT>0){powerT-=dt;if(powerT<=0)power=0;}
    shots.forEach(s=>s.y-=520*dt);shots=shots.filter(s=>s.y>-10);
    const sway=Math.sin(t*1.3)*40;
    foes.forEach(f=>{f.x+=(f.tx+sway-f.x)*dt*4;f.y+=(f.ty-f.y)*dt*3;f.ty+=dt*4;
      if(Math.random()<dt*(0.08+wave*0.02))bombs.push({x:f.x,y:f.y+14});});
    if(boss){boss.y+=(80-boss.y)*dt*2;boss.x+=boss.dir*(70+wave*4)*dt;if(boss.x<60||boss.x>W-60)boss.dir*=-1;
      if(Math.random()<dt*1.6)bombs.push({x:boss.x+gRand(-30,30),y:boss.y+30,v:gRand(160,260)});}
    bombs.forEach(b=>b.y+=(b.v||200)*dt);bombs=bombs.filter(b=>b.y<H+10);
    drops.forEach(d=>d.y+=110*dt);drops=drops.filter(d=>d.y<H+10);
    /* hits */
    shots=shots.filter(s=>{for(const f of foes){if(Math.abs(f.x-s.x)<18&&Math.abs(f.y-s.y)<18){f.hp--;if(f.hp<=0){f.dead=true;score+=10*wave;boom(f.x,f.y,'#ff3d8b');sfx('coin');if(Math.random()<0.08)drops.push({x:f.x,y:f.y,k:Math.random()<0.5?'⚡':'🛡️'});}return false;}}
      if(boss&&Math.abs(boss.x-s.x)<44&&Math.abs(boss.y-s.y)<40){boss.hp--;boom(s.x,s.y,'#ffd166',3);if(boss.hp<=0){score+=200*wave;boom(boss.x,boss.y,'#ffd166',40);sfx('win');boss=null;}return false;}
      return true;});
    foes=foes.filter(f=>!f.dead);
    foes.forEach(f=>{if(f.y>H-90)hitPlayer();});
    bombs=bombs.filter(b=>{if(Math.abs(b.x-px)<20&&b.y>H-86&&b.y<H-40){hitPlayer();return false;}return true;});
    drops=drops.filter(d=>{if(Math.abs(d.x-px)<26&&d.y>H-90&&d.y<H-40){if(d.k==='⚡'){power=1;powerT=8;}else shield=1;sfx('coin');return false;}return true;});
    parts.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.l-=dt;});parts=parts.filter(p=>p.l>0);
    if(!foes.length&&!boss)newWave();
    draw();}
  let hurtT=0;
  function hitPlayer(){if(hurtT>0)return;if(shield){shield=0;hurtT=1;sfx('click');return;}lives--;hurtT=1.5;boom(px,H-66,'#00e5ff',20);sfx('lose');if(navigator.vibrate)navigator.vibrate(80);if(lives<=0)end();}
  function draw(){if(hurtT>0)hurtT-=1/60;
    gSky(ctx,W,H,'#050b18','#120f3d');
    ctx.fillStyle='#fff';for(let i=0;i<40;i++){const y=((i*97+t*40*(1+i%3))%H);ctx.globalAlpha=0.3+(i%3)*0.2;ctx.fillRect((i*53)%W,y,2,2);}ctx.globalAlpha=1;
    parts.forEach(p=>{ctx.fillStyle=p.c;ctx.globalAlpha=p.l;ctx.fillRect(p.x,p.y,4,4);});ctx.globalAlpha=1;
    ctx.fillStyle='#7df9ff';shots.forEach(s=>{gRR(ctx,s.x-2,s.y-10,4,14,2);ctx.fill();});
    ctx.fillStyle='#ff3d8b';bombs.forEach(b=>{ctx.beginPath();ctx.arc(b.x,b.y,5,0,Math.PI*2);ctx.fill();});
    foes.forEach(f=>gEmoji(ctx,f.e,f.x,f.y,34));
    drops.forEach(d=>gEmoji(ctx,d.k,d.x,d.y,28));
    if(boss){gEmoji(ctx,boss.e,boss.x,boss.y,90);ctx.fillStyle='#0a1428';gRR(ctx,W/2-120,14,240,12,6);ctx.fill();ctx.fillStyle='#d7263d';gRR(ctx,W/2-120,14,240*boss.hp/boss.max,12,6);ctx.fill();gText(ctx,'BOSS',W/2,40,14,'#ffd166');}
    if(!(hurtT>0&&Math.floor(hurtT*12)%2)){if(shield){ctx.strokeStyle='#7df9ff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(px,H-66,34,0,Math.PI*2);ctx.stroke();}gEmoji(ctx,'🚀',px,H-66,46);}
    gText(ctx,'Wave '+wave,14,H-16,16,'#9fc3ff','left');gText(ctx,'❤️'.repeat(Math.max(0,lives)),W-14,H-16,16,'#fff','right');
    hud.innerHTML='Score <b>'+score+'</b> · best <b>'+best+'</b>'+(power?' · ⚡ triple shot':'')+(shield?' · 🛡️':'');
    if(!run)gOverlay(ctx,W,H,over?'Ship down!':'Neon Invaders',over?('Score '+score+' · wave '+wave):'Drag to fly — it fires by itself',over?'Tap to play again':'Tap to launch');}
  function end(){run=false;over=true;loop.stop();best=hubBest('invaders',score);draw();}
  const aim=e=>{const p=gPos(c,e);px=Math.max(24,Math.min(W-24,p.x));};
  c.addEventListener('pointerdown',e=>{if(!run){reset();run=true;loop.start();}aim(e);});
  c.addEventListener('pointermove',e=>{if(run&&(e.buttons||e.pointerType==='touch'))aim(e);});
  c.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});
  reset();draw();
  activeGame={stop(){run=false;loop.stop();}};
}

/* ============================================================
   3 · AIR HOCKEY — two players on one iPad (or vs Kimbap)
   ============================================================ */
function hubHockey(body){
  hubChooser(body,'🏒 Air Hockey',[['👥 Two players','One screen, one end each — real multi-touch'],['🐒 Me vs Kimbap','Play the bottom end against the monkey']],mode=>start(mode===1));
  function start(ai){
    const W=400,H=640,hud=hubHud(body),c=hubCanvas(body,W,H),ctx=c.getContext('2d');
    const R=26,PR=14,GOAL=110,WIN=7;
    const top={x:W/2,y:80,vx:0,vy:0,score:0,col:'#ff3d8b'},bot={x:W/2,y:H-80,vx:0,vy:0,score:0,col:'#00e5ff'};
    let puck,run=false,over=false,msg='',msgT=0,pointers={},t=0;
    const loop=gLoop(tick);
    function serve(toTop){puck={x:W/2,y:H/2,vx:0,vy:toTop?-120:120};}
    function say(s){msg=s;msgT=1.2;}
    function tick(dt){t+=dt;if(msgT>0)msgT-=dt;
      if(ai){/* Kimbap: chase the puck in its half, return to goal otherwise */
        const want=puck.y<H/2?{x:puck.x,y:Math.min(puck.y-6,H/2-PR-4)}:{x:W/2+(puck.x-W/2)*0.4,y:80};
        const sp=Math.min(1,dt*(puck.y<H/2?7:3));top.vx=(want.x-top.x)*sp/dt;top.vy=(want.y-top.y)*sp/dt;top.x+=want.x>top.x?Math.min(want.x-top.x,sp*(want.x-top.x)):Math.max(want.x-top.x,sp*(want.x-top.x));top.y+=(want.y-top.y)*sp;
        top.x=Math.max(PR,Math.min(W-PR,top.x));top.y=Math.max(PR,Math.min(H/2-PR,top.y));}
      puck.x+=puck.vx*dt;puck.y+=puck.vy*dt;puck.vx*=Math.pow(0.992,dt*60);puck.vy*=Math.pow(0.992,dt*60);
      if(puck.x<R){puck.x=R;puck.vx=Math.abs(puck.vx);sfx('click');}if(puck.x>W-R){puck.x=W-R;puck.vx=-Math.abs(puck.vx);sfx('click');}
      const inGoal=Math.abs(puck.x-W/2)<GOAL/2;
      if(puck.y<R&&!inGoal){puck.y=R;puck.vy=Math.abs(puck.vy);sfx('click');}if(puck.y>H-R&&!inGoal){puck.y=H-R;puck.vy=-Math.abs(puck.vy);sfx('click');}
      if(puck.y<-R){bot.score++;sfx('win');say(ai?'GOAL! You score!':'GOAL for blue!');if(bot.score>=WIN)return end(ai?'You win! 🏆':'Blue wins! 🏆');serve(false);}
      if(puck.y>H+R){top.score++;sfx('lose');say(ai?'Kimbap scores! 🐒':'GOAL for pink!');if(top.score>=WIN)return end(ai?'Kimbap wins 🐒':'Pink wins! 🏆');serve(true);}
      [top,bot].forEach(p=>{const dx=puck.x-p.x,dy=puck.y-p.y,d=Math.hypot(dx,dy);if(d<R+PR&&d>0){const nx=dx/d,ny=dy/d;puck.x=p.x+nx*(R+PR);puck.y=p.y+ny*(R+PR);
        const rel=(puck.vx-p.vx)*nx+(puck.vy-p.vy)*ny;if(rel<0){puck.vx-=1.9*rel*nx;puck.vy-=1.9*rel*ny;}
        puck.vx+=p.vx*0.5;puck.vy+=p.vy*0.5;const sp=Math.hypot(puck.vx,puck.vy);if(sp>900){puck.vx*=900/sp;puck.vy*=900/sp;}sfx('click');}});
      draw();}
    function draw(){ctx.fillStyle='#0d1f45';ctx.fillRect(0,0,W,H);
      ctx.strokeStyle='rgba(255,255,255,.25)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,H/2);ctx.lineTo(W,H/2);ctx.stroke();ctx.beginPath();ctx.arc(W/2,H/2,60,0,Math.PI*2);ctx.stroke();
      ctx.strokeStyle='#ffd166';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(W/2-GOAL/2,3);ctx.lineTo(W/2+GOAL/2,3);ctx.moveTo(W/2-GOAL/2,H-3);ctx.lineTo(W/2+GOAL/2,H-3);ctx.stroke();
      ctx.save();ctx.translate(W/2,H/4);ctx.rotate(Math.PI);gText(ctx,String(top.score),0,0,70,'rgba(255,61,139,.35)');ctx.restore();gText(ctx,String(bot.score),W/2,H*3/4,70,'rgba(0,229,255,.35)');
      [top,bot].forEach(p=>{ctx.fillStyle=p.col;ctx.shadowColor=p.col;ctx.shadowBlur=18;ctx.beginPath();ctx.arc(p.x,p.y,PR,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.fill();});
      if(ai)gEmoji(ctx,'🐒',top.x,top.y-30,26);
      ctx.fillStyle='#f4f4f4';ctx.shadowColor='#fff';ctx.shadowBlur=10;ctx.beginPath();ctx.arc(puck.x,puck.y,R,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#d7263d';ctx.beginPath();ctx.arc(puck.x,puck.y,R*0.45,0,Math.PI*2);ctx.fill();
      if(msgT>0){ctx.save();ctx.translate(W/2,H/2);gText(ctx,msg,0,0,28,'#ffd166');ctx.restore();}
      hud.innerHTML=(ai?'🐒 Kimbap <b>'+top.score+'</b> · You <b>'+bot.score+'</b>':'🩷 Pink <b>'+top.score+'</b> · 🩵 Blue <b>'+bot.score+'</b>')+' · first to '+WIN;
      if(!run)gOverlay(ctx,W,H,over?msg:'Air Hockey',over?'':(ai?'Drag the blue paddle':'Each player drags their own paddle'),over?'Tap to play again':'Tap to start');}
    function end(m){run=false;over=true;msg=m;loop.stop();draw();}
    function grab(e){const p=gPos(c,e);const half=p.y<H/2?'top':'bot';if(ai&&half==='top')return;pointers[e.pointerId]=half;try{c.setPointerCapture(e.pointerId);}catch(_){}move(e);}
    function move(e){const half=pointers[e.pointerId];if(!half||!run)return;const p=gPos(c,e);const pad=half==='top'?top:bot;
      const nx=Math.max(PR,Math.min(W-PR,p.x)),ny=half==='top'?Math.max(PR,Math.min(H/2-PR,p.y)):Math.max(H/2+PR,Math.min(H-PR,p.y));
      pad.vx=(nx-pad.x)*60;pad.vy=(ny-pad.y)*60;pad.x=nx;pad.y=ny;}
    c.addEventListener('pointerdown',e=>{e.preventDefault();if(!run){top.score=0;bot.score=0;over=false;serve(Math.random()<.5);run=true;loop.start();}grab(e);});
    c.addEventListener('pointermove',e=>{e.preventDefault();move(e);});
    const rel=e=>{const half=pointers[e.pointerId];if(half){const pad=half==='top'?top:bot;pad.vx=0;pad.vy=0;}delete pointers[e.pointerId];};
    c.addEventListener('pointerup',rel);c.addEventListener('pointercancel',rel);
    c.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});c.addEventListener('touchstart',e=>e.preventDefault(),{passive:false});
    serve(true);draw();
    activeGame={stop(){run=false;loop.stop();}};
  }
  activeGame={stop(){}};
}

/* ============================================================
   4 · NEON POOL — pull back from the cue ball to shoot
   ============================================================ */
function hubPool(body){
  const W=400,H=640,hud=hubHud(body),c=hubCanvas(body,W,H),ctx=c.getContext('2d');
  const R=12,M=26,POCK=22,COLS=['#ffd23f','#1f6fe0','#d7263d','#8a4dd6','#ff7a18','#12b38a','#8b2b1a','#111'];
  let balls,shots,drag,potted,run=false,done=false,best=hubBest('pool',0),msg='',msgT=0,moving=false,cueIn=false;
  const pockets=[[M,M],[W-M,M],[M,H/2],[W-M,H/2],[M,H-M],[W-M,H-M]];
  const loop=gLoop(tick);
  function rack(){balls=[{x:W/2,y:H-150,vx:0,vy:0,n:0,c:'#fff'}];let n=1;
    for(let r=0;r<4;r++)for(let i=0;i<=r;i++){if(n>9)break;balls.push({x:W/2+(i-r/2)*R*2.05,y:200-r*R*1.8,vx:0,vy:0,n,c:COLS[(n-1)%COLS.length]});n++;}
    shots=0;potted=0;done=false;cueIn=false;}
  function say(s){msg=s;msgT=1.3;}
  function tick(dt){if(msgT>0)msgT-=dt;moving=false;
    const steps=4;for(let s=0;s<steps;s++){const h=dt/steps;
      balls.forEach(b=>{if(b.gone)return;b.x+=b.vx*h;b.y+=b.vy*h;const f=Math.pow(0.985,h*60);b.vx*=f;b.vy*=f;if(Math.hypot(b.vx,b.vy)<4){b.vx=0;b.vy=0;}else moving=true;
        for(const [px,py] of pockets){if(Math.hypot(b.x-px,b.y-py)<POCK){b.gone=true;b.vx=0;b.vy=0;if(b.n===0){cueIn=true;say('Cue ball in! 😬');sfx('lose');}else{potted++;say('Potted the '+b.n+'!');sfx('coin');}}}
        if(b.gone)return;
        if(b.x<M+R){b.x=M+R;b.vx=Math.abs(b.vx)*0.8;}if(b.x>W-M-R){b.x=W-M-R;b.vx=-Math.abs(b.vx)*0.8;}
        if(b.y<M+R){b.y=M+R;b.vy=Math.abs(b.vy)*0.8;}if(b.y>H-M-R){b.y=H-M-R;b.vy=-Math.abs(b.vy)*0.8;}});
      for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++){const a=balls[i],b=balls[j];if(a.gone||b.gone)continue;const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
        if(d<2*R&&d>0){const nx=dx/d,ny=dy/d,ov=(2*R-d)/2;a.x-=nx*ov;a.y-=ny*ov;b.x+=nx*ov;b.y+=ny*ov;const rel=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;if(rel>0){a.vx-=rel*nx;a.vy-=rel*ny;b.vx+=rel*nx;b.vy+=rel*ny;if(rel>40)sfx('click');}}}}
    if(!moving){if(cueIn){const cue=balls[0];cue.gone=false;cue.x=W/2;cue.y=H-150;cueIn=false;}
      if(balls.slice(1).every(b=>b.gone)&&!done){done=true;const sc=Math.max(10,100-shots*5);best=hubBest('pool',sc);say('🏆 Cleared in '+shots+' shots!');sfx('win');}}
    draw();}
  function draw(){ctx.fillStyle='#4a2b14';ctx.fillRect(0,0,W,H);ctx.fillStyle='#0f6b4a';ctx.fillRect(M-6,M-6,W-2*M+12,H-2*M+12);
    ctx.fillStyle='#0a1428';pockets.forEach(([x,y])=>{ctx.beginPath();ctx.arc(x,y,POCK,0,Math.PI*2);ctx.fill();});
    const cue=balls[0];
    if(drag&&!moving&&!cue.gone){const dx=cue.x-drag.x,dy=cue.y-drag.y,d=Math.min(160,Math.hypot(dx,dy));if(d>8){const nx=dx/Math.hypot(dx,dy),ny=dy/Math.hypot(dx,dy);
        ctx.strokeStyle='rgba(255,255,255,.6)';ctx.setLineDash([6,8]);ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cue.x,cue.y);ctx.lineTo(cue.x+nx*420,cue.y+ny*420);ctx.stroke();ctx.setLineDash([]);
        ctx.strokeStyle='#d9b27a';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(cue.x-nx*(R+6+d*0.5),cue.y-ny*(R+6+d*0.5));ctx.lineTo(cue.x-nx*(R+6+d*0.5+200),cue.y-ny*(R+6+d*0.5+200));ctx.stroke();
        ctx.fillStyle='#ffd166';gRR(ctx,W/2-80,H-18,160*d/160,8,4);ctx.fill();}}
    balls.forEach(b=>{if(b.gone)return;ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.arc(b.x+2,b.y+3,R,0,Math.PI*2);ctx.fill();
      const g=ctx.createRadialGradient(b.x-4,b.y-4,2,b.x,b.y,R);g.addColorStop(0,'#fff');g.addColorStop(0.25,b.c);g.addColorStop(1,b.c);ctx.fillStyle=g;ctx.beginPath();ctx.arc(b.x,b.y,R,0,Math.PI*2);ctx.fill();
      if(b.n){ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(b.x,b.y,6,0,Math.PI*2);ctx.fill();gText(ctx,String(b.n),b.x,b.y+0.5,8,'#111');}});
    if(msgT>0)gText(ctx,msg,W/2,H/2,24,'#ffd166');
    hud.innerHTML='Shots <b>'+shots+'</b> · potted <b>'+potted+'/9</b> · best score <b>'+best+'</b>'+(done?' · <button type="button" class="btn btn-quiet pool-again" style="min-height:32px;padding:4px 10px">Rack again</button>':'');
    hud.querySelector('.pool-again')?.addEventListener('click',()=>{rack();draw();});
    if(!run)gOverlay(ctx,W,H,'Neon Pool','Pull back from the white ball, let go to shoot','Pot all 9 in the fewest shots · tap to start');}
  c.addEventListener('pointerdown',e=>{if(!run){run=true;loop.start();return;}if(moving||balls[0].gone)return;const p=gPos(c,e);if(Math.hypot(p.x-balls[0].x,p.y-balls[0].y)<90)drag=p;});
  c.addEventListener('pointermove',e=>{if(drag)drag=gPos(c,e);});
  const rel=()=>{if(!drag)return;const cue=balls[0];const dx=cue.x-drag.x,dy=cue.y-drag.y,d=Math.min(160,Math.hypot(dx,dy));drag=null;if(d<8)return;const nx=dx/Math.hypot(dx,dy),ny=dy/Math.hypot(dx,dy);cue.vx=nx*d*7;cue.vy=ny*d*7;shots++;sfx('click');};
  c.addEventListener('pointerup',rel);c.addEventListener('pointercancel',()=>drag=null);
  c.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});
  rack();draw();
  activeGame={stop(){run=false;loop.stop();}};
}

/* ============================================================
   5 · TORII SWEEPER — minesweeper with a flag mode
   ============================================================ */
function hubSweeper(body){
  hubChooser(body,'💣 Torii Sweeper',[['🌱 Easy','8 × 8 · 10 hidden foxes'],['🔥 Medium','10 × 12 · 22 foxes'],['💀 Hard','12 × 16 · 40 foxes']],lvl=>start([[8,8,10],[10,12,22],[12,16,40]][lvl]));
  function start([C,Rn,MINES]){
    const hud=hubHud(body);
    const tools=document.createElement('div');tools.className='sw-tools';
    tools.innerHTML='<button type="button" class="btn btn-quiet sw-flag">🚩 Flag mode: OFF</button><span class="sw-info"></span><button type="button" class="btn btn-quiet sw-new">↺ New</button>';body.appendChild(tools);
    const grid=document.createElement('div');grid.className='sw-grid';grid.style.gridTemplateColumns='repeat('+C+',1fr)';body.appendChild(grid);
    let mines,open,flag,started,dead,won,flagMode=false,time=0,timer=null,best=hubBest('sweep'+C,0);
    const idx=(x,y)=>y*C+x;
    const nb=i=>{const x=i%C,y=Math.floor(i/C),r=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const X=x+dx,Y=y+dy;if(X>=0&&Y>=0&&X<C&&Y<Rn)r.push(idx(X,Y));}return r;};
    function reset(){mines=Array(C*Rn).fill(false);open=Array(C*Rn).fill(false);flag=Array(C*Rn).fill(false);started=false;dead=false;won=false;time=0;clearInterval(timer);render();}
    function plant(safe){const avoid=new Set([safe,...nb(safe)]);let n=0;while(n<MINES){const i=gInt(0,C*Rn-1);if(mines[i]||avoid.has(i))continue;mines[i]=true;n++;}started=true;timer=setInterval(()=>{time++;info();},1000);}
    function count(i){return nb(i).filter(j=>mines[j]).length;}
    function reveal(i){if(open[i]||flag[i])return;open[i]=true;if(!mines[i]&&count(i)===0)nb(i).forEach(reveal);}
    function tap(i){if(dead||won)return;
      if(flagMode){if(!open[i]){flag[i]=!flag[i];sfx('click');}render();return;}
      if(flag[i])return;
      if(!started)plant(i);
      if(mines[i]){dead=true;clearInterval(timer);sfx('lose');if(navigator.vibrate)navigator.vibrate(120);render();return;}
      if(open[i]){/* chord: open neighbours if flags match */const n=count(i);if(nb(i).filter(j=>flag[j]).length===n){nb(i).forEach(j=>{if(!flag[j]&&!open[j]){if(mines[j]){dead=true;}else reveal(j);}});if(dead){clearInterval(timer);sfx('lose');}}}
      else reveal(i);
      sfx('click');
      if(!dead&&open.filter(Boolean).length===C*Rn-MINES){won=true;clearInterval(timer);best=hubBest('sweep'+C,best?Math.min(best,time)||time:time);sfx('win');burst(grid);}
      render();}
    function info(){tools.querySelector('.sw-info').textContent='🦊 '+(MINES-flag.filter(Boolean).length)+' · ⏱ '+time+'s';}
    function render(){grid.innerHTML='';
      for(let i=0;i<C*Rn;i++){const d=document.createElement('button');d.type='button';d.dataset.i=i;let cls='sw-c';
        if(open[i]){cls+=' open';if(mines[i]){cls+=' boom';d.textContent='🦊';}else{const n=count(i);if(n){d.textContent=n;cls+=' n'+n;}}}
        else if(flag[i]){d.textContent='🚩';if(dead&&!mines[i])cls+=' wrong';}
        else if(dead&&mines[i]){d.textContent='🦊';cls+=' show';}
        d.className=cls;grid.appendChild(d);}
      info();
      hud.innerHTML=won?('🏆 Cleared in <b>'+time+'s</b>!'+(best?' · best '+best+'s':'')):dead?('💥 A fox! Tap ↺ New'):('Find the safe squares — numbers count the foxes touching them.'+(best?' Best: '+best+'s':''));}
    /* tap = reveal, press-and-hold = flag */
    let hold=null,held=false;
    grid.addEventListener('pointerdown',e=>{const d=e.target.closest('.sw-c');if(!d)return;held=false;hold=setTimeout(()=>{held=true;const i=+d.dataset.i;if(!open[i]&&!dead&&!won){flag[i]=!flag[i];sfx('click');if(navigator.vibrate)navigator.vibrate(30);render();}},380);});
    const endHold=()=>{clearTimeout(hold);hold=null;};
    grid.addEventListener('pointerup',endHold);grid.addEventListener('pointercancel',endHold);grid.addEventListener('pointerleave',endHold);
    grid.addEventListener('click',e=>{const d=e.target.closest('.sw-c');if(!d||held){held=false;return;}tap(+d.dataset.i);});
    grid.addEventListener('contextmenu',e=>e.preventDefault());
    tools.querySelector('.sw-flag').addEventListener('click',e=>{flagMode=!flagMode;e.target.textContent='🚩 Flag mode: '+(flagMode?'ON':'OFF');e.target.classList.toggle('on',flagMode);sfx('click');});
    tools.querySelector('.sw-new').addEventListener('click',reset);
    reset();
    activeGame={stop(){clearInterval(timer);}};
  }
  activeGame={stop(){}};
}

/* ============================================================
   6 · SUMO SMASH — tap battle, two players or vs Kimbap
   ============================================================ */
function hubSumo(body){
  hubChooser(body,'🥋 Sumo Smash',[['👥 Two players','Left half vs right half — mash your side!'],['🐒 Me vs Kimbap','You on the left, the monkey on the right']],mode=>start(mode===1));
  function start(ai){
    const W=400,H=520,hud=hubHud(body),c=hubCanvas(body,W,H),ctx=c.getContext('2d');
    let pos,stam,wins,round,run=false,over=false,flash=0,flashT=0,msg='',msgT=0,aiT=0,t=0,roundOver=false;
    const L={e:'🧑',col:'#00e5ff'},Rr={e:ai?'🐒':'🧑',col:'#ff3d8b'};
    const loop=gLoop(tick);
    function newRound(){pos=0;stam=[1,1];roundOver=false;flash=0;flashT=gRand(2,4);say('Round '+round+' — HAKKEYOI!');}
    function say(s){msg=s;msgT=1.4;}
    function push(side){if(!run||roundOver)return;const i=side==='L'?0:1;const dir=i?-1:1;
      const big=flash===(i+1);const power=(big?0.16:0.035)*(0.35+0.65*stam[i]);pos+=dir*power;stam[i]=Math.max(0,stam[i]-(big?0:0.09));
      if(big){flash=0;sfx('coin');say(big?'💥 BIG SHOVE!':'');}else sfx('click');
      if(Math.abs(pos)>=1){roundOver=true;const winner=pos>0?0:1;wins[winner]++;sfx('win');
        say(winner===0?(ai?'You win the round!':'Left wins the round!'):(ai?'Kimbap wins the round 🐒':'Right wins the round!'));
        if(wins[winner]>=2)setTimeout(()=>end(winner),900);else setTimeout(()=>{round++;newRound();},1300);}}
    function tick(dt){t+=dt;if(msgT>0)msgT-=dt;
      stam[0]=Math.min(1,stam[0]+dt*0.22);stam[1]=Math.min(1,stam[1]+dt*0.22);
      if(!roundOver){flashT-=dt;if(flashT<=0&&!flash){flash=gInt(1,2);flashT=gRand(2.5,4.5);setTimeout(()=>{if(flash)flash=0;},900);}
        pos*=Math.pow(0.9,dt);/* the ring pulls you back toward the middle a little */
        if(ai){aiT-=dt;if(aiT<=0){aiT=flash===2?0.08:gRand(0.14,0.3);if(stam[1]>0.3||flash===2)push('R');}}}
      draw();}
    function draw(){gSky(ctx,W,H,'#2a1a10','#5a3a22');
      ctx.fillStyle='#c9a15a';ctx.beginPath();ctx.ellipse(W/2,H*0.62,185,70,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#5a3a1a';ctx.lineWidth=8;ctx.beginPath();ctx.ellipse(W/2,H*0.62,160,56,0,0,Math.PI*2);ctx.stroke();
      const cx=W/2+pos*150,y=H*0.6;
      gEmoji(ctx,L.e,cx-34,y,74);gEmoji(ctx,Rr.e,cx+34,y,74);
      /* stamina bars */
      [[0,20,L.col],[1,W-170,Rr.col]].forEach(([i,x,col])=>{ctx.fillStyle='rgba(0,0,0,.4)';gRR(ctx,x,20,150,14,7);ctx.fill();ctx.fillStyle=col;gRR(ctx,x,20,150*stam[i],14,7);ctx.fill();});
      gText(ctx,(ai?'YOU':'LEFT')+' '+wins[0],20,52,16,L.col,'left');gText(ctx,wins[1]+' '+(ai?'KIMBAP':'RIGHT'),W-20,52,16,Rr.col,'right');
      /* edge markers */
      ctx.fillStyle='#d7263d';ctx.fillRect(W/2-150-6,y+40,4,30);ctx.fillRect(W/2+150+2,y+40,4,30);
      if(flash){const x=flash===1?W*0.25:W*0.75;ctx.fillStyle='rgba(255,209,102,'+(0.5+0.5*Math.sin(t*20))+')';ctx.beginPath();ctx.arc(x,H-70,46,0,Math.PI*2);ctx.fill();gText(ctx,'TAP!',x,H-70,22,'#5a3a1a');}
      ctx.strokeStyle='rgba(255,255,255,.2)';ctx.setLineDash([8,8]);ctx.beginPath();ctx.moveTo(W/2,H-130);ctx.lineTo(W/2,H);ctx.stroke();ctx.setLineDash([]);
      gText(ctx,ai?'TAP HERE':'LEFT TAPS HERE',W*0.25,H-20,14,'rgba(255,255,255,.6)');gText(ctx,ai?'🐒 Kimbap':'RIGHT TAPS HERE',W*0.75,H-20,14,'rgba(255,255,255,.6)');
      if(msgT>0)gText(ctx,msg,W/2,H*0.3,26,'#ffd166');
      hud.innerHTML='Best of 3 · tap FAST, but your stamina bar runs out — wait for the gold TAP! for a big shove';
      if(!run)gOverlay(ctx,W,H,over?msg:'Sumo Smash',over?'':(ai?'Mash the left half of the screen':'Each player mashes their own half'),over?'Tap to play again':'Tap to start');}
    function end(w){run=false;over=true;msg=w===0?(ai?'You win! 🏆':'Left wins! 🏆'):(ai?'Kimbap wins 🐒':'Right wins! 🏆');loop.stop();draw();}
    c.addEventListener('pointerdown',e=>{e.preventDefault();if(!run){wins=[0,0];round=1;over=false;run=true;newRound();loop.start();return;}const p=gPos(c,e);if(p.x<W/2)push('L');else if(!ai)push('R');});
    c.addEventListener('touchstart',e=>e.preventDefault(),{passive:false});
    wins=[0,0];round=1;pos=0;stam=[1,1];draw();
    activeGame={stop(){run=false;loop.stop();}};
  }
  activeGame={stop(){}};
}
