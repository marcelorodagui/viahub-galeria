(() => {
  const datos = Object.assign({ reels: [], afiches: [], logos: [] }, window.GALERIA);
  const $ = id => document.getElementById(id);
  const estado = { tipo: 'todo', cliente: '' };
  let lista = [];   // piezas visibles, en orden, para navegar en el visor
  let actual = -1;

  const reels = datos.reels.map(r => ({ ...r, tipo: 'reel' }));
  const afiches = datos.afiches.map(a => ({ ...a, tipo: 'afiche' }));
  const logos = datos.logos.map(l => ({ ...l, tipo: 'logo' }));
  const clientes = [...new Set([...reels, ...afiches, ...logos].map(p => p.cliente).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));

  const icono = '<svg viewBox="0 0 10 12" aria-hidden="true"><path d="M0 0l10 6-10 6z"/></svg>';
  const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tactil = matchMedia('(hover: none)').matches;

  function chip(texto, cuenta, activo, alPulsar, clase = '') {
    const b = document.createElement('button');
    b.className = `chip ${clase}`;
    b.type = 'button';
    b.setAttribute('aria-pressed', activo);
    b.innerHTML = `${esc(texto)}${cuenta != null ? `<small>${cuenta}</small>` : ''}`;
    b.addEventListener('click', alPulsar);
    return b;
  }

  function pintarFiltros() {
    const delCliente = p => !estado.cliente || p.cliente === estado.cliente;
    const nR = reels.filter(delCliente).length, nA = afiches.filter(delCliente).length, nL = logos.filter(delCliente).length;
    const tipo = $('filtrosTipo');
    tipo.replaceChildren(
      chip('Todo', nR + nA + nL, estado.tipo === 'todo', () => cambiar({ tipo: 'todo' })),
      chip('Reels', nR, estado.tipo === 'reel', () => cambiar({ tipo: 'reel' })),
      chip('Afiches', nA, estado.tipo === 'afiche', () => cambiar({ tipo: 'afiche' })),
      ...(logos.length ? [chip('Logos', nL, estado.tipo === 'logo', () => cambiar({ tipo: 'logo' }))] : []),
    );
    const cli = $('filtrosCliente');
    if (clientes.length > 1) {
      cli.replaceChildren(
        chip('Todas las marcas', null, !estado.cliente, () => cambiar({ cliente: '' }), 'cliente'),
        ...clientes.map(c => chip(c, null, estado.cliente === c, () => cambiar({ cliente: c }), 'cliente')),
      );
    }
  }

  function tarjetaReel(r, i) {
    const b = document.createElement('button');
    b.className = 'pieza';
    b.type = 'button';
    b.style.animationDelay = `${Math.min(i, 12) * 50}ms`;
    b.setAttribute('aria-label', `Ver reel: ${r.titulo}`);
    b.innerHTML = `
      <img src="${r.portada}" alt="" loading="lazy" width="${r.w}" height="${r.h}">
      <span class="duracion">${r.dur ? mmss(r.dur) : ''}</span>
      <span class="play">${icono}</span>
      <span class="capa"><span class="marca">${esc(r.cliente)}</span><span class="nombre">${esc(r.titulo)}</span></span>`;
    // Vista previa silenciosa al pasar el mouse (en computadora)
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
    return b;
  }

  function tarjetaAfiche(a, i) {
    const b = document.createElement('button');
    b.className = 'pieza';
    b.type = 'button';
    b.style.animationDelay = `${Math.min(i, 12) * 50}ms`;
    b.setAttribute('aria-label', `Ver ${a.tipo}: ${a.titulo}`);
    b.dataset.id = a.id;
    b.innerHTML = `
      <img src="${a.mini}" alt="${esc(a.titulo)}" loading="lazy" width="${a.w}" height="${a.h}" style="aspect-ratio:${a.w}/${a.h}">
      <span class="capa"><span class="marca">${esc(a.cliente)}</span><span class="nombre">${esc(a.titulo)}</span></span>`;
    return b;
  }

  function pintar() {
    const delCliente = p => !estado.cliente || p.cliente === estado.cliente;
    const ver = t => estado.tipo === 'todo' || estado.tipo === t;
    const vR = ver('reel') ? reels.filter(delCliente) : [];
    const vA = ver('afiche') ? afiches.filter(delCliente) : [];
    const vL = ver('logo') ? logos.filter(delCliente) : [];
    lista = [...vR, ...vA, ...vL];

    $('reels').replaceChildren(...vR.map((r, i) => {
      const t = tarjetaReel(r, i); t.addEventListener('click', () => abrir(i)); return t;
    }));
    $('afiches').replaceChildren(...vA.map((a, i) => {
      const t = tarjetaAfiche(a, i); t.addEventListener('click', () => abrir(vR.length + i)); return t;
    }));
    $('logos').replaceChildren(...vL.map((l, i) => {
      const t = tarjetaAfiche(l, i); t.addEventListener('click', () => abrir(vR.length + vA.length + i)); return t;
    }));
    $('seccionReels').hidden = !vR.length;
    $('seccionAfiches').hidden = !vA.length;
    $('seccionLogos').hidden = !vL.length;
    $('cuentaReels').textContent = vR.length;
    $('cuentaAfiches').textContent = vA.length;
    $('cuentaLogos').textContent = vL.length;
    $('vacio').hidden = lista.length > 0;
    pintarFiltros();
    acomodarMosaico();
  }

  // Cada afiche/logo ocupa las filas de 2px que correspondan a su proporción + el hueco.
  function acomodarMosaico() {
    for (const cont of [$('afiches'), $('logos')]) {
      const hueco = parseFloat(getComputedStyle(cont).getPropertyValue('--hueco')) || 16;
      cont.querySelectorAll('.pieza').forEach(el => {
        const a = lista.find(p => p.tipo !== 'reel' && el.dataset.id === p.id);
        if (!a) return;
        const alto = el.getBoundingClientRect().width * a.h / a.w;
        el.style.gridRowEnd = `span ${Math.ceil((alto + hueco) / 2)}`;
      });
    }
  }
  const observador = new ResizeObserver(acomodarMosaico);
  observador.observe($('afiches'));
  observador.observe($('logos'));

  function cambiar(cambios) {
    Object.assign(estado, cambios);
    pintar();
  }

  // ---------- Visor ----------
  const visor = $('visor');
  let enfoquePrevio = null;

  function mostrar(i) {
    actual = (i + lista.length) % lista.length;
    const p = lista[actual];
    const medio = $('visorMedio');
    medio.querySelector('video')?.pause();
    if (p.tipo === 'reel') {
      const v = document.createElement('video');
      Object.assign(v, { src: p.video, poster: p.portada, controls: true, autoplay: true, playsInline: true, loop: true });
      medio.replaceChildren(v);
    } else {
      const img = new Image();
      img.src = p.imagen; img.alt = p.titulo;
      medio.replaceChildren(img);
    }
    $('visorPie').innerHTML = `${p.cliente ? `<span>${esc(p.cliente)}</span>` : ''}${esc(p.titulo)}`;
    const varios = lista.length > 1;
    $('visorAnt').hidden = $('visorSig').hidden = !varios;
  }

  function abrir(i) {
    enfoquePrevio = document.activeElement;
    visor.hidden = false;
    document.body.style.overflow = 'hidden';
    mostrar(i);
    $('visorCerrar').focus();
  }

  function cerrar() {
    $('visorMedio').querySelector('video')?.pause();
    $('visorMedio').replaceChildren();
    visor.hidden = true;
    document.body.style.overflow = '';
    enfoquePrevio?.focus();
  }

  $('visorCerrar').addEventListener('click', cerrar);
  $('visorAnt').addEventListener('click', () => mostrar(actual - 1));
  $('visorSig').addEventListener('click', () => mostrar(actual + 1));
  visor.addEventListener('click', e => { if (e.target === visor || e.target.classList.contains('visor-medio')) cerrar(); });
  document.addEventListener('keydown', e => {
    if (visor.hidden) return;
    if (e.key === 'Escape') cerrar();
    else if (e.key === 'ArrowLeft') mostrar(actual - 1);
    else if (e.key === 'ArrowRight') mostrar(actual + 1);
  });

  // Deslizar con el dedo en el celular
  let x0 = null;
  visor.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  visor.addEventListener('touchend', e => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 60) mostrar(actual + (dx < 0 ? 1 : -1));
    x0 = null;
  });

  pintar();
})();
