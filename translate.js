/* ============================================================
   Asia 2026 — TRANSLATE tab
   Photo → text → English (OCR in the browser, needs internet the first
   time for the language file), speech both ways, typed text, the
   show-the-waiter diet card, the phrasebook with voice, and a money
   converter with a live daily rate.
   ============================================================ */
const TR_LANG={jp:{name:'Japan',flag:'🇯🇵',code:'ja',speech:'ja-JP',ocr:'jpn',ocrV:'jpn_vert',cur:'JPY',sym:'¥',label:'Japanese',native:'日本語'},
               kr:{name:'Korea',flag:'🇰🇷',code:'ko',speech:'ko-KR',ocr:'kor',ocrV:null,cur:'KRW',sym:'₩',label:'Korean',native:'한국어'}};
let trCountry=(()=>{try{return localStorage.getItem('a26-tr-country')||'jp';}catch(_){return 'jp';}})();
function trL(){return TR_LANG[trCountry];}

/* ---------- translation (online) ---------- */
async function trTranslate(text,from,to){
  text=(text||'').trim();if(!text)return '';
  try{const u='https://translate.googleapis.com/translate_a/single?client=gtx&sl='+from+'&tl='+to+'&dt=t&q='+encodeURIComponent(text);
    const r=await fetch(u);if(!r.ok)throw 0;const j=await r.json();const out=(j[0]||[]).map(s=>s[0]).join('');if(out)return out;}catch(_){/* fall through */}
  const r2=await fetch('https://api.mymemory.translated.net/get?q='+encodeURIComponent(text.slice(0,480))+'&langpair='+(from==='auto'?trL().code:from)+'|'+to);
  const j2=await r2.json();const t=j2&&j2.responseData&&j2.responseData.translatedText;if(!t)throw new Error('no translation');return t;
}
const trHasCJK=s=>/[぀-ヿ㐀-鿿가-힯]/.test(s||'');

/* ---------- speech out ---------- */
let trVoicesReady=false,trAudio=null;
function trVoiceFor(lang){try{const vs=speechSynthesis.getVoices();if(vs.length)trVoicesReady=true;const two=lang.toLowerCase().slice(0,2);
  return vs.find(v=>v.lang&&v.lang.replace('_','-').toLowerCase()===lang.toLowerCase())||vs.find(v=>v.lang&&v.lang.toLowerCase().startsWith(two))||null;}catch(_){return null;}}
/* Online fallback: Google's TTS audio, used when the phone has no voice for the language (iPhones often ship Japanese but not Korean). */
function trSpeakOnline(text,lang){
  const code=lang.slice(0,2);const parts=[];let t=text.replace(/\s+/g,' ').trim();
  while(t.length){let cut=Math.min(180,t.length);if(cut<t.length){const i=Math.max(t.lastIndexOf('。',cut),t.lastIndexOf('.',cut),t.lastIndexOf(' ',cut));if(i>40)cut=i+1;}parts.push(t.slice(0,cut).trim());t=t.slice(cut);}
  if(trAudio){try{trAudio.pause();}catch(_){}}
  let i=0;const a=new Audio();trAudio=a;
  const next=()=>{if(i>=parts.length)return;a.src='https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl='+code+'&q='+encodeURIComponent(parts[i++]);a.play().catch(()=>{toast('Can’t play audio — check you’re online, or add the '+(code==='ko'?'Korean':'Japanese')+' voice in Settings → Accessibility → Spoken Content → Voices.');});};
  a.onended=next;a.onerror=()=>toast('Can’t play audio — check you’re online, or add the '+(code==='ko'?'Korean':'Japanese')+' voice in Settings → Accessibility → Spoken Content → Voices.');next();return true;
}
function trSpeak(text,lang){
  text=(text||'').trim();if(!text)return false;
  if(!('speechSynthesis' in window))return navigator.onLine?trSpeakOnline(text,lang):false;
  const v=trVoiceFor(lang);
  if(!v&&trVoicesReady){ /* voices are known and none speaks this language → online audio */
    if(navigator.onLine)return trSpeakOnline(text,lang);
    toast('This phone has no '+(lang.slice(0,2)==='ko'?'Korean':'Japanese')+' voice. Add it in Settings → Accessibility → Spoken Content → Voices, or go online.');return false;}
  try{if(speechSynthesis.speaking||speechSynthesis.pending)speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text);u.lang=lang;u.rate=0.9;if(v)u.voice=v;
    let started=false;u.onstart=()=>{started=true;};
    u.onerror=e=>{if(e&&e.error==='interrupted')return;if(navigator.onLine)trSpeakOnline(text,lang);};
    /* iOS sometimes swallows an utterance without any event — if nothing has started after 1.5s, use the online audio instead */
    setTimeout(()=>{if(!started&&!speechSynthesis.speaking&&navigator.onLine){try{speechSynthesis.cancel();}catch(_){}trSpeakOnline(text,lang);}},1500);
    speechSynthesis.speak(u);return true;}catch(_){return navigator.onLine?trSpeakOnline(text,lang):false;}
}
try{if('speechSynthesis' in window){speechSynthesis.getVoices();speechSynthesis.onvoiceschanged=()=>{if(speechSynthesis.getVoices().length)trVoicesReady=true;};}}catch(_){}

/* ---------- speech in ---------- */
function trRecognise(lang,onResult,onEnd,onError){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR)return null;
  const r=new SR();r.lang=lang;r.interimResults=true;r.maxAlternatives=1;r.continuous=false;
  r.onresult=e=>{let s='';for(let i=0;i<e.results.length;i++)s+=e.results[i][0].transcript;onResult(s,e.results[e.results.length-1].isFinal);};
  r.onend=onEnd;r.onerror=e=>onError&&onError(e.error||'error');
  try{r.start();}catch(e){onError&&onError('start');return null;}return r;
}

/* ---------- OCR (Tesseract.js, loaded on first use) ---------- */
let trOcrLib=null,trWorkers={};
function trLoadOcr(){if(trOcrLib)return trOcrLib;trOcrLib=new Promise((res,rej)=>{if(window.Tesseract)return res(window.Tesseract);const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';s.onload=()=>res(window.Tesseract);s.onerror=()=>{trOcrLib=null;rej(new Error('Could not load the text reader — are you online?'));};document.head.appendChild(s);});return trOcrLib;}
async function trWorker(lang,onProgress){const T=await trLoadOcr();if(trWorkers[lang])return trWorkers[lang];
  const w=await T.createWorker(lang,1,{logger:m=>{if(onProgress)onProgress(m);}});trWorkers[lang]=w;return w;}
function trPrepImage(file){return new Promise((res,rej)=>{const url=URL.createObjectURL(file);const im=new Image();im.onload=()=>{const sc=Math.min(1,1800/Math.max(im.width,im.height));const c=document.createElement('canvas');c.width=Math.round(im.width*sc);c.height=Math.round(im.height*sc);const x=c.getContext('2d');x.drawImage(im,0,0,c.width,c.height);
  /* grey + a bit more contrast helps printed menus and signs */
  const d=x.getImageData(0,0,c.width,c.height),p=d.data;for(let i=0;i<p.length;i+=4){let g=p[i]*0.3+p[i+1]*0.59+p[i+2]*0.11;g=(g-128)*1.25+128;p[i]=p[i+1]=p[i+2]=Math.max(0,Math.min(255,g));}x.putImageData(d,0,0);
  URL.revokeObjectURL(url);res({canvas:c,preview:url2(im)});};im.onerror=rej;im.src=url;
  function url2(img){const c2=document.createElement('canvas');const sc=Math.min(1,900/Math.max(img.width,img.height));c2.width=img.width*sc;c2.height=img.height*sc;c2.getContext('2d').drawImage(img,0,0,c2.width,c2.height);return c2.toDataURL('image/jpeg',0.8);}});}

/* ---------- phrasebook ---------- */
const PHRASES={
jp:[['Essentials',[['Hello','こんにちは','kon-nee-chee-wah'],['Good morning','おはようございます','oh-hah-yoh go-zai-mass'],['Thank you','ありがとうございます','ah-ree-gah-toh go-zai-mass'],['Please (when asking)','お願いします','oh-neh-gai-shee-mass'],['Excuse me / sorry','すみません','soo-mee-mah-sen'],['Yes / No','はい / いいえ','hai / ee-eh'],['How much?','いくらですか','ee-koo-rah dess-kah'],['The bill, please','お会計お願いします','oh-kai-kei oh-neh-gai-shee-mass'],["Where's the toilet?",'トイレはどこですか','toy-reh wah doh-koh dess-kah'],['Do you speak English?','英語を話せますか','ay-go oh hah-nah-seh-mass-kah'],["I don't understand",'わかりません','wah-kah-ree-mah-sen'],['Delicious!','おいしい','oy-shee'],['Before eating','いただきます','ee-tah-dah-kee-mass'],['After eating','ごちそうさまでした','go-chee-soh-sah-mah desh-tah']]],
    ['The diet ones ⚠️',[["I can't eat meat",'肉が食べられません','nee-koo gah tah-beh-rah-reh-mah-sen'],["I can't eat shellfish",'貝が食べられません','kai gah tah-beh-rah-reh-mah-sen'],['Fish is fine','魚は大丈夫です','sah-kah-nah wah dai-joh-boo dess'],['Is there meat in this?','肉が入っていますか','nee-koo gah hight-teh ee-mass-kah'],['Is there shellfish in this?','貝は入っていますか','kai wah hight-teh ee-mass-kah'],['Without meat, please','肉抜きでお願いします','nee-koo-noo-kee deh oh-neh-gai-shee-mass']]],
    ['Menu words',[['Pork ❌','豚肉','butaniku'],['Chicken ❌','鶏肉','toriniku'],['Beef ❌','牛肉','gyuniku'],['Shrimp ❌','えび','ebi'],['Crab ❌','かに','kani'],['Squid ❌','いか','ika'],['Octopus ❌','たこ','tako'],['Eel ❌','うなぎ','unagi'],['Salmon ✅','鮭','sake'],['Tuna ✅','まぐろ','maguro'],['Mackerel ✅','さば','saba'],['Sea bream ✅','鯛','tai'],['Yellowtail ✅','はまち','hamachi']]]],
kr:[['Essentials',[['Hello','안녕하세요','an-nyong-ha-se-yo'],['Thank you','감사합니다','kam-sa-ham-ni-da'],['Please give me…','…주세요','…joo-se-yo'],['Excuse me (to call staff)','저기요','juh-gi-yo'],['Sorry','죄송합니다','jwe-song-ham-ni-da'],['Yes / No','네 / 아니요','neh / ah-ni-yo'],['How much?','얼마예요?','ol-ma-ye-yo'],["Where's the toilet?",'화장실 어디예요?','hwa-jang-shil oh-di-ye-yo'],['Do you speak English?','영어 하세요?','yong-oh ha-se-yo'],["I don't understand",'잘 모르겠어요','jal mo-reu-ge-sso-yo'],['Delicious!','맛있어요','ma-shi-sso-yo'],['Goodbye (you are leaving)','안녕히 계세요','an-nyong-hi gye-se-yo'],['Water, please','물 주세요','mul joo-se-yo']]],
    ['The diet ones ⚠️',[['Is there fermented shrimp in it?','새우젓 들어갔어요?','sae-oo-jot deu-ro-ga-sso-yo'],["I can't eat meat",'고기 못 먹어요','go-gi mot mo-go-yo'],['No shellfish','조개 안 돼요','jo-gae an dwae-yo'],['Fish is fine','생선은 괜찮아요','saeng-son-eun gwaen-cha-na-yo'],['Without meat, please','고기 빼주세요','go-gi ppae-joo-se-yo']]],
    ['Kimbap — order by name',[['Tuna kimbap','참치김밥','cham-chi gim-bap'],['Cheese kimbap','치즈김밥','chi-jeu gim-bap'],['Vegetable kimbap','야채김밥','ya-chae gim-bap'],['Tuna only, please','참치만 넣어주세요','cham-chi-man no-o-joo-se-yo']]]]};

/* ---------- the diet card, show it to the waiter ---------- */
const DIET_CARD={
jp:{big:'肉と、えび・かに・いか・たこ・貝は\n食べられません。',small:'',en:'We can’t eat meat or shellfish.'},
kr:{big:'고기와 조개류(새우·게·오징어·문어·조개)는\n못 먹어요.',small:'',en:'We can’t eat meat or shellfish.'}};
function trShowDietCard(){const L=trL(),d=DIET_CARD[trCountry];document.querySelector('.diet-full')?.remove();
  const o=document.createElement('div');o.className='diet-full';
  o.innerHTML='<div class="diet-inner"><div class="diet-flag">'+L.flag+'</div><p class="diet-big"></p><p class="diet-small"></p><p class="diet-en"></p>'+
    '<div class="diet-actions"><button type="button" class="btn btn-primary diet-say">🔊 Say it</button><button type="button" class="btn btn-quiet diet-close">Done</button></div></div>';
  o.querySelector('.diet-big').textContent=d.big;o.querySelector('.diet-small').textContent=d.small;if(!d.small)o.querySelector('.diet-small').remove();o.querySelector('.diet-en').textContent=d.en;
  o.querySelector('.diet-say').addEventListener('click',()=>{if(!trSpeak(d.big.replace(/\n/g,''),L.speech))toast('This phone can’t speak '+L.label+' — show the screen instead.');});
  o.querySelector('.diet-close').addEventListener('click',()=>o.remove());document.body.appendChild(o);}

/* ---------- money ---------- */
let trRates=null;
async function trLoadRates(force){
  try{const c=JSON.parse(localStorage.getItem('a26-rates')||'null');if(c&&!force&&Date.now()-c.at<6*3600e3){trRates=c;return c;}}catch(_){}
  const tries=[async()=>{const j=await (await fetch('https://open.er-api.com/v6/latest/GBP')).json();if(!j||!j.rates||!j.rates.JPY)throw 0;return {JPY:j.rates.JPY,KRW:j.rates.KRW,date:j.time_last_update_utc||'',src:'open.er-api.com'};},
    async()=>{const j=await (await fetch('https://api.frankfurter.app/latest?from=GBP&to=JPY,KRW')).json();if(!j||!j.rates)throw 0;return {JPY:j.rates.JPY,KRW:j.rates.KRW,date:j.date,src:'ECB via frankfurter.app'};}];
  for(const t of tries){try{const r=await t();trRates={...r,at:Date.now()};try{localStorage.setItem('a26-rates',JSON.stringify(trRates));}catch(_){}return trRates;}catch(_){/* next */}}
  if(!trRates){try{trRates=JSON.parse(localStorage.getItem('a26-rates')||'null');}catch(_){}}
  if(!trRates)trRates={JPY:211,KRW:1830,date:'plan rate (5 Sept 2026) — offline',src:'offline',at:0};
  return trRates;
}

/* ---------- the tab ---------- */
function renderTranslate(){
  const host=document.getElementById('translateView');if(!host)return;const L=trL();
  host.innerHTML=
   '<div class="hub-head"><h2>🌐 Translate</h2><p class="hub-earn">Photos, speech, typing, the waiter card, the phrasebook and the money converter. Needs internet for photos and speech.</p></div>'+
   '<div class="tr-country"><button type="button" class="tr-cb '+(trCountry==='jp'?'on':'')+'" data-c="jp">🇯🇵 Japan</button><button type="button" class="tr-cb '+(trCountry==='kr'?'on':'')+'" data-c="kr">🇰🇷 Korea</button></div>'+
   '<section class="tr-card tr-diet"><h3>🍽️ Show the waiter</h3><p>“We can’t eat meat or shellfish” in '+L.label+', full screen, with a button that says it out loud.</p><button type="button" class="btn btn-primary tr-diet-btn">Open the card</button></section>'+
   '<section class="tr-card"><h3>📸 Photo → English</h3><p>Menus, signs, labels. Point the camera at printed text, straight on, good light. The first photo downloads the '+L.label+' reader (a few MB).</p>'+
     '<label class="tr-photo-btn btn btn-primary">📷 Take a photo<input type="file" accept="image/*" capture="environment" hidden></label>'+
     '<label class="tr-photo-btn btn btn-quiet">🖼️ From Photos<input type="file" accept="image/*" hidden></label>'+
     (L.ocrV?'<label class="tr-check"><input type="checkbox" class="tr-vert"> Text runs top-to-bottom (vertical)</label>':'')+
     '<div class="tr-progress hidden"><div class="tr-bar"><i></i></div><span></span></div>'+
     '<div class="tr-result hidden"><img class="tr-img" alt="your photo"><textarea class="tr-orig" rows="4" placeholder="Text found in the photo (you can fix it)"></textarea><button type="button" class="btn btn-quiet tr-retrans">↻ Translate again</button><div class="tr-en"></div></div>'+
     '<p class="tr-tip">💡 iPhone tip: long-press on the photo above and choose <b>Translate</b> — Apple’s built-in reader is often even better.</p></section>'+
   '<section class="tr-card"><h3>🎤 Speech</h3><p>Hold the phone up. One button for them, one for you.</p>'+
     '<div class="tr-row"><button type="button" class="btn btn-primary tr-mic" data-dir="in">🎤 They speak '+L.native+' → English</button><button type="button" class="btn btn-primary tr-mic" data-dir="out">🎤 I speak English → '+L.native+'</button></div>'+
     '<div class="tr-heard"></div><div class="tr-said"></div><p class="tr-note tr-sr-note hidden">⚠️ Speech recognition isn’t available in this view. Open <b>ross.asia</b> in Safari itself for the microphone — typing below still works here.</p></section>'+
   '<section class="tr-card"><h3>⌨️ Type it</h3><p>Paste or type '+L.label+' to get English, or type English to get '+L.label+' (it can say it out loud).</p>'+
     '<textarea class="tr-type" rows="3" placeholder="Type here…"></textarea><div class="tr-row"><button type="button" class="btn btn-primary tr-go">Translate</button><button type="button" class="btn btn-quiet tr-type-say hidden">🔊 Say it</button></div><div class="tr-type-out"></div></section>'+
   '<section class="tr-card"><h3>💷 Money</h3><p class="tr-rate">Loading today’s rate…</p>'+
     '<div class="tr-money"><div><label>'+L.sym+' '+L.cur+'</label><input class="tr-amt" type="number" inputmode="decimal" placeholder="0"></div><div class="tr-eq">=</div><div><label>£ GBP</label><input class="tr-gbp" type="number" inputmode="decimal" placeholder="0"></div></div>'+
     '<div class="tr-quick">'+(trCountry==='jp'?[100,500,1000,3000,5000,10000]:[1000,5000,10000,30000,50000,100000]).map(v=>'<button type="button" class="tr-q" data-v="'+v+'">'+L.sym+v.toLocaleString()+'</button>').join('')+'</div>'+
     '<p class="tr-note tr-rate-src"></p></section>'+
   '<section class="tr-card"><h3>🗣️ Phrasebook with voice</h3><p>Tap 🔊 and the phone says it in '+L.label+'. Tap the words to make them big for showing.</p><div class="tr-phr"></div></section>';

  host.querySelectorAll('.tr-cb').forEach(b=>b.addEventListener('click',()=>{trCountry=b.dataset.c;try{localStorage.setItem('a26-tr-country',trCountry);}catch(_){}renderTranslate();}));
  host.querySelector('.tr-diet-btn').addEventListener('click',trShowDietCard);

  /* photo */
  const prog=host.querySelector('.tr-progress'),res=host.querySelector('.tr-result'),orig=host.querySelector('.tr-orig'),en=host.querySelector('.tr-en');
  async function doPhoto(file){if(!file)return;prog.classList.remove('hidden');res.classList.add('hidden');const bar=prog.querySelector('i'),lbl=prog.querySelector('span');lbl.textContent='Preparing photo…';bar.style.width='5%';
    try{const {canvas,preview}=await trPrepImage(file);host.querySelector('.tr-img').src=preview;
      const vert=host.querySelector('.tr-vert')?.checked;const lang=vert?L.ocrV:L.ocr;
      const w=await trWorker(lang,m=>{if(m.status==='recognizing text'){bar.style.width=(10+m.progress*85)+'%';lbl.textContent='Reading text… '+Math.round(m.progress*100)+'%';}else{lbl.textContent=(m.status||'Loading')+'…';bar.style.width='8%';}});
      const out=await w.recognize(canvas);let text=(out.data.text||'').replace(/[ \t]+/g,m=>trCountry==='jp'?'':m).replace(/\n{2,}/g,'\n').trim();
      prog.classList.add('hidden');res.classList.remove('hidden');orig.value=text;
      if(!text){en.textContent='No text found. Try closer, straighter, better light — or the iPhone tip below.';return;}
      en.textContent='Translating…';en.textContent=await trTranslate(text,L.code,'en');}
    catch(e){prog.classList.add('hidden');res.classList.remove('hidden');en.textContent='⚠️ '+(e&&e.message?e.message:'That didn’t work — check you’re online.');}}
  host.querySelectorAll('.tr-photo-btn input').forEach(i=>i.addEventListener('change',e=>doPhoto(e.target.files[0])));
  host.querySelector('.tr-retrans').addEventListener('click',async()=>{en.textContent='Translating…';try{en.textContent=await trTranslate(orig.value,L.code,'en');}catch(_){en.textContent='⚠️ Could not translate — are you online?';}});

  /* speech */
  const SRok=!!(window.SpeechRecognition||window.webkitSpeechRecognition);
  host.querySelector('.tr-sr-note').classList.toggle('hidden',SRok);
  let rec=null;
  host.querySelectorAll('.tr-mic').forEach(b=>b.addEventListener('click',async()=>{
    const heard=host.querySelector('.tr-heard'),said=host.querySelector('.tr-said');
    if(rec){try{rec.stop();}catch(_){}rec=null;b.classList.remove('live');return;}
    if(!SRok){host.querySelector('.tr-sr-note').classList.remove('hidden');return;}
    const dir=b.dataset.dir;heard.textContent='🎙️ Listening…';said.textContent='';b.classList.add('live');
    rec=trRecognise(dir==='in'?L.speech:'en-GB',async(s,final)=>{heard.textContent=s;if(final){try{const out=await trTranslate(s,dir==='in'?L.code:'en',dir==='in'?'en':L.code);said.innerHTML='';const big=document.createElement('div');big.className='tr-bigout';big.textContent=out;said.appendChild(big);
          if(dir==='out'){trSpeak(out,L.speech);const sb=document.createElement('button');sb.type='button';sb.className='btn btn-quiet';sb.textContent='🔊 Say it again';sb.addEventListener('click',()=>trSpeak(out,L.speech));said.appendChild(sb);}}
        catch(_){said.textContent='⚠️ Could not translate — are you online?';}}},
      ()=>{b.classList.remove('live');rec=null;if(heard.textContent==='🎙️ Listening…')heard.textContent='Didn’t catch that — tap and try again.';},
      err=>{b.classList.remove('live');rec=null;heard.textContent=err==='not-allowed'?'⚠️ Microphone blocked — allow it in Settings → Safari.':'⚠️ Speech didn’t work ('+err+'). Try again or type it below.';});
  }));

  /* typing */
  const ta=host.querySelector('.tr-type'),out=host.querySelector('.tr-type-out'),sayBtn=host.querySelector('.tr-type-say');let lastOut='',lastLang='';
  host.querySelector('.tr-go').addEventListener('click',async()=>{const s=ta.value.trim();if(!s)return;out.textContent='Translating…';sayBtn.classList.add('hidden');
    try{const toEn=trHasCJK(s);const r=await trTranslate(s,toEn?L.code:'en',toEn?'en':L.code);out.innerHTML='';const big=document.createElement('div');big.className='tr-bigout';big.textContent=r;out.appendChild(big);
      lastOut=r;lastLang=toEn?'en-GB':L.speech;sayBtn.classList.remove('hidden');}catch(_){out.textContent='⚠️ Could not translate — are you online?';}});
  sayBtn.addEventListener('click',()=>trSpeak(lastOut,lastLang));

  /* money */
  const amt=host.querySelector('.tr-amt'),gbp=host.querySelector('.tr-gbp'),rateEl=host.querySelector('.tr-rate'),srcEl=host.querySelector('.tr-rate-src');
  function rate(){return trRates?trRates[L.cur]:null;}
  function showRate(){const r=rate();if(!r)return;rateEl.innerHTML='<b>£1 = '+L.sym+(trCountry==='jp'?r.toFixed(2):Math.round(r).toLocaleString())+'</b> · <b>'+L.sym+(trCountry==='jp'?'1,000':'10,000')+' = £'+((trCountry==='jp'?1000:10000)/r).toFixed(2)+'</b>';
    srcEl.textContent='Rate updated '+(trRates.date||'')+' ('+trRates.src+'). Refreshes every few hours when online.';}
  amt.addEventListener('input',()=>{const r=rate();if(!r)return;gbp.value=amt.value===''?'':(Number(amt.value)/r).toFixed(2);});
  gbp.addEventListener('input',()=>{const r=rate();if(!r)return;amt.value=gbp.value===''?'':(trCountry==='jp'?Math.round(Number(gbp.value)*r):Math.round(Number(gbp.value)*r/10)*10);});
  host.querySelectorAll('.tr-q').forEach(b=>b.addEventListener('click',()=>{amt.value=b.dataset.v;amt.dispatchEvent(new Event('input'));}));
  trLoadRates().then(showRate);

  /* phrasebook */
  const ph=host.querySelector('.tr-phr');
  PHRASES[trCountry].forEach(([sec,rows])=>{const d=document.createElement('details');d.className='tr-sec';d.open=sec==='Essentials';
    d.innerHTML='<summary>'+escapeHtml(sec)+'</summary>'+rows.map(r=>'<div class="tr-ph"><button type="button" class="tr-say" aria-label="say">🔊</button><div class="tr-ph-t"><div class="tr-ph-en">'+escapeHtml(r[0])+'</div><div class="tr-ph-n">'+escapeHtml(r[1])+'</div><div class="tr-ph-r">'+escapeHtml(r[2])+'</div></div></div>').join('');
    ph.appendChild(d);
    d.querySelectorAll('.tr-ph').forEach((row,i)=>{row.querySelector('.tr-say').addEventListener('click',e=>{e.stopPropagation();if(!trSpeak(rows[i][1],L.speech))toast('This phone can’t speak '+L.label+' — show the words instead.');});
      row.querySelector('.tr-ph-t').addEventListener('click',()=>{const o=document.createElement('div');o.className='diet-full';o.innerHTML='<div class="diet-inner"><p class="diet-big"></p><p class="diet-en"></p><div class="diet-actions"><button type="button" class="btn btn-primary diet-say">🔊 Say it</button><button type="button" class="btn btn-quiet diet-close">Done</button></div></div>';
        o.querySelector('.diet-big').textContent=rows[i][1];o.querySelector('.diet-en').textContent=rows[i][0]+' · '+rows[i][2];o.querySelector('.diet-say').addEventListener('click',()=>trSpeak(rows[i][1],L.speech));o.querySelector('.diet-close').addEventListener('click',()=>o.remove());document.body.appendChild(o);});});});
}
