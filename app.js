(function(){
var RAIZ = "/vivienda-catalunya", TEXT = "Mira aquestes dades sobre l'habitatge {a_municipi}.", LIMITS_V = "da6085e4";
var $ = function(id){ return document.getElementById(id); };
function norm(t){ return (t||'').toLowerCase().replace(/·/g,'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim(); }
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
function avisar(t){
  var a = document.querySelector('.aviso'); if (!a){ a = document.createElement('div'); a.className = 'aviso'; a.setAttribute('role','status'); document.body.appendChild(a); }
  a.textContent = t; a.classList.add('ver'); clearTimeout(a._t); a._t = setTimeout(function(){ a.classList.remove('ver'); }, 2400);
}
function msg(t, error){ var m = $('msg'); if (m){ m.textContent = t; m.className = 'msg' + (error ? ' error' : ''); } }

// ---------- la cerca (entrada)
var caixa = $('cerca');
if (caixa && window.MUNICIPIS){
  var M = window.MUNICIPIS, llista = $('suggs'), trobats = [];
  M.forEach(function(m){ m.cc = m.k.map(function(k){ return k.replace(/ /g, ''); }); });
  function nota(m, q, qc){
    var best = 9;
    for (var j = 0; j < m.k.length; j++){
      var k = m.k[j], kc = m.cc[j];
      if (k === q) best = Math.min(best, 0);
      else if (k.indexOf(q) === 0 || kc.indexOf(qc) === 0) best = Math.min(best, 1);
      else if ((' ' + k).indexOf(' ' + q) >= 0) best = Math.min(best, 2);
      else if (kc.indexOf(qc) >= 0) best = Math.min(best, 3);
    }
    return best;
  }
  function cercar(){
    var q = norm(caixa.value), qc = q.replace(/ /g, '');
    if (!q){ llista.hidden = true; caixa.setAttribute('aria-expanded', 'false'); return; }
    var r = [];
    M.forEach(function(m){ var s = nota(m, q, qc); if (s < 9) r.push([s, m]); });
    r.sort(function(a, b){ return a[0] - b[0] || b[1].h - a[1].h; });
    trobats = r.slice(0, 8).map(function(x){ return x[1]; });
    llista.innerHTML = trobats.length ? trobats.map(function(m, i){
        return '<li><a href="' + RAIZ + '/m/' + m.s + '/"' + (i ? '' : ' class="actiu"') + '>' + esc(m.n) + '<small>' + esc(m.p) + '</small></a></li>'; }).join('')
      : '<li class="cap">Cap municipi amb aquest nom. Prova d\'escriure\'l d\'una altra manera.</li>';
    llista.hidden = false; caixa.setAttribute('aria-expanded', 'true');
  }
  caixa.addEventListener('input', cercar);
  caixa.addEventListener('keydown', function(ev){
    if (ev.key === 'Enter'){ ev.preventDefault(); if (trobats.length) location.href = RAIZ + '/m/' + trobats[0].s + '/'; }
    if (ev.key === 'Escape'){ llista.hidden = true; }
  });
  document.addEventListener('click', function(ev){ if (!ev.target.closest('.camp')) llista.hidden = true; });
}

// ---------- la ubicació: el punt dins del municipi (contorns de l'ICGC) o, si no cau en cap, el més proper
function dinsAnell(x, y, a){
  var d = false;
  for (var i = 0, j = a.length - 2; i < a.length; j = i, i += 2){
    var xi = a[i], yi = a[i + 1], xj = a[j], yj = a[j + 1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) d = !d;
  }
  return d;
}
function municipiA(G, lon, lat){
  var x = lon * 1e4, y = lat * 1e4, millor = null, dist = Infinity, k = Math.cos(lat * Math.PI / 180);
  for (var i = 0; i < G.length; i++){
    var g = G[i], c = g[1];
    if (x >= c[0] && x <= c[2] && y >= c[1] && y <= c[3]){
      var dins = false;
      g[3].forEach(function(a){ if (dinsAnell(x, y, a)) dins = !dins; });
      if (dins) return g[0];
    }
    var dx = (g[2][0] - x) * k, dy = g[2][1] - y, d = dx * dx + dy * dy;
    if (d < dist){ dist = d; millor = g[0]; }
  }
  // fora de tots els contorns: el més proper, si és a menys de ~15 km (la costa, un punt a la ratlla)
  return Math.sqrt(dist) / 1e4 * 111 < 15 ? millor : null;
}
var btn = $('ubicacio');
if (btn) btn.addEventListener('click', function(){
  if (!navigator.geolocation){ msg('Aquest navegador no dona la ubicació. Cerca el municipi pel nom.', true); return; }
  btn.disabled = true; msg('Demanant la ubicació al dispositiu…');
  navigator.geolocation.getCurrentPosition(function(p){
    msg('Buscant el municipi…');
    fetch(RAIZ + '/municipis.json?v=' + LIMITS_V).then(function(r){ if (!r.ok) throw new Error(r.status); return r.json(); }).then(function(G){
      var s = municipiA(G, p.coords.longitude, p.coords.latitude);
      btn.disabled = false;
      if (!s){ msg('La teva ubicació és fora de Catalunya. Cerca el municipi pel nom.', true); return; }
      location.href = RAIZ + '/m/' + s + '/';
    }).catch(function(){ btn.disabled = false; msg('No hem pogut carregar els municipis. Revisa la connexió o cerca pel nom.', true); });
  }, function(err){
    btn.disabled = false;
    msg(err.code === 1 ? 'Has denegat la ubicació. Cerca el municipi pel nom.' : 'Ara no podem saber la ubicació. Cerca el municipi pel nom.', true);
  }, {enableHighAccuracy: false, timeout: 15000, maximumAge: 600000});
});

// ---------- enviar per WhatsApp: al mòbil, el fitxer pel compartir del dispositiu (va la imatge, no un enllaç);
// a l'ordinador o sense aquest recurs, el wa.me amb el text i l'enllaç de la previsualització /v/<slug>/
var tactil = window.matchMedia && matchMedia('(pointer:coarse)').matches;
var fitxers = tactil && (function(){ try { return !!(navigator.canShare && navigator.canShare({files:[new File([''], 'x.jpg', {type:'image/jpeg'})]})); } catch(e){ return false; } })();
// a l'Android el share de vegades no acaba quan la persona torna del WhatsApp (vist al cards.boralula.org): tornar a la pàgina el tanca
function compartir(d){
  return new Promise(function(ok, error){
    var sortit = false, fi = false;
    var acabar = function(f, x){ if (fi) return; fi = true; document.removeEventListener('visibilitychange', vis); f(x); };
    var vis = function(){ if (document.hidden) sortit = true; else if (sortit) setTimeout(function(){ acabar(ok); }, 300); };
    document.addEventListener('visibilitychange', vis);
    try { navigator.share(d).then(function(){ acabar(ok); }, function(e){ acabar(error, e); }); } catch(e){ acabar(error, e); }
  });
}
var ocupat = false;
document.addEventListener('click', function(ev){
  var b = ev.target.closest('[data-zap]');
  if (b){
    ev.preventDefault();
    var text = TEXT.replace('{a_municipi}', b.dataset.amun), link = location.origin + b.dataset.link;
    var wa = function(){ window.open('https://wa.me/?text=' + encodeURIComponent(text + '\n' + link), '_blank', 'noopener'); };
    if (!fitxers) return wa();
    if (ocupat) return;
    ocupat = true; b.disabled = true; var abans = b.innerHTML; b.lastChild.textContent = 'Preparant…';
    fetch(b.dataset.src).then(function(r){ if (!r.ok) throw new Error(r.status); return r.blob(); }).then(function(blob){
      return compartir({files: [new File([blob], b.dataset.fitxer, {type: 'image/jpeg'})], text: text});
    }).catch(function(e){ if (!e || e.name !== 'AbortError') wa(); })
      .then(function(){ ocupat = false; b.disabled = false; b.innerHTML = abans; });
    return;
  }
  var c = ev.target.closest('[data-copiar]');
  if (c){
    ev.preventDefault();
    var url = location.origin + c.dataset.copiar;
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function(){ avisar('Enllaç copiat'); },
      function(){ prompt("Copia l'enllaç:", url); });
  }
});
})();
