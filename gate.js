/* ross.asia gate.
   The game itself is ENCRYPTED in vault.bin (AES-256-GCM) — this file and index.html hold nothing personal.
   Each family member's password unlocks their own copy of the key (PBKDF2-SHA256, 600,000 rounds), so the
   right password opens the game even with no signal. After one password sign-in a phone can use Face ID:
   - PRF passkeys (iOS 18+, recent Android): the key is sealed with a secret only Face ID can release.
   - older phones: the key is sealed with a locked-in-the-browser key that only opens after a Face ID check.
   Log out forgets both. Built by tools/build.mjs, which fills in BUILD and SLOTS.
   (The pre-trip countdown lock was removed on 16 Oct 2026: the site goes straight to sign-in.) */
(function(){
'use strict';
var BUILD='2026-10-16-1925';
var SLOTS={"v":1,"users":{"jacob":{"iter":600000,"salt":"j3C/uNg6ulYdxEQw2SvvwQ==","iv":"yAOb/ajVgh/IkO8U","ct":"MR0ExlgPZ16bZWABiYBUSr/TfwnW1KfQsavurOYEW7+OBIcHiUZjOxhmSkvjfDeok5mjk3O0l0qywumxh+UufXm4+S9M2r0w6fgjyjfjPpduleo7IsslgSUycL80QLGnXZO/"},"lily":{"iter":600000,"salt":"bkcV8X4ASH/u7DJ1GBUWDQ==","iv":"Ha7xGHyWnn+D+My+","ct":"QDpjCBlmx0hcm+e+YjgLVpJ4pHalrmiUowYEfxUkAYR+xpRBtwOH8DAhTi2gVytO+zH5wiN48o+kcW6W83A9M+mYQgdRCDJ8xhJa6ARvqORQKVBWcwVVzQ0F7Yr1NeXV1eI="},"hannah":{"iter":600000,"salt":"LWZ9TX34Au00InTcugvxXA==","iv":"eCbEVGsD9wab3sxz","ct":"CuyfJlfsRgTtFU+g9Zp3Biar/CUq4on25o5WcITcXjsZPl2KUpQd7FS3CTTOwq6J8k3N4x/Dk+ZVcO3LOB1R0AGvwP6rgCRazLv2FJmX2lLUhL+lGB/QH3k66VolQ3IuFxSwIg=="},"mark":{"iter":600000,"salt":"LEsdcN8fifrXzqZeGAsAKg==","iv":"78fGp/01Qw6Pfu/6","ct":"QPwWYH47AVPYuzcnmE/bSCyO1aWhZZ+5XWwwaeRs6Isb5rP6GDHL2MIZPZnLNSHhgEp8JV7cRfH6OemQ0EanzsF/WlL0G57JIFDtgd61tmxxn5c5El8LeNc/C1Zg6IxAjY0="},"ethan":{"iter":600000,"salt":"7LZyAnhCSBc2SPvqaJ+NdA==","iv":"LCmd5aZCPtzOM2np","ct":"E64PUj98SlLij9HdfOrCSl+re/O+3IkyYph12LPuDGxTO0JbUL2NLkFyf4Ow4LoWBYLpm8CVwWfr5gc9aA4ANvy9j/Ib2sHAjMaQsXO4cWBVNz+KHs/oql65+vYTnWlc2oILi6KWltaebelLPpcDSEWipnBV3nRmd7mhx9Vu"}}};
window.__BUILD__=BUILD;
var FACE='rossasia-face-v1',SESSION='asia26-session-v1',KEYFIX='rossasia-adminkey-v1',STAY='rossasia-stay-v1'; /* STAY: stay signed in on this phone until Log out */
var te=new TextEncoder(),td=new TextDecoder();
var subtle=window.crypto&&crypto.subtle;
function $(id){return document.getElementById(id);}
function b64(buf){var u=new Uint8Array(buf),s='';for(var i=0;i<u.length;i++)s+=String.fromCharCode(u[i]);return btoa(s);}
function unb64(s){var b=atob(s),u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u;}
function rand(n){return crypto.getRandomValues(new Uint8Array(n));}
function read(k){try{return localStorage.getItem(k);}catch(_){return null;}}
function store(k,v){try{if(v==null)localStorage.removeItem(k);else localStorage.setItem(k,v);}catch(_){/**/}}

/* ?fresh=1 wipes every cache and the worker, then reloads clean (escape hatch for a stuck phone) */
if(/[?&]fresh=1(&|$)/.test(location.search)){
  var jobs=[];
  try{if(window.caches)jobs.push(caches.keys().then(function(ks){return Promise.all(ks.map(function(k){return caches.delete(k);}));}));}catch(_){/**/}
  try{if(navigator.serviceWorker)jobs.push(navigator.serviceWorker.getRegistrations().then(function(rs){return Promise.all(rs.map(function(r){return r.unregister();}));}));}catch(_){/**/}
  Promise.all(jobs).catch(function(){}).then(function(){location.replace(location.pathname);});
  return;
}

/* an old sign-in may still hold the admin password in plain text — drop it */
try{var old=JSON.parse(read(SESSION)||'null');if(old&&old.adminKey){delete old.adminKey;store(SESSION,JSON.stringify(old));}}catch(_){/**/}

/* ---- neon skyline behind the sign-in (app.js leaves a built one alone) ---- */
function seedFrom(str){var h=2166136261;for(var i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
function buildCity(){
  document.querySelectorAll('.city').forEach(function(city){
    if(city.dataset.built)return;city.dataset.built='1';
    var rnd=mulberry(seedFrom('asia26-city')),x=-3;
    while(x<103){
      var w=4+Math.floor(rnd()*8),h=18+Math.floor(rnd()*58),b=document.createElement('b');
      b.style.left=x+'%';b.style.width=w+'%';b.style.height=h+'%';
      if(rnd()<0.28)b.style.borderRadius='3px 3px 0 0';
      city.appendChild(b);x+=w+(rnd()<0.5?0.6:1.8);
    }
    for(var i=0;i<10;i++){var g=document.createElement('i');g.style.left=(4+rnd()*92)+'%';g.style.height=(18+rnd()*52)+'%';city.appendChild(g);}
  });
}
buildCity();

/* ---- passwords ---- */
function slotName(n){n=String(n||'').trim().toLowerCase();return n==='admin'?'ethan':n;}
function passKey(pw,slot){
  return subtle.importKey('raw',te.encode(pw),'PBKDF2',false,['deriveKey']).then(function(base){
    return subtle.deriveKey({name:'PBKDF2',salt:unb64(slot.salt),iterations:slot.iter,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['decrypt']);
  });
}
function unlockWithPassword(name,pw){
  var slot=SLOTS.users[slotName(name)];
  if(!slot||!pw)return Promise.reject(new Error('bad'));
  return passKey(pw,slot)
    .then(function(k){return subtle.decrypt({name:'AES-GCM',iv:unb64(slot.iv)},k,unb64(slot.ct));})
    .then(function(pt){return JSON.parse(td.decode(pt));},function(){throw new Error('bad');});
}

/* ---- Face ID (WebAuthn passkey on this phone) ---- */
function faceRecord(){try{var r=JSON.parse(read(FACE)||'null');return r&&r.cred&&r.ct?r:null;}catch(_){return null;}}
function faceAvailable(){
  try{
    if(!window.isSecureContext||!window.PublicKeyCredential||!PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable)return Promise.resolve(false);
    return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(function(){return false;});
  }catch(_){return Promise.resolve(false);}
}
function idb(mode,fn){
  return new Promise(function(res,rej){
    var r=indexedDB.open('rossasia',1);
    r.onupgradeneeded=function(){r.result.createObjectStore('keys');};
    r.onerror=function(){rej(r.error);};
    r.onsuccess=function(){
      var db=r.result,tx=db.transaction('keys',mode),q=fn(tx.objectStore('keys'));
      tx.oncomplete=function(){db.close();res(q&&q.result);};
      tx.onerror=tx.onabort=function(){db.close();rej(tx.error);};
    };
  });
}
function idbGet(k){return idb('readonly',function(s){return s.get(k);});}
function idbPut(k,v){return idb('readwrite',function(s){return s.put(v,k);});}
function idbDel(k){return idb('readwrite',function(s){return s.delete(k);}).catch(function(){});}
function prfKey(out){
  return subtle.importKey('raw',out,'HKDF',false,['deriveKey']).then(function(base){
    return subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:te.encode('rossasia-face'),info:te.encode('v1')},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  });
}
function prfOut(cred){var x=cred&&cred.getClientExtensionResults?cred.getClientExtensionResults():{};return x&&x.prf&&x.prf.results&&x.prf.results.first||null;}
function assertFace(credId,salt){
  var pk={challenge:rand(32),rpId:location.hostname,allowCredentials:[{type:'public-key',id:credId}],userVerification:'required',timeout:60000};
  if(salt)pk.extensions={prf:{eval:{first:salt}}};
  return navigator.credentials.get({publicKey:pk});
}
function enrollFace(p){
  var salt=rand(32),rec={v:1,name:p.name};
  return navigator.credentials.create({publicKey:{
    rp:{name:'Asia 2026',id:location.hostname},
    user:{id:te.encode('rossasia:'+p.name.toLowerCase()),name:p.name+' · Asia 2026',displayName:p.name},
    challenge:rand(32),
    pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],
    authenticatorSelection:{authenticatorAttachment:'platform',residentKey:'preferred',requireResidentKey:false,userVerification:'required'},
    timeout:60000,attestation:'none',extensions:{prf:{eval:{first:salt}}}
  }}).then(function(cred){
    rec.cred=b64(cred.rawId);
    var out=prfOut(cred),x=cred.getClientExtensionResults?cred.getClientExtensionResults():{};
    /* some phones only switch PRF on at sign-up and hand the secret over on the first real Face ID */
    if(!out&&x&&x.prf&&x.prf.enabled)return assertFace(cred.rawId,salt).then(prfOut,function(){return null;});
    return out;
  }).then(function(out){
    if(out){rec.mode='prf';rec.salt=b64(salt);return prfKey(out);}
    rec.mode='device';
    return subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']).then(function(k){return idbPut('face-key',k).then(function(){return k;});});
  }).then(function(k){
    var iv=rand(12);rec.iv=b64(iv);
    return subtle.encrypt({name:'AES-GCM',iv:iv},k,te.encode(JSON.stringify(p)));
  }).then(function(ct){rec.ct=b64(ct);store(FACE,JSON.stringify(rec));return rec;});
}
function unlockWithFace(){
  var rec=faceRecord();if(!rec)return Promise.reject(new Error('noface'));
  return assertFace(unb64(rec.cred),rec.mode==='prf'?unb64(rec.salt):null).then(function(a){
    if(rec.mode==='prf'){var out=prfOut(a);if(!out)throw new Error('noprf');return prfKey(out);}
    var flags=new Uint8Array(a.response.authenticatorData)[32];
    if(!(flags&4))throw new Error('nouv'); /* Face ID / passcode must actually have been checked */
    return idbGet('face-key').then(function(k){if(!k)throw new Error('nokey');return k;});
  }).then(function(k){return subtle.decrypt({name:'AES-GCM',iv:unb64(rec.iv)},k,unb64(rec.ct));})
    .then(function(pt){return JSON.parse(td.decode(pt));});
}
function forgetFace(){store(FACE,null);return idbDel('face-key');}

/* ---- open the encrypted game ---- */
var opened=false;
function openApp(p){
  if(opened)return Promise.resolve();
  var key;
  return subtle.importKey('raw',unb64(p.k),{name:'AES-GCM'},false,['encrypt','decrypt']).then(function(k){
    key=k;
    return fetch('vault.bin?v='+BUILD).then(function(r){if(!r.ok)throw new Error('vault '+r.status);return r.arrayBuffer();});
  }).then(function(buf){
    var u=new Uint8Array(buf);
    if(td.decode(u.subarray(0,4))!=='RAV1')throw new Error('vault format');
    return subtle.decrypt({name:'AES-GCM',iv:u.slice(4,16)},key,u.slice(16));
  }).then(function(pt){
    var vault=JSON.parse(td.decode(pt));
    var fix=read(KEYFIX),adminKey=Promise.resolve(p.adminKey||'');
    if(fix&&p.role==='admin'){
      try{var f=JSON.parse(fix);
        adminKey=subtle.decrypt({name:'AES-GCM',iv:unb64(f.iv)},key,unb64(f.ct)).then(function(b){return td.decode(b);},function(){return p.adminKey||'';});
      }catch(_){/**/}
    }
    return adminKey.then(function(ak){mount(vault,p,key,ak);});
  });
}
function mount(vault,p,key,adminKey){
  opened=true;
  var prev=null;try{prev=JSON.parse(read(SESSION)||'null');}catch(_){/**/}
  var s={username:p.name,role:p.role,test:false};
  if(p.role==='admin'){
    /* Ethan = admin AND the test account: one login, a 👑/🧪 switch in the top bar */
    s.owner=true;
    s.mode=(prev&&prev.username===p.name&&prev.mode==='test')?'test':'admin';
    if(s.mode==='test'){s.role='player';s.test=true;}
  }
  store(SESSION,JSON.stringify(s));
  window.RA={
    session:s,
    adminKey:adminKey,
    saveAdminKey:function(k){
      var iv=rand(12);
      return subtle.encrypt({name:'AES-GCM',iv:iv},key,te.encode(k)).then(function(ct){store(KEYFIX,JSON.stringify({iv:b64(iv),ct:b64(ct)}));});
    },
    logout:function(){store(SESSION,null);store(KEYFIX,null);store(STAY,null);forgetFace().then(function(){location.replace(location.pathname);});}
  };
  document.body.insertAdjacentHTML('beforeend',vault.html);
  vault.scripts.forEach(function(sc){
    var el=document.createElement('script');
    el.textContent=sc.c+'\n//# sourceURL='+sc.n;
    document.body.appendChild(el);
  });
  /* the game's start-up hooks wait for this, and the page finished loading long ago */
  document.dispatchEvent(new Event('DOMContentLoaded'));
  $('login').classList.add('hidden');
}

/* ---- the sign-in screen ---- */
var form=$('loginForm'),nameIn=$('username'),passIn=$('password'),errEl=$('loginError');
var faceBox=$('faceBox'),offer=$('faceOffer'),loginBtn=$('loginBtn'),faceBtn=$('faceBtn');
function show(el,on){el.classList.toggle('hidden',!on);}
function err(t){errEl.textContent=t||'';}
function failOpen(e){
  console.error('[gate]',e);
  show(offer,false);show(form,true);loginBtn.disabled=false;loginBtn.textContent='Start the adventure';
  err(navigator.onLine===false?'Connect to the internet once so this phone can download the game, then try again.':'Could not open the game — try again, or open ross.asia/?fresh=1');
}
function go(p){err('');store(STAY,JSON.stringify(p));return openApp(p).catch(failOpen);}
function afterPassword(p){
  passIn.value='';
  var rec=faceRecord();
  if(rec&&rec.name===p.name)return go(p);
  return faceAvailable().then(function(ok){
    if(!ok)return go(p);
    show(form,false);show(faceBox,false);show(offer,true);
    $('faceYes').onclick=function(){
      $('faceYes').disabled=true;err('');
      enrollFace(p).then(function(){go(p);},function(e){
        console.warn('[gate] Face ID set-up',e);$('faceYes').disabled=false;
        err(e&&e.name==='NotAllowedError'?'Face ID was cancelled — tap again, or Not now.':'Face ID could not be set up on this phone — tap Not now.');
      });
    };
    $('faceNo').onclick=function(){go(p);};
  });
}
form.addEventListener('submit',function(e){
  e.preventDefault();err('');
  if(!subtle){err('Open https://ross.asia in Safari or Chrome to sign in.');return;}
  loginBtn.disabled=true;loginBtn.textContent='Checking…';
  unlockWithPassword(nameIn.value,passIn.value).then(afterPassword,function(x){
    loginBtn.disabled=false;loginBtn.textContent='Start the adventure';
    passIn.value='';err(x&&x.message==='bad'?'Wrong name or password.':'Could not check that — try again.');
  });
});
faceBtn.addEventListener('click',function(){
  err('');faceBtn.disabled=true;
  unlockWithFace().then(function(p){return go(p);},function(e){
    console.warn('[gate] Face ID',e);
    err(e&&e.name==='NotAllowedError'?'Face ID was cancelled — tap to try again, or use your password.':'Face ID didn’t work — use your password.');
  }).then(function(){faceBtn.disabled=false;});
});
$('usePassBtn').addEventListener('click',function(){show(faceBox,false);show(form,true);err('');nameIn.focus();});
function showSignIn(){
  var rec=faceRecord();
  if(rec){$('faceName').textContent=rec.name;show(faceBox,true);show(form,false);}
  else{show(faceBox,false);show(form,true);}
}
showSignIn();
/* signed in before on this phone and never logged out: straight back into the game */
(function(){var p=null;try{p=JSON.parse(read(STAY)||'null');}catch(_){p=null;}
  if(p&&p.k&&p.name){show(form,false);show(faceBox,false);err('Opening…');go(p).then(function(){err('');});}})();

})();
