/* 약점 요약 페이지: data/weak.md를 읽어 그린다.
 * 지원 문법: # ## ### 제목, 문단, - 목록, 1. 목록(4칸 들여쓰기 하위), | 표 |, ``` 코드, **굵게**, `코드`
 * ## 제목의 첫 단어는 섹션 id (net·sec·db·sw·os·pg·gap) — 지도 앵커와 색에 쓴다.
 */
'use strict';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const AREA_IDS = ['net','sec','db','sw','os','pg'];
const KEY_OPEN = 'eipsc.v1.weakClosed';
const AREA_NAME = {net:'네트워크', sec:'보안', db:'DB', sw:'SW공학', os:'OS', pg:'프로그래밍'};
// 소단원 제목의 단어 → 지도에서 강조할 칸 이름(일부). 위에서부터 처음 맞는 것을 쓴다.
const FOCUS = {
  net: [['서브넷','서브넷'],['ARP','ARP'],['라우팅','라우팅'],['패킷교환','오류검출'],['오류검출','오류검출'],['애드혹','특수망'],['함께','OSI']],
  sec: [['공격기법','공격자'],['악성코드','공격자'],['보안프로토콜','성벽'],['소프트웨어보안','성벽'],['암호','금고'],['접근통제','성문']],
  db:  [['관계대수','관계대수'],['집계','SQL'],['DML','SQL'],['UNION','SQL'],['무결성','키·무결성'],['데이터모델링','모델링']],
  sw:  [['디자인패턴','디자인패턴'],['UML','UML'],['결합도','결합도'],['테스트','테스트']],
  os:  [['스케줄링','스케줄링'],['페이지교체','페이지 교체'],['리눅스','리눅스']],
};
const focusOf = (area, title) => ((FOCUS[area] || []).find(([k]) => title.includes(k)) || [])[1] || '';
const pathOf = title => title.replace(/\s*\(p\.[^)]*\)\s*$/, '').replace(/🔴|🟠|⚪/gu, '').replace(/\s+·\s*$/, '').replace(/\s{2,}/g, ' ').trim();

function inline(s){
  // 코드 조각을 먼저 빼 두고, 나머지에 굵게를 적용한다
  const codes = [];
  let t = esc(s).replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length-1}\u0000`; });
  t = t.replace(/\\([*~_])/g, '$1').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  t = t.replace(/🔴/g, '<span class="mk red" title="구조적 약점(3회 이상)">🔴</span>')
       .replace(/🟠/g, '<span class="mk ora" title="보강 전">🟠</span>')
       .replace(/⚪/g, '<span class="mk wht" title="보강함">⚪</span>');
  return t.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[+i]}</code>`);
}

function parse(md){
  const L = md.replace(/\r/g, '').split('\n');
  const out = { title: '', lead: [], sections: [] };
  let sec = null, sub = null, i = 0;
  const target = () => (sub ? sub.body : sec ? sec.body : out.lead);

  while(i < L.length){
    const l = L[i];
    if(/^# /.test(l)){ out.title = l.slice(2).trim(); i++; continue; }
    if(/^## /.test(l)){
      const m = l.slice(3).trim().match(/^(\S+)\s+(.*)$/);
      sec = { id: m ? m[1] : 'x', title: m ? m[2] : l.slice(3), body: [], subs: [] };
      out.sections.push(sec); sub = null; i++; continue;
    }
    if(/^### /.test(l) && sec){ sub = { title: l.slice(4).trim(), body: [] }; sec.subs.push(sub); i++; continue; }
    if(l.startsWith('```')){
      const lang = l.slice(3).trim(), buf = []; i++;
      while(i < L.length && !L[i].startsWith('```')){ buf.push(L[i]); i++; }
      i++; target().push(`<pre class="code"${lang?` data-lang="${esc(lang)}"`:''}>${esc(buf.join('\n'))}</pre>`); continue;
    }
    if(l.startsWith('|')){
      const rows = [];
      while(i < L.length && L[i].startsWith('|')){ rows.push(L[i].split('|').slice(1,-1).map(x => x.trim())); i++; }
      const body = rows.slice(1).filter(r => !r.every(x => /^:?-{3,}:?$/.test(x)));
      target().push(`<div class="tbl"><table><thead><tr>${rows[0].map(x=>`<th>${inline(x)}</th>`).join('')}</tr></thead><tbody>${
        body.map(r => `<tr>${r.map(x=>`<td>${inline(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if(/^(- |\d+\. )/.test(l)){
      const ordered = /^\d+\. /.test(l), items = [];
      while(i < L.length && (/^(- |\d+\. )/.test(L[i]) || /^ {4}(- |\d+\. )/.test(L[i]))){
        const s = L[i];
        if(/^ {4}/.test(s)){ (items[items.length-1].kids ||= []).push(s.trim().replace(/^(- |\d+\. )/, '')); }
        else items.push({ t: s.replace(/^(- |\d+\. )/, '') });
        i++;
      }
      const tag = ordered ? 'ol' : 'ul';
      target().push(`<${tag}>${items.map(it => `<li>${inline(it.t)}${it.kids ? `<ol>${it.kids.map(k=>`<li>${inline(k)}</li>`).join('')}</ol>` : ''}</li>`).join('')}</${tag}>`);
      continue;
    }
    if(l.trim()){ target().push(`<p>${inline(l)}</p>`); }
    i++;
  }
  return out;
}

function closedSet(){ try{ return new Set(JSON.parse(localStorage.getItem(KEY_OPEN) || '[]')); }catch(e){ return new Set(); } }
function saveClosed(s){ try{ localStorage.setItem(KEY_OPEN, JSON.stringify([...s])); }catch(e){} }

function render(doc){
  $('w-title').textContent = doc.title || '약점 요약';
  $('w-lead').innerHTML = doc.lead.join('');
  const closed = closedSet();
  $('w-chips').innerHTML = doc.sections.map(s =>
    `<a href="#${esc(s.id)}" style="--c:var(--${AREA_IDS.includes(s.id) ? s.id : 'muted'})">${esc(s.title.replace(/^\d+\.\s*/, '').split(' — ')[0])}</a>`).join('');
  $('w-body').innerHTML = doc.sections.map(s => {
    const area = AREA_IDS.includes(s.id);
    const subs = s.subs.map((u, k) => {
      const key = s.id + ':' + k;
      return `<details class="sub" data-key="${esc(key)}" data-area="${area ? esc(s.id) : ''}" data-focus="${esc(focusOf(s.id, u.title))}" data-path="${esc(pathOf(u.title))}"${closed.has(key) ? '' : ' open'}><summary>${inline(u.title)}</summary><div class="sub-b">${u.body.join('')}</div></details>`;
    }).join('');
    return `<section id="${esc(s.id)}" class="wsec" data-area="${area ? esc(s.id) : ''}" style="--c:var(--${area ? s.id : 'muted'})">
      <div class="whead"><h2>${esc(s.title)}</h2>${area ? `<a class="tomap" href="map.html#${esc(s.id)}">지도에서 보기 ›</a>` : ''}</div>
      ${s.body.join('')}${subs}</section>`;
  }).join('');
  $('w-body').addEventListener('toggle', e => {
    const d = e.target; if(!d.matches || !d.matches('details.sub')) return;
    const s = closedSet(); if(d.open) s.delete(d.dataset.key); else s.add(d.dataset.key); saveClosed(s);
  }, true);
  if(location.hash){ const t = document.querySelector(location.hash); if(t) t.scrollIntoView(); }
  watchPlace();
}

/* ---------- 지금 위치 + 지도 펼치기 ---------- */
let place = null;
function currentPlace(){
  const line = window.innerHeight * 0.35;
  let sec = null, sub = null;
  for(const el of document.querySelectorAll('section.wsec')){ if(el.getBoundingClientRect().top <= line) sec = el; }
  if(!sec || !sec.dataset.area) return null;
  for(const el of sec.querySelectorAll('details.sub')){ if(el.getBoundingClientRect().top <= line) sub = el; }
  return { area: sec.dataset.area, focus: sub ? sub.dataset.focus : '', path: sub ? sub.dataset.path : '' };
}
function updatePlace(){
  place = currentPlace();
  const b = $('mapfab');
  b.hidden = !place;
  if(!place) return;
  b.style.setProperty('--c', `var(--${place.area})`);
  $('mapfab-where').textContent = AREA_NAME[place.area] + (place.path ? ' › ' + place.path : '');
}
function watchPlace(){
  let tick = false;
  const on = () => { if(tick) return; tick = true; requestAnimationFrame(() => { tick = false; updatePlace(); }); };
  window.addEventListener('scroll', on, {passive: true});
  window.addEventListener('resize', on);
  document.addEventListener('toggle', on, true);
  updatePlace();
}
function openMap(){
  if(!place) return;
  const d = $('mapdlg');
  $('mapdlg-where').textContent = AREA_NAME[place.area] + (place.path ? ' › ' + place.path : '');
  $('mapdlg-full').href = `map.html#${place.area}`;
  $('mapdlg-f').src = `map.html?embed=1${place.focus ? '&focus=' + encodeURIComponent(place.focus) : ''}#${place.area}`;
  d.style.setProperty('--c', `var(--${place.area})`);
  if(d.showModal) d.showModal(); else d.setAttribute('open', '');
  document.documentElement.classList.add('noscroll');
}
function closeMap(){
  const d = $('mapdlg');
  if(d.close) d.close(); else d.removeAttribute('open');
}
$('mapfab').onclick = openMap;
$('mapdlg-x').onclick = closeMap;
$('mapdlg').addEventListener('close', () => { document.documentElement.classList.remove('noscroll'); $('mapdlg-f').src = 'about:blank'; });
$('mapdlg').addEventListener('click', e => { if(e.target === $('mapdlg')) closeMap(); });

$('w-fold').onclick = () => {
  const all = [...document.querySelectorAll('details.sub')];
  const open = all.some(d => d.open);
  all.forEach(d => d.open = !open);
  $('w-fold').textContent = open ? '모두 펼치기' : '모두 접기';
};

fetch('data/weak.md', {cache: 'no-cache'})
  .then(r => { if(!r.ok) throw new Error(r.status); return r.text(); })
  .then(t => { render(parse(t)); $('w-status').hidden = true; })
  .catch(() => { $('w-status').textContent = '요약을 불러오지 못했어요. 인터넷 연결을 확인하고 새로 고쳐 주세요.'; });

if('serviceWorker' in navigator && location.protocol !== 'file:'){
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
