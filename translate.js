/* ============================================================
   Asia 2026 — PHRASES tab
   The show-the-waiter diet card, the phrasebook, and a money converter
   with a live daily rate. (Photo, speech and typed translation were
   removed — Google Translate / Claude do that job better.)
   ============================================================ */
const TR_LANG={jp:{name:'Japan',flag:'🇯🇵',cur:'JPY',sym:'¥',label:'Japanese',native:'日本語'},
               kr:{name:'Korea',flag:'🇰🇷',cur:'KRW',sym:'₩',label:'Korean',native:'한국어'}};
let trCountry=(()=>{try{return localStorage.getItem('a26-tr-country')||'jp';}catch(_){return 'jp';}})();
function trL(){return TR_LANG[trCountry];}

/* ---------- phrasebook ---------- */
const PHRASES={
jp:[['Essentials',[['Hello','こんにちは','kon-nee-chee-wah'],['Good morning','おはようございます','oh-hah-yoh go-zai-mass'],['Thank you','ありがとうございます','ah-ree-gah-toh go-zai-mass'],['Please (when asking)','お願いします','oh-neh-gai-shee-mass'],['Excuse me / sorry','すみません','soo-mee-mah-sen'],['Yes / No','はい / いいえ','hai / ee-eh'],['How much?','いくらですか','ee-koo-rah dess-kah'],['The bill, please','お会計お願いします','oh-kai-kei oh-neh-gai-shee-mass'],["Where's the toilet?",'トイレはどこですか','toy-reh wah doh-koh dess-kah'],['Do you speak English?','英語を話せますか','ay-go oh hah-nah-seh-mass-kah'],["I don't understand",'わかりません','wah-kah-ree-mah-sen'],['Delicious!','おいしい','oy-shee'],['Before eating','いただきます','ee-tah-dah-kee-mass'],['After eating','ごちそうさまでした','go-chee-soh-sah-mah desh-tah']]],
    ['The diet ones ⚠️',[["I can't eat meat",'肉が食べられません','nee-koo gah tah-beh-rah-reh-mah-sen'],["I can't eat shellfish",'貝が食べられません','kai gah tah-beh-rah-reh-mah-sen'],['Fish is fine','魚は大丈夫です','sah-kah-nah wah dai-joh-boo dess'],['Is there meat in this?','肉が入っていますか','nee-koo gah hight-teh ee-mass-kah'],['Is there shellfish in this?','貝は入っていますか','kai wah hight-teh ee-mass-kah'],['Without meat, please','肉抜きでお願いします','nee-koo-noo-kee deh oh-neh-gai-shee-mass']]],
    ['Menu words',[['Pork ❌','豚肉','butaniku'],['Chicken ❌','鶏肉','toriniku'],['Beef ❌','牛肉','gyuniku'],['Shrimp ❌','えび','ebi'],['Crab ❌','かに','kani'],['Squid ❌','いか','ika'],['Octopus ❌','たこ','tako'],['Eel ❌','うなぎ','unagi'],['Salmon ✅','鮭','sake'],['Tuna ✅','まぐろ','maguro'],['Mackerel ✅','さば','saba'],['Sea bream ✅','鯛','tai'],['Yellowtail ✅','はまち','hamachi']]]],
kr:[['Essentials',[['Hello','안녕하세요','an-nyong-ha-se-yo'],['Thank you','감사합니다','kam-sa-ham-ni-da'],['Please give me…','…주세요','…joo-se-yo'],['Excuse me (to call staff)','저기요','juh-gi-yo'],['Sorry','죄송합니다','jwe-song-ham-ni-da'],['Yes / No','네 / 아니요','neh / ah-ni-yo'],['How much?','얼마예요?','ol-ma-ye-yo'],["Where's the toilet?",'화장실 어디예요?','hwa-jang-shil oh-di-ye-yo'],['Do you speak English?','영어 하세요?','yong-oh ha-se-yo'],["I don't understand",'잘 모르겠어요','jal mo-reu-ge-sso-yo'],['Delicious!','맛있어요','ma-shi-sso-yo'],['Goodbye (you are leaving)','안녕히 계세요','an-nyong-hi gye-se-yo'],['Water, please','물 주세요','mul joo-se-yo']]],
    ['The diet ones ⚠️',[['Is there fermented shrimp in it?','새우젓 들어갔어요?','sae-oo-jot deu-ro-ga-sso-yo'],["I can't eat meat",'고기 못 먹어요','go-gi mot mo-go-yo'],['No shellfish','조개 안 돼요','jo-gae an dwae-yo'],['Fish is fine','생선은 괜찮아요','saeng-son-eun gwaen-cha-na-yo'],['Without meat, please','고기 빼주세요','go-gi ppae-joo-se-yo']]],
    ['Kimbap — order by name',[['Tuna kimbap','참치김밥','cham-chi gim-bap'],['Cheese kimbap','치즈김밥','chi-jeu gim-bap'],['Vegetable kimbap','야채김밥','ya-chae gim-bap'],['Tuna only, please','참치만 넣어주세요','cham-chi-man no-o-joo-se-yo']]]]};

/* ---------- the diet card, show it to the waiter ---------- */

/* ---------- the diet card, show it to the waiter ---------- */
const DIET_CARD={
jp:{big:'肉と、えび・かに・いか・たこ・貝は\n食べられません。',small:'',en:'We can’t eat meat or shellfish.'},
kr:{big:'고기와 조개류(새우·게·오징어·문어·조개)는\n못 먹어요.',small:'',en:'We can’t eat meat or shellfish.'}};
function trBigCard(big,en){document.querySelector('.diet-full')?.remove();
  const o=document.createElement('div');o.className='diet-full';
  o.innerHTML='<div class="diet-inner"><div class="diet-flag">'+trL().flag+'</div><p class="diet-big"></p><p class="diet-en"></p><div class="diet-actions"><button type="button" class="btn btn-primary diet-close">Done</button></div></div>';
  o.querySelector('.diet-big').textContent=big;o.querySelector('.diet-en').textContent=en;
  o.querySelector('.diet-close').addEventListener('click',()=>o.remove());o.addEventListener('click',e=>{if(e.target===o)o.remove();});document.body.appendChild(o);}
function trShowDietCard(){const d=DIET_CARD[trCountry];trBigCard(d.big,d.en);}

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
   '<div class="hub-head"><h2>🗣️ Phrases</h2><p class="hub-earn">The waiter card, the phrasebook and the money converter. For translating menus or speech, use Google Translate or Claude.</p></div>'+
   '<div class="tr-country"><button type="button" class="tr-cb '+(trCountry==='jp'?'on':'')+'" data-c="jp">🇯🇵 Japan</button><button type="button" class="tr-cb '+(trCountry==='kr'?'on':'')+'" data-c="kr">🇰🇷 Korea</button></div>'+
   '<section class="tr-card tr-diet"><h3>🍽️ Show the waiter</h3><p>“We can’t eat meat or shellfish” in '+L.label+', full screen.</p><button type="button" class="btn btn-primary tr-diet-btn">Open the card</button></section>'+
   '<section class="tr-card"><h3>💷 Money</h3><p class="tr-rate">Loading today’s rate…</p>'+
     '<div class="tr-money"><div><label>'+L.sym+' '+L.cur+'</label><input class="tr-amt" type="number" inputmode="decimal" placeholder="0"></div><div class="tr-eq">=</div><div><label>£ GBP</label><input class="tr-gbp" type="number" inputmode="decimal" placeholder="0"></div></div>'+
     '<div class="tr-quick">'+(trCountry==='jp'?[100,500,1000,3000,5000,10000]:[1000,5000,10000,30000,50000,100000]).map(v=>'<button type="button" class="tr-q" data-v="'+v+'">'+L.sym+v.toLocaleString()+'</button>').join('')+'</div>'+
     '<p class="tr-note tr-rate-src"></p></section>'+
   '<section class="tr-card"><h3>🗣️ Phrasebook</h3><p>Tap any phrase to make it big for showing.</p><div class="tr-phr"></div></section>';

  host.querySelectorAll('.tr-cb').forEach(b=>b.addEventListener('click',()=>{trCountry=b.dataset.c;try{localStorage.setItem('a26-tr-country',trCountry);}catch(_){}renderTranslate();}));
  host.querySelector('.tr-diet-btn').addEventListener('click',trShowDietCard);

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
    d.innerHTML='<summary>'+escapeHtml(sec)+'</summary>'+rows.map(r=>'<div class="tr-ph tr-ph-nosay"><div class="tr-ph-t"><div class="tr-ph-en">'+escapeHtml(r[0])+'</div><div class="tr-ph-n">'+escapeHtml(r[1])+'</div><div class="tr-ph-r">'+escapeHtml(r[2])+'</div></div></div>').join('');
    ph.appendChild(d);
    d.querySelectorAll('.tr-ph').forEach((row,i)=>row.addEventListener('click',()=>trBigCard(rows[i][1],rows[i][0]+' · '+rows[i][2])));});
}
