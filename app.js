(function(){
var TEXTO = window.TEXTO_WHATSAPP||"Mira estos datos sobre la vivienda en {municipio}.", RAIZ = "/vivienda-catalunya";
// buscar
function norm(t){ return (t||'').toLowerCase().replace(/·/g,'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim(); }
var caja = document.getElementById('buscar');
if (caja && window.MUNICIPIOS){
  var M = window.MUNICIPIOS, lista = document.getElementById('resultados'), vacio = document.getElementById('vacio');
  var titulo = document.getElementById('titulo-lista');
  M.forEach(function(m){ m.cc = m.k.map(function(k){ return k.replace(/ /g,''); }); });
  function fila(m){
    var n = m.i.length, etq = n ? '<span class="etq si">' + n + (n > 1 ? ' carteles' : ' cartel') + '</span>' : '<span class="etq no">En preparación</span>';
    return '<li><a href="' + RAIZ + '/m/' + m.s + '/"><span><span class="n t">' + esc(m.n) + '</span><span class="p">' + esc(m.p) + '</span></span>' + etq + '</a></li>';
  }
  function esc(s){ return s.replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
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
  function inicial(){
    var con = M.filter(function(m){ return m.i.length; });
    var base = (con.length ? con : M.slice()).sort(function(a, b){ return b.h - a.h; }).slice(0, 12);
    titulo.textContent = con.length === M.length ? 'Los más poblados' : con.length ? 'Ya disponibles' : 'Municipios';
    titulo.parentNode.hidden = false; vacio.hidden = true;
    lista.innerHTML = base.map(fila).join('');
  }
  function buscar(){
    var q = norm(caja.value), qc = q.replace(/ /g,'');
    if (!q){ inicial(); return; }
    titulo.parentNode.hidden = true;
    var r = [];
    M.forEach(function(m){ var s = nota(m, q, qc); if (s < 9) r.push([s, m]); });
    r.sort(function(a, b){ return a[0] - b[0] || b[1].h - a[1].h; });
    lista.innerHTML = r.slice(0, 30).map(function(x){ return fila(x[1]); }).join('');
    vacio.hidden = r.length > 0;
  }
  caja.addEventListener('input', buscar);
  caja.closest('form').addEventListener('submit', function(ev){
    ev.preventDefault();
    var a = lista.querySelector('a'); if (a) location.href = a.getAttribute('href');
  });
  buscar();
}
// avisos
function avisar(t){
  var a = document.querySelector('.aviso'); if (!a){ a = document.createElement('div'); a.className = 'aviso'; a.setAttribute('role','status'); document.body.appendChild(a); }
  a.textContent = t; a.classList.add('ver'); clearTimeout(a._t); a._t = setTimeout(function(){ a.classList.remove('ver'); }, 2200);
}
// mandar por WhatsApp: no celular, o arquivo pelo compartilhar do aparelho (vai a imagem, não um link);
// no computador ou sem esse recurso, o wa.me com o texto e o link da prévia /v/<slug>/
var tactil = window.matchMedia && matchMedia('(pointer:coarse)').matches;
var archivos = tactil && (function(){ try { return !!(navigator.canShare && navigator.canShare({files:[new File([''], 'x.jpg', {type:'image/jpeg'})]})); } catch(e){ return false; } })();
// no Android o share às vezes não termina quando a pessoa volta do WhatsApp (visto no cards.boralula.org): voltar à página encerra
function compartir(d){
  return new Promise(function(ok, erro){
    var salio = false, fin = false;
    var acabar = function(f, x){ if (fin) return; fin = true; document.removeEventListener('visibilitychange', vis); f(x); };
    var vis = function(){ if (document.hidden) salio = true; else if (salio) setTimeout(function(){ acabar(ok); }, 300); };
    document.addEventListener('visibilitychange', vis);
    try { navigator.share(d).then(function(){ acabar(ok); }, function(e){ acabar(erro, e); }); } catch(e){ acabar(erro, e); }
  });
}
var ocupado = false;
document.addEventListener('click', function(ev){
  var b = ev.target.closest('[data-zap]');
  if (b){
    ev.preventDefault();
    var texto = TEXTO.replace('{municipio}', b.dataset.muni), link = location.origin + b.dataset.link;
    var wa = function(){ window.open('https://wa.me/?text=' + encodeURIComponent(texto + '\n' + link), '_blank', 'noopener'); };
    if (!archivos) return wa();
    if (ocupado) return;
    ocupado = true; b.disabled = true; var antes = b.innerHTML; b.lastChild.textContent = 'Preparando…';
    fetch(b.dataset.src).then(function(r){ if (!r.ok) throw new Error(r.status); return r.blob(); }).then(function(blob){
      return compartir({files: [new File([blob], b.dataset.archivo, {type: 'image/jpeg'})], text: texto});
    }).catch(function(e){ if (!e || e.name !== 'AbortError') wa(); })
      .then(function(){ ocupado = false; b.disabled = false; b.innerHTML = antes; });
    return;
  }
  var c = ev.target.closest('[data-copiar]');
  if (c){
    ev.preventDefault();
    var url = location.origin + c.dataset.copiar;
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function(){ avisar('Enlace copiado'); },
      function(){ prompt('Copia el enlace:', url); });
  }
});
})();
