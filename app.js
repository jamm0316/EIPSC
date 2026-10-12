/* 정처기 실기 카드 PWA
 * - 하루 제한 없음: 필터에 맞는 카드를 한 바퀴씩 계속 돈다
 * - 카드마다 회독 수 0~5 (localStorage). 5회 = 완료
 */
'use strict';

const MAX = 5;
const EXAM = '2026-10-25';
const KEY_COUNTS = 'eipsc.v1.counts';
const KEY_PREFS = 'eipsc.v1.prefs';
const KEY_A2HS = 'eipsc.v1.a2hs';
const AREAS = [['all','전체',''],['pg','프로그래밍','--pg'],['db','DB','--db'],['net','네트워크','--net'],['sec','보안','--sec'],['sw','SW공학','--sw'],['os','OS','--os']];
const KINDS = [['all','전체'],['개념','개념'],['코드','코드']];

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ymd = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');

/* ---------- 저장소 (실패해도 앱은 돈다) ---------- */
const store = {
  get(k, fb){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; }catch(e){ return fb; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch(e){ return false; } },
};
let counts = store.get(KEY_COUNTS, {});
const prefs = Object.assign({area:'all', kind:'all', tab:'study', showDone:false, shuffle:false}, store.get(KEY_PREFS, {}));
const savePrefs = () => store.set(KEY_PREFS, prefs);
const cnt = id => Math.max(0, Math.min(MAX, counts[id] | 0));
function setCount(id, n){
  n = Math.max(0, Math.min(MAX, n));
  if(n) counts[id] = n; else delete counts[id];
  if(!store.set(KEY_COUNTS, counts)) $('status').textContent = '이 브라우저에 기록을 저장하지 못했어요 (개인정보 보호 모드인지 확인).';
}

/* ---------- 상태 ---------- */
let cards = [], byId = {}, queue = [], cur = null, flipped = false, rnd = {};

const kindOf = c => c.kind || (c.code ? '코드' : '개념');
const inView = c => (prefs.area === 'all' || c.area === prefs.area) && (prefs.kind === 'all' || kindOf(c) === prefs.kind);
const unitKey = c => kindOf(c) + ' > ' + (c.unit || '');
const weak = c => (c.ng || 0) - (c.ok || 0);   // 예전 앱에서 틀린 만큼 앞으로

function buildQueue(keepCur){
  rnd = {};
  if(prefs.shuffle) cards.forEach(c => rnd[c.id] = Math.random());
  queue = cards.filter(c => inView(c) && (prefs.showDone || cnt(c.id) < MAX))
    .sort((a,b) => (cnt(a.id) - cnt(b.id))
      || (prefs.shuffle ? rnd[a.id] - rnd[b.id] : (weak(b) - weak(a)) || unitKey(a).localeCompare(unitKey(b)) || a.id.localeCompare(b.id)))
    .map(c => c.id);
  if(!(keepCur && cur && queue.includes(cur))){ cur = queue[0] || null; flipped = false; }
  else { queue = [cur, ...queue.filter(id => id !== cur)]; }
}

/* ---------- 렌더링 조각 ---------- */
function rich(text){
  const L = String(text || '').split('\n'); let out = '', i = 0;
  while(i < L.length){
    const l = L[i];
    if(l.startsWith('```')){ const buf=[]; i++; while(i<L.length && !L[i].startsWith('```')){ buf.push(L[i]); i++; } i++; out += `<pre>${esc(buf.join('\n'))}</pre>`; continue; }
    if(l.startsWith('|')){ const rows=[]; while(i<L.length && L[i].startsWith('|')){ rows.push(L[i].split('|').slice(1,-1).map(x=>x.trim())); i++; }
      out += `<div class="tbl"><table><thead><tr>${rows[0].map(x=>`<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows.slice(1).map(r=>`<tr>${r.map(x=>`<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; continue; }
    if(l.startsWith('단서:')) out += `<p class="clue">${esc(l)}</p>`;
    else if(l.startsWith('함정:')) out += `<p class="trap">${esc(l)}</p>`;
    else if(l.trim()) out += `<p>${esc(l)}</p>`;
    i++;
  }
  return `<div class="rich">${out}</div>`;
}
function crumbHTML(c){
  const segs = [kindOf(c), ...String(c.unit||'').split('>').map(x=>x.trim()).filter(Boolean), c.title||''].filter(Boolean);
  return `<div class="cat"><span class="cat-k">분류</span><div class="crumb">${segs.map(x=>`<span>${esc(x)}</span>`).join('<i aria-hidden="true">›</i>')}</div></div>`;
}
const codeHTML = c => c.code ? `<div class="codebox">${c.lang?`<span class="lang">${esc(c.lang)}</span>`:''}<pre>${esc(c.code)}</pre></div>` : '';
function answerHTML(c){
  const lines = String(c.back || '').split('\n');
  const note = c.note ? `<div class="note"><span class="cat-k">문법 · 개념 노트</span>${rich(c.note)}</div>` : '';
  const k = c.concept && byId[c.concept];
  const rule = k ? `<details class="rule"><summary>소속 규칙: ${esc(k.title || k.front)}</summary><div class="rule-b">${esc(k.back)}</div></details>` : '';
  return `<div class="ans">${crumbHTML(c)}<div class="a1">${esc(lines[0])}</div>${lines.length>1 ? rich(lines.slice(1).join('\n')) : ''}${note}${rule}<div class="src">${esc(c.src || '')}</div></div>`;
}
function dotsHTML(id, small){
  const n = cnt(id);
  return `<div class="dots${small?' sm':''}" role="group" aria-label="회독 수 ${n}/${MAX}">${
    Array.from({length:MAX}, (_,i) => `<button type="button" class="dot${i<n?' on':''}" data-id="${id}" data-n="${i+1}" aria-label="${i+1}회로 표시">${i+1}</button>`).join('')}</div>`;
}

function renderCounts(){
  const vis = cards.filter(inView);
  const by = Array(MAX+1).fill(0); vis.forEach(c => by[cnt(c.id)]++);
  $('counts').innerHTML = by.map((v,i) => `<div class="cnt${i===MAX?' full':''}"><b>${v}</b><span>${i===MAX?'5회 완료':i+'회'}</span></div>`).join('');
  const total = vis.reduce((s,c) => s + cnt(c.id), 0), max = vis.length * MAX;
  $('bar-fill').style.width = max ? (total/max*100).toFixed(1)+'%' : '0';
  $('sum').textContent = `${vis.length}장 · 누적 ${total}/${max}회 (${max?Math.round(total/max*100):0}%)`;
}

function render(){
  if(!cards.length) return;
  renderCounts();
  $('study').hidden = prefs.tab !== 'study';
  $('list').hidden = prefs.tab !== 'list';
  if(prefs.tab === 'list') return renderList();

  $('status').textContent = `이번 바퀴 남은 카드 ${queue.length}장` + (prefs.showDone ? '' : ' (5회 채운 카드 제외)');
  const c = byId[cur];
  if(!c){
    const left = cards.filter(x => inView(x) && cnt(x.id) < MAX).length;
    $('study').innerHTML = `<div class="done"><b>${left ? '한 바퀴 끝' : '이 범위 5회 완료'}</b><span>${left ? `아직 5회 안 된 카드 ${left}장. 바로 한 바퀴 더 돌 수 있어요.` : '[5회 채운 카드도 보기]를 켜면 계속 복습할 수 있어요.'}</span>${left ? '<button type="button" id="b-again">한 바퀴 더</button>' : ''}</div>`;
    const again = $('b-again'); if(again) again.onclick = () => { buildQueue(); render(); };
    return;
  }
  const n = cnt(c.id);
  $('study').innerHTML = `<div class="card" id="card" tabindex="0" role="button" aria-label="카드 뒤집기" style="--c:var(--${esc(c.area)})">
      <div class="meta"><span class="tag">${esc(kindOf(c))} · ${esc(c.unit || '')}</span><span>${weak(c) > 0 ? '예전에 틀림 · ' : ''}${esc(c.id)}</span></div>
      <div class="q">${esc(c.front)}</div>${codeHTML(c)}
      ${flipped ? answerHTML(c) : '<div class="hint">답을 말하거나 쓴 다음 눌러서 뒤집기</div>'}
    </div>
    <div class="reads"><span class="reads-l">회독 <b>${n}</b>/${MAX}</span>${dotsHTML(c.id)}</div>
    <div class="act">
      <button type="button" class="skip" id="b-skip">건너뛰기</button>
      <button type="button" class="seen" id="b-seen" ${flipped && n < MAX ? '' : 'disabled'}>${n >= MAX ? '5회 완료' : '봤음 +1'}</button>
    </div>`;
  $('card').onclick = e => {
    if(e.target.closest('.ans') && (e.target.closest('details') || String(window.getSelection?.() || ''))) return;
    flipped = !flipped; render();
  };
  $('b-skip').onclick = skip;
  $('b-seen').onclick = seen;
}

function renderList(){
  const vis = cards.filter(inView).sort((a,b) => unitKey(a).localeCompare(unitKey(b)) || a.id.localeCompare(b.id));
  $('status').textContent = `카드 ${vis.length}장 · 눌러서 펼치면 답과 회독 점이 나옵니다`;
  const open = new Set([...document.querySelectorAll('#list details[open]')].map(d => d.dataset.id));
  let html = '', last = '';
  for(const c of vis){
    const k = unitKey(c), n = cnt(c.id);
    if(k !== last){ html += `<div class="group">${esc(kindOf(c))} › <b>${esc(c.unit || '')}</b></div>`; last = k; }
    html += `<details data-id="${esc(c.id)}" style="--c:var(--${esc(c.area)})"${open.has(c.id)?' open':''}><summary><span class="pill">${esc(c.lang || kindOf(c))}</span><span class="f">${esc(c.title || String(c.front).split('\n')[0])}</span><span class="pill${n>=MAX?' full':''}">${n}/${MAX}</span></summary>
      <div class="q" style="font-size:15px;margin-top:8px">${esc(c.front)}</div>${codeHTML(c)}${answerHTML(c)}
      <div class="row-dots">회독 ${dotsHTML(c.id, true)}</div></details>`;
  }
  $('list').innerHTML = html;
}

/* ---------- 동작 ---------- */
function next(){ cur = queue[0] || null; flipped = false; render(); window.scrollTo({top: $('status').offsetTop - 8, behavior: 'smooth'}); }
function seen(){
  if(!cur || !flipped) return;
  setCount(cur, cnt(cur) + 1);
  queue = queue.filter(id => id !== cur);
  next();
}
function skip(){
  if(!cur) return;
  queue = queue.filter(id => id !== cur);
  if(queue.length) queue.push(cur); else queue = [cur];
  if(queue[0] === cur && queue.length > 1) queue.push(queue.shift());
  next();
}
document.addEventListener('click', e => {
  const d = e.target.closest('.dot'); if(!d) return;
  e.preventDefault(); e.stopPropagation();
  const id = d.dataset.id, n = +d.dataset.n;
  setCount(id, cnt(id) === n ? n - 1 : n);
  render();
}, true);
document.addEventListener('keydown', e => {
  if(prefs.tab !== 'study' || !cur || /INPUT|TEXTAREA/.test(e.target.tagName)) return;
  if(e.key === ' ' || (e.key === 'Enter' && e.target.id === 'card')){ e.preventDefault(); flipped = !flipped; render(); }
  else if(e.key === 'ArrowRight') seen();
  else if(e.key === 'ArrowLeft') skip();
});

/* ---------- 필터 ---------- */
function press(group, attr, val){ $(group).querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset[attr] === val)); }
$('kinds').innerHTML = KINDS.map(([k,l]) => `<button type="button" data-k="${k}">${l}</button>`).join('');
$('chips').innerHTML = AREAS.map(([k,l,v]) => `<button type="button" data-a="${k}" ${v?`style="--c:var(${v})"`:''}>${l}</button>`).join('');
$('kinds').addEventListener('click', e => { const b = e.target.closest('button'); if(!b) return; prefs.kind = b.dataset.k; press('kinds','k',prefs.kind); savePrefs(); buildQueue(); render(); });
$('chips').addEventListener('click', e => { const b = e.target.closest('button'); if(!b) return; prefs.area = b.dataset.a; press('chips','a',prefs.area); savePrefs(); buildQueue(); render(); });
function setTab(t){ prefs.tab = t; $('t-study').setAttribute('aria-pressed', t==='study'); $('t-list').setAttribute('aria-pressed', t==='list'); savePrefs(); if(t==='study') buildQueue(true); render(); }
$('t-study').onclick = () => setTab('study');
$('t-list').onclick = () => setTab('list');
$('o-done').onchange = e => { prefs.showDone = e.target.checked; savePrefs(); buildQueue(true); render(); };
$('o-shuffle').onchange = e => { prefs.shuffle = e.target.checked; savePrefs(); buildQueue(); render(); };

/* ---------- 백업 ---------- */
const msg = t => { $('tool-msg').textContent = t; };
$('b-export').onclick = async () => {
  const code = JSON.stringify({v:1, at: new Date().toISOString(), counts});
  $('io').hidden = false; $('io').value = code;
  try{ await navigator.clipboard.writeText(code); msg('백업 코드를 복사했어요. 메모 앱 등에 붙여넣어 두세요.'); }
  catch(e){ $('io').select(); msg('자동 복사가 안 돼요. 아래 코드를 길게 눌러 복사하세요.'); }
};
$('b-import').onclick = () => {
  if($('io').hidden || !$('io').value.trim()){ $('io').hidden = false; $('io').value = ''; $('io').focus(); msg('백업 코드를 붙여넣고 한 번 더 누르세요.'); return; }
  try{
    const d = JSON.parse($('io').value.trim()); const src = d.counts || d; const out = {};
    for(const [k,v] of Object.entries(src)){ const n = Math.max(0, Math.min(MAX, v|0)); if(n) out[k] = n; }
    counts = out; store.set(KEY_COUNTS, counts); buildQueue(); render(); msg(`불러왔어요: ${Object.keys(out).length}장 기록.`);
  }catch(e){ msg('코드 형식이 맞지 않아요. 복사한 코드 전체를 붙여넣었는지 확인하세요.'); }
};
let resetArmed = false;
$('b-reset').onclick = () => {
  if(!resetArmed){ resetArmed = true; $('b-reset').textContent = '정말 0회로? 한 번 더 누르기'; setTimeout(() => { resetArmed = false; $('b-reset').textContent = '전부 0회로'; }, 4000); return; }
  resetArmed = false; $('b-reset').textContent = '전부 0회로';
  counts = {}; store.set(KEY_COUNTS, counts); buildQueue(); render(); msg('모든 회독 기록을 지웠어요.');
};

/* ---------- 홈 화면 추가 안내 (처음 한 번) ---------- */
function a2hs(){
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const force = new URLSearchParams(location.search).has('a2hs');
  if(standalone || (!force && store.get(KEY_A2HS, false))) return;
  const ua = navigator.userAgent;
  if(!force && !/iPhone|iPad|iPod|Android/i.test(ua)) return;
  let t;
  if(/KAKAOTALK/i.test(ua)) t = '카카오톡 안에서는 설치가 안 돼요.\n오른쪽 아래 ⋯ → [다른 브라우저로 열기]로 사파리/크롬에서 연 뒤 추가하세요.';
  else if(/iPhone|iPad|iPod/i.test(ua)) t = '사파리 아래쪽 공유 버튼(□↑) → [홈 화면에 추가].\n앱처럼 열리고, 한 번 열어 두면 오프라인에서도 카드를 볼 수 있어요.';
  else t = '크롬 메뉴(⋮) → [홈 화면에 추가] 또는 [앱 설치].\n앱처럼 열리고, 한 번 열어 두면 오프라인에서도 카드를 볼 수 있어요.';
  $('a2hs-msg').textContent = t; $('a2hs').hidden = false;
  $('a2hs-ok').onclick = () => { $('a2hs').hidden = true; store.set(KEY_A2HS, true); };
}

/* ---------- 시작 ---------- */
(function init(){
  const today = new Date(); today.setHours(0,0,0,0);
  const dday = Math.round((new Date(EXAM + 'T00:00:00') - today) / 864e5);
  $('today').textContent = `${ymd(new Date())} · 시험 ${EXAM} (${dday > 0 ? 'D-' + dday : dday === 0 ? 'D-DAY' : '종료'})`;
  press('kinds','k',prefs.kind); press('chips','a',prefs.area);
  $('t-study').setAttribute('aria-pressed', prefs.tab==='study'); $('t-list').setAttribute('aria-pressed', prefs.tab==='list');
  $('o-done').checked = prefs.showDone; $('o-shuffle').checked = prefs.shuffle;
  fetch('data/cards.json', {cache: 'no-cache'})
    .then(r => { if(!r.ok) throw new Error(r.status); return r.json(); })
    .then(list => {
      cards = list; byId = Object.fromEntries(list.map(c => [c.id, c]));
      buildQueue(); render(); a2hs();
    })
    .catch(() => { $('status').textContent = '카드를 불러오지 못했어요. 인터넷 연결을 확인하고 새로 고쳐 주세요.'; });
})();

if('serviceWorker' in navigator && location.protocol !== 'file:'){
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
