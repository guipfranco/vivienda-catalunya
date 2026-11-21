(function(){
// a página /mapa/ (no molde do #mapa do cards.boralula.org)
var RAIZ = window.RAIZ, M = window.MUNICIPIOS, porS = {};
M.forEach(function(m){ porS[m.s] = m; });
var PROV = {barcelona: 'Barcelona', girona: 'Girona', lleida: 'Lleida', tarragona: 'Tarragona'};
var $ = function(id){ return document.getElementById(id); };
function norm(t){ return (t||'').toLowerCase().replace(/·/g,'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim(); }
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
function provDe(m){ return norm(m.p); }
function celular(){ return window.innerWidth < 900; }
var svg, todo, vb, foco = null, mun = null, pronto = false;

fetch(RAIZ + '/mapa.svg?v=' + window.MAPA_V).then(function(r){ return r.text(); }).then(montar);

function montar(txt){
  var lienzo = $('mp-lienzo'); lienzo.innerHTML = txt;
  svg = lienzo.querySelector('svg');
  var b = svg.viewBox.baseVal; todo = [b.x, b.y, b.width, b.height]; vb = todo.slice();
  svg.querySelectorAll('path').forEach(function(p){
    var m = porS[p.dataset.s]; if (!m) return;
    var bb = p.getBBox(); m.bb = [bb.x, bb.y, bb.width, bb.height]; m.cx = bb.x + bb.width / 2; m.cy = bb.y + bb.height / 2; m.el = p;
  });
  pronto = true;
  gestos(); ligarGaveta();
  lerHash(true);
  window.addEventListener('hashchange', function(){ lerHash(true); });
}

// ---------- a janela do mapa
function aplicar(){ svg.setAttribute('viewBox', vb.join(' ')); agendarSugestoes(); }
// no celular desconta a gaveta: a baixa (200 px) ou, com município escolhido, a do cartão (até 380 px)
function folga(){ return celular() ? {t: 128, b: mun ? Math.min(380, window.innerHeight * 0.62) + 10 : 210, l: 16, r: 60} : {t: 24, b: 24, l: 24, r: 64}; }
function caixaDe(lista){
  var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  lista.forEach(function(m){ x0 = Math.min(x0, m.bb[0]); y0 = Math.min(y0, m.bb[1]); x1 = Math.max(x1, m.bb[0] + m.bb[2]); y1 = Math.max(y1, m.bb[1] + m.bb[3]); });
  return [x0, y0, x1 - x0, y1 - y0];
}
// leva a caixa (no sistema do mapa) para a área livre da tela, descontando os controles e a gaveta
function irPara(c, animar){
  var r = svg.getBoundingClientRect(), f = folga();
  var lw = Math.max(40, r.width - f.l - f.r), lh = Math.max(40, r.height - f.t - f.b);
  var s = Math.max(c[2] / lw, c[3] / lh);
  var alvo = [c[0] + c[2] / 2 - (f.l + lw / 2) * s, c[1] + c[3] / 2 - (f.t + lh / 2) * s, r.width * s, r.height * s];
  if (!animar){ vb = alvo; aplicar(); return; }
  var de = vb.slice(), t0 = performance.now();
  (function passo(agora){
    var k = Math.min(1, (agora - t0) / 450); k = 1 - Math.pow(1 - k, 3);
    vb = de.map(function(v, i){ return v + (alvo[i] - v) * k; }); aplicar();
    if (k < 1) requestAnimationFrame(passo);
  })(t0);
}
function escala(){ var r = svg.getBoundingClientRect(); return Math.max(vb[2] / r.width, vb[3] / r.height); }
function ponto(x, y){
  var r = svg.getBoundingClientRect(), s = escala();
  return [vb[0] + (x - r.left - (r.width - vb[2] / s) / 2) * s, vb[1] + (y - r.top - (r.height - vb[3] / s) / 2) * s];
}
function zoom(f, cx, cy){
  var w = Math.min(todo[2] * 1.5, Math.max(todo[2] / 80, vb[2] * f)); f = w / vb[2];
  if (cx === undefined){ cx = vb[0] + vb[2] / 2; cy = vb[1] + vb[3] / 2; }
  vb = [cx - (cx - vb[0]) * f, cy - (cy - vb[1]) * f, vb[2] * f, vb[3] * f]; aplicar();
}
function gestos(){
  document.querySelector('.mapa-ctl').addEventListener('click', function(ev){
    var z = ev.target.closest('[data-zoom]'); if (!z) return;
    var k = +z.dataset.zoom;
    if (k === 0){ focarProv(null, true); } else zoom(k > 0 ? 0.6 : 1 / 0.6);
  });
  svg.addEventListener('wheel', function(ev){ ev.preventDefault(); var p = ponto(ev.clientX, ev.clientY); zoom(ev.deltaY < 0 ? 0.8 : 1.25, p[0], p[1]); }, {passive: false});
  var dedos = {}, movido = 0, dist = 0;
  svg.addEventListener('pointerdown', function(ev){ svg.setPointerCapture(ev.pointerId); dedos[ev.pointerId] = [ev.clientX, ev.clientY]; movido = 0; dist = 0; });
  svg.addEventListener('pointermove', function(ev){
    if (!dedos[ev.pointerId]) return;
    var antes = dedos[ev.pointerId]; dedos[ev.pointerId] = [ev.clientX, ev.clientY];
    var ids = Object.keys(dedos);
    if (ids.length === 1){
      var s = escala(), dx = ev.clientX - antes[0], dy = ev.clientY - antes[1];
      movido += Math.abs(dx) + Math.abs(dy);
      vb[0] -= dx * s; vb[1] -= dy * s; aplicar();
    } else if (ids.length === 2){
      var a = dedos[ids[0]], d = dedos[ids[1]], agora = Math.hypot(a[0] - d[0], a[1] - d[1]);
      if (dist){ var p = ponto((a[0] + d[0]) / 2, (a[1] + d[1]) / 2); zoom(dist / agora, p[0], p[1]); }
      dist = agora; movido = 99;
    }
  });
  function soltar(ev){
    var eraUm = Object.keys(dedos).length === 1;
    delete dedos[ev.pointerId]; if (Object.keys(dedos).length < 2) dist = 0;
    if (ev.type === 'pointerup' && eraUm && movido < 8){
      var alvo = document.elementFromPoint(ev.clientX, ev.clientY);
      if (alvo && alvo.tagName === 'path' && svg.contains(alvo)) focarMun(porS[alvo.dataset.s], false);
    }
  }
  svg.addEventListener('pointerup', soltar); svg.addEventListener('pointercancel', soltar);
}

// ---------- foco: província (o resto apagado) e município
function marcarHash(){ var h = (foco || '') + (mun ? '/' + mun.s : ''); history.replaceState(null, '', location.pathname + (h ? '#' + h : '')); }
function lerHash(mover){
  var h = decodeURIComponent(location.hash.slice(1)).split('/');
  var m = h[1] && porS[h[1]];
  if (m) focarMun(m, mover); else focarProv(PROV[h[0]] ? h[0] : null, mover);
}
function pintar(){
  M.forEach(function(m){ if (!m.el) return;
    m.el.classList.toggle('fuera', !!foco && provDe(m) !== foco);
    m.el.classList.toggle('sel', !!mun && m === mun);
  });
  if (mun) mun.el.parentNode.appendChild(mun.el);
}
function focarProv(pv, mover){
  if (!pronto) return;
  foco = pv && PROV[pv] ? pv : null; mun = null;
  $('mp-prov').value = foco || '';
  pintar(); marcarHash();
  if (mover){
    if (foco) irPara(caixaDe(M.filter(function(m){ return m.bb && provDe(m) === foco; })), true);
    else irPara(todo, true);
  }
  sugerir();
}
function focarMun(m, mover){
  if (!pronto || !m) return;
  foco = provDe(m); mun = m;
  $('mp-prov').value = foco;
  pintar(); marcarHash(); listarMun(m);
  if (mover){
    var lado = Math.max(m.bb[2], m.bb[3], todo[2] / 10) * 2.2;
    irPara([m.cx - lado / 2, m.cy - lado / 2, lado, lado], true);
  }
  gaveta(false);
}
$('mp-prov').addEventListener('change', function(){ focarProv(this.value || null, true); });

// ---------- a lista: sem município, os mais populosos da área que está na tela; com município, o cartão dele
function cartao(m){
  var img = m.i ? '<img src="' + RAIZ + '/mini/' + m.s + '_' + m.i[0] + '.webp?v=' + window.LOTE_V + '" alt="" loading="lazy" width="48" height="60">' : '<i></i>';
  return '<button type="button" class="mp-cartao" data-s="' + m.s + '">' + img + '<span><b>' + esc(m.n) + '</b><small>' + esc(m.p) + '</small></span></button>';
}
var espera = null;
function agendarSugestoes(){ if (mun) return; clearTimeout(espera); espera = setTimeout(sugerir, 180); }
function sugerir(){
  if (!pronto || mun) return;
  var na = function(m){ return m.bb && m.cx >= vb[0] && m.cx <= vb[0] + vb[2] && m.cy >= vb[1] && m.cy <= vb[1] + vb[3]; };
  var itens = M.filter(function(m){ return (!foco || provDe(m) === foco) && na(m); }).sort(function(a, b){ return b.h - a.h; }).slice(0, 12);
  $('mp-sug-caja').classList.remove('mp-mun');
  $('mp-salir').hidden = true;
  $('mp-sug-tit').textContent = !itens.length ? 'Ningún municipio en esta zona'
    : foco ? 'Los más poblados de ' + PROV[foco] : vb[2] < todo[2] * 0.85 ? 'Los más poblados en esta zona' : 'Los más poblados';
  var lista = $('mp-sug');
  lista.innerHTML = itens.map(cartao).join('');
  lista.scrollLeft = 0; lista.scrollTop = 0;
}
function listarMun(m){
  $('mp-sug-caja').classList.add('mp-mun');
  $('mp-salir').hidden = false;
  $('mp-sug-tit').innerHTML = esc(m.n) + '<small>' + esc(m.p) + '</small>';
  var miniaturas = m.i.split('').map(function(L){
    return '<a class="mp-mini" href="' + RAIZ + '/m/' + m.s + '/"><img src="' + RAIZ + '/mini/' + m.s + '_' + L + '.webp?v=' + window.LOTE_V + '" alt="" width="120" height="150"></a>'; }).join('');
  $('mp-sug').innerHTML = '<div class="mp-ficha"><div class="mp-minis">' + miniaturas + '</div>'
    + '<a class="boton bajar mp-ir" href="' + RAIZ + '/m/' + m.s + '/">' + (m.i ? 'Ver los carteles' : 'Abrir') + ' ›</a></div>';
}
$('mp-sug').addEventListener('click', function(ev){ var b = ev.target.closest('button[data-s]'); if (b) focarMun(porS[b.dataset.s], true); });
$('mp-salir').addEventListener('click', function(){ focarProv(foco, false); });

// ---------- minha localização: o ponto vira coordenada do mapa (a mesma projeção do mapa.svg) e abre o município dele
function avisar(txt){
  var a = document.querySelector('.aviso'); if (!a){ a = document.createElement('div'); a.className = 'aviso'; a.setAttribute('role', 'status'); document.body.appendChild(a); }
  a.textContent = txt; a.classList.add('ver'); clearTimeout(a._t); a._t = setTimeout(function(){ a.classList.remove('ver'); }, 3200);
}
function municipioEm(lon, lat){
  var d = svg.dataset, x = (lon - +d.x0) * +d.cos * +d.k, y = (+d.y1 - lat) * +d.k;
  var pt = svg.createSVGPoint(); pt.x = x; pt.y = y;
  for (var i = 0; i < M.length; i++){
    var m = M[i]; if (!m.bb) continue;
    if (x < m.bb[0] || y < m.bb[1] || x > m.bb[0] + m.bb[2] || y > m.bb[1] + m.bb[3]) continue;
    if (m.el.isPointInFill(pt)) return m;
  }
  return null;
}
$('mp-loc').addEventListener('click', function(){
  var b = this;
  if (!navigator.geolocation){ avisar('Tu navegador no permite usar la ubicación.'); return; }
  b.classList.add('buscando');
  navigator.geolocation.getCurrentPosition(function(pos){
    b.classList.remove('buscando');
    if (!pronto) return;
    var m = municipioEm(pos.coords.longitude, pos.coords.latitude);
    if (m) focarMun(m, true); else avisar('Tu ubicación está fuera de Catalunya. Busca tu municipio por el nombre.');
  }, function(){
    b.classList.remove('buscando');
    avisar('No pudimos usar tu ubicación. Busca tu municipio por el nombre.');
  }, {enableHighAccuracy: false, timeout: 12000, maximumAge: 600000});
});

// ---------- busca
var q = $('mp-q'), res = $('mp-res'), achados = [];
function nota(m, qq, qc){
  var best = 9;
  m.k.forEach(function(k){ var kc = k.replace(/ /g, '');
    if (k === qq) best = Math.min(best, 0);
    else if (k.indexOf(qq) === 0 || kc.indexOf(qc) === 0) best = Math.min(best, 1);
    else if ((' ' + k).indexOf(' ' + qq) >= 0) best = Math.min(best, 2);
    else if (kc.indexOf(qc) >= 0) best = Math.min(best, 3); });
  return best;
}
q.addEventListener('input', function(){
  var qq = norm(q.value), qc = qq.replace(/ /g, '');
  if (!qq){ res.hidden = true; return; }
  var r = [];
  M.forEach(function(m){ var s = nota(m, qq, qc); if (s < 9) r.push([s, m]); });
  r.sort(function(a, b){ return a[0] - b[0] || b[1].h - a[1].h; });
  achados = r.slice(0, 8).map(function(x){ return x[1]; });
  res.innerHTML = achados.length ? achados.map(function(m, i){ return '<li role="option" data-i="' + i + '">' + esc(m.n) + '<small>' + esc(m.p) + '</small></li>'; }).join('')
    : '<li class="mp-nada">Ningún municipio con ese nombre</li>';
  res.hidden = false;
});
function escolher(m){ res.hidden = true; q.value = ''; q.blur(); focarMun(m, true); }
res.addEventListener('click', function(ev){ var li = ev.target.closest('li[data-i]'); if (li) escolher(achados[+li.dataset.i]); });
q.addEventListener('keydown', function(ev){ if (ev.key === 'Enter' && achados.length && !res.hidden){ ev.preventDefault(); escolher(achados[0]); } });
document.addEventListener('click', function(ev){ if (!ev.target.closest('.mp-busca')) res.hidden = true; });

// ---------- gaveta (celular): baixa mostra o título e o começo da lista; alta, a lista quase toda. Vai com o dedo pela
// alça e pelo título; ao soltar fica na altura mais perto (ou na do lado para onde o dedo ia rápido); toque alterna
function gaveta(alta){ $('mp-sug-caja').classList.toggle('mp-alta', !!alta); $('mp-sug-caja').style.height = ''; }
function ligarGaveta(){
  var caja = $('mp-sug-caja'), y0 = 0, h0 = 0, t0 = 0, ativo = false, mexeu = 0;
  function inicio(ev){ if (!celular()) return; ativo = true; mexeu = 0; y0 = ev.clientY; t0 = performance.now(); h0 = caja.getBoundingClientRect().height; caja.classList.add('mp-arrasto'); ev.target.setPointerCapture && ev.target.setPointerCapture(ev.pointerId); }
  function mover(ev){ if (!ativo) return; var dy = y0 - ev.clientY; mexeu = Math.max(mexeu, Math.abs(dy)); caja.style.height = Math.max(120, Math.min(window.innerHeight * 0.85, h0 + dy)) + 'px'; }
  function fim(ev){
    if (!ativo) return; ativo = false; caja.classList.remove('mp-arrasto');
    if (mexeu < 6){ gaveta(!caja.classList.contains('mp-alta')); return; }
    var dy = y0 - ev.clientY, v = dy / Math.max(1, performance.now() - t0), h = caja.getBoundingClientRect().height;
    gaveta(Math.abs(v) > 0.5 ? v > 0 : h > window.innerHeight * 0.45);
  }
  [ $('mp-alca'), document.querySelector('.mp-sug-cab') ].forEach(function(el){
    el.addEventListener('pointerdown', function(ev){ if (ev.target.closest('#mp-salir')) return; inicio(ev); });
    el.addEventListener('pointermove', mover); el.addEventListener('pointerup', fim); el.addEventListener('pointercancel', fim);
  });
}
})();
