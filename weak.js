/* 약점 요약 페이지: data/weak.md를 읽어 그린다.
 * 지원 문법: # ## ### 제목, 문단, - 목록, 1. 목록(4칸 들여쓰기 하위), | 표 |, ``` 코드, **굵게**, `코드`
 * ## 제목의 첫 단어는 섹션 id (net·sec·db·sw·os·pg·gap) — 지도 앵커와 색에 쓴다.
 */
'use strict';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const AREA_IDS = ['net','sec','db','sw','os','pg'];
const KEY_OPEN = 'eipsc.v1.weakClosed';

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
      return `<details class="sub" data-key="${esc(key)}"${closed.has(key) ? '' : ' open'}><summary>${inline(u.title)}</summary><div class="sub-b">${u.body.join('')}</div></details>`;
    }).join('');
    return `<section id="${esc(s.id)}" class="wsec" style="--c:var(--${area ? s.id : 'muted'})">
      <div class="whead"><h2>${esc(s.title)}</h2>${area ? `<a class="tomap" href="map.html#${esc(s.id)}">지도에서 보기 ›</a>` : ''}</div>
      ${s.body.join('')}${subs}</section>`;
  }).join('');
  $('w-body').addEventListener('toggle', e => {
    const d = e.target; if(!d.matches || !d.matches('details.sub')) return;
    const s = closedSet(); if(d.open) s.delete(d.dataset.key); else s.add(d.dataset.key); saveClosed(s);
  }, true);
  if(location.hash){ const t = document.querySelector(location.hash); if(t) t.scrollIntoView(); }
}

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
