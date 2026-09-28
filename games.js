/* ============================================================
   Asia 2026 — ACTIVITY GAMES (second edition)
   19 brand-new game engines. Each stop picks 3, themed to the place.
   Beat the goal in ANY one to clear the arcade objective; games keep
   going after the goal so the family can chase high scores.
   Engine contract: fn(stage, g, report) -> {stop()}
     g = stop's options + {target, title}
     report(score, won) — call when a run ends, and once when the goal is hit.
   ============================================================ */
const WIN_BONUS_PER_EXTRA=5;

/* ---------- per-stop game state ---------- */
function gameState(stopId){const g=progress.game[stopId];return (g&&g.perGame)?g:{perGame:{},complete:false};}
function gamesFor(stop){return (stop.games||[]).map(([t,n,o])=>({t,n,o:o||{}}));}
function winsCount(stop){const st=gameState(stop.id);return gamesFor(stop).filter((_,i)=>st.perGame[i]?.won).length;}
function reportScore(root,stop,gi,score,won){
  const st=gameState(stop.id);
  const cur=st.perGame[gi]||{best:0,won:false};
  st.perGame[gi]={best:Math.max(cur.best,score|0),won:cur.won||won};
  st.complete=Object.values(st.perGame).some(g=>g.won);
  progress.game[stop.id]=st;
  const gk=stop.id+'-'+gi;
  if(won&&!progress.chipGrant[gk]){progress.chipGrant[gk]=true;progress.chips=(progress.chips||0)+10;grantEarn(10);updateChips();syncPlayer();sfx('coin');bearShout('+10 chips! Come gamble them with me! 🐒🪙');setTimeout(maybeMysteryBox,1200);}
  saveProgress();refreshTaskTags(root,stop);
  const badge=root.querySelector('.gm-tab[data-gi="'+gi+'"] .gm-best');
  if(badge)badge.textContent='Best '+st.perGame[gi].best+(st.perGame[gi].won?' 🏆':'');
  if(won)burst(root.querySelector('.arcade'));
}

/* ---------- engine registry: goal text, how-to, default target ---------- */
const GAME_META={
  pack:{target:5,goal:v=>'Clear '+v+' lines',how:'Suitcase blocks drop in. ◀ ▶ to move, ⟳ to turn, ⬇ to drop. Fill a whole row to clear it — don’t let the pile reach the top!'},
  merge:{target:6,goal:(v,o)=>'Make a '+((o.chain||MERGE_DEFAULT)[v]||'top tile'),how:'Swipe the board (or use the arrows). Two matching tiles slide together and turn into the next thing on the chain. Keep going until you can’t move!'},
  swap:{target:600,goal:v=>'Score '+v+' in 20 moves',how:'Tap a tile, then tap the one next to it to swap them. Line up 3 or more the same to clear them — chains score extra!'},
  climb:{target:250,goal:v=>'Climb '+v+'m',how:'You bounce by yourself. Hold the left or right side of the screen to steer onto the next platform. Cracked ones break! Fall off the bottom and it’s over.'},
  cross:{target:4,goal:v=>'Cross '+v+' times',how:'Get to the far side without being hit. Swipe or use the arrows to step. Every crossing gets busier. 3 lives!'},
  belt:{target:4,goal:v=>'Finish '+v+' orders',how:'The order card shows what the family wants. Tap the right plates as they go by. Tap a banned one and you lose a life. Don’t let the order timer run out!'},
  diff:{target:2,goal:v=>'Clear '+v+' rounds',how:'The two pictures have 5 differences. Tap them on either picture before the time runs out. Wrong taps cost 3 seconds!'},
  path:{target:3,goal:v=>'Solve '+v+' paths',how:'Start on the glowing square. Drag through every open square in one line — no jumping, no crossing your own path. Drag back to undo.'},
  pipes:{target:2,goal:v=>'Light '+v+' boards',how:'Tap a tile to turn it. Connect every tile back to the power so the whole board glows.'},
  lights:{target:2,goal:v=>'Solve '+v+' boards',how:'Tapping a lantern flips it AND the ones above, below, left and right. Get every lantern lit!'},
  maze:{target:3,goal:v=>'Escape '+v+' mazes',how:'Swipe on the maze or use the arrows. Reach the exit before the clock runs out. Each maze is bigger.'},
  plinko:{target:900,goal:v=>'Score '+v+' with 10 balls',how:'Tap along the top to drop a ball where you like. It bounces off the pins into a pot. Aim for the big numbers!'},
  claw:{target:3,goal:v=>'Win '+v+' prizes',how:'The claw swings on its own. Tap DROP when it’s right above a prize. Line it up well or the prize slips out. 8 goes.'},
  toss:{target:5,goal:v=>'Land '+v+' throws',how:'Drag back from the thing you’re throwing, aim, and let go. Watch the wind arrow! Miss 3 times and it’s over.'},
  cook:{target:8,goal:v=>'Serve '+v,how:'Tap an empty pan to start cooking. Tap again when it turns golden to flip it, then again when the other side is golden to serve. Burn 3 and you’re out!'},
  balance:{target:120,goal:v=>'Walk '+v+'m',how:'You walk forward by yourself but you keep wobbling. Tap or hold LEFT and RIGHT to lean back the other way. Tip too far and you fall!'},
  archery:{target:25,goal:v=>'Score '+v+' with 5 arrows',how:'Hold to draw the bow, let go to shoot. The target moves and the wind pushes your arrow — aim off to one side to allow for it.'},
  words:{target:1,goal:v=>'Find all the words'+(v>1?' '+v+' times':''),how:'Drag across the letters to find each word in the list. Words go across, down or diagonally.'},
  slide:{target:1,goal:v=>'Finish '+v+' picture'+(v>1?'s':''),how:'Tap a tile next to the gap to slide it. Put the picture back together.'}
};

/* ---------- the arcade panel on each stop ---------- */
function renderArcade(root,stop){
  const host=root.querySelector('.arcade');
  const games=gamesFor(stop);const st=gameState(stop.id);
  host.innerHTML='<p class="arcade-rule">🏆 Beat the goal in <b>ANY 1</b> of these '+games.length+' games to clear this objective. Every EXTRA game you beat = bonus points from the boss. Games keep going after the goal — chase the family high score!</p>'+
    '<div class="gm-tabs" style="grid-template-columns:repeat('+games.length+',minmax(0,1fr))">'+games.map((g,i)=>'<button type="button" class="gm-tab" data-gi="'+i+'"><span class="gm-name">'+escapeHtml(g.n)+'</span><span class="gm-best">'+(st.perGame[i]?'Best '+(st.perGame[i].best||0)+(st.perGame[i].won?' 🏆':''):'New')+'</span></button>').join('')+'</div>'+
    '<div class="arcade-goal"></div><div class="arcade-stage"></div>';
  const stage=host.querySelector('.arcade-stage'),goal=host.querySelector('.arcade-goal');
  function open(i){
    stopGame();host.querySelectorAll('.gm-tab').forEach(b=>b.classList.toggle('active',+b.dataset.gi===i));
    const g=games[i],meta=GAME_META[g.t],fn=GAME_ENGINES[g.t];
    if(!meta||!fn){goal.textContent='This game is missing — tell Ethan.';stage.innerHTML='';return;}
    const target=g.o.target||meta.target;
    goal.innerHTML='🎯 <b>'+escapeHtml(meta.goal(target,g.o))+'</b> to win<br><span class="arcade-instr">📖 '+escapeHtml(meta.how)+'</span>';
    stage.innerHTML='';
    activeGame=fn(stage,{...g.o,target,title:g.n},(score,won)=>reportScore(root,stop,i,score,won));
  }
  host.querySelectorAll('.gm-tab').forEach(b=>b.addEventListener('click',()=>open(+b.dataset.gi)));
  open(0);
}

/* ============================================================
   SHARED HELPERS
   ============================================================ */
function gCanvas(stage,w,h){const c=document.createElement('canvas');c.width=w;c.height=h;c.className='game-canvas g2-canvas';stage.appendChild(c);return c;}
function gHud(stage){const d=document.createElement('div');d.className='game-hud';stage.appendChild(d);return d;}
function gPos(c,e){const r=c.getBoundingClientRect();return {x:(e.clientX-r.left)*c.width/r.width,y:(e.clientY-r.top)*c.height/r.height};}
function gRand(a,b){return a+Math.random()*(b-a);}
function gInt(a,b){return Math.floor(gRand(a,b+1));}
function gPick(a){return a[Math.floor(Math.random()*a.length)];}
function gShuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function gRR(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function gEmoji(ctx,ch,x,y,size){ctx.save();ctx.font=size+'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(ch,x,y+size*0.06);ctx.restore();}
function gText(ctx,t,x,y,size,color,align,weight){ctx.save();ctx.font=(weight||'900')+' '+size+'px "Trebuchet MS",system-ui,sans-serif';ctx.fillStyle=color||'#fff';ctx.textAlign=align||'center';ctx.textBaseline='middle';ctx.fillText(t,x,y);ctx.restore();}
function gOverlay(ctx,w,h,title,sub,sub2){ctx.save();ctx.fillStyle='rgba(5,11,24,.78)';ctx.fillRect(0,0,w,h);ctx.restore();
  gText(ctx,title,w/2,h/2-24,Math.min(34,w/12),'#00e5ff');if(sub)gText(ctx,sub,w/2,h/2+16,Math.min(19,w/20),'#ffffff','center','800');if(sub2)gText(ctx,sub2,w/2,h/2+44,Math.min(16,w/24),'#9fc3ff','center','700');}
function gSky(ctx,w,h,top,bot){const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,top);g.addColorStop(1,bot);ctx.fillStyle=g;ctx.fillRect(0,0,w,h);}
/* a row of chunky on-screen buttons (phones) + matching keyboard keys */
function gPad(stage,defs){
  const row=document.createElement('div');row.className='g2-pad';
  const map={};
  defs.forEach(d=>{const b=document.createElement('button');b.type='button';b.className='g2-btn'+(d.wide?' wide':'');b.textContent=d.label;
    let rep=null;
    const fire=e=>{e.preventDefault();d.fn();if(d.repeat){clearInterval(rep);rep=setInterval(d.fn,d.repeat);}};
    const end=()=>{clearInterval(rep);rep=null;if(d.up)d.up();};
    b.addEventListener('pointerdown',fire);b.addEventListener('pointerup',end);b.addEventListener('pointerleave',end);b.addEventListener('pointercancel',end);
    b.addEventListener('contextmenu',e=>e.preventDefault());
    row.appendChild(b);(d.keys||[]).forEach(k=>map[k]=d);});
  stage.appendChild(row);
  const onKey=e=>{const d=map[e.key];if(!d)return;if(!document.body.contains(row))return;e.preventDefault();if(e.type==='keydown'){if(!e.repeat||d.repeat)d.fn();}else if(d.up)d.up();};
  window.addEventListener('keydown',onKey);window.addEventListener('keyup',onKey);
  return {row,remove(){window.removeEventListener('keydown',onKey);window.removeEventListener('keyup',onKey);}};
}
/* swipe detector on an element: cb('up'|'down'|'left'|'right') */
function gSwipe(el,cb,min){let sx=0,sy=0,on=false;min=min||22;
  el.addEventListener('pointerdown',e=>{on=true;sx=e.clientX;sy=e.clientY;});
  el.addEventListener('pointerup',e=>{if(!on)return;on=false;const dx=e.clientX-sx,dy=e.clientY-sy;
    if(Math.max(Math.abs(dx),Math.abs(dy))<min)return;cb(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'));});
  el.addEventListener('pointercancel',()=>on=false);}
/* animation loop with delta time (seconds), capped so a background tab doesn't teleport */
function gLoop(fn){let raf=0,last=0,on=false;
  function f(t){if(!on)return;const dt=Math.min(0.05,last?(t-last)/1000:0.016);last=t;fn(dt);if(on)raf=requestAnimationFrame(f);}
  return {start(){if(on)return;on=true;last=0;raf=requestAnimationFrame(f);},stop(){on=false;cancelAnimationFrame(raf);},get on(){return on;}};}
function gStartBtn(stage,label,cb){const b=document.createElement('button');b.type='button';b.className='btn btn-primary g2-start';b.textContent=label;b.addEventListener('click',cb);stage.appendChild(b);return b;}

/* ============================================================
   1 · PACK — falling-block suitcase packing (Tetris-style)
   ============================================================ */
function egPack(stage,g,report){
  const COLS=10,ROWS=18,CS=24,W=COLS*CS+110,H=ROWS*CS;
  const hud=gHud(stage),c=gCanvas(stage,W,H),ctx=c.getContext('2d');
  const COLORS=g.colors||['#1f6fe0','#d7263d','#12b38a','#f0a830','#8a4dd6','#ff3d8b','#00b8d4'];
  const SHAPES=[[[1,1,1,1]],[[1,1],[1,1]],[[0,1,0],[1,1,1]],[[1,0,0],[1,1,1]],[[0,0,1],[1,1,1]],[[0,1,1],[1,1,0]],[[1,1,0],[0,1,1]]];
  let board,cur,next,lines,run=false,over=false,won=false,drop=0,speed,score;
  const loop=gLoop(dt=>{drop+=dt;if(drop>=speed){drop=0;step();}draw();});
  function newPiece(){const k=gInt(0,6);return {m:SHAPES[k].map(r=>r.slice()),k,x:3,y:0};}
  function rot(m){return m[0].map((_,i)=>m.map(r=>r[i]).reverse());}
  function fits(m,x,y){for(let r=0;r<m.length;r++)for(let q=0;q<m[r].length;q++){if(!m[r][q])continue;const X=x+q,Y=y+r;if(X<0||X>=COLS||Y>=ROWS)return false;if(Y>=0&&board[Y][X]!==null)return false;}return true;}
  function lock(){cur.m.forEach((row,r)=>row.forEach((v,q)=>{if(v&&cur.y+r>=0)board[cur.y+r][cur.x+q]=cur.k;}));
    let cleared=0;for(let r=ROWS-1;r>=0;r--){if(board[r].every(v=>v!==null)){board.splice(r,1);board.unshift(Array(COLS).fill(null));cleared++;r++;}}
    if(cleared){lines+=cleared;score+=[0,100,300,500,800][cleared];sfx('coin');speed=Math.max(0.12,0.7-lines*0.035);}
    if(!won&&lines>=g.target){won=true;report(lines,true);sfx('win');}
    cur=next;next=newPiece();if(!fits(cur.m,cur.x,cur.y))end();}
  function step(){if(!run)return;if(fits(cur.m,cur.x,cur.y+1))cur.y++;else lock();}
  function move(d){if(run&&fits(cur.m,cur.x+d,cur.y)){cur.x+=d;draw();}}
  function turn(){if(!run)return;const m=rot(cur.m);for(const k of [0,-1,1,-2,2])if(fits(m,cur.x+k,cur.y)){cur.m=m;cur.x+=k;break;}draw();}
  function hard(){if(!run)return;while(fits(cur.m,cur.x,cur.y+1))cur.y++;lock();draw();}
  function soft(){if(run){step();draw();}}
  function cell(x,y,k,alpha){ctx.save();ctx.globalAlpha=alpha||1;const px=x*CS,py=y*CS;
    ctx.fillStyle=COLORS[k%COLORS.length];gRR(ctx,px+1,py+1,CS-2,CS-2,5);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.28)';gRR(ctx,px+3,py+3,CS-6,6,3);ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.35)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(px+CS/2-4,py+CS-6);ctx.lineTo(px+CS/2+4,py+CS-6);ctx.stroke();ctx.restore();}
  function draw(){gSky(ctx,W,H,'#0d1f45','#1a3a6b');
    ctx.fillStyle='#08142c';ctx.fillRect(0,0,COLS*CS,H);
    ctx.strokeStyle='rgba(0,229,255,.08)';for(let x=0;x<=COLS;x++){ctx.beginPath();ctx.moveTo(x*CS,0);ctx.lineTo(x*CS,H);ctx.stroke();}
    board&&board.forEach((row,r)=>row.forEach((v,q)=>{if(v!==null)cell(q,r,v);}));
    if(cur&&run){let gy=cur.y;while(fits(cur.m,cur.x,gy+1))gy++;cur.m.forEach((row,r)=>row.forEach((v,q)=>{if(v)cell(cur.x+q,gy+r,cur.k,0.22);}));
      cur.m.forEach((row,r)=>row.forEach((v,q)=>{if(v&&cur.y+r>=0)cell(cur.x+q,cur.y+r,cur.k);}));}
    const px=COLS*CS+12;gText(ctx,'NEXT',px+43,18,14,'#9fc3ff');
    if(next)next.m.forEach((row,r)=>row.forEach((v,q)=>{if(v){ctx.save();ctx.translate(px+10-(COLS*CS)+ (next.m[0].length===4?-6:6),30);cell(q+COLS,r,next.k);ctx.restore();}}));
    gText(ctx,'LINES',px+43,120,14,'#9fc3ff');gText(ctx,String(lines||0),px+43,146,28,'#00e5ff');
    gText(ctx,'GOAL',px+43,186,14,'#9fc3ff');gText(ctx,String(g.target),px+43,210,22,'#ffffff');
    gEmoji(ctx,g.icon||'🧳',px+43,290,42);
    if(!run)gOverlay(ctx,COLS*CS,H,over?'Case full!':'Suitcase Pack',over?('Lines: '+lines):'Tap to start',over?'Tap to pack again':'Fill rows to clear them');}
  function start(){board=Array.from({length:ROWS},()=>Array(COLS).fill(null));lines=0;score=0;speed=0.7;drop=0;won=false;over=false;cur=newPiece();next=newPiece();run=true;loop.start();}
  function end(){run=false;over=true;loop.stop();report(lines,won);sfx('lose');draw();}
  let tx=0,ty=0,moved=false,tt=0;
  c.addEventListener('pointerdown',e=>{if(!run){start();return;}const p=gPos(c,e);tx=p.x;ty=p.y;moved=false;tt=Date.now();});
  c.addEventListener('pointermove',e=>{if(!run||e.buttons===0&&e.pointerType==='mouse')return;const p=gPos(c,e);
    if(Math.abs(p.x-tx)>CS){move(p.x>tx?1:-1);tx=p.x;moved=true;}
    if(p.y-ty>CS*1.2){soft();ty=p.y;moved=true;}});
  c.addEventListener('pointerup',e=>{if(!run)return;const p=gPos(c,e);if(!moved&&Date.now()-tt<300){turn();}else if(p.y-ty>CS*3)hard();});
  const pad=gPad(stage,[{label:'◀',fn:()=>move(-1),repeat:120,keys:['ArrowLeft']},{label:'⟳',fn:turn,keys:['ArrowUp',' ']},{label:'▶',fn:()=>move(1),repeat:120,keys:['ArrowRight']},{label:'⬇',fn:soft,repeat:60,keys:['ArrowDown']},{label:'⤓ Drop',fn:hard,wide:true,keys:['Enter']}]);
  hud.innerHTML='🧳 Pack the case — every full row clears.';
  lines=0;draw();
  return {stop(){run=false;loop.stop();pad.remove();}};
}

/* ============================================================
   2 · MERGE — slide & merge up a themed chain (2048-style)
   ============================================================ */
const MERGE_DEFAULT=['🍙','🍡','🍱','🍜','🍣','🍥','🏮','⛩️','🗻','🏯','🌸','👑'];
function egMerge(stage,g,report){
  const chain=g.chain||MERGE_DEFAULT,N=4;
  const hud=gHud(stage);
  const wrap=document.createElement('div');wrap.className='mg-wrap';
  wrap.innerHTML='<div class="mg-board"></div><div class="mg-chain"></div>';
  stage.appendChild(wrap);
  const boardEl=wrap.querySelector('.mg-board');
  wrap.querySelector('.mg-chain').innerHTML=chain.map((e,i)=>'<span class="'+(i===g.target?'goal':'')+'">'+e+'</span>').join('<i>›</i>');
  let grid,score,best,won,dead;
  function empties(){const r=[];for(let y=0;y<N;y++)for(let x=0;x<N;x++)if(grid[y][x]<0)r.push([x,y]);return r;}
  function spawn(){const e=empties();if(!e.length)return null;const [x,y]=gPick(e);grid[y][x]=Math.random()<0.88?0:1;return x+','+y;}
  function reset(){grid=Array.from({length:N},()=>Array(N).fill(-1));score=0;best=0;won=false;dead=false;spawn();spawn();render(new Set(),new Set());}
  function canMove(){if(empties().length)return true;for(let y=0;y<N;y++)for(let x=0;x<N;x++){const v=grid[y][x];if(x<N-1&&grid[y][x+1]===v)return true;if(y<N-1&&grid[y+1][x]===v)return true;}return false;}
  function slide(dir){if(dead)return;
    const merged=new Set();let moved=false;
    const vec={left:[-1,0],right:[1,0],up:[0,-1],down:[0,1]}[dir];
    const xs=[...Array(N).keys()],ys=[...Array(N).keys()];if(vec[0]===1)xs.reverse();if(vec[1]===1)ys.reverse();
    const done=Array.from({length:N},()=>Array(N).fill(false));
    for(const y of ys)for(const x of xs){const v=grid[y][x];if(v<0)continue;
      let cx=x,cy=y;
      while(true){const nx=cx+vec[0],ny=cy+vec[1];if(nx<0||ny<0||nx>=N||ny>=N)break;
        if(grid[ny][nx]<0){grid[ny][nx]=grid[cy][cx];grid[cy][cx]=-1;cx=nx;cy=ny;moved=true;continue;}
        if(grid[ny][nx]===v&&!done[ny][nx]&&v<chain.length-1){grid[ny][nx]=v+1;grid[cy][cx]=-1;done[ny][nx]=true;merged.add(nx+','+ny);score+=Math.pow(2,v+2);moved=true;
          if(v+1>best)best=v+1;}
        break;}}
    if(!moved)return;
    const born=new Set();const s=spawn();if(s)born.add(s);
    if(merged.size)sfx('coin');
    if(!won&&best>=g.target){won=true;report(score,true);sfx('win');}
    render(merged,born);
    if(!canMove()){dead=true;report(score,won);sfx('lose');setTimeout(()=>{hud.innerHTML='🧱 No moves left! Score <b>'+score+'</b> · best tile '+chain[best]+' · tap <b>New game</b>';},200);}
  }
  function render(merged,born){
    boardEl.innerHTML='';
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){const v=grid[y][x];const d=document.createElement('div');
      d.className='mg-cell'+(v>=0?' t'+Math.min(v,11):'')+(merged.has(x+','+y)?' pop':'')+(born.has(x+','+y)?' new':'');
      if(v>=0)d.innerHTML='<span>'+chain[v]+'</span><small>'+(v+1)+'</small>';boardEl.appendChild(d);}
    if(!dead)hud.innerHTML='Score <b>'+score+'</b> · best '+chain[best]+(won?' · 🏆':' · goal '+chain[g.target]);
  }
  gSwipe(boardEl,slide,18);
  boardEl.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});
  const pad=gPad(stage,[{label:'◀',fn:()=>slide('left'),keys:['ArrowLeft']},{label:'▲',fn:()=>slide('up'),keys:['ArrowUp']},{label:'▼',fn:()=>slide('down'),keys:['ArrowDown']},{label:'▶',fn:()=>slide('right'),keys:['ArrowRight']},{label:'↺ New game',fn:reset,wide:true}]);
  reset();
  return {stop(){pad.remove();}};
}

/* ============================================================
   3 · SWAP — match-3 market stall, 20 moves
   ============================================================ */
function egSwap(stage,g,report){
  const N=7,MOVES=20,icons=(g.icons||['🍙','🍡','🍵','🍘','🍥','🎏']).slice(0,6);
  const hud=gHud(stage);
  const boardEl=document.createElement('div');boardEl.className='sw-board';stage.appendChild(boardEl);
  let grid,sel=null,score,moves,busy=false,won=false,dead=false;
  const R=()=>gInt(0,icons.length-1);
  function matches(){const hit=new Set();
    for(let y=0;y<N;y++){let run=1;for(let x=1;x<=N;x++){if(x<N&&grid[y][x]===grid[y][x-1]&&grid[y][x]>=0)run++;else{if(run>=3)for(let k=1;k<=run;k++)hit.add((x-k)+','+y);run=1;}}}
    for(let x=0;x<N;x++){let run=1;for(let y=1;y<=N;y++){if(y<N&&grid[y][x]===grid[y-1][x]&&grid[y][x]>=0)run++;else{if(run>=3)for(let k=1;k<=run;k++)hit.add(x+','+(y-k));run=1;}}}
    return hit;}
  function anyMove(){for(let y=0;y<N;y++)for(let x=0;x<N;x++)for(const [dx,dy] of [[1,0],[0,1]]){const X=x+dx,Y=y+dy;if(X>=N||Y>=N)continue;
    [grid[y][x],grid[Y][X]]=[grid[Y][X],grid[y][x]];const ok=matches().size>0;[grid[y][x],grid[Y][X]]=[grid[Y][X],grid[y][x]];if(ok)return true;}return false;}
  function fresh(){do{grid=Array.from({length:N},()=>Array.from({length:N},R));let m;while((m=matches()).size)m.forEach(k=>{const [x,y]=k.split(',').map(Number);grid[y][x]=R();});}while(!anyMove());}
  function reset(){fresh();score=0;moves=MOVES;won=false;dead=false;sel=null;busy=false;render();}
  function render(hit){boardEl.innerHTML='';
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){const b=document.createElement('button');b.type='button';
      b.className='sw-cell'+(sel&&sel[0]===x&&sel[1]===y?' sel':'')+(hit&&hit.has(x+','+y)?' boom':'');
      b.textContent=grid[y][x]>=0?icons[grid[y][x]]:'';b.dataset.x=x;b.dataset.y=y;boardEl.appendChild(b);}
    hud.innerHTML=dead?('🛒 Out of moves! Score <b>'+score+'</b> — tap any tile for a new game'):('Score <b>'+score+'</b> · moves left <b>'+moves+'</b>'+(won?' · 🏆':' · goal '+g.target));}
  function wait(ms){return new Promise(r=>setTimeout(r,ms));}
  async function resolve(){let combo=1;
    while(true){const hit=matches();if(!hit.size)break;
      score+=hit.size*10*combo;if(combo>1)sfx('coin');render(hit);await wait(230);
      hit.forEach(k=>{const [x,y]=k.split(',').map(Number);grid[y][x]=-1;});
      for(let x=0;x<N;x++){const col=[];for(let y=N-1;y>=0;y--)if(grid[y][x]>=0)col.push(grid[y][x]);for(let y=N-1,i=0;y>=0;y--,i++)grid[y][x]=i<col.length?col[i]:R();}
      render();await wait(160);combo++;}
    if(!anyMove()){fresh();render();}
  }
  async function trySwap(a,b){busy=true;
    const [x1,y1]=a,[x2,y2]=b;[grid[y1][x1],grid[y2][x2]]=[grid[y2][x2],grid[y1][x1]];render();
    if(!matches().size){await wait(180);[grid[y1][x1],grid[y2][x2]]=[grid[y2][x2],grid[y1][x1]];render();busy=false;return;}
    moves--;await resolve();
    if(!won&&score>=g.target){won=true;report(score,true);sfx('win');}
    if(moves<=0){dead=true;report(score,won);}
    render();busy=false;}
  let skipClick=false;
  boardEl.addEventListener('click',e=>{if(skipClick){skipClick=false;return;}const b=e.target.closest('.sw-cell');if(!b||busy)return;
    if(dead){reset();return;}
    const p=[+b.dataset.x,+b.dataset.y];
    if(!sel){sel=p;render();return;}
    if(Math.abs(sel[0]-p[0])+Math.abs(sel[1]-p[1])===1){const a=sel;sel=null;trySwap(a,p);}
    else{sel=(sel[0]===p[0]&&sel[1]===p[1])?null:p;render();}});
  /* swipe a tile to swap it with its neighbour */
  let sp=null;
  boardEl.addEventListener('pointerdown',e=>{const b=e.target.closest('.sw-cell');sp=b?{x:+b.dataset.x,y:+b.dataset.y,cx:e.clientX,cy:e.clientY}:null;});
  boardEl.addEventListener('pointerup',e=>{if(!sp||busy||dead)return;const dx=e.clientX-sp.cx,dy=e.clientY-sp.cy;if(Math.max(Math.abs(dx),Math.abs(dy))<24)return;
    const t=Math.abs(dx)>Math.abs(dy)?[sp.x+Math.sign(dx),sp.y]:[sp.x,sp.y+Math.sign(dy)];
    if(t[0]<0||t[1]<0||t[0]>=N||t[1]>=N)return;sel=null;skipClick=true;setTimeout(()=>{skipClick=false;},50);const a=[sp.x,sp.y];sp=null;trySwap(a,t);});
  reset();
  return {stop(){}};
}

/* ============================================================
   4 · CLIMB — bounce up platforms (torii beams, branches, floors)
   ============================================================ */
function egClimb(stage,g,report){
  const W=380,H=540,hud=gHud(stage),c=gCanvas(stage,W,H),ctx=c.getContext('2d');
  const P=g.p||'🦊',PLAT=g.plat||'#e0452b',sky=g.sky||['#0b1b36','#3a6fd5'];
  let pl,px,py,vx,vy,cam,top,run=false,over=false,won=false,steer=0,maxH;
  const loop=gLoop(tick);
  function addPlat(y){const r=Math.random(),w=gRand(62,86),k=top>1500&&r<0.18?'break':top>600&&r<0.36?'move':'solid';
    pl.push({x:gRand(10,W-w-10),y,w,k,dx:k==='move'?gRand(40,80)*(Math.random()<.5?-1:1):0,gone:false});}
  function reset(){pl=[];top=0;cam=0;px=W/2;py=H-80;vx=0;vy=-560;maxH=0;won=false;
    pl.push({x:W/2-50,y:H-40,w:100,k:'solid',dx:0});
    let y=H-40;while(y>-H){y-=gRand(58,92);addPlat(y);}}
  function tick(dt){
    vx+=(steer*900-vx*4)*dt;px+=vx*dt;if(px<-15)px=W+15;if(px>W+15)px=-15;
    vy+=1250*dt;const oy=py;py+=vy*dt;
    pl.forEach(p=>{if(p.k==='move'){p.x+=p.dx*dt;if(p.x<5||p.x+p.w>W-5)p.dx*=-1;}});
    if(vy>0)for(const p of pl){if(p.gone)continue;const sy=p.y-cam;
      if(oy+18<=p.y&&py+18>=p.y&&px>p.x-12&&px<p.x+p.w+12){
        if(p.k==='break'){p.gone=true;sfx('click');continue;}
        py=p.y-18;vy=-640;sfx('click');break;}}
    const h=Math.max(0,Math.round((H-80-py)/10));if(h>maxH)maxH=h;
    if(py-cam<H*0.4){const d=H*0.4-(py-cam);cam-=d;}
    let minY=Math.min(...pl.map(p=>p.y));top=maxH*10;
    while(minY>cam-60){minY-=gRand(60,top>2000?108:96);addPlat(minY);}
    pl=pl.filter(p=>p.y-cam<H+40);
    if(!won&&maxH>=g.target){won=true;report(maxH,true);sfx('win');}
    if(py-cam>H+40)return end();
    draw();}
  function draw(){gSky(ctx,W,H,sky[0],sky[1]);
    ctx.save();ctx.globalAlpha=.25;for(let i=0;i<12;i++){const y=((i*120-cam*0.3)%H+H)%H;ctx.fillStyle='#fff';ctx.fillRect((i*83)%W,y,2,2);}ctx.restore();
    pl.forEach(p=>{if(p.gone)return;const y=p.y-cam;
      ctx.fillStyle=p.k==='break'?'#8a6a4a':PLAT;gRR(ctx,p.x,y,p.w,11,4);ctx.fill();
      if(g.torii){ctx.fillStyle='#111';ctx.fillRect(p.x-4,y-4,p.w+8,5);ctx.fillStyle=PLAT;ctx.fillRect(p.x+10,y+10,7,16);ctx.fillRect(p.x+p.w-17,y+10,7,16);}
      if(p.k==='break'){ctx.strokeStyle='#3b2a1a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x+p.w*0.4,y);ctx.lineTo(p.x+p.w*0.5,y+11);ctx.lineTo(p.x+p.w*0.6,y+3);ctx.stroke();}
      if(p.k==='move'){ctx.fillStyle='rgba(255,255,255,.6)';ctx.fillRect(p.x+p.w/2-8,y+4,16,3);}});
    gEmoji(ctx,P,px,py-cam,38);
    gText(ctx,maxH+'m',W-12,22,20,'#fff','right');
    if(!run)gOverlay(ctx,W,H,over?'You fell!':(g.title||'Climb!'),over?('Height: '+maxH+'m'):'Tap to start',over?'Tap to climb again':'Hold left / right to steer');}
  function end(){run=false;over=true;loop.stop();report(maxH,won);sfx('lose');draw();}
  c.addEventListener('pointerdown',e=>{if(!run){reset();run=true;over=false;loop.start();return;}const p=gPos(c,e);steer=p.x<W/2?-1:1;});
  c.addEventListener('pointermove',e=>{if(run&&e.buttons){const p=gPos(c,e);steer=p.x<W/2?-1:1;}});
  const up=()=>{steer=0;};c.addEventListener('pointerup',up);c.addEventListener('pointercancel',up);c.addEventListener('pointerleave',up);
  const pad=gPad(stage,[{label:'◀ Left',fn:()=>steer=-1,up,keys:['ArrowLeft'],wide:true},{label:'Right ▶',fn:()=>steer=1,up,keys:['ArrowRight'],wide:true}]);
  hud.innerHTML='⬆️ Bounce as high as you can!';
  reset();maxH=0;draw();
  return {stop(){run=false;loop.stop();pad.remove();}};
}

/* ============================================================
   5 · CROSS — get across busy lanes (Frogger-style)
   ============================================================ */
function egCross(stage,g,report){
  const COLS=8,ROWS=11,CS=46,W=COLS*CS,H=ROWS*CS;
  const hud=gHud(stage),c=gCanvas(stage,W,H),ctx=c.getContext('2d');
  const P=g.p||'🚶',OBS=g.obs||['🚗','🚕','🚙','🚌'],GOAL=g.goal||'🏁',road=g.road||'#2a2f3a',safe=g.safe||'#3a6b4a';
  let lanes,fx,fy,lives,crossed,run=false,over=false,won=false,level,flash=0,best=0,grace=0;
  const loop=gLoop(tick);
  function laneFor(r){return r===0||r===ROWS-1||r===Math.floor(ROWS/2);}
  function build(){lanes=[];for(let r=0;r<ROWS;r++){if(laneFor(r)){lanes.push(null);continue;}
      const dir=r%2?1:-1,sp=(50+level*14+gRand(0,40))*dir,gap=gRand(2.3,3.6)*CS,n=Math.ceil((W+4*CS)/gap);
      const list=[];for(let i=0;i<n;i++)list.push({x:i*gap+gRand(0,CS),e:gPick(OBS),w:CS*(Math.random()<0.25?1.6:1)});
      lanes.push({sp,list});}}
  function reset(){level=0;lives=3;crossed=0;won=false;build();home();}
  function home(){fx=Math.floor(COLS/2);fy=ROWS-1;grace=0.6;}
  function hop(dx,dy){if(!run)return;const nx=fx+dx,ny=fy+dy;if(nx<0||nx>=COLS||ny<0||ny>=ROWS)return;fx=nx;fy=ny;sfx('click');
    if(fy===0){crossed++;level++;sfx('coin');if(!won&&crossed>=g.target){won=true;report(crossed,true);sfx('win');}build();home();}}
  function tick(dt){if(grace>0)grace-=dt;if(flash>0)flash-=dt;
    lanes.forEach(l=>{if(!l)return;l.list.forEach(o=>{o.x+=l.sp*dt;const span=W+4*CS;if(l.sp>0&&o.x>W+CS)o.x-=span;if(l.sp<0&&o.x<-2*CS)o.x+=span;});});
    const l=lanes[fy];if(l&&grace<=0){const cx=fx*CS+CS/2;for(const o of l.list){if(cx>o.x+6&&cx<o.x+o.w-6){lives--;flash=0.5;sfx('lose');if(navigator.vibrate)navigator.vibrate(80);home();if(lives<=0)return end();break;}}}
    draw();}
  function draw(){ctx.fillStyle=road;ctx.fillRect(0,0,W,H);
    for(let r=0;r<ROWS;r++){const y=r*CS;
      if(laneFor(r)){ctx.fillStyle=r===0?(g.goalCol||'#1f6fe0'):safe;ctx.fillRect(0,y,W,CS);
        if(r===0)for(let x=0;x<COLS;x++)gEmoji(ctx,GOAL,x*CS+CS/2,y+CS/2,22);}
      else{if(g.zebra){ctx.fillStyle='rgba(255,255,255,.18)';for(let x=0;x<W;x+=26)ctx.fillRect(x,y+6,13,CS-12);}
        ctx.strokeStyle='rgba(255,255,255,.14)';ctx.setLineDash([12,10]);ctx.beginPath();ctx.moveTo(0,y+CS);ctx.lineTo(W,y+CS);ctx.stroke();ctx.setLineDash([]);}}
    lanes.forEach((l,r)=>{if(!l)return;l.list.forEach(o=>{ctx.save();if(l.sp>0){ctx.translate(o.x+o.w/2,r*CS+CS/2);ctx.scale(-1,1);gEmoji(ctx,o.e,0,0,CS*0.8);}else gEmoji(ctx,o.e,o.x+o.w/2,r*CS+CS/2,CS*0.8);ctx.restore();});});
    ctx.save();if(grace>0&&Math.floor(grace*10)%2)ctx.globalAlpha=.4;gEmoji(ctx,P,fx*CS+CS/2,fy*CS+CS/2,CS*0.78);ctx.restore();
    if(flash>0){ctx.fillStyle='rgba(255,40,60,'+flash*0.6+')';ctx.fillRect(0,0,W,H);}
    hud.innerHTML='Crossings <b>'+(crossed||0)+'</b> · '+'❤️'.repeat(Math.max(0,lives||0))+(won?' · 🏆':'');
    if(!run)gOverlay(ctx,W,H,over?'Out of lives!':(g.title||'Crossing'),over?('Crossings: '+crossed):'Tap to start',over?'Tap to try again':'Swipe or use the arrows');}
  function end(){run=false;over=true;loop.stop();report(crossed,won);draw();}
  c.addEventListener('pointerdown',()=>{if(!run){reset();run=true;over=false;loop.start();}});
  gSwipe(c,d=>{if(!run)return;({up:()=>hop(0,-1),down:()=>hop(0,1),left:()=>hop(-1,0),right:()=>hop(1,0)})[d]();},16);
  c.addEventListener('click',e=>{if(!run)return;});
  const pad=gPad(stage,[{label:'◀',fn:()=>hop(-1,0),keys:['ArrowLeft']},{label:'▲',fn:()=>hop(0,-1),keys:['ArrowUp']},{label:'▼',fn:()=>hop(0,1),keys:['ArrowDown']},{label:'▶',fn:()=>hop(1,0),keys:['ArrowRight']}]);
  reset();lives=3;crossed=0;draw();
  return {stop(){run=false;loop.stop();pad.remove();}};
}

/* ============================================================
   6 · BELT — conveyor orders (kaiten-zushi, market stalls)
   ============================================================ */
function egBelt(stage,g,report){
  const W=380,H=460,hud=gHud(stage),c=gCanvas(stage,W,H),ctx=c.getContext('2d');
  const GOOD=g.good||['🍣','🍙','🥚','🍤'],BAD=g.bad||['🦐','🦑','🦀','🐙'],LABEL=g.label||'Order';
  const BELTS=[{y:210,dir:1},{y:330,dir:-1}];
  let plates,order,orders,lives,timer,tmax,run=false,over=false,won=false,speed,msg='',msgT=0;
  const loop=gLoop(tick);
  function newOrder(){const n=Math.min(3+Math.floor(orders/2),6);const o={};for(let i=0;i<n;i++){const e=gPick(GOOD);o[e]=(o[e]||0)+1;}order=o;tmax=Math.max(11,20-orders);timer=tmax;}
  function reset(){plates=[];orders=0;lives=3;speed=70;won=false;newOrder();
    BELTS.forEach(b=>{for(let x=0;x<W;x+=72)plates.push(mk(b,x));});}
  function mk(b,x){const need=Object.keys(order).filter(k=>order[k]>0);const r=Math.random();
    const e=r<0.45&&need.length?gPick(need):r<0.72?gPick(GOOD):gPick(BAD);return {b,x,e,taken:false};}
  function tick(dt){timer-=dt;if(msgT>0)msgT-=dt;
    plates.forEach(p=>{p.x+=p.b.dir*speed*dt;});
    plates=plates.filter(p=>!p.taken&&p.x>-50&&p.x<W+50);
    /* keep an even gap: only add a plate once the last one has moved far enough onto the belt */
    BELTS.forEach(bt=>{const on=plates.filter(p=>p.b===bt);const edge=bt.dir>0?Math.min(W+80,...on.map(p=>p.x)):Math.max(-80,...on.map(p=>p.x));
      const gap=bt.dir>0?edge-(-40):(W+40)-edge;if(gap>=72+(bt.skip||0)){bt.skip=Math.random()<0.25?gRand(20,70):0;plates.push(mk(bt,bt.dir>0?-40:W+40));}});
    if(timer<=0){lives--;say('⏰ Too slow!');sfx('lose');if(lives<=0)return end();newOrder();}
    draw();}
  function say(t){msg=t;msgT=1.1;}
  function tap(x,y){if(!run)return;for(const p of plates){if(Math.abs(p.x-x)<30&&Math.abs(p.b.y-y)<34&&!p.taken){p.taken=true;
      if(BAD.includes(p.e)){lives--;say('🚫 Not allowed!');sfx('lose');if(navigator.vibrate)navigator.vibrate(90);if(lives<=0)end();return;}
      if(order[p.e]>0){order[p.e]--;sfx('click');
        if(Object.values(order).every(v=>v<=0)){orders++;speed+=8;say('✅ Order done!');sfx('coin');if(!won&&orders>=g.target){won=true;report(orders,true);sfx('win');}newOrder();}}
      else{timer=Math.max(0,timer-2);say('Not on the order (−2s)');}
      return;}}}
  function draw(){gSky(ctx,W,H,'#12264d','#0b1b36');
    ctx.fillStyle='#fff8ec';gRR(ctx,14,14,W-28,120,14);ctx.fill();
    gText(ctx,LABEL,W/2,34,16,'#0d3f8f');
    const ks=Object.keys(order||{});ks.forEach((k,i)=>{const x=W/2+(i-(ks.length-1)/2)*62;gEmoji(ctx,k,x,76,34);
      gText(ctx,order[k]>0?('×'+order[k]):'✓',x,110,16,order[k]>0?'#d7263d':'#12b38a');});
    ctx.fillStyle='#dbe7f7';ctx.fillRect(24,136,W-48,8);ctx.fillStyle=timer/tmax<0.3?'#d7263d':'#1f6fe0';ctx.fillRect(24,136,(W-48)*Math.max(0,timer/tmax),8);
    BELTS.forEach(b=>{ctx.fillStyle='#39414f';ctx.fillRect(0,b.y-30,W,60);ctx.fillStyle='#4c5566';for(let x=((Date.now()/20*b.dir)%24+24)%24;x<W;x+=24)ctx.fillRect(x,b.y-30,3,60);});
    plates.forEach(p=>{ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(p.x,p.b.y+4,27,20,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle=BAD.includes(p.e)?'#f0a830':'#1f6fe0';ctx.lineWidth=3;ctx.stroke();gEmoji(ctx,p.e,p.x,p.b.y+2,30);});
    gText(ctx,'❤️'.repeat(Math.max(0,lives||0)),14,H-22,18,'#fff','left');gText(ctx,'Orders '+(orders||0),W-14,H-22,18,'#00e5ff','right');
    if(msgT>0)gText(ctx,msg,W/2,H-60,20,'#ffd166');
    if(!run)gOverlay(ctx,W,H,over?'Shift over!':(g.title||'Conveyor'),over?('Orders done: '+orders):'Tap to start',over?'Tap to play again':'Tap the plates on the order');}
  function end(){run=false;over=true;loop.stop();report(orders,won);draw();}
  c.addEventListener('pointerdown',e=>{if(!run){reset();run=true;over=false;loop.start();return;}const p=gPos(c,e);tap(p.x,p.y);});
  hud.innerHTML='🍽️ Tap the plates the family ordered. '+BAD.join(' ')+' = not allowed!';
  order={};reset();orders=0;lives=3;draw();
  return {stop(){run=false;loop.stop();}};
}

/* ============================================================
   7 · DIFF — spot the 5 differences
   ============================================================ */
function egDiff(stage,g,report){
  const W=380,PH=230,GAP=10,H=PH*2+GAP,hud=gHud(stage),c=gCanvas(stage,W,H),ctx=c.getContext('2d');
  const ITEMS=g.items||['🏮','⛩️','🌸','🐟','🍙','🎏','🗻','🌳','🐈','🎐','🍡','🏯'];
  const sky=g.sky||['#8ec5ff','#e8f4ff'],ground=g.ground||'#6fae5b';
  let objs,diffs,found,rounds,timeLeft,run=false,over=false,won=false,marks=[],pen=0;
  const loop=gLoop(dt=>{timeLeft-=dt;if(pen>0)pen-=dt;if(timeLeft<=0)return end();draw();});
  function scene(){objs=[];const n=13+Math.min(rounds,4);let tries=0;
    while(objs.length<n&&tries++<400){const s=gRand(24,40),x=gRand(s/2+4,W-s/2-4),y=gRand(s/2+30,PH-s/2-4);
      if(objs.some(o=>Math.hypot(o.x-x,o.y-y)<(o.s+s)/2+4))continue;objs.push({x,y,s,e:gPick(ITEMS)});}
    const idx=gShuffle(objs.map((_,i)=>i)).slice(0,5);
    diffs=idx.map(i=>{const o=objs[i],kind=gPick(['gone','swap','big','move']);const b={...o};
      if(kind==='gone')b.e=null;
      else if(kind==='swap'){let e;do{e=gPick(ITEMS);}while(e===o.e);b.e=e;}
      else if(kind==='big')b.s=o.s*(Math.random()<.5?0.55:1.55);
      else{b.x=Math.min(W-20,Math.max(20,o.x+gPick([-1,1])*gRand(14,20)));}
      return {i,a:o,b,got:false};});
    found=0;marks=[];timeLeft=Math.max(35,60-rounds*5);}
  function panel(oy,alt){ctx.save();ctx.beginPath();ctx.rect(0,oy,W,PH);ctx.clip();
    const gr=ctx.createLinearGradient(0,oy,0,oy+PH);gr.addColorStop(0,sky[0]);gr.addColorStop(1,sky[1]);ctx.fillStyle=gr;ctx.fillRect(0,oy,W,PH);
    ctx.fillStyle=ground;ctx.fillRect(0,oy+PH*0.72,W,PH*0.28);
    objs.forEach((o,i)=>{let d=o;if(alt){const df=diffs.find(x=>x.i===i);if(df)d=df.b;}if(d.e)gEmoji(ctx,d.e,d.x,oy+d.y,d.s);});
    ctx.restore();ctx.strokeStyle='#0a1428';ctx.lineWidth=3;ctx.strokeRect(1.5,oy+1.5,W-3,PH-3);}
  function draw(){ctx.fillStyle='#0a1428';ctx.fillRect(0,0,W,H);panel(0,false);panel(PH+GAP,true);
    diffs&&diffs.forEach(d=>{if(!d.got)return;[0,PH+GAP].forEach(oy=>{ctx.strokeStyle='#ff3d8b';ctx.lineWidth=4;ctx.beginPath();ctx.arc(d.a.x,oy+d.a.y,Math.max(d.a.s,d.b.s||0)/2+10,0,Math.PI*2);ctx.stroke();});});
    marks.forEach(m=>{gText(ctx,'✖',m.x,m.y,26,'#d7263d');});
    if(run){ctx.fillStyle='rgba(10,20,40,.7)';gRR(ctx,6,6,150,26,8);ctx.fill();gText(ctx,'⏱ '+Math.ceil(timeLeft)+'s  ·  '+found+'/5',81,19,15,pen>0?'#ff6b6b':'#fff');}
    hud.innerHTML='Rounds cleared <b>'+(rounds||0)+'</b>'+(won?' · 🏆':'');
    if(!run)gOverlay(ctx,W,H,over?'Time up!':(g.title||'Spot the difference'),over?('Rounds cleared: '+rounds):'Tap to start',over?'Tap to play again':'Find 5 differences');}
  function tap(x,y){const oy=y>PH+GAP?PH+GAP:0;const ly=y-oy;
    for(const d of diffs){if(d.got)continue;const r=Math.max(d.a.s,d.b.s||0)/2+14;
      if(Math.hypot(x-d.a.x,ly-d.a.y)<r||(d.b.e&&Math.hypot(x-d.b.x,ly-d.b.y)<r)){d.got=true;found++;sfx('coin');
        if(found>=5){rounds++;sfx('win');if(!won&&rounds>=g.target){won=true;report(rounds,true);}setTimeout(()=>{if(run){scene();}},500);}return;}}
    timeLeft-=3;pen=0.4;marks.push({x,y});setTimeout(()=>marks.shift(),500);sfx('lose');}
  function end(){run=false;over=true;loop.stop();report(rounds,won);draw();}
  c.addEventListener('pointerdown',e=>{const p=gPos(c,e);if(!run){rounds=0;won=false;scene();run=true;over=false;loop.start();return;}tap(p.x,p.y);});
  rounds=0;scene();draw();
  return {stop(){run=false;loop.stop();}};
}

/* ============================================================
   8 · PATH — one-stroke path through every open square
   ============================================================ */
function egPath(stage,g,report){
  const hud=gHud(stage),box=document.createElement('div');box.className='pz-wrap';stage.appendChild(box);
  const ROCK=g.rock||'🪨',START=g.start||'🧘',trail=g.trail||'#e9dcc0';
  let N,open,path,solved=0,won=false,board;
  function gen(){for(let tries=0;tries<200;tries++){
      const cells=N*N,seen=Array(cells).fill(false);let cur=gInt(0,cells-1);const p=[cur];seen[cur]=true;
      const nb=i=>{const x=i%N,y=Math.floor(i/N),r=[];if(x>0)r.push(i-1);if(x<N-1)r.push(i+1);if(y>0)r.push(i-N);if(y<N-1)r.push(i+N);return r;};
      while(true){const opts=nb(cur).filter(j=>!seen[j]);if(!opts.length)break;
        const deg=j=>nb(j).filter(k=>!seen[k]).length;opts.sort((a,b)=>deg(a)-deg(b)+(Math.random()-0.5)*1.2);cur=opts[0];seen[cur]=true;p.push(cur);}
      if(p.length>=cells*0.72&&p.length<cells){open=seen;return p[0];}}
    open=Array(N*N).fill(true);return 0;}
  function newPuzzle(){N=Math.min(5+Math.floor(solved/2),8);const s=gen();path=[s];render();}
  function render(){box.innerHTML='';board=document.createElement('div');board.className='pz-board';board.style.gridTemplateColumns='repeat('+N+',1fr)';
    for(let i=0;i<N*N;i++){const d=document.createElement('div');const k=path.indexOf(i);
      d.className='pz-cell'+(open[i]?'':' rock')+(k>=0?' on':'')+(k===path.length-1?' head':'');d.dataset.i=i;
      if(!open[i])d.textContent=ROCK;else if(k===0)d.textContent=START;else if(k>0)d.style.background=trail;
      board.appendChild(d);}
    box.appendChild(board);const left=open.filter(Boolean).length-path.length;
    hud.innerHTML='Solved <b>'+solved+'</b> · squares left <b>'+left+'</b>'+(won?' · 🏆':'');
    const row=document.createElement('div');row.className='pz-tools';row.innerHTML='<button type="button" class="btn btn-quiet pz-undo">↶ Undo</button><button type="button" class="btn btn-quiet pz-reset">Restart</button><button type="button" class="btn btn-quiet pz-skip">New puzzle</button>';
    box.appendChild(row);row.querySelector('.pz-undo').onclick=()=>{if(path.length>1){path.pop();render();}};
    row.querySelector('.pz-reset').onclick=()=>{path=[path[0]];render();};row.querySelector('.pz-skip').onclick=newPuzzle;
    wire();}
  function adj(a,b){const ax=a%N,ay=Math.floor(a/N),bx=b%N,by=Math.floor(b/N);return Math.abs(ax-bx)+Math.abs(ay-by)===1;}
  function visit(i){if(i==null||!open[i])return;const head=path[path.length-1];
    if(path.length>1&&i===path[path.length-2]){path.pop();paint();return;}
    if(path.includes(i)||!adj(head,i))return;path.push(i);paint();
    if(path.length===open.filter(Boolean).length){solved++;sfx('win');burst(box);if(!won&&solved>=g.target){won=true;report(solved,true);}else report(solved,won);setTimeout(newPuzzle,700);}}
  function paint(){board.querySelectorAll('.pz-cell').forEach(d=>{const i=+d.dataset.i,k=path.indexOf(i);d.classList.toggle('on',k>=0);d.classList.toggle('head',k===path.length-1);
      if(open[i]&&k!==0){d.textContent='';d.style.background=k>0?trail:'';}});
    hud.innerHTML='Solved <b>'+solved+'</b> · squares left <b>'+(open.filter(Boolean).length-path.length)+'</b>'+(won?' · 🏆':'');}
  let down=false;window.addEventListener('pointerup',()=>down=false);
  function wire(){
    const at=e=>{const el=document.elementFromPoint(e.clientX,e.clientY);const d=el&&el.closest&&el.closest('.pz-cell');return d&&board.contains(d)?+d.dataset.i:null;};
    board.addEventListener('pointerdown',e=>{down=true;const i=at(e);if(i===path[path.length-1])return;visit(i);});
    board.addEventListener('pointermove',e=>{if(down)visit(at(e));});
    board.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});}
  newPuzzle();
  return {stop(){}};
}

/* ============================================================
   9 · PIPES — rotate tiles until every tile is powered
   ============================================================ */
function egPipes(stage,g,report){
  const hud=gHud(stage),box=document.createElement('div');box.className='pz-wrap';stage.appendChild(box);
  const SRC=g.src||'⚡',END=g.end||'💡',col=g.col||'#00e5ff';
  let N,conn,rot,src,solved=0,won=false,moves;
  /* bits: 1=up 2=right 4=down 8=left */
  const turn=(b,k)=>{for(let i=0;i<k;i++)b=((b<<1)|(b>>3))&15;return b;};
  function gen(){N=Math.min(4+Math.floor(solved/1.5),7);conn=Array(N*N).fill(0);src=Math.floor(N/2)*N+Math.floor(N/2);
    const seen=Array(N*N).fill(false),stack=[src];seen[src]=true;
    while(stack.length){const i=stack[stack.length-1],x=i%N,y=Math.floor(i/N);
      const opts=[[0,-1,1,4],[1,0,2,8],[0,1,4,1],[-1,0,8,2]].filter(([dx,dy])=>{const X=x+dx,Y=y+dy;return X>=0&&Y>=0&&X<N&&Y<N&&!seen[Y*N+X];});
      if(!opts.length||(stack.length>3&&Math.random()<0.18)){stack.pop();continue;}
      const [dx,dy,a,b]=gPick(opts),j=(y+dy)*N+x+dx;conn[i]|=a;conn[j]|=b;seen[j]=true;stack.push(j);}
    rot=conn.map(()=>gInt(0,3));moves=0;
    if(powered().every(Boolean))rot[0]=(rot[0]+1)%4;render();}
  function cur(i){return turn(conn[i],rot[i]);}
  function powered(){const on=Array(N*N).fill(false),q=[src];on[src]=true;
    while(q.length){const i=q.shift(),x=i%N,y=Math.floor(i/N),b=cur(i);
      [[1,0,-1,4],[2,1,0,8],[4,0,1,1],[8,-1,0,2]].forEach(([bit,dx,dy,back])=>{if(!(b&bit))return;const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=N||Y>=N)return;const j=Y*N+X;if(on[j]||!(cur(j)&back))return;on[j]=true;q.push(j);});}
    return on;}
  function svg(b,lit){const c=lit?col:'#5d7690',w=lit?9:7;let s='<svg viewBox="0 0 60 60" class="pp-svg">';
    const seg={1:'M30 30V0',2:'M30 30H60',4:'M30 30V60',8:'M30 30H0'};
    [1,2,4,8].forEach(k=>{if(b&k)s+='<path d="'+seg[k]+'" stroke="'+c+'" stroke-width="'+w+'" stroke-linecap="round"'+(lit?' style="filter:drop-shadow(0 0 4px '+c+')"':'')+'/>';});
    s+='<circle cx="30" cy="30" r="'+(lit?7:5)+'" fill="'+c+'"/></svg>';return s;}
  function render(){const on=powered();box.innerHTML='';const bd=document.createElement('div');bd.className='pz-board pp';bd.style.gridTemplateColumns='repeat('+N+',1fr)';
    for(let i=0;i<N*N;i++){const d=document.createElement('button');d.type='button';d.className='pz-cell pp-cell'+(on[i]?' lit':'');d.dataset.i=i;
      const b=cur(i),deg=[1,2,4,8].filter(k=>b&k).length;
      d.innerHTML=svg(b,on[i])+(i===src?'<span class="pp-ico">'+SRC+'</span>':deg===1?'<span class="pp-ico'+(on[i]?'':' dim')+'">'+END+'</span>':'');bd.appendChild(d);}
    box.appendChild(bd);
    const done=on.every(Boolean);
    hud.innerHTML='Boards lit <b>'+solved+'</b> · powered <b>'+on.filter(Boolean).length+'/'+on.length+'</b>'+(won?' · 🏆':'');
    bd.addEventListener('click',e=>{const d=e.target.closest('.pp-cell');if(!d||done)return;const i=+d.dataset.i;rot[i]=(rot[i]+1)%4;moves++;sfx('click');render();});
    if(done){solved++;sfx('win');burst(box);if(!won&&solved>=g.target){won=true;report(solved,true);}else report(solved,won);
      hud.innerHTML='✨ All lit! Boards <b>'+solved+'</b>'+(won?' · 🏆':'');setTimeout(gen,900);}}
  gen();
  return {stop(){}};
}

/* ============================================================
   10 · LIGHTS — light every lantern (Lights Out)
   ============================================================ */
function egLights(stage,g,report){
  const hud=gHud(stage),box=document.createElement('div');box.className='pz-wrap';stage.appendChild(box);
  const ON=g.on||'🏮';
  let N,s,solved=0,won=false,moves,par;
  function press(i,arr){const x=i%N,y=Math.floor(i/N);[[0,0],[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy])=>{const X=x+dx,Y=y+dy;if(X>=0&&Y>=0&&X<N&&Y<N)arr[Y*N+X]^=1;});}
  function gen(){N=solved>=3?5:solved>=1?4:3;s=Array(N*N).fill(1);par=Math.min(3+solved*2,N*N-2);
    const picks=gShuffle([...Array(N*N).keys()]).slice(0,par);picks.forEach(i=>press(i,s));
    if(s.every(v=>v))press(0,s);moves=0;render();}
  function render(){box.innerHTML='';const bd=document.createElement('div');bd.className='pz-board lt';bd.style.gridTemplateColumns='repeat('+N+',1fr)';
    s.forEach((v,i)=>{const d=document.createElement('button');d.type='button';d.className='pz-cell lt-cell'+(v?' on':'');d.dataset.i=i;d.textContent=ON;bd.appendChild(d);});
    box.appendChild(bd);
    const row=document.createElement('div');row.className='pz-tools';row.innerHTML='<button type="button" class="btn btn-quiet">New board</button>';row.firstChild.onclick=gen;box.appendChild(row);
    const lit=s.filter(Boolean).length;
    hud.innerHTML='Boards <b>'+solved+'</b> · lit <b>'+lit+'/'+s.length+'</b> · taps '+moves+' (can be done in '+par+')'+(won?' · 🏆':'');
    bd.addEventListener('click',e=>{const d=e.target.closest('.lt-cell');if(!d)return;press(+d.dataset.i,s);moves++;sfx('click');
      if(s.every(v=>v)){solved++;render();sfx('win');burst(box);if(!won&&solved>=g.target){won=true;report(solved,true);}else report(solved,won);
        hud.innerHTML='✨ Every lantern lit! Boards <b>'+solved+'</b>'+(won?' · 🏆':'');setTimeout(gen,900);return;}
      render();});}
  gen();
  return {stop(){}};
}

/* ============================================================
   11 · MAZE — escape before the clock (optional torch-only fog)
   ============================================================ */
function egMaze(stage,g,report){
  const W=380,H=380,hud=gHud(stage),c=gCanvas(stage,W,H),ctx=c.getContext('2d');
  const P=g.p||'🙂',EXIT=g.exit||'🚪',wall=g.wall||'#2e7d32',floor=g.floor||'#f3ead2',fog=!!g.fog,PICK=g.pick||null;
  let N,cells,px,py,escaped=0,run=false,over=false,won=false,timeLeft,cs,picks,got;
  const loop=gLoop(dt=>{timeLeft-=dt;if(timeLeft<=0)return end();draw();});
  function gen(){N=Math.min(7+escaped*2,15);cs=W/N;cells=Array.from({length:N*N},()=>({w:[1,1,1,1]}));
    const seen=Array(N*N).fill(false),st=[0];seen[0]=true;
    while(st.length){const i=st[st.length-1],x=i%N,y=Math.floor(i/N);
      const o=[[0,-1,0,2],[1,0,1,3],[0,1,2,0],[-1,0,3,1]].filter(([dx,dy])=>{const X=x+dx,Y=y+dy;return X>=0&&Y>=0&&X<N&&Y<N&&!seen[Y*N+X];});
      if(!o.length){st.pop();continue;}const [dx,dy,a,b]=gPick(o),j=(y+dy)*N+x+dx;cells[i].w[a]=0;cells[j].w[b]=0;seen[j]=true;st.push(j);}
    px=0;py=0;timeLeft=25+N*3.2;picks=[];got=0;
    if(PICK){while(picks.length<3){const k=gInt(1,N*N-2);if(!picks.includes(k))picks.push(k);}}}
  function mv(d){if(!run)return;const i=py*N+px,[dx,dy,wi]={up:[0,-1,0],right:[1,0,1],down:[0,1,2],left:[-1,0,3]}[d];
    if(cells[i].w[wi])return;px+=dx;py+=dy;
    const k=picks.indexOf(py*N+px);if(k>=0){picks.splice(k,1);got++;timeLeft+=4;sfx('coin');}
    if(px===N-1&&py===N-1){escaped++;sfx('win');if(!won&&escaped>=g.target){won=true;report(escaped,true);}gen();}draw();}
  function draw(){ctx.fillStyle=floor;ctx.fillRect(0,0,W,H);
    ctx.strokeStyle=wall;ctx.lineWidth=Math.max(3,cs*0.16);ctx.lineCap='round';
    cells.forEach((cl,i)=>{const x=(i%N)*cs,y=Math.floor(i/N)*cs;ctx.beginPath();
      if(cl.w[0]){ctx.moveTo(x,y);ctx.lineTo(x+cs,y);}if(cl.w[1]){ctx.moveTo(x+cs,y);ctx.lineTo(x+cs,y+cs);}
      if(cl.w[2]){ctx.moveTo(x,y+cs);ctx.lineTo(x+cs,y+cs);}if(cl.w[3]){ctx.moveTo(x,y);ctx.lineTo(x,y+cs);}ctx.stroke();});
    picks.forEach(k=>gEmoji(ctx,PICK,(k%N+0.5)*cs,(Math.floor(k/N)+0.5)*cs,cs*0.6));
    gEmoji(ctx,EXIT,(N-0.5)*cs,(N-0.5)*cs,cs*0.75);gEmoji(ctx,P,(px+0.5)*cs,(py+0.5)*cs,cs*0.8);
    if(fog&&run){const cx=(px+0.5)*cs,cy=(py+0.5)*cs,r=cs*3;const gr=ctx.createRadialGradient(cx,cy,r*0.3,cx,cy,r);gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(1,'rgba(3,6,12,0.97)');
      ctx.fillStyle=gr;ctx.fillRect(0,0,W,H);ctx.fillStyle='rgba(3,6,12,0.97)';ctx.beginPath();ctx.rect(0,0,W,H);ctx.arc(cx,cy,r,0,Math.PI*2,true);ctx.fill();}
    hud.innerHTML='Escaped <b>'+escaped+'</b>'+(run?' · ⏱ <b>'+Math.ceil(timeLeft)+'s</b>':'')+(PICK&&run?' · '+PICK+' '+got+' (+4s each)':'')+(won?' · 🏆':'');
    if(!run)gOverlay(ctx,W,H,over?'Out of time!':(g.title||'Maze'),over?('Mazes escaped: '+escaped):'Tap to start',over?'Tap to try again':(fog?'Torch only — the exit is bottom-right':'Get to '+EXIT));}
  function end(){run=false;over=true;loop.stop();report(escaped,won);sfx('lose');draw();}
  c.addEventListener('pointerdown',()=>{if(!run){escaped=0;won=false;gen();run=true;over=false;loop.start();}});
  gSwipe(c,mv,14);
  c.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});
  const pad=gPad(stage,[{label:'◀',fn:()=>mv('left'),repeat:140,keys:['ArrowLeft']},{label:'▲',fn:()=>mv('up'),repeat:140,keys:['ArrowUp']},{label:'▼',fn:()=>mv('down'),repeat:140,keys:['ArrowDown']},{label:'▶',fn:()=>mv('right'),repeat:140,keys:['ArrowRight']}]);
  escaped=0;gen();draw();
  return {stop(){run=false;loop.stop();pad.remove();}};
}

/* ============================================================
   12 · PLINKO — pachinko drop, 10 balls
   ============================================================ */
function egPlinko(stage,g,report){
  const W=380,H=540,hud=gHud(stage),c=gCanvas(stage,W,H),ctx=c.getContext('2d');
  const VALS=g.vals||[10,50,100,300,100,50,10],BALL=g.ball||null,neon=g.neon||'#ff3d8b';
  const pegs=[];for(let r=0;r<9;r++){const n=r%2?7:8;for(let i=0;i<n;i++)pegs.push({x:(r%2?W/7*(i+0.5)+W/56:W/8*(i+0.5)),y:110+r*42});}
  const binW=W/VALS.length,BR=9,PR=5;
  let balls,left,score,run=false,over=false,won=false,lastBin=-1,binFlash=0;
  const loop=gLoop(dt=>{
    const steps=3;for(let s=0;s<steps;s++){const h=dt/steps;
      balls.forEach(b=>{if(b.done)return;b.vy+=900*h;b.x+=b.vx*h;b.y+=b.vy*h;
        if(b.x<BR){b.x=BR;b.vx=Math.abs(b.vx)*0.6;}if(b.x>W-BR){b.x=W-BR;b.vx=-Math.abs(b.vx)*0.6;}
        for(const p of pegs){const dx=b.x-p.x,dy=b.y-p.y,d=Math.hypot(dx,dy);if(d<BR+PR&&d>0){const nx=dx/d,ny=dy/d,dot=b.vx*nx+b.vy*ny;
          if(dot<0){b.vx-=1.55*dot*nx;b.vy-=1.55*dot*ny;b.vx+=gRand(-18,18);}b.x=p.x+nx*(BR+PR);b.y=p.y+ny*(BR+PR);p.hit=0.2;}}
        if(b.y>H-60){for(let k=1;k<VALS.length;k++){const wx=k*binW;if(Math.abs(b.x-wx)<BR+2&&b.y>H-58){b.vx=(b.x<wx?-1:1)*Math.abs(b.vx||40);b.x=wx+(b.x<wx?-BR-2:BR+2);}}}
        if(b.y>H-BR-4){b.done=true;const bin=Math.max(0,Math.min(VALS.length-1,Math.floor(b.x/binW)));score+=VALS[bin];lastBin=bin;binFlash=0.8;sfx(VALS[bin]>=Math.max(...VALS)?'win':'coin');
          if(!won&&score>=g.target){won=true;report(score,true);}}});}
    pegs.forEach(p=>{if(p.hit>0)p.hit-=dt;});if(binFlash>0)binFlash-=dt;
    if(left<=0&&balls.every(b=>b.done)){end();return;}
    draw();});
  function draw(){gSky(ctx,W,H,'#12082b','#1d1147');
    ctx.fillStyle='rgba(255,255,255,.07)';ctx.fillRect(0,0,W,70);gText(ctx,'TAP ANYWHERE TO DROP ▼',W/2,40,16,'#9fc3ff');
    pegs.forEach(p=>{ctx.fillStyle=p.hit>0?'#fff':neon;ctx.shadowColor=neon;ctx.shadowBlur=p.hit>0?14:6;ctx.beginPath();ctx.arc(p.x,p.y,PR,0,Math.PI*2);ctx.fill();});ctx.shadowBlur=0;
    VALS.forEach((v,i)=>{const x=i*binW;ctx.fillStyle=i===lastBin&&binFlash>0?'#ffd166':(v>=Math.max(...VALS)?'#d7263d':'#1f6fe0');ctx.globalAlpha=.85;ctx.fillRect(x+3,H-56,binW-6,52);ctx.globalAlpha=1;
      gText(ctx,String(v),x+binW/2,H-28,v>=100?17:15,'#fff');ctx.fillStyle='#c9d6ff';if(i)ctx.fillRect(x-1,H-60,2,60);});
    balls.forEach(b=>{if(b.done)return;if(BALL)gEmoji(ctx,BALL,b.x,b.y,22);else{const gr=ctx.createRadialGradient(b.x-3,b.y-3,1,b.x,b.y,BR);gr.addColorStop(0,'#fff');gr.addColorStop(1,'#b8c4d6');ctx.fillStyle=gr;ctx.beginPath();ctx.arc(b.x,b.y,BR,0,Math.PI*2);ctx.fill();}});
    hud.innerHTML='Score <b>'+score+'</b> · balls left <b>'+left+'</b>'+(won?' · 🏆':' · goal '+g.target);
    if(!run)gOverlay(ctx,W,H,over?'All balls gone!':(g.title||'Pachinko'),over?('Score: '+score):'Tap to start',over?'Tap to play again':'10 balls — aim for the red pot');}
  function end(){run=false;over=true;loop.stop();report(score,won);draw();}
  c.addEventListener('pointerdown',e=>{const p=gPos(c,e);if(!run){balls=[];left=10;score=0;won=false;lastBin=-1;run=true;over=false;loop.start();return;}
    if(left>0){balls.push({x:Math.max(BR,Math.min(W-BR,p.x)),y:60,vx:gRand(-10,10),vy:0,done:false});left--;sfx('click');}});
  balls=[];left=10;score=0;draw();
  return {stop(){run=false;loop.stop();}};
}

/* ============================================================
   13 · CLAW — crane game, 8 goes
   ============================================================ */
function egClaw(stage,g,report){
  const W=380,H=480,hud=gHud(stage),c=gCanvas(stage,W,H),ctx=c.getContext('2d');
  const PRIZES=g.prizes||['🧸','🐱','🐼','🍙','🎮','🦊'],FLOOR=H-70,CHUTE=58;
  let prizes,cx,cdir,cy,state,held,tries,won_n,run=false,over=false,won=false,msg='',msgT=0,speed;
  const loop=gLoop(tick);
  function fill(){prizes=[];for(let i=0;i<9;i++)prizes.push({x:gRand(CHUTE+40,W-30),y:FLOOR-gRand(0,26),e:gPick(PRIZES),s:gRand(40,50)});}
  function reset(){fill();cx=W/2;cdir=1;cy=40;state='swing';held=null;tries=8;won_n=0;won=false;speed=120;}
  function tick(dt){if(msgT>0)msgT-=dt;
    if(state==='swing'){cx+=cdir*speed*dt;if(cx>W-26){cx=W-26;cdir=-1;}if(cx<CHUTE+20){cx=CHUTE+20;cdir=1;}}
    else if(state==='down'){cy+=260*dt;const target=prizes.reduce((b,p)=>Math.abs(p.x-cx)<Math.abs((b?b.x:9e9)-cx)?p:b,null);
      if(cy>=FLOOR-30){state='grab';setTimeout(()=>{const t=prizes.reduce((b,p)=>Math.abs(p.x-cx)<Math.abs((b?b.x:9e9)-cx)?p:b,null);
          const off=t?Math.abs(t.x-cx):99;const chance=off<8?0.92:off<16?0.7:off<26?0.35:0;
          if(t&&Math.random()<chance){held=t;prizes=prizes.filter(p=>p!==t);}state='up';},260);}}
    else if(state==='up'){cy-=220*dt;if(held){held.x=cx;held.y=cy+34;if(cy<120&&Math.random()<0.0035){prizes.push({...held,y:FLOOR-gRand(0,20)});held=null;say('😱 It slipped!');}}
      if(cy<=40){cy=40;state=held?'carry':'back';}}
    else if(state==='carry'){cx-=200*dt;held.x=cx;if(cx<=CHUTE/2+6){state='dropP';}}
    else if(state==='dropP'){held.y+=400*dt;if(held.y>FLOOR){won_n++;say('🎉 WON a '+held.e+'!');sfx('win');held=null;if(!won&&won_n>=g.target){won=true;report(won_n,true);}if(prizes.length<5)fill();state='back';}}
    else if(state==='back'){cx+=200*dt;if(cx>=W/2){cx=W/2;state='swing';speed=Math.min(240,speed+12);if(tries<=0)return end();}}
    draw();}
  function say(t){msg=t;msgT=1.4;}
  function draw(){gSky(ctx,W,H,'#1b0f3a','#3a1f6b');
    ctx.strokeStyle='#ff3d8b';ctx.lineWidth=6;ctx.shadowColor='#ff3d8b';ctx.shadowBlur=12;ctx.strokeRect(4,4,W-8,H-8);ctx.shadowBlur=0;
    ctx.fillStyle='rgba(180,220,255,.12)';ctx.fillRect(8,8,W-16,FLOOR+20);
    ctx.fillStyle='#0a1428';ctx.fillRect(8,FLOOR+22,CHUTE,H-FLOOR-30);ctx.fillStyle='#ffd166';gText(ctx,'WIN',8+CHUTE/2,FLOOR+44,14,'#ffd166');
    ctx.fillStyle='#0a1428';ctx.fillRect(8,FLOOR+20,W-16,6);
    prizes.forEach(p=>gEmoji(ctx,p.e,p.x,p.y,p.s));
    ctx.strokeStyle='#cfd8e3';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(8,30);ctx.lineTo(W-8,30);ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx,30);ctx.lineTo(cx,cy);ctx.stroke();
    const open=state==='down'||state==='swing'||state==='back'?1:0.35;
    ctx.lineWidth=5;ctx.strokeStyle='#e8eef6';ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx-18*open-6,cy+22);ctx.lineTo(cx-8,cy+34);ctx.moveTo(cx,cy);ctx.lineTo(cx+18*open+6,cy+22);ctx.lineTo(cx+8,cy+34);ctx.stroke();
    ctx.fillStyle='#ff3d8b';gRR(ctx,cx-14,cy-10,28,14,5);ctx.fill();
    if(held)gEmoji(ctx,held.e,held.x,held.y,held.s);
    if(state==='swing'&&run){ctx.setLineDash([4,6]);ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cx,cy+34);ctx.lineTo(cx,FLOOR);ctx.stroke();ctx.setLineDash([]);}
    if(msgT>0)gText(ctx,msg,W/2+20,H-26,20,'#ffd166');
    hud.innerHTML='Prizes <b>'+(won_n||0)+'</b> · goes left <b>'+(tries??8)+'</b>'+(won?' · 🏆':'');
    if(!run)gOverlay(ctx,W,H,over?'Game over!':(g.title||'Crane game'),over?('Prizes won: '+won_n):'Tap to start',over?'Tap to play again':'Tap DROP above a prize');}
  function drop(){if(!run||state!=='swing'||tries<=0)return;tries--;state='down';sfx('click');}
  function end(){run=false;over=true;loop.stop();report(won_n,won);draw();}
  c.addEventListener('pointerdown',()=>{if(!run){reset();run=true;over=false;loop.start();}else drop();});
  const pad=gPad(stage,[{label:'⬇ DROP',fn:()=>{if(!run){reset();run=true;over=false;loop.start();}else drop();},wide:true,keys:[' ','Enter','ArrowDown']}]);
  reset();tries=8;won_n=0;draw();
  return {stop(){run=false;loop.stop();pad.remove();}};
}

/* ============================================================
   14 · TOSS — drag-to-throw with wind
   ============================================================ */
function egToss(stage,g,report){
  const W=380,H=520,hud=gHud(stage),c=gCanvas(stage,W,H),ctx=c.getContext('2d');
  const BALL=g.ball||'🪙',TGT=g.tgt||'🎁',sky=g.sky||['#7fb8ff','#e6f2ff'],ground=g.ground||'#8bbf6a',moving=g.moving!==false;
  const HOME={x:W/2,y:H-70},POW=6.2;
  let ball,drag,tgt,wind,hits,misses,run=false,over=false,won=false,msg='',msgT=0,trail=[];
  const loop=gLoop(tick);
  function newTarget(){tgt={x:gRand(70,W-70),y:gRand(130,240),vx:moving?gRand(30,55+hits*6)*(Math.random()<.5?-1:1):0,r:34};wind=gRand(-1,1)*(18+hits*5);}
  function reset(){hits=0;misses=0;won=false;ball=null;newTarget();}
  function tick(dt){if(msgT>0)msgT-=dt;
    tgt.x+=tgt.vx*dt;if(tgt.x<50||tgt.x>W-50)tgt.vx*=-1;
    if(ball&&ball.fly){ball.vx+=wind*dt*3;ball.vy+=620*dt;ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;ball.s=Math.max(20,40-(HOME.y-ball.y)*0.05);
      trail.push({x:ball.x,y:ball.y});if(trail.length>14)trail.shift();
      if(ball.vy>0&&Math.hypot(ball.x-tgt.x,ball.y-tgt.y)<tgt.r+8){hits++;say(gPick(['Perfect!','Got it!','Nailed it!','Bullseye!']));sfx('coin');ball=null;trail=[];
        if(!won&&hits>=g.target){won=true;report(hits,true);sfx('win');}newTarget();}
      else if(ball.y>H+40||ball.x<-40||ball.x>W+40||(ball.vy>0&&ball.y>tgt.y+70)){misses++;say('Missed!');sfx('lose');ball=null;trail=[];if(misses>=3)return end();}}
    draw();}
  function say(t){msg=t;msgT=1;}
  function draw(){gSky(ctx,W,H,sky[0],sky[1]);ctx.fillStyle=ground;ctx.fillRect(0,H-110,W,110);
    gEmoji(ctx,TGT,tgt.x,tgt.y,tgt.r*2);ctx.strokeStyle='rgba(255,255,255,.7)';ctx.setLineDash([5,5]);ctx.beginPath();ctx.arc(tgt.x,tgt.y,tgt.r+8,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='rgba(10,20,40,.65)';gRR(ctx,W/2-70,10,140,30,10);ctx.fill();
    const wl=Math.min(50,Math.abs(wind));gText(ctx,'WIND',W/2-38,25,13,'#fff');ctx.strokeStyle='#ffd166';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(W/2+10,25);ctx.lineTo(W/2+10+Math.sign(wind)*wl,25);ctx.stroke();
    if(wl>2){ctx.fillStyle='#ffd166';ctx.beginPath();const tx=W/2+10+Math.sign(wind)*wl;ctx.moveTo(tx,25);ctx.lineTo(tx-Math.sign(wind)*8,19);ctx.lineTo(tx-Math.sign(wind)*8,31);ctx.fill();}
    trail.forEach((t,i)=>{ctx.fillStyle='rgba(255,255,255,'+(i/trail.length*0.5)+')';ctx.beginPath();ctx.arc(t.x,t.y,3,0,Math.PI*2);ctx.fill();});
    if(drag){const dx=HOME.x-drag.x,dy=HOME.y-drag.y;ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineWidth=3;ctx.setLineDash([6,6]);ctx.beginPath();
      let x=HOME.x,y=HOME.y,vx=dx*POW,vy=dy*POW;ctx.moveTo(x,y);for(let i=0;i<12;i++){vx+=wind*0.05*3;vy+=620*0.05;x+=vx*0.05;y+=vy*0.05;ctx.lineTo(x,y);}ctx.stroke();ctx.setLineDash([]);
      gEmoji(ctx,BALL,drag.x,drag.y,40);}
    else if(ball)gEmoji(ctx,BALL,ball.x,ball.y,ball.s);else gEmoji(ctx,BALL,HOME.x,HOME.y,40);
    if(!ball&&!drag&&run){ctx.strokeStyle='rgba(255,255,255,.5)';ctx.beginPath();ctx.arc(HOME.x,HOME.y,30,0,Math.PI*2);ctx.stroke();}
    if(msgT>0)gText(ctx,msg,W/2,H/2+40,26,'#fff');
    hud.innerHTML='Hits <b>'+(hits||0)+'</b> · misses '+'❌'.repeat(misses||0)+(won?' · 🏆':'');
    if(!run)gOverlay(ctx,W,H,over?'3 misses!':(g.title||'Throw!'),over?('Hits: '+hits):'Tap to start',over?'Tap to play again':'Drag back from '+BALL+' and let go');}
  function end(){run=false;over=true;loop.stop();report(hits,won);draw();}
  c.addEventListener('pointerdown',e=>{if(!run){reset();run=true;over=false;loop.start();return;}if(ball)return;const p=gPos(c,e);if(Math.hypot(p.x-HOME.x,p.y-HOME.y)<80)drag=p;});
  c.addEventListener('pointermove',e=>{if(drag){const p=gPos(c,e);const dx=p.x-HOME.x,dy=p.y-HOME.y,d=Math.hypot(dx,dy),m=120;drag=d>m?{x:HOME.x+dx/d*m,y:HOME.y+dy/d*m}:p;}});
  const rel=()=>{if(!drag)return;const dx=HOME.x-drag.x,dy=HOME.y-drag.y;drag=null;if(Math.hypot(dx,dy)<15)return;ball={x:HOME.x,y:HOME.y,vx:dx*POW,vy:dy*POW,fly:true,s:40};sfx('click');};
  c.addEventListener('pointerup',rel);c.addEventListener('pointercancel',()=>drag=null);
  c.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});
  reset();draw();
  return {stop(){run=false;loop.stop();}};
}

/* ============================================================
   15 · COOK — street-food griddle: flip at golden, serve at golden
   ============================================================ */
function egCook(stage,g,report){
  const W=380,H=460,hud=gHud(stage),c=gCanvas(stage,W,H),ctx=c.getContext('2d');
  const FOOD=g.food||'🥞',NAME=g.name||'pancake';
  const PANS=[{x:95,y:170},{x:285,y:170},{x:95,y:330},{x:285,y:330}];
  let pans,served,burnt,run=false,over=false,won=false,rate,msg='',msgT=0,queue;
  const loop=gLoop(tick);
  function reset(){pans=PANS.map(p=>({...p,st:'empty',t:0,side:0}));served=0;burnt=0;won=false;rate=0.19;queue=3;}
  /* t goes 0→1: 0.55–0.8 is GOLDEN, above 1 is burnt */
  function tick(dt){if(msgT>0)msgT-=dt;
    pans.forEach(p=>{if(p.st==='cook'){p.t+=rate*dt*(p.side?1.15:1);if(p.t>=1){p.st='burnt';p.t=0;burnt++;say('🔥 Burnt one!');sfx('lose');if(burnt>=3)end();}}
      else if(p.st==='burnt'){p.t+=dt;if(p.t>1.2){p.st='empty';p.t=0;}}});
    draw();}
  function say(t){msg=t;msgT=1;}
  function tapPan(p){if(p.st==='empty'){p.st='cook';p.t=0;p.side=0;sfx('click');return;}
    if(p.st!=='cook')return;
    const golden=p.t>=0.55&&p.t<=0.8;
    if(!golden){if(p.t<0.55){say('Not ready yet!');}return;}
    if(p.side===0){p.side=1;p.t=0.1;sfx('click');say(gPick(['Flip!','Nice flip!']));}
    else{p.st='empty';p.t=0;served++;rate=Math.min(0.42,rate+0.012);sfx('coin');say('Served! 😋');if(!won&&served>=g.target){won=true;report(served,true);sfx('win');}}}
  function draw(){gSky(ctx,W,H,'#3b2412','#1e1208');
    ctx.fillStyle='#fff3dd';gRR(ctx,14,12,W-28,62,12);ctx.fill();gText(ctx,(g.stall||'Street stall')+' · '+NAME,W/2,32,16,'#7a3b10');
    gText(ctx,'Served '+served+'   ·   Burnt '+'🔥'.repeat(burnt),W/2,56,15,'#3b2412');
    pans.forEach(p=>{ctx.fillStyle='#2b2b2b';ctx.beginPath();ctx.arc(p.x,p.y,62,0,Math.PI*2);ctx.fill();ctx.fillStyle='#3d3d3d';ctx.beginPath();ctx.arc(p.x,p.y,54,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#2b2b2b';ctx.fillRect(p.x+50,p.y-7,40,14);
      if(p.st==='cook'||p.st==='burnt'){const t=p.st==='burnt'?1.2:p.t;const col=t<0.55?mix('#f6e7b8','#e9b35a',t/0.55):t<=0.8?'#d8902a':mix('#b96a1a','#2a1a10',Math.min(1,(t-0.8)/0.25));
        ctx.fillStyle=col;ctx.beginPath();ctx.ellipse(p.x,p.y,40,36,0,0,Math.PI*2);ctx.fill();if(p.side)gText(ctx,'side 2',p.x,p.y+20,11,'rgba(0,0,0,.45)');
        gEmoji(ctx,FOOD,p.x,p.y-4,30);
        if(p.st==='cook'){ctx.lineWidth=7;ctx.strokeStyle='rgba(255,255,255,.15)';ctx.beginPath();ctx.arc(p.x,p.y,70,-Math.PI/2,Math.PI*1.5);ctx.stroke();
          ctx.strokeStyle='#ffd166';ctx.beginPath();ctx.arc(p.x,p.y,70,-Math.PI/2+0.55*Math.PI*2,-Math.PI/2+0.8*Math.PI*2);ctx.stroke();
          ctx.strokeStyle=p.t>0.8?'#d7263d':'#12b38a';ctx.lineWidth=4;ctx.beginPath();ctx.arc(p.x,p.y,70,-Math.PI/2,-Math.PI/2+Math.min(1,p.t)*Math.PI*2);ctx.stroke();}
        if(p.st==='burnt'){ctx.globalAlpha=.8;gEmoji(ctx,'💨',p.x+20,p.y-30,26);ctx.globalAlpha=1;}}
      else gText(ctx,'tap to cook',p.x,p.y,14,'rgba(255,255,255,.45)');});
    if(msgT>0)gText(ctx,msg,W/2,H-24,20,'#ffd166');
    hud.innerHTML='Served <b>'+(served||0)+'</b>'+(won?' · 🏆':' · goal '+g.target)+' · <span style="color:#b8860b">gold arc = flip/serve now</span>';
    if(!run)gOverlay(ctx,W,H,over?'3 burnt — stall closed!':(g.title||'Street food'),over?('Served: '+served):'Tap to start',over?'Tap to cook again':'Flip and serve in the gold zone');}
  function mix(a,b,t){const pa=parseInt(a.slice(1),16),pb=parseInt(b.slice(1),16);const r=Math.round(((pa>>16)&255)*(1-t)+((pb>>16)&255)*t),gg=Math.round(((pa>>8)&255)*(1-t)+((pb>>8)&255)*t),bb=Math.round((pa&255)*(1-t)+(pb&255)*t);return 'rgb('+r+','+gg+','+bb+')';}
  function end(){if(!run)return;run=false;over=true;loop.stop();report(served,won);draw();}
  c.addEventListener('pointerdown',e=>{if(!run){reset();run=true;over=false;loop.start();return;}const q=gPos(c,e);for(const p of pans)if(Math.hypot(q.x-p.x,q.y-p.y)<72){tapPan(p);break;}});
  reset();draw();
  return {stop(){run=false;loop.stop();}};
}

/* ============================================================
   16 · BALANCE — lean against the wobble and keep walking
   ============================================================ */
function egBalance(stage,g,report){
  const W=380,H=460,hud=gHud(stage),c=gCanvas(stage,W,H),ctx=c.getContext('2d');
  const WHO=g.p||'🧍',CARRY=g.carry||'🍵',sky=g.sky||['#20124d','#e2725b'],path=g.path||'#a0785a';
  let ang,av,dist,push,run=false,over=false,won=false,gust=0,t=0,scroll=0;
  const loop=gLoop(dt=>{t+=dt;
    /* tuned by simulation: ~0.3s reactions reach the goal, doing nothing always falls, and it keeps getting harder */
    const lvl=1+dist/100;gust+=(gRand(-1,1)*1.0*lvl-gust*0.9)*dt*3;
    av+=(Math.sin(ang)*1.4*lvl+gust+push*4.6)*dt*1.6;av*=0.97;ang+=av*dt;
    dist+=dt*(3.2+lvl*0.4);scroll+=dt*60;
    if(!won&&dist>=g.target){won=true;report(Math.floor(dist),true);sfx('win');}
    if(Math.abs(ang)>1.05)return end();draw();});
  function draw(){gSky(ctx,W,H,sky[0],sky[1]);
    ctx.fillStyle='rgba(0,0,0,.25)';for(let i=0;i<6;i++){const x=((i*90-scroll*0.3)%(W+90)+W+90)%(W+90)-45;ctx.fillRect(x,H-190-(i%3)*30,40,190);}
    ctx.fillStyle=path;ctx.beginPath();ctx.moveTo(W/2-40,H-120);ctx.lineTo(W/2+40,H-120);ctx.lineTo(W/2+150,H);ctx.lineTo(W/2-150,H);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.25)';ctx.lineWidth=3;for(let i=0;i<8;i++){const k=((i*0.13+scroll*0.004)%1);const y=H-120+120*k*k;const hw=40+110*k*k;ctx.beginPath();ctx.moveTo(W/2-hw,y);ctx.lineTo(W/2+hw,y);ctx.stroke();}
    ctx.save();ctx.translate(W/2,H-110);ctx.rotate(ang);
    ctx.strokeStyle='#5a3316';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(-80,-130);ctx.lineTo(80,-130);ctx.stroke();
    gEmoji(ctx,CARRY,-80,-150,30);gEmoji(ctx,CARRY,80,-150,30);gEmoji(ctx,WHO,0,-70,110);ctx.restore();
    const m=Math.min(1,Math.abs(ang)/1.05);ctx.fillStyle='rgba(10,20,40,.6)';gRR(ctx,W/2-90,14,180,14,7);ctx.fill();
    ctx.fillStyle=m>0.7?'#d7263d':m>0.4?'#f0a830':'#12b38a';ctx.fillRect(W/2+(ang<0?-90*m:0),16,90*m,10);ctx.fillStyle='#fff';ctx.fillRect(W/2-1,12,2,18);
    gText(ctx,Math.floor(dist)+'m',W-14,50,22,'#fff','right');
    hud.innerHTML='Distance <b>'+Math.floor(dist||0)+'m</b>'+(won?' · 🏆':' · goal '+g.target+'m');
    if(!run)gOverlay(ctx,W,H,over?'Wobble… fell!':(g.title||'Balance'),over?('Distance: '+Math.floor(dist)+'m'):'Tap to start',over?'Tap to try again':'Lean LEFT / RIGHT against the wobble');}
  function reset(){ang=gRand(-0.05,0.05);av=0;dist=0;push=0;won=false;gust=0;}
  function end(){run=false;over=true;loop.stop();report(Math.floor(dist),won);sfx('lose');draw();}
  c.addEventListener('pointerdown',e=>{if(!run){reset();run=true;over=false;loop.start();return;}push=gPos(c,e).x<W/2?-1:1;});
  const up=()=>push=0;c.addEventListener('pointerup',up);c.addEventListener('pointercancel',up);c.addEventListener('pointerleave',up);
  const pad=gPad(stage,[{label:'◀ Lean left',fn:()=>push=-1,up,wide:true,keys:['ArrowLeft']},{label:'Lean right ▶',fn:()=>push=1,up,wide:true,keys:['ArrowRight']}]);
  reset();draw();
  return {stop(){run=false;loop.stop();pad.remove();}};
}

/* ============================================================
   17 · ARCHERY — kyudo: draw, allow for wind, loose
   ============================================================ */
function egArchery(stage,g,report){
  const W=380,H=500,hud=gHud(stage),c=gCanvas(stage,W,H),ctx=c.getContext('2d');
  const TGT=g.tgt||null,sky=g.sky||['#cfe4ff','#f7fbff'];
  let tx,tdir,arrows,round,best,wind,power,drawing,arrow,marks,run=false,over=false,won=false,msg='',msgT=0,wob=0;
  const TY=150,R=62;
  const loop=gLoop(dt=>{wob+=dt;if(msgT>0)msgT-=dt;
    tx+=tdir*(28+(5-arrows)*6)*dt;if(tx<R+10||tx>W-R-10)tdir*=-1;
    if(drawing)power=Math.min(1,power+dt*0.9);
    if(arrow){arrow.t+=dt*2.5;if(arrow.t>=1){const hx=arrow.x+wind*1.25,hy=TY+arrow.dy;const d=Math.hypot(hx-tx,hy-TY);
        const pts=d<R?Math.max(1,10-Math.floor(d/(R/10))):0;marks.push({dx:hx-tx,dy:hy-TY,pts});round+=pts;sfx(pts>=8?'coin':pts?'click':'lose');say(pts?(pts===10?'🎯 BULLSEYE!':pts+' points'):'Missed the mato!');
        arrow=null;arrows--;wind=gRand(-1,1)*22;
        if(arrows<=0){best=Math.max(best,round);if(!won&&round>=g.target){won=true;report(round,true);sfx('win');}else report(round,won);end();}}}
    draw();});
  function say(t){msg=t;msgT=1.1;}
  function draw(){gSky(ctx,W,H,sky[0],sky[1]);ctx.fillStyle='#3d6b3a';ctx.fillRect(0,TY+R+10,W,H);
    ctx.fillStyle='#e8dcc0';ctx.fillRect(0,TY-R-24,W,2*R+48);ctx.fillStyle='#2f2a24';ctx.fillRect(0,TY-R-28,W,6);
    ctx.save();ctx.translate(tx,TY);[['#fff',1],['#111',0.86],['#fff',0.7],['#111',0.52],['#fff',0.36],['#111',0.2]].forEach(([c2,k])=>{ctx.fillStyle=c2;ctx.beginPath();ctx.arc(0,0,R*k,0,Math.PI*2);ctx.fill();});
    if(TGT)gEmoji(ctx,TGT,0,0,R*0.34);marks.forEach(m=>{ctx.fillStyle='#d7263d';ctx.beginPath();ctx.arc(m.dx,m.dy,4,0,Math.PI*2);ctx.fill();});ctx.restore();
    const sway=Math.sin(wob*2.3)*14*(drawing?1-power*0.6:1),aimX=W/2+sway,aimY=TY+Math.cos(wob*1.7)*10;
    if(run&&!arrow){ctx.strokeStyle='rgba(215,38,61,.9)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(aimX,aimY,12,0,Math.PI*2);ctx.moveTo(aimX-18,aimY);ctx.lineTo(aimX+18,aimY);ctx.moveTo(aimX,aimY-18);ctx.lineTo(aimX,aimY+18);ctx.stroke();}
    if(arrow){const y=H-60-(H-60-TY)*arrow.t,x=arrow.x+wind*1.25*arrow.t;ctx.strokeStyle='#3b2a1a';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+30);ctx.stroke();}
    ctx.strokeStyle='#7a4b21';ctx.lineWidth=5;ctx.beginPath();ctx.arc(W/2,H-20,120,Math.PI*1.12,Math.PI*1.88);ctx.stroke();
    ctx.fillStyle='rgba(10,20,40,.6)';gRR(ctx,12,H-40,120,16,8);ctx.fill();ctx.fillStyle=power>0.75?'#12b38a':'#f0a830';ctx.fillRect(14,H-38,116*(power||0),12);gText(ctx,'DRAW',72,H-52,12,'#0a1428');
    ctx.fillStyle='rgba(10,20,40,.65)';gRR(ctx,W-150,H-46,138,30,10);ctx.fill();gText(ctx,'WIND '+(wind>0?'→':'←')+' '+Math.abs(Math.round(wind)),W-81,H-31,14,'#ffd166');
    gText(ctx,'Arrows '+'➶'.repeat(Math.max(0,arrows||0)),12,20,16,'#0a1428','left');gText(ctx,'Round '+(round||0),W-12,20,16,'#0a1428','right');
    if(msgT>0)gText(ctx,msg,W/2,TY+R+50,24,'#fff');
    hud.innerHTML='This round <b>'+(round||0)+'</b> · best <b>'+(best||0)+'</b>'+(won?' · 🏆':' · goal '+g.target);
    if(!run)gOverlay(ctx,W,H,over?'Round over!':(g.title||'Kyudo'),over?('Score: '+round+' / 50'):'Tap to start',over?'Tap for another round':'Hold to draw · let go to shoot');}
  function reset(){tx=W/2;tdir=1;arrows=5;round=0;wind=gRand(-1,1)*18;power=0;drawing=false;arrow=null;marks=[];}
  function end(){run=false;over=true;loop.stop();draw();}
  c.addEventListener('pointerdown',()=>{if(!run){reset();run=true;over=false;loop.start();return;}if(!arrow){drawing=true;power=0;}});
  const loose=()=>{if(!drawing||!run)return;drawing=false;const sway=Math.sin(wob*2.3)*14*(1-power*0.6);
    const weak=(1-power)*70;arrow={t:0,x:W/2+sway,dy:Math.cos(wob*1.7)*10+weak};power=0;sfx('click');};
  c.addEventListener('pointerup',loose);c.addEventListener('pointercancel',loose);
  best=0;reset();draw();
  return {stop(){run=false;loop.stop();}};
}

/* ============================================================
   18 · WORDS — word search
   ============================================================ */
function egWords(stage,g,report){
  const hud=gHud(stage),box=document.createElement('div');box.className='pz-wrap';stage.appendChild(box);
  const LIST=(g.words||['TOKYO','SEOUL','KYOTO','SUSHI','TORII','RAMEN','KIMBAP','TEMPLE']).map(w=>w.toUpperCase().replace(/[^A-Z]/g,''));
  let N,grid,words,found,cells,sel,solved=0,won=false,dir=null,start=null;
  function gen(){N=Math.max(8,Math.max(...LIST.map(w=>w.length))+1);N=Math.min(N,11);
    for(let t=0;t<60;t++){grid=Array.from({length:N},()=>Array(N).fill(''));words=[];
      const pool=gShuffle(LIST.filter(w=>w.length<=N)).slice(0,Math.min(7,LIST.length));
      const dirs=[[1,0],[0,1],[1,1],[1,-1]];let ok=true;
      for(const w of pool){let placed=false;for(let k=0;k<200&&!placed;k++){const [dx,dy]=gPick(dirs),x=gInt(0,N-1),y=gInt(0,N-1);
          const ex=x+dx*(w.length-1),ey=y+dy*(w.length-1);if(ex<0||ex>=N||ey<0||ey>=N)continue;
          let fits=true;for(let i=0;i<w.length;i++){const ch=grid[y+dy*i][x+dx*i];if(ch&&ch!==w[i]){fits=false;break;}}
          if(!fits)continue;const cs=[];for(let i=0;i<w.length;i++){grid[y+dy*i][x+dx*i]=w[i];cs.push((y+dy*i)*N+x+dx*i);}words.push({w,cs,got:false});placed=true;}
        if(!placed){ok=false;break;}}
      if(ok)break;}
    const AB='ABCDEFGHIJKLMNOPRSTUWY';for(let y=0;y<N;y++)for(let x=0;x<N;x++)if(!grid[y][x])grid[y][x]=AB[gInt(0,AB.length-1)];
    found=0;render();}
  function render(){box.innerHTML='<div class="ws-list">'+words.map(w=>'<span class="'+(w.got?'got':'')+'">'+w.w+'</span>').join('')+'</div>';
    const bd=document.createElement('div');bd.className='pz-board ws';bd.style.gridTemplateColumns='repeat('+N+',1fr)';
    for(let i=0;i<N*N;i++){const d=document.createElement('div');d.className='ws-cell'+(words.some(w=>w.got&&w.cs.includes(i))?' got':'');d.dataset.i=i;d.textContent=grid[Math.floor(i/N)][i%N];bd.appendChild(d);}
    box.appendChild(bd);cells=bd;wire(bd);
    hud.innerHTML='Words <b>'+found+'/'+words.length+'</b> · puzzles <b>'+solved+'</b>'+(won?' · 🏆':'');}
  function line(a,b){const ax=a%N,ay=Math.floor(a/N),bx=b%N,by=Math.floor(b/N),dx=Math.sign(bx-ax),dy=Math.sign(by-ay);
    if(!(ax===bx||ay===by||Math.abs(bx-ax)===Math.abs(by-ay)))return null;const n=Math.max(Math.abs(bx-ax),Math.abs(by-ay));const r=[];for(let i=0;i<=n;i++)r.push((ay+dy*i)*N+ax+dx*i);return r;}
  function wire(bd){let down=false;
    const at=e=>{const el=document.elementFromPoint(e.clientX,e.clientY);const d=el&&el.closest&&el.closest('.ws-cell');return d&&bd.contains(d)?+d.dataset.i:null;};
    const show=()=>bd.querySelectorAll('.ws-cell').forEach(d=>d.classList.toggle('sel',!!sel&&sel.includes(+d.dataset.i)));
    bd.addEventListener('pointerdown',e=>{const i=at(e);if(i==null)return;down=true;start=i;sel=[i];show();});
    bd.addEventListener('pointermove',e=>{if(!down)return;const i=at(e);if(i==null)return;const l=line(start,i);if(l){sel=l;show();}});
    const up=()=>{if(!down)return;down=false;if(!sel)return;
      const txt=sel.map(i=>grid[Math.floor(i/N)][i%N]).join('');
      const w=words.find(w=>!w.got&&(w.w===txt||w.w===txt.split('').reverse().join('')));
      if(w){w.got=true;found++;sfx('coin');if(found===words.length){solved++;sfx('win');burst(box);if(!won&&solved>=g.target){won=true;report(solved,true);}else report(solved,won);setTimeout(gen,1100);}}
      sel=null;render();};
    bd.addEventListener('pointerup',up);bd.addEventListener('pointercancel',up);
    bd.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});}
  gen();
  return {stop(){}};
}

/* ============================================================
   19 · SLIDE — sliding picture puzzle
   ============================================================ */
function egSlide(stage,g,report){
  const hud=gHud(stage),box=document.createElement('div');box.className='pz-wrap';stage.appendChild(box);
  const ART=g.art||['🏯','🌸'],BG=g.bg||['#ffb3c7','#6a8dff'],LBL=g.label||g.title||'';
  let N,tiles,moves,solved=0,won=false,img;
  function picture(){const S=360,cv=document.createElement('canvas');cv.width=S;cv.height=S;const x=cv.getContext('2d');
    const gr=x.createLinearGradient(0,0,0,S);gr.addColorStop(0,BG[0]);gr.addColorStop(1,BG[1]);x.fillStyle=gr;x.fillRect(0,0,S,S);
    x.fillStyle='rgba(255,255,255,.35)';x.beginPath();x.arc(S*0.78,S*0.22,40,0,Math.PI*2);x.fill();
    x.fillStyle='rgba(0,0,0,.18)';x.beginPath();x.moveTo(0,S*0.8);for(let i=0;i<=8;i++)x.lineTo(i*S/8,S*0.8-(i%2?30:10));x.lineTo(S,S);x.lineTo(0,S);x.fill();
    gEmoji(x,ART[0],S/2,S*0.5,S*0.46);if(ART[1]){gEmoji(x,ART[1],S*0.18,S*0.2,S*0.16);gEmoji(x,ART[1],S*0.84,S*0.72,S*0.14);}
    if(LBL){x.fillStyle='rgba(10,20,40,.7)';x.fillRect(0,S-40,S,40);gText(x,LBL,S/2,S-20,20,'#fff');}
    for(let i=1;i<6;i++){x.strokeStyle='rgba(255,255,255,.12)';x.beginPath();x.moveTo(i*S/6,0);x.lineTo(i*S/6,S);x.stroke();}
    return cv.toDataURL('image/png');}
  function gen(){N=solved>=2?4:3;tiles=[...Array(N*N).keys()];let e=N*N-1;
    for(let k=0;k<(N===3?80:220);k++){const x=e%N,y=Math.floor(e/N);const o=[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy])=>x+dx>=0&&x+dx<N&&y+dy>=0&&y+dy<N);
      const [dx,dy]=gPick(o),j=(y+dy)*N+x+dx;[tiles[e],tiles[j]]=[tiles[j],tiles[e]];e=j;}
    if(tiles.every((t,i)=>t===i))return gen();moves=0;render();}
  function render(){box.innerHTML='';const bd=document.createElement('div');bd.className='pz-board sl';bd.style.gridTemplateColumns='repeat('+N+',1fr)';
    tiles.forEach((t,i)=>{const d=document.createElement('button');d.type='button';d.className='sl-cell'+(t===N*N-1?' gap':'');d.dataset.i=i;
      if(t!==N*N-1){const x=t%N,y=Math.floor(t/N);d.style.backgroundImage='url('+img+')';d.style.backgroundSize=(N*100)+'% '+(N*100)+'%';d.style.backgroundPosition=(x*100/(N-1))+'% '+(y*100/(N-1))+'%';}
      bd.appendChild(d);});
    box.appendChild(bd);
    const peek=document.createElement('div');peek.className='sl-peek';peek.innerHTML='<img alt="finished picture"><span>Finished picture</span>';peek.querySelector('img').src=img;box.appendChild(peek);
    hud.innerHTML='Moves <b>'+moves+'</b> · solved <b>'+solved+'</b>'+(won?' · 🏆':'');
    bd.addEventListener('click',e=>{const d=e.target.closest('.sl-cell');if(!d)return;const i=+d.dataset.i,gi=tiles.indexOf(N*N-1);
      const x=i%N,y=Math.floor(i/N),gx=gi%N,gy=Math.floor(gi/N);if(Math.abs(x-gx)+Math.abs(y-gy)!==1)return;
      [tiles[i],tiles[gi]]=[tiles[gi],tiles[i]];moves++;sfx('click');
      if(tiles.every((t,k)=>t===k)){solved++;render();sfx('win');burst(box);if(!won&&solved>=g.target){won=true;report(solved,true);}else report(solved,won);hud.innerHTML='🖼️ Picture complete! Solved <b>'+solved+'</b>'+(won?' · 🏆':'');setTimeout(gen,1200);return;}
      render();});}
  img=picture();gen();
  return {stop(){}};
}

/* ---------- registry ---------- */
const GAME_ENGINES={pack:egPack,merge:egMerge,swap:egSwap,climb:egClimb,cross:egCross,belt:egBelt,diff:egDiff,path:egPath,pipes:egPipes,lights:egLights,maze:egMaze,plinko:egPlinko,claw:egClaw,toss:egToss,cook:egCook,balance:egBalance,archery:egArchery,words:egWords,slide:egSlide};
