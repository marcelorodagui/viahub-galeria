(() => {
  const datos = Object.assign({ reels: [], motion: [], afiches: [], marcas: [], sitio: {} }, window.GALERIA);
  const $ = id => document.getElementById(id);
  const estado = { tipo: 'todo', cliente: '' };

  const reels = datos.reels.map(r => ({ ...r, tipo: 'reel' }));
  const motion = datos.motion.map(m => ({ ...m, tipo: 'motion' }));
  const afiches = datos.afiches.map(a => ({ ...a, tipo: 'afiche' }));
  const marcas = datos.marcas;
  const piezas = [...reels, ...motion, ...afiches];
  const marcaDe = clave => marcas.find(m => m.clave === clave);
  const nombreDe = clave => marcaDe(clave)?.nombre ?? clave;
  const clientes = [...new Set([...piezas.map(p => p.cliente), ...marcas.map(m => m.clave)].filter(Boolean))]
    .sort((a, b) => nombreDe(a).localeCompare(nombreDe(b), 'es'));

  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const tactil = matchMedia('(hover: none)').matches;

  const ICONOS = {
    play: '<svg viewBox="0 0 10 12" aria-hidden="true"><path d="M0 0l10 6-10 6z"/></svg>',
    laminas: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="1" width="11" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M1.8 4.5v8.2c0 .8.7 1.5 1.5 1.5h8.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.4" cy="6.6" r="1.3" fill="currentColor"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.8v3h2.6V21z"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.6 3c.4 2.2 1.8 3.6 4 3.8v3.1c-1.5 0-2.8-.4-4-1.2v6.1c0 3.4-2.6 5.7-5.7 5.7a5.6 5.6 0 0 1-.8-11.2v3.2a2.5 2.5 0 1 0 1.7 2.4V3z"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M4 20l1.3-4A8 8 0 1 1 8 18.8z"/><path fill="currentColor" d="M9.2 8.3c.2-.4.5-.4.8-.4h.4c.2 0 .4 0 .5.4l.6 1.4c0 .2 0 .4-.1.5l-.5.6c.6 1.1 1.5 2 2.6 2.6l.6-.5c.1-.2.3-.2.5-.1l1.4.6c.3.1.4.3.4.5v.4c0 .3-.1.6-.4.8-.5.4-1.2.5-1.8.3-2.3-.7-4.1-2.5-4.8-4.8-.2-.6-.1-1.3.3-1.8z"/></svg>',
    web: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    correo: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 7l8 6 8-6" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  };

  function enlacesRedes(redes = [], clase = '') {
    return redes.map(r => `<a class="red ${clase}" href="${esc(r.url)}" target="_blank" rel="noopener" aria-label="${esc(r.red)}: ${esc(r.texto)}">${ICONOS[r.red] ?? ICONOS.web}<span>${esc(r.texto)}</span></a>`).join('');
  }

  // ---------- Encabezado y pie ----------
  if (datos.sitio.lema) { $('eslogan').textContent = datos.sitio.lema; $('esloganPie').textContent = datos.sitio.lema; }
  $('redesVia').innerHTML = enlacesRedes(datos.sitio.redes);
  $('redesPie').innerHTML = enlacesRedes(datos.sitio.redes);

  // ---------- Filtros ----------
  function chip(texto, cuenta, activo, alPulsar, clase = '') {
    const b = document.createElement('button');
    b.className = `chip ${clase}`;
    b.type = 'button';
    b.setAttribute('aria-pressed', activo);
    b.innerHTML = `${esc(texto)}${cuenta != null ? `<small>${cuenta}</small>` : ''}`;
    b.addEventListener('click', alPulsar);
    return b;
  }

  const delCliente = p => !estado.cliente || p.cliente === estado.cliente;

  function pintarFiltros() {
    const n = lista => lista.filter(delCliente).length;
    const nMarcas = marcas.filter(m => !estado.cliente || m.clave === estado.cliente).length;
    const nR = n(reels), nM = n(motion), nA = n(afiches);
    const tipos = [
      ['todo', 'Todo', nMarcas + nR + nM + nA],
      ['marca', 'Marcas', nMarcas],
      ['reel', 'Reels', nR],
      ['motion', 'Motion graphics', nM],
      ['afiche', 'Afiches', nA],
    ].filter(([t]) => t === 'todo' || (t === 'marca' ? marcas.length : piezas.some(p => p.tipo === t)));
    $('filtrosTipo').replaceChildren(...tipos.map(([t, txt, c]) => chip(txt, c, estado.tipo === t, () => cambiar({ tipo: t }))));
    if (clientes.length > 1) {
      $('filtrosCliente').replaceChildren(
        chip('Todas las marcas', null, !estado.cliente, () => cambiar({ cliente: '' }), 'cliente'),
        ...clientes.map(c => chip(nombreDe(c), null, estado.cliente === c, () => cambiar({ cliente: c }), 'cliente')),
      );
    }
  }

  // ---------- Tarjetas ----------
  function tarjetaReel(r, i, alAbrir) {
    const b = document.createElement('button');
    b.className = 'pieza';
    b.type = 'button';
    b.style.animationDelay = `${Math.min(i, 12) * 50}ms`;
    b.setAttribute('aria-label', `Ver ${r.tipo === 'motion' ? 'motion graphic' : 'reel'}: ${r.titulo}`);
    b.dataset.w = r.w; b.dataset.h = r.h;
    b.innerHTML = `
      <img src="${r.portada}" alt="" loading="lazy" width="${r.w}" height="${r.h}">
      <span class="duracion">${r.dur ? mmss(r.dur) : ''}</span>
      <span class="insignia">${ICONOS.play}</span>
      <span class="capa"><span class="marca-etq">${esc(nombreDe(r.cliente))}</span><span class="nombre">${esc(r.titulo)}</span></span>`;
    if (!tactil) {
      let v;
      b.addEventListener('mouseenter', () => {
        if (!v) {
          v = document.createElement('video');
          Object.assign(v, { src: r.video, muted: true, loop: true, playsInline: true, preload: 'auto' });
          b.insertBefore(v, b.children[1]);
        }
        v.play().then(() => b.classList.add('reproduciendo')).catch(() => {});
      });
      b.addEventListener('mouseleave', () => { b.classList.remove('reproduciendo'); v?.pause(); });
    }
    b.addEventListener('click', alAbrir);
    return b;
  }

  function tarjetaImagen(a, i, alAbrir) {
    const b = document.createElement('button');
    b.className = 'pieza';
    b.type = 'button';
    b.style.animationDelay = `${Math.min(i, 12) * 50}ms`;
    b.setAttribute('aria-label', `Ver ${a.laminas ? 'carrusel' : 'afiche'}: ${a.titulo}`);
    b.dataset.w = a.w; b.dataset.h = a.h;
    b.innerHTML = `
      <img src="${a.mini}" alt="${esc(a.titulo)}" loading="lazy" width="${a.w}" height="${a.h}" style="aspect-ratio:${a.w}/${a.h}">
      ${a.laminas ? `<span class="insignia laminas">${ICONOS.laminas}${a.laminas.length}</span>` : ''}
      <span class="capa"><span class="marca-etq">${esc(nombreDe(a.cliente))}</span><span class="nombre">${esc(a.titulo)}</span></span>`;
    b.addEventListener('click', alAbrir);
    return b;
  }

  function contarPiezas(clave) {
    const n = t => piezas.filter(p => p.cliente === clave && p.tipo === t).length;
    return [[n('reel'), 'reel', 'reels'], [n('motion'), 'motion graphic', 'motion graphics'], [n('afiche'), 'afiche', 'afiches']]
      .filter(([c]) => c).map(([c, uno, varios]) => `${c} ${c === 1 ? uno : varios}`);
  }

  function tarjetaMarca(m, i) {
    const art = document.createElement('article');
    art.className = 'marca';
    art.style.animationDelay = `${Math.min(i, 12) * 60}ms`;
    const portada = m.portada;
    const fondo = portada?.oscuro ? m.fondos.oscuro : m.fondos.claro;
    const meta = [m.identidad ? 'Identidad de marca' : 'Contenido para redes', ...contarPiezas(m.clave)].join(' · ');
    const ig = m.redes.find(r => r.red === 'instagram');
    art.innerHTML = `
      <div class="marca-portada" style="background:${esc(fondo)}">${portada ? `<img src="${portada.mini}" alt="" loading="lazy">` : ''}</div>
      <div class="marca-info">
        <h3>${esc(m.nombre)}</h3>
        ${m.descripcion ? `<p>${esc(m.descripcion)}</p>` : ''}
        <p class="marca-meta">${esc(meta)}</p>
        ${m.colores.length ? `<div class="mini-paleta" aria-hidden="true">${m.colores.slice(0, 6).map(c => `<span style="background:${c.hex}"></span>`).join('')}</div>` : ''}
      </div>
      <button class="marca-abrir" type="button" aria-label="Ver el caso de ${esc(m.nombre)}"></button>
      ${ig ? enlacesRedes([ig], 'marca-red') : ''}`;
    art.querySelector('.marca-abrir').addEventListener('click', () => abrirCaso(m));
    return art;
  }

  // ---------- Página ----------
  function pintar() {
    const ver = t => estado.tipo === 'todo' || estado.tipo === t;
    const vMarcas = ver('marca') ? marcas.filter(m => !estado.cliente || m.clave === estado.cliente) : [];
    const vR = ver('reel') ? reels.filter(delCliente) : [];
    const vM = ver('motion') ? motion.filter(delCliente) : [];
    const vA = ver('afiche') ? afiches.filter(delCliente) : [];
    const lista = [...vR, ...vM, ...vA];

    $('marcas').replaceChildren(...vMarcas.map(tarjetaMarca));
    const llenar = (id, grupo, tarjeta, desde) => $(id).replaceChildren(
      ...grupo.map((p, i) => tarjeta(p, i, () => abrirVisor(lista, desde + i))));
    llenar('reels', vR, tarjetaReel, 0);
    llenar('motion', vM, tarjetaReel, vR.length);
    llenar('afiches', vA, tarjetaImagen, vR.length + vM.length);

    for (const [sec, cuenta, n] of [['seccionMarcas', 'cuentaMarcas', vMarcas.length], ['seccionReels', 'cuentaReels', vR.length],
      ['seccionMotion', 'cuentaMotion', vM.length], ['seccionAfiches', 'cuentaAfiches', vA.length]]) {
      $(sec).hidden = !n; $(cuenta).textContent = n;
    }
    $('vacio').hidden = vMarcas.length + lista.length > 0;
    pintarFiltros();
    acomodarMosaicos();
  }

  function cambiar(cambios) {
    Object.assign(estado, cambios);
    pintar();
  }

  // Mosaico: cada imagen ocupa las filas de 2px que correspondan a su proporción + el hueco.
  function acomodarMosaicos() {
    document.querySelectorAll('.rejilla-afiches').forEach(cont => {
      const hueco = parseFloat(getComputedStyle(cont).getPropertyValue('--hueco')) || 16;
      cont.querySelectorAll(':scope > .pieza').forEach(el => {
        const alto = el.getBoundingClientRect().width * el.dataset.h / el.dataset.w;
        if (alto) el.style.gridRowEnd = `span ${Math.ceil((alto + hueco) / 2)}`;
      });
    });
  }
  const observador = new ResizeObserver(() => acomodarMosaicos());
  observador.observe(document.body);

  // ---------- Bloqueo de scroll (caso y visor pueden estar abiertos a la vez) ----------
  let bloqueos = 0;
  const bloquear = () => { if (bloqueos++ === 0) document.body.style.overflow = 'hidden'; };
  const desbloquear = () => { if (--bloqueos <= 0) { bloqueos = 0; document.body.style.overflow = ''; } };

  // ---------- Caso de marca ----------
  const caso = $('caso');
  let casoActual = null;
  let enfoqueCaso = null;
  const fuentesCargadas = new Set();

  function cargarFuente(nombre) {
    if (!nombre || fuentesCargadas.has(nombre)) return;
    fuentesCargadas.add(nombre);
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(nombre)}:wght@300;400;500;700&display=swap`;
    document.head.appendChild(l);
  }

  function abrirCaso(m, { desdeHash = false } = {}) {
    casoActual = m;
    if (caso.hidden) { enfoqueCaso = document.activeElement; bloquear(); }
    caso.hidden = false;
    caso.style.setProperty('--claro', m.fondos.claro);
    caso.style.setProperty('--oscuro', m.fondos.oscuro);
    cargarFuente(m.tipografia);
    const cont = $('casoContenido');
    const portada = m.portada;
    const imagenesProceso = m.pasos.flatMap(p => p.piezas.map(x => ({ ...x, cliente: m.clave, titulo: `${p.titulo} · ${x.titulo}` })));
    const propias = piezas.filter(p => p.cliente === m.clave);
    const dominio = m.redes.find(r => r.red === 'web')?.texto ?? '';
    let n = 0;
    const pasos = [
      // Los pasos "Sitio web…" se muestran dentro de un marco de navegador
      ...m.pasos.map(p => ({ titulo: p.titulo, html: `<div class="paso-piezas ${/^sitio/i.test(p.titulo) ? 'sitio' : ''}">${p.piezas.map(x =>
        `<button type="button" class="paso-pieza" data-i="${n++}" ${/^sitio/i.test(p.titulo) ? `data-url="${esc(dominio ? `${dominio} · ${x.titulo}` : x.titulo)}" style="max-width:${x.w}px"` : `style="aspect-ratio:${x.w}/${x.h}"`} aria-label="Ampliar ${esc(x.titulo)}">
           <img src="${x.mini}" alt="${esc(x.titulo)}" loading="lazy"><span>${esc(x.titulo)}</span></button>`).join('')}</div>` })),
      ...(m.colores.length ? [{ titulo: 'Colores', html: `<div class="paleta">${m.colores.map(c =>
        `<button type="button" class="color" data-hex="${c.hex}" aria-label="Copiar ${esc(c.nombre)} ${c.hex}">
           <span class="color-muestra" style="background:${c.hex}"></span><strong>${esc(c.nombre)}</strong><code>${c.hex}</code></button>`).join('')}</div>` }] : []),
      ...(m.tipografia ? [{ titulo: 'Tipografía', html: `
        <div class="tipografia" style="font-family:'${esc(m.tipografia)}', var(--letra)">
          <p class="tipo-muestra">Aa</p>
          <div><p class="tipo-nombre">${esc(m.tipografia)}</p>
          <p class="tipo-pesos"><span style="font-weight:300">Ligera</span><span style="font-weight:400">Regular</span><span style="font-weight:500">Media</span><span style="font-weight:700">Negrita</span></p>
          <p class="tipo-abc">ABCDEFGHIJKLMNÑOPQRSTUVWXYZ<br>abcdefghijklmnñopqrstuvwxyz 0123456789</p>
          ${m.lema ? `<p class="tipo-frase">${esc(m.lema)}</p>` : ''}</div>
        </div>` }] : []),
    ];
    cont.innerHTML = `
      <header class="caso-hero" style="background:${esc(portada?.oscuro ? m.fondos.oscuro : m.fondos.claro)}">
        ${portada ? `<img src="${portada.imagen}" alt="${esc(m.nombre)}">` : ''}
      </header>
      <div class="caso-cuerpo">
        <p class="caso-etiqueta">${m.identidad ? 'Identidad de marca' : 'Contenido para redes'} · Vía Hub Studio</p>
        <h2 id="casoNombre">${esc(m.nombre)}</h2>
        ${m.lema ? `<p class="caso-lema">“${esc(m.lema)}”</p>` : ''}
        ${m.descripcion ? `<p class="caso-desc">${esc(m.descripcion)}</p>` : ''}
        <div class="caso-acciones">
          ${enlacesRedes(m.redes, 'boton')}
          ${propias.length ? `<button type="button" class="boton secundario" id="casoVerPiezas">${propias.length === 1 ? 'Ver su pieza' : `Ver sus ${propias.length} piezas`}</button>` : ''}
        </div>
        ${m.concepto ? `<section class="caso-bloque concepto"><h3>Concepto</h3><p>${esc(m.concepto)}</p></section>` : ''}
        ${pasos.length ? `<section class="caso-bloque"><h3>Proceso de identidad</h3><ol class="pasos">${pasos.map((p, i) => `
          <li class="paso"><div class="paso-cabeza"><span class="paso-num">${String(i + 1).padStart(2, '0')}</span><h4>${esc(p.titulo)}</h4></div>${p.html}</li>`).join('')}
        </ol></section>` : ''}
        ${propias.length ? `<section class="caso-bloque"><h3>Aplicaciones en redes</h3><div class="rejilla-afiches caso-piezas" id="casoPiezas"></div></section>` : ''}
      </div>`;

    cont.querySelectorAll('.paso-pieza').forEach(b => b.addEventListener('click', () => abrirVisor(imagenesProceso, Number(b.dataset.i))));
    cont.querySelectorAll('.color').forEach(b => b.addEventListener('click', () => copiar(b.dataset.hex)));
    $('casoVerPiezas')?.addEventListener('click', () => { cerrarCaso(); cambiar({ cliente: m.clave, tipo: 'todo' }); $('seccionReels').scrollIntoView({ behavior: 'smooth' }); });
    if (propias.length) {
      $('casoPiezas').replaceChildren(...propias.map((p, i) =>
        (p.video ? tarjetaReel : tarjetaImagen)(p, i, () => abrirVisor(propias, i))));
      requestAnimationFrame(acomodarMosaicos);
    }
    caso.scrollTop = 0;
    if (!desdeHash) history.replaceState(null, '', `#marca/${m.slug}`);
    $('casoCerrar').focus();
  }

  function cerrarCaso() {
    if (caso.hidden) return;
    caso.hidden = true;
    casoActual = null;
    desbloquear();
    history.replaceState(null, '', location.pathname + location.search);
    enfoqueCaso?.focus();
  }

  $('casoCerrar').addEventListener('click', cerrarCaso);
  caso.addEventListener('click', e => { if (e.target === caso) cerrarCaso(); });

  function desdeHash() {
    const m = location.hash.match(/^#marca\/(.+)$/);
    const marca = m && marcas.find(x => x.slug === decodeURIComponent(m[1]));
    if (marca) abrirCaso(marca, { desdeHash: true });
  }
  window.addEventListener('hashchange', desdeHash);

  let temporizador;
  async function copiar(texto) {
    try { await navigator.clipboard.writeText(texto); avisar(`Copiado ${texto}`); }
    catch { avisar(texto); }
  }
  function avisar(texto) {
    const a = $('aviso');
    a.textContent = texto; a.classList.add('visible');
    clearTimeout(temporizador);
    temporizador = setTimeout(() => a.classList.remove('visible'), 1600);
  }

  // ---------- Visor ----------
  const visor = $('visor');
  let listaVisor = [];
  let actual = -1;
  let enfoqueVisor = null;

  function mostrar(i) {
    actual = (i + listaVisor.length) % listaVisor.length;
    const p = listaVisor[actual];
    const medio = $('visorMedio');
    medio.querySelector('video')?.pause();
    if (p.video) {
      const v = document.createElement('video');
      Object.assign(v, { src: p.video, poster: p.portada, controls: true, autoplay: true, playsInline: true, loop: true });
      medio.replaceChildren(v);
    } else if (p.laminas) {
      medio.replaceChildren(carrusel(p));
    } else {
      const img = new Image();
      img.src = p.imagen; img.alt = p.titulo;
      medio.replaceChildren(img);
    }
    $('visorPie').innerHTML = `${p.cliente ? `<span>${esc(nombreDe(p.cliente))}</span>` : ''}${esc(p.titulo)}`;
    $('visorAnt').hidden = $('visorSig').hidden = listaVisor.length < 2;
  }

  function carrusel(p) {
    const caja = document.createElement('div');
    caja.className = 'carrusel';
    caja.innerHTML = `
      <div class="pista">${p.laminas.map((l, i) => `<img src="${l.imagen}" alt="${esc(p.titulo)} · ${i + 1} de ${p.laminas.length}" ${i ? 'loading="lazy"' : ''}>`).join('')}</div>
      <div class="carrusel-nav">
        <button type="button" class="carrusel-btn" data-d="-1" aria-label="Lámina anterior">‹</button>
        <div class="puntos">${p.laminas.map((_, i) => `<span class="${i ? '' : 'activo'}"></span>`).join('')}</div>
        <button type="button" class="carrusel-btn" data-d="1" aria-label="Lámina siguiente">›</button>
      </div>`;
    const pista = caja.querySelector('.pista');
    const puntos = [...caja.querySelectorAll('.puntos span')];
    const indice = () => Math.round(pista.scrollLeft / pista.clientWidth);
    pista.addEventListener('scroll', () => puntos.forEach((s, i) => s.classList.toggle('activo', i === indice())), { passive: true });
    caja.querySelectorAll('.carrusel-btn').forEach(b => b.addEventListener('click', () =>
      pista.scrollTo({ left: (indice() + Number(b.dataset.d)) * pista.clientWidth, behavior: 'smooth' })));
    return caja;
  }

  function abrirVisor(lista, i) {
    listaVisor = lista;
    if (visor.hidden) { enfoqueVisor = document.activeElement; bloquear(); }
    visor.hidden = false;
    mostrar(i);
    $('visorCerrar').focus();
  }

  function cerrarVisor() {
    if (visor.hidden) return;
    $('visorMedio').querySelector('video')?.pause();
    $('visorMedio').replaceChildren();
    visor.hidden = true;
    desbloquear();
    enfoqueVisor?.focus();
  }

  $('visorCerrar').addEventListener('click', cerrarVisor);
  $('visorAnt').addEventListener('click', () => mostrar(actual - 1));
  $('visorSig').addEventListener('click', () => mostrar(actual + 1));
  visor.addEventListener('click', e => { if (e.target === visor || e.target.classList.contains('visor-medio')) cerrarVisor(); });

  document.addEventListener('keydown', e => {
    if (!visor.hidden) {
      if (e.key === 'Escape') cerrarVisor();
      else if (e.key === 'ArrowLeft') mostrar(actual - 1);
      else if (e.key === 'ArrowRight') mostrar(actual + 1);
    } else if (!caso.hidden && e.key === 'Escape') cerrarCaso();
  });

  // Deslizar con el dedo en el celular (salvo dentro de un carrusel, que se desliza solo)
  let x0 = null;
  visor.addEventListener('touchstart', e => { x0 = e.target.closest('.pista') ? null : e.touches[0].clientX; }, { passive: true });
  visor.addEventListener('touchend', e => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 60) mostrar(actual + (dx < 0 ? 1 : -1));
    x0 = null;
  });

  pintar();
  desdeHash();
})();
