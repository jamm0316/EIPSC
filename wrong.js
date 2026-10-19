/* 오답노트: data/wrong.json(기출 PDF에서 틀린·찍은 문제)을 단원별로 보여 준다.
 * 문제 그림 → [정답 보기] → 정답·해설 그림 + 그때 내 답·메모 → [맞힘]/[또 틀림] 기록(localStorage).
 * 연속 2번 맞히면 졸업.
 */
'use strict';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const AREAS = [['sw','SW공학'],['db','DB'],['net','네트워크'],['sec','보안'],['os','OS'],['pg','프로그래밍']];
const AREA_NAME = Object.fromEntries(AREAS);
// 단원 안 순서: 지도 흐름 순. 목록에 없는 태그는 뒤로.
const ORDER = {
  sw: ['UML다이어그램','결합도','응집도','팬인/팬아웃','디자인패턴','UI/UX','정적/동적분석','테스트단계','통합테스트','블랙박스테스트','테스트커버리지','테스트케이스','회귀테스트'],
  db: ['데이터모델링','릴레이션구조','키','무결성제약','함수종속','관계대수','DML','서브쿼리','집계함수/NULL','UNION','회복기법'],
  net: ['서브넷','ARP/RARP','라우팅프로토콜','패킷교환','오류검출','HDLC','애드혹네트워크'],
  sec: ['정보보호관리체계','접근통제','OAuth','암호알고리즘','보안프로토콜','무선보안','소프트웨어보안','공격기법','악성코드'],
  os: ['스케줄링','페이지교체','RAID','리눅스명령'],
  pg: ['반복문','포인터','2차원배열','구조체','연결리스트','문자열처리','비트연산','재귀','참조전달','상속/오버라이딩','생성자호출순서','static','인터페이스','제네릭','람다','리스트','딕셔너리','문자열포맷'],
};
const KEY_LOG = 'eipsc.v1.wrongLog';
const KEY_PREFS = 'eipsc.v1.wrongPrefs';
const store = {
  get(k, fb){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; }catch(e){ return fb; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch(e){ return false; } },
};
let log = store.get(KEY_LOG, {});            // id → {ok, ng, streak}
const prefs = Object.assign({area: 'all', hide: false, unsure: true}, store.get(KEY_PREFS, {}));
let items = [];

const rxText = s => /^(대기열|넘어감)$/.test((s || '').trim()) ? '' : (s || '').trim();
const graduated = id => (log[id]?.streak || 0) >= 2;
const rank = it => { const o = ORDER[it.area] || []; const i = o.indexOf(it.tag); return i < 0 ? 999 : i; };

function visible(){
  return items.filter(it => (prefs.area === 'all' || it.area === prefs.area)
    && (prefs.unsure || it.kind !== '불안')
    && !(prefs.hide && graduated(it.id)));
}

function recLine(id){
  const r = log[id];
  if(!r) return '';
  if(graduated(id)) return `<span class="o-rec done">졸업 · 맞힘 ${r.ok}</span>`;
  return `<span class="o-rec">맞힘 ${r.ok} · 또 틀림 ${r.ng}</span>`;
}

function card(it){
  const exam = it.exam.replace('-', '년 ') + '회';
  return `<article class="ocard${graduated(it.id) ? ' grad' : ''}" id="q-${esc(it.id)}" style="--c:var(--${esc(it.area)})">
    <div class="ometa">
      <span class="tag">${esc(it.tag)}</span>
      <span class="okind ${it.kind === '틀림' ? 'x' : 'u'}">${it.kind === '틀림' ? '✕ 틀림' : '△ 찍음'}</span>
      <span class="osrc">${esc(exam)} #${it.no}</span>
      ${recLine(it.id)}
    </div>
    <div class="oimg"><img src="${esc(it.q)}" width="${it.qw}" height="${it.qh}" loading="lazy" decoding="async" alt="${esc(exam)} ${it.no}번 문제" /></div>
    <button type="button" class="oreveal" data-id="${esc(it.id)}" aria-expanded="false">정답 보기</button>
    <div class="oans" hidden>
      <div class="oimg"><img data-src="${esc(it.a)}" width="${it.aw}" height="${it.ah}" decoding="async" alt="${esc(exam)} ${it.no}번 정답과 해설" /></div>
      <dl class="onote">
        <dt>그때 내 답</dt><dd>${esc(it.mine)}</dd>
        ${it.memo ? `<dt>그때 메모</dt><dd>${esc(it.memo)}</dd>` : ''}
        ${rxText(it.rx) ? `<dt>그때 처방</dt><dd>${esc(rxText(it.rx))}</dd>` : ''}
      </dl>
      <div class="ograde">
        <button type="button" class="ok" data-id="${esc(it.id)}" data-r="ok">이번엔 맞힘</button>
        <button type="button" class="ng" data-id="${esc(it.id)}" data-r="ng">또 틀림</button>
      </div>
    </div>
  </article>`;
}

function render(){
  const all = items.filter(it => prefs.unsure || it.kind !== '불안');
  const left = all.filter(it => !graduated(it.id)).length;
  $('o-sum').textContent = `${all.length}문제 · 남음 ${left}`;

  const countOf = a => all.filter(it => (a === 'all' || it.area === a) && !graduated(it.id)).length;
  $('o-chips').innerHTML = [['all','전체'], ...AREAS].map(([a, n]) =>
    `<button type="button" data-a="${a}" aria-pressed="${prefs.area === a}" style="--c:var(--${a === 'all' ? 'ink' : a})">${n} ${countOf(a)}</button>`).join('');

  const vis = visible();
  const html = AREAS.filter(([a]) => vis.some(it => it.area === a)).map(([a, n]) => {
    const list = vis.filter(it => it.area === a).sort((x, y) => rank(x) - rank(y) || y.exam.localeCompare(x.exam) || x.no - y.no);
    return `<section class="wsec" id="${a}" style="--c:var(--${a})">
      <div class="whead"><h2>${esc(n)}</h2><a class="tomap" href="weak.html#${a}">약점 요약 ›</a></div>
      ${list.map(card).join('')}</section>`;
  }).join('');
  $('o-body').innerHTML = html || '<p class="status">남은 문제가 없어요. 전부 졸업했습니다.</p>';
  $('o-status').hidden = true;
}

function grade(id, r){
  const cur = log[id] || {ok: 0, ng: 0, streak: 0};
  if(r === 'ok'){ cur.ok++; cur.streak++; } else { cur.ng++; cur.streak = 0; }
  log[id] = cur;
  if(!store.set(KEY_LOG, log)) $('o-msg').textContent = '이 브라우저에 기록을 저장하지 못했어요.';
  const el = $('q-' + id);
  el.querySelector('.ometa .o-rec')?.remove();
  el.querySelector('.ometa').insertAdjacentHTML('beforeend', recLine(id));
  el.classList.toggle('grad', graduated(id));
  el.querySelectorAll('.ograde button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.r === r)));
  const all = items.filter(it => prefs.unsure || it.kind !== '불안');
  $('o-sum').textContent = `${all.length}문제 · 남음 ${all.filter(it => !graduated(it.id)).length}`;
}

function zoom(img){
  const d = $('zoomdlg'), z = $('zoom-img');
  z.src = img.currentSrc || img.src; z.alt = img.alt;
  if(d.showModal) d.showModal(); else d.setAttribute('open', '');
  document.documentElement.classList.add('noscroll');
}
$('zoom-x').onclick = () => { const d = $('zoomdlg'); if(d.close) d.close(); else d.removeAttribute('open'); };
$('zoomdlg').addEventListener('close', () => document.documentElement.classList.remove('noscroll'));

$('o-body').addEventListener('click', e => {
  const im = e.target.closest('.oimg img');
  if(im && im.src){ zoom(im); return; }
  const b = e.target.closest('button'); if(!b) return;
  if(b.classList.contains('oreveal')){
    const box = b.nextElementSibling, open = box.hidden;
    box.hidden = !open;
    b.setAttribute('aria-expanded', String(open));
    b.textContent = open ? '정답 접기' : '정답 보기';
    const img = box.querySelector('img[data-src]');
    if(img){ img.src = img.dataset.src; img.removeAttribute('data-src'); }
    return;
  }
  if(b.dataset.r) grade(b.dataset.id, b.dataset.r);
});
$('o-chips').addEventListener('click', e => {
  const b = e.target.closest('button[data-a]'); if(!b) return;
  prefs.area = b.dataset.a; store.set(KEY_PREFS, prefs); render();
  window.scrollTo({top: 0});
});
$('o-hide').checked = prefs.hide;
$('o-unsure').checked = prefs.unsure;
$('o-hide').onchange = e => { prefs.hide = e.target.checked; store.set(KEY_PREFS, prefs); render(); };
$('o-unsure').onchange = e => { prefs.unsure = e.target.checked; store.set(KEY_PREFS, prefs); render(); };
$('o-reset').onclick = () => {
  if($('o-reset').dataset.armed !== '1'){ $('o-reset').dataset.armed = '1'; $('o-reset').textContent = '한 번 더 누르면 지워요'; return; }
  log = {}; store.set(KEY_LOG, log); $('o-reset').dataset.armed = ''; $('o-reset').textContent = '오답노트 기록 지우기';
  $('o-msg').textContent = '기록을 지웠어요.'; render();
};
$('o-pre').onclick = async () => {
  const urls = items.flatMap(it => [it.q, it.a]);
  let n = 0;
  $('o-msg').textContent = `받는 중… 0/${urls.length}`;
  for(const u of urls){
    try{ await fetch(u); }catch(e){}
    n++; if(n % 10 === 0 || n === urls.length) $('o-msg').textContent = `받는 중… ${n}/${urls.length}`;
  }
  $('o-msg').textContent = `문제 그림 ${urls.length}장을 받아 뒀어요. 이제 인터넷 없이도 열려요.`;
};

fetch('data/wrong.json', {cache: 'no-cache'})
  .then(r => { if(!r.ok) throw new Error(r.status); return r.json(); })
  .then(d => { items = d; render(); if(location.hash){ const t = document.querySelector(location.hash); if(t) t.scrollIntoView(); } })
  .catch(() => { $('o-status').textContent = '오답노트를 불러오지 못했어요. 인터넷 연결을 확인하고 새로 고쳐 주세요.'; });

if('serviceWorker' in navigator && location.protocol !== 'file:'){
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
