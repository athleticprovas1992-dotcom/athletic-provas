/* Athletic Center - Provas */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const h = (tag, attrs, ...kids) => {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach(c => { if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c)); });
    return e;
  };
  const clone = o => JSON.parse(JSON.stringify(o));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const MOD_NOME = { karate: 'Karatê', kick: 'Kickboxing' };
  const EMAIL = 'athletic.provas1992@gmail.com';

  /* ---------- armazenamento ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('ac_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('ac_' + k, JSON.stringify(v)); return true; } catch (e) { toast('Não foi possível salvar: espaço do computador esgotado.'); return false; } }
  };
  let provas = store.get('provas', null);
  if (!provas) { provas = clone(window.PROVAS_PADRAO); store.set('provas', provas); }
  const saveProvas = () => store.set('provas', provas);
  provas.forEach(p => { if (p.carencia === undefined) { const d = window.PROVAS_PADRAO.find(x => x.id === p.id); p.carencia = d ? d.carencia || '' : ''; } });

  /* ---------- avaliação e cálculo ---------- */
  const NIVEIS = [
    { k: 'mi', n: 'Muito insuficiente', c: '#d32f2f' },
    { k: 'in', n: 'Insuficiente', c: '#e65100' },
    { k: 'su', n: 'Suficiente', c: '#fbc02d' },
    { k: 'bo', n: 'Bom', c: '#8bc34a' },
    { k: 'mb', n: 'Muito bom', c: '#14532d' },
    { k: 'ex', n: 'Excepcional', c: '#1565c0' }
  ];
  const NV = Object.fromEntries(NIVEIS.map(n => [n.k, n]));
  // grupo g: Suficiente = média da faixa (g+1), Excepcional = máximo (g+2).
  // Abaixo da média a nota desce até zero: Insuficiente = metade da média, Muito insuficiente = 0.
  const valor = (k, g) => ({ mi: 0, in: (g + 1) / 2, su: g + 1, bo: g + 1 + 1 / 3, mb: g + 1 + 2 / 3, ex: g + 2 })[k];
  const r1 = v => Math.round(v * 10 + 1e-9) / 10;
  const nf = v => v == null || isNaN(v) ? '–' : r1(v).toFixed(1).replace('.', ',');
  const GRUPOS = { 5: '5 a 7', 6: '6 a 8', 7: '7 a 9' };

  function calcular(s) {
    const p = s.prova, g = Number(p.grupo) || 5;
    let total = 0, ruins = 0, pend = 0, reqPend = 0, reqNao = [];
    const blocos = p.blocos.map((b, bi) => {
      if (b.tipo === 'req') {
        b.linhas.forEach((l, li) => { if (l.t !== 'i') return; const v = s.req[bi + '-' + li]; if (!v) reqPend++; else if (v === 'nao') reqNao.push(txt(l.x)); });
        return { nome: b.nome, tipo: 'req', nota: null };
      }
      const vals = [];
      if (b.tipo === 'geral') {
        total++; const v = s.av[bi + '-g'];
        if (!v) pend++; else { vals.push(valor(v, g)); if (v === 'mi' || v === 'in') ruins++; }
      } else {
        b.linhas.forEach((l, li) => {
          if (l.t !== 'i') return; total++;
          const v = s.av[bi + '-' + li];
          if (!v) pend++; else { vals.push(valor(v, g)); if (v === 'mi' || v === 'in') ruins++; }
        });
      }
      return { nome: b.nome, tipo: b.tipo, nota: vals.length ? r1(vals.reduce((a, c) => a + c, 0) / vals.length) : null, n: vals.length };
    });
    const comNota = blocos.filter(b => b.tipo !== 'req' && b.nota != null);
    const notaProva = comNota.length ? r1(comNota.reduce((a, b) => a + b.nota, 0) / comNota.length) : null;
    const cp = clampPts(s.cursosPts), ep = clampPts(s.extrasPts);
    const pontos = Math.min(10, cp + ep);
    const final = notaProva == null ? null : r1(notaProva + pontos / 10);
    const pctRuim = total ? ruins / total : 0;
    const reprovNotas = total > 0 && pctRuim >= 0.8;
    let motivo = '';
    if (reprovNotas) motivo = Math.round(pctRuim * 100) + '% das avaliações foram Muito insuficiente ou Insuficiente (limite: 80%).';
    if (reqNao.length) motivo = (motivo ? motivo + ' ' : '') + 'Requisito não cumprido: ' + reqNao.join('; ') + '.';
    return { blocos, notaProva, final, pontos, cp, ep, total, ruins, pend, reqPend, aprovado: !reprovNotas && !reqNao.length, motivo, pctRuim };
  }
  const clampPts = v => { v = parseFloat(String(v || '0').replace(',', '.')); return isNaN(v) ? 0 : Math.max(0, Math.min(10, v)); };
  const txt = html => { const d = document.createElement('div'); d.innerHTML = String(html).replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li)>/gi, '\n'); return d.textContent.replace(/\n{2,}/g, '\n').trim(); };
  const clean = html => { const d = document.createElement('div'); d.innerHTML = html; $$('script,style,iframe,object', d).forEach(e => e.remove()); $$('*', d).forEach(e => [...e.attributes].forEach(a => { if (/^on/i.test(a.name)) e.removeAttribute(a.name); })); return d.innerHTML.trim(); };

  /* ---------- navegação ---------- */
  let modAtual = null;
  function mostrar(tela) {
    ['home', 'karate', 'kick'].forEach(t => $('#scr-' + t).hidden = t !== tela);
    modAtual = tela === 'home' ? null : tela;
    $('#corner').hidden = tela === 'home';
    $('#cel-btns').hidden = tela !== 'kick';
    renderJanelas();
  }
  const sons = { karate: new Audio('assets/som-karate.wav'), kick: new Audio('assets/som-kick-v3.wav') };
  $$('#scr-home .hot').forEach(b => b.addEventListener('click', () => {
    const m = b.dataset.go; try { sons[m].currentTime = 0; sons[m].play(); } catch (e) {}
    mostrar(m);
  }));
  $('#btn-back').addEventListener('click', () => mostrar('home'));
  $$('.screen .hot[data-act]').forEach(b => b.addEventListener('click', () => {
    const a = b.dataset.act;
    if (a === 'add') abrirEditor(null, modAtual);
    if (a === 'edit') listaEditar(modAtual);
    if (a === 'run') listaRealizar(modAtual);
    if (a === 'dip') abrirDiplomaConfig(modAtual);
    if (a === 'down') listaBaixar(modAtual);
  }));

  /* ---------- modal ---------- */
  let modalOnClose = null;
  function modal(title, body, foot, onClose) {
    $('#modal-title').textContent = title;
    const mb = $('#modal-body'); mb.innerHTML = ''; mb.append(body); mb.scrollTop = 0;
    const mf = $('#modal-foot'); mf.innerHTML = ''; (foot || []).forEach(f => mf.append(f));
    modalOnClose = onClose || null;
    $('#modal').hidden = false;
  }
  function fecharModal(force) {
    if (!force && modalOnClose && modalOnClose() === false) return;
    $('#modal').hidden = true; modalOnClose = null; $('#modal .modal-box').classList.remove('largo');
  }
  $('#modal-close').addEventListener('click', () => fecharModal());
  let mZoom = 1;
  const setMZoom = z => { mZoom = Math.max(.5, Math.min(2.5, Math.round(z * 10) / 10)); $('#modal-body').style.zoom = mZoom; $('#mz-lbl').textContent = Math.round(mZoom * 100) + '%'; };
  $('#mz-menos').onclick = () => setMZoom(mZoom - .1); $('#mz-mais').onclick = () => setMZoom(mZoom + .1); $('#mz-lbl').onclick = () => setMZoom(1);
  $('#mz-max').onclick = () => $('#modal .modal-box').classList.toggle('max');
  $('#modal-body').addEventListener('wheel', ev => { if (ev.ctrlKey) { ev.preventDefault(); setMZoom(mZoom + (ev.deltaY < 0 ? .1 : -.1)); } }, { passive: false });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) fecharModal(); });

  let toastT;
  function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 3200); }

  const provasDe = mod => provas.filter(p => p.mod === mod);
  const contaItens = p => p.blocos.reduce((a, b) => a + (b.tipo === 'geral' ? 1 : b.tipo === 'req' ? 0 : b.linhas.filter(l => l.t === 'i').length), 0);

  /* ---------- Editar prova: lista ---------- */
  function listaEditar(mod) {
    const wrap = h('div');
    wrap.append(h('p', { class: 'hint' }, 'Escolha a prova que deseja editar. As alterações salvas vão automaticamente para Realizar prova.'));
    const grid = h('div', { class: 'plist' });
    provasDe(mod).forEach(p => {
      grid.append(h('div', { class: 'pcard' },
        h('h3', null, p.titulo),
        h('div', { class: 'meta' }, p.faixa + ' • notas de ' + GRUPOS[p.grupo] + ' • ' + contaItens(p) + ' avaliações'),
        h('div', { class: 'acts' },
          h('button', { class: 'btn small primary', onclick: () => abrirEditor(p.id, mod) }, 'Editar'),
          h('button', { class: 'btn small', onclick: () => { const c = clone(p); c.id = uid(); c.titulo += ' (cópia)'; provas.splice(provas.indexOf(p) + 1, 0, c); saveProvas(); listaEditar(mod); toast('Cópia criada.'); } }, 'Duplicar'),
          h('button', { class: 'btn small danger', onclick: () => { if (confirm('Excluir a prova "' + p.titulo + '"? Isso não pode ser desfeito.')) { provas = provas.filter(x => x !== p); saveProvas(); listaEditar(mod); toast('Prova excluída.'); } } }, 'Excluir'))));
    });
    if (!provasDe(mod).length) grid.append(h('p', { class: 'hint' }, 'Nenhuma prova cadastrada.'));
    wrap.append(grid);
    modal('Editar prova – ' + MOD_NOME[mod], wrap, [
      h('button', { class: 'btn', onclick: () => restaurarPadrao(mod) }, 'Restaurar provas padrão'),
      h('button', { class: 'btn primary', onclick: () => fecharModal() }, 'Fechar')]);
  }
  function restaurarPadrao(mod) {
    if (!confirm('Restaurar as provas padrão da academia de ' + MOD_NOME[mod] + '?\n\nAs provas padrão voltam ao original (as edições nelas serão perdidas). Provas criadas por você são mantidas.')) return;
    const pad = window.PROVAS_PADRAO.filter(p => p.mod === mod);
    const ids = pad.map(p => p.id);
    const proprias = provas.filter(p => p.mod === mod && !ids.includes(p.id));
    provas = provas.filter(p => p.mod !== mod).concat(clone(pad), proprias);
    saveProvas(); listaEditar(mod); toast('Provas padrão restauradas.');
  }

  /* ---------- Editor (Adicionar / Editar) ---------- */
  const TIPOS_BLOCO = { itens: 'Avaliar cada item', geral: 'Avaliação geral (uma para o bloco)', req: 'Requisitos (Sim / Não)' };
  function novoModelo(mod) {
    const b = (nome, tipo) => ({ nome, tipo, linhas: [{ t: 'i', x: '' }] });
    return { id: uid(), mod, titulo: '', faixa: '', carencia: '', grupo: 5, info: [],
      blocos: mod === 'karate' ? [b('Kihon', 'itens'), b('Kata', 'itens'), b('Kumite', 'geral')]
        : [b('Parte Física', 'itens'), b('Golpes Isolados', 'itens'), b('Sequências', 'itens'), b('Combate', 'geral')] };
  }

  function abrirEditor(id, mod) {
    const orig = id ? provas.find(p => p.id === id) : null;
    const p = orig ? clone(orig) : novoModelo(mod);
    p.blocos.forEach(b => b.linhas.forEach(l => { if (l.t === 'r') l.t = 'i'; }));
    let sujo = false;
    const root = h('div');
    root.addEventListener('input', () => sujo = true);

    // barra de formatação (estilo Word)
    const cmd = (c, v) => { document.execCommand(c, false, v); sujo = true; };
    const tb = h('div', { class: 'toolbar', onmousedown: e => { if (e.target.tagName === 'BUTTON') e.preventDefault(); } },
      h('select', { title: 'Fonte', onchange: e => cmd('fontName', e.target.value) },
        ...['Segoe UI', 'Arial', 'Calibri', 'Times New Roman', 'Georgia', 'Verdana'].map(f => h('option', { value: f }, f))),
      h('select', { title: 'Tamanho', onchange: e => cmd('fontSize', e.target.value) },
        ...[['2', '10'], ['3', '12'], ['4', '14'], ['5', '18'], ['6', '24']].map(([v, l]) => h('option', { value: v, selected: v === '3' }, l))),
      h('span', { class: 'sep' }),
      h('button', { title: 'Negrito', onclick: () => cmd('bold'), html: '<b>N</b>' }),
      h('button', { title: 'Itálico', onclick: () => cmd('italic'), html: '<i>I</i>' }),
      h('button', { title: 'Sublinhado', onclick: () => cmd('underline'), html: '<u>S</u>' }),
      h('button', { title: 'Tachado', onclick: () => cmd('strikeThrough'), html: '<s>T</s>' }),
      h('span', { class: 'lbl' }, 'Cor'),
      h('input', { type: 'color', value: '#b3121b', title: 'Cor do texto', oninput: e => cmd('foreColor', e.target.value) }),
      h('span', { class: 'lbl' }, 'Realce'),
      h('input', { type: 'color', value: '#fff59d', title: 'Cor de realce', oninput: e => cmd('hiliteColor', e.target.value) }),
      h('span', { class: 'sep' }),
      h('button', { title: 'Alinhar à esquerda', onclick: () => cmd('justifyLeft') }, '⯇'),
      h('button', { title: 'Centralizar', onclick: () => cmd('justifyCenter') }, '≡'),
      h('button', { title: 'Alinhar à direita', onclick: () => cmd('justifyRight') }, '⯈'),
      h('button', { title: 'Lista com marcadores', onclick: () => cmd('insertUnorderedList') }, '•'),
      h('button', { title: 'Lista numerada', onclick: () => cmd('insertOrderedList') }, '1.'),
      h('span', { class: 'sep' }),
      h('button', { title: 'Desfazer', onclick: () => cmd('undo') }, '↶'),
      h('button', { title: 'Refazer', onclick: () => cmd('redo') }, '↷'),
      h('button', { title: 'Limpar formatação', onclick: () => cmd('removeFormat') }, 'Tx'));

    const top = h('div', { class: 'ed-top' },
      h('label', { class: 'f' }, 'Nome da prova', h('input', { value: p.titulo, placeholder: 'Ex.: Branca para Amarela', oninput: e => p.titulo = e.target.value })),
      h('label', { class: 'f' }, 'Faixa conquistada (aparece no diploma)', h('input', { value: p.faixa, placeholder: 'Ex.: Faixa Amarela', oninput: e => p.faixa = e.target.value })),
      h('label', { class: 'f' }, 'Tempo de treino (só no PDF do aluno)', h('input', { value: p.carencia || '', placeholder: 'Ex.: 6 meses', oninput: e => p.carencia = e.target.value })),
      h('label', { class: 'f' }, 'Notas da faixa pretendida', h('select', { onchange: e => p.grupo = Number(e.target.value) },
        ...[5, 6, 7].map(g => h('option', { value: g, selected: p.grupo === g }, 'De ' + GRUPOS[g])))));

    const infoBox = h('div', { class: 'info-box' });
    const renderInfo = () => {
      infoBox.innerHTML = '';
      infoBox.append(h('div', { class: 'hint', style: 'margin-bottom:6px' }, 'Informações da prova (aparecem no topo, sem avaliação). Ex.: Prova escrita, Idade mínima.'));
      p.info.forEach((t, i) => infoBox.append(h('div', { class: 'info-row' },
        h('input', { value: t, oninput: e => p.info[i] = e.target.value }),
        h('button', { class: 'ibtn del', title: 'Remover', onclick: () => { p.info.splice(i, 1); sujo = true; renderInfo(); } }, '✕'))));
      infoBox.append(h('button', { class: 'btn small', onclick: () => { p.info.push(''); renderInfo(); } }, '+ Informação'));
    };
    renderInfo();

    const blocosEl = h('div');
    const nomeTipoLinha = (bt, t) => t === 's' ? 'Título / base' : t === 'o' ? 'Orientação' :
      bt === 'geral' ? 'Referência' : bt === 'req' ? 'Requisito' : 'Item avaliado';
    const renderBlocos = () => {
      blocosEl.innerHTML = '';
      p.blocos.forEach((b, bi) => {
        const rows = h('div', { class: 'rows' });
        b.linhas.forEach((l, li) => {
          const rt = h('div', { class: 'rt', contenteditable: 'true', html: l.x });
          rt.addEventListener('input', () => { l.x = rt.innerHTML; });
          rt.addEventListener('blur', () => { l.x = clean(rt.innerHTML); });
          const sel = h('select', { onchange: e => { l.t = e.target.value; sujo = true; renderBlocos(); } },
            ...['s', 'i', 'o'].map(t => h('option', { value: t, selected: l.t === t }, nomeTipoLinha(b.tipo, t))));
          rows.append(h('div', { class: 'row t-' + l.t }, sel, rt,
            (l.t === 'i' && b.tipo === 'itens') ? h('label', { class: 'esc', title: 'Mostra um campo para o professor anotar qual kata/técnica o aluno escolheu' },
              h('input', { type: 'checkbox', checked: !!l.escolha, onchange: e => { l.escolha = e.target.checked; sujo = true; } }), 'campo de escolha') : null,
            h('button', { class: 'ibtn', title: 'Subir', onclick: () => { if (li > 0) { [b.linhas[li - 1], b.linhas[li]] = [b.linhas[li], b.linhas[li - 1]]; sujo = true; renderBlocos(); } } }, '↑'),
            h('button', { class: 'ibtn', title: 'Descer', onclick: () => { if (li < b.linhas.length - 1) { [b.linhas[li + 1], b.linhas[li]] = [b.linhas[li], b.linhas[li + 1]]; sujo = true; renderBlocos(); } } }, '↓'),
            h('button', { class: 'ibtn del', title: 'Remover linha', onclick: () => { b.linhas.splice(li, 1); sujo = true; renderBlocos(); } }, '✕')));
        });
        const addL = t => () => { b.linhas.push({ t, x: '' }); sujo = true; renderBlocos(); const r = $$('.rt', blocosEl).filter(x => x.closest('.blk') === blocosEl.children[bi]); r[r.length - 1] && r[r.length - 1].focus(); };
        rows.append(h('div', { style: 'display:flex;gap:6px;margin-top:8px;flex-wrap:wrap' },
          h('button', { class: 'btn small', onclick: addL('i') }, '+ ' + nomeTipoLinha(b.tipo, 'i')),
          h('button', { class: 'btn small', onclick: addL('s') }, '+ Título / base'),
          h('button', { class: 'btn small', onclick: addL('o') }, '+ Orientação')));
        blocosEl.append(h('div', { class: 'blk' },
          h('div', { class: 'blk-head' },
            h('input', { value: b.nome, placeholder: 'Nome do bloco', oninput: e => b.nome = e.target.value }),
            h('select', { onchange: e => { b.tipo = e.target.value; sujo = true; renderBlocos(); } },
              ...Object.entries(TIPOS_BLOCO).map(([k, v]) => h('option', { value: k, selected: b.tipo === k }, v))),
            h('button', { class: 'ibtn', title: 'Subir bloco', onclick: () => { if (bi > 0) { [p.blocos[bi - 1], p.blocos[bi]] = [p.blocos[bi], p.blocos[bi - 1]]; sujo = true; renderBlocos(); } } }, '↑'),
            h('button', { class: 'ibtn', title: 'Descer bloco', onclick: () => { if (bi < p.blocos.length - 1) { [p.blocos[bi + 1], p.blocos[bi]] = [p.blocos[bi], p.blocos[bi + 1]]; sujo = true; renderBlocos(); } } }, '↓'),
            h('button', { class: 'ibtn del', title: 'Remover bloco', onclick: () => { if (confirm('Remover o bloco "' + b.nome + '"?')) { p.blocos.splice(bi, 1); sujo = true; renderBlocos(); } } }, '✕')),
          rows));
      });
      blocosEl.append(h('button', { class: 'btn', onclick: () => { p.blocos.push({ nome: 'Novo bloco', tipo: 'itens', linhas: [{ t: 'i', x: '' }] }); sujo = true; renderBlocos(); } }, '+ Bloco'));
    };
    renderBlocos();

    root.append(top, tb, infoBox, h('p', { class: 'hint' }, 'Cada "Item avaliado" recebe as 6 bolinhas na hora da prova. Em blocos de "Avaliação geral" (como o Kumite), os itens aparecem como referência e o professor dá uma avaliação só para o bloco.'), blocosEl);

    const salvar = () => {
      $$('.rt', blocosEl).forEach(e => e.blur());
      p.titulo = p.titulo.trim();
      if (!p.titulo) { toast('Dê um nome para a prova antes de salvar.'); return; }
      p.info = p.info.map(s => s.trim()).filter(Boolean);
      p.blocos.forEach(b => { b.linhas = b.linhas.map(l => Object.assign(l, { x: clean(l.x) })).filter(l => txt(l.x)); if (b.tipo === 'geral') b.linhas.forEach(l => { if (l.t === 'i') l.t = 'r'; }); });
      const i = provas.findIndex(x => x.id === p.id);
      if (i >= 0) provas[i] = p; else provas.push(p);
      if (saveProvas()) { sujo = false; fecharModal(true); toast('Prova salva! Ela já está disponível em Realizar prova.'); }
    };
    modal((orig ? 'Editar prova – ' : 'Adicionar prova – ') + MOD_NOME[mod], root,
      [h('button', { class: 'btn', onclick: () => fecharModal() }, 'Cancelar'), h('button', { class: 'btn primary', onclick: salvar }, 'Salvar prova')],
      () => sujo ? confirm('Sair sem salvar? As alterações serão perdidas.') : true);
  }

  /* ---------- Realizar prova ---------- */
  let sessoes = store.get('sessoes', []);
  const saveSessoes = () => store.set('sessoes', sessoes);
  function listaRealizar(mod) {
    const wrap = h('div');
    wrap.append(h('p', { class: 'hint' }, 'Clique numa prova para abrir. Você pode abrir várias provas ao mesmo tempo, uma para cada aluno.'));
    const grid = h('div', { class: 'plist' });
    provasDe(mod).forEach(p => grid.append(h('div', { class: 'pcard click', onclick: () => { fecharModal(); abrirSessao(p); } },
      h('h3', null, p.titulo), h('div', { class: 'meta' }, p.faixa + ' • ' + contaItens(p) + ' avaliações'))));
    if (!provasDe(mod).length) grid.append(h('p', { class: 'hint' }, 'Nenhuma prova cadastrada. Use Adicionar prova.'));
    wrap.append(grid);
    modal('Realizar prova – ' + MOD_NOME[mod], wrap, [h('button', { class: 'btn primary', onclick: () => fecharModal() }, 'Fechar')]);
  }

  function abrirSessao(p) {
    const n = sessoes.filter(s => s.prova.mod === p.mod).length;
    const w = Math.min(820, innerWidth - 40), hh = Math.min(innerHeight - 90, 900);
    const s = { sid: uid(), prova: clone(p), aluno: '', data: new Date().toISOString().slice(0, 10), professor: store.get('ultimoProfessor', ''),
      av: {}, notas: {}, escolha: {}, req: {}, obs: '', cursosDesc: '', cursosPts: '', extrasDesc: '', extrasPts: '',
      pos: { x: Math.max(10, (innerWidth - w) / 2 + n * 30), y: Math.max(10, 30 + n * 30), w, h: hh }, min: false };
    sessoes.push(s); saveSessoes(); renderJanelas(); focar(s.sid);
  }

  let zTop = 1;
  function focar(sid) { const e = $('#w-' + sid); if (e) { e.style.zIndex = ++zTop; } }

  function renderJanelas() {
    const desk = $('#desk'), bar = $('#taskbar');
    desk.innerHTML = ''; bar.innerHTML = '';
    sessoes.filter(s => s.prova.mod === modAtual).forEach(s => {
      if (s.min) {
        bar.append(h('button', { class: 'chip', onclick: () => { s.min = false; saveSessoes(); renderJanelas(); focar(s.sid); } },
          '▣ ' + (s.aluno || 'Aluno sem nome') + ' – ' + s.prova.titulo));
      } else desk.append(janela(s));
    });
  }

  function janela(s) {
    const p = s.prova;
    const w = h('div', { class: 'win', id: 'w-' + s.sid, style: `left:${s.pos.x}px;top:${s.pos.y}px;width:${s.pos.w}px;height:${s.pos.h}px;z-index:${++zTop}` });
    w.addEventListener('mousedown', () => focar(s.sid));
    const tituloEl = h('span', { class: 't' });
    const setTitulo = () => tituloEl.textContent = MOD_NOME[p.mod] + ' – ' + p.titulo + (s.aluno ? ' – ' + s.aluno : '');
    setTitulo();
    const zLbl = h('span', { class: 'zlbl', title: 'Clique para voltar a 100%' });
    const setZoom = z => { s.zoom = Math.max(.5, Math.min(2.5, Math.round(z * 10) / 10)); body.style.zoom = s.zoom; zLbl.textContent = Math.round(s.zoom * 100) + '%'; saveSessoes(); };
    zLbl.onclick = () => setZoom(1);
    const maximizar = () => {
      if (s.max) { s.max = null; Object.assign(s.pos, s.antes || s.pos); }
      else { s.antes = Object.assign({}, s.pos); s.max = true; Object.assign(s.pos, { x: 0, y: 0, w: innerWidth, h: innerHeight }); }
      Object.assign(w.style, { left: s.pos.x + 'px', top: s.pos.y + 'px', width: s.pos.w + 'px', height: s.pos.h + 'px' }); bMax.textContent = s.max ? '❐' : '☐'; saveSessoes();
    };
    const bMax = h('button', { title: 'Maximizar / restaurar', onclick: maximizar }, s.max ? '❐' : '☐');
    const head = h('div', { class: 'win-head', ondblclick: e => { if (e.target.tagName !== 'BUTTON' && !e.target.classList.contains('zlbl')) maximizar(); } }, tituloEl,
      h('div', { class: 'zoombox' },
        h('button', { title: 'Diminuir zoom (Ctrl + roda do mouse)', onclick: () => setZoom((s.zoom || 1) - .1) }, '−'), zLbl,
        h('button', { title: 'Aumentar zoom (Ctrl + roda do mouse)', onclick: () => setZoom((s.zoom || 1) + .1) }, '+')),
      h('button', { title: 'Minimizar', onclick: () => { s.min = true; saveSessoes(); renderJanelas(); } }, '—'), bMax,
      h('button', { title: 'Fechar prova', onclick: () => {
        const temDados = Object.keys(s.av).length || s.aluno;
        if (!temDados || confirm('Fechar esta prova?\n\nAs avaliações desta janela serão apagadas. Se ainda não baixou o PDF do resultado, faça isso antes.')) {
          sessoes = sessoes.filter(x => x !== s); saveSessoes(); renderJanelas(); }
      } }, '✕'));
    // arrastar
    head.addEventListener('mousedown', e => {
      if (e.target.tagName === 'BUTTON') return;
      const sx = e.clientX - w.offsetLeft, sy = e.clientY - w.offsetTop;
      const mv = ev => { s.pos.x = Math.max(-w.offsetWidth + 120, Math.min(innerWidth - 120, ev.clientX - sx)); s.pos.y = Math.max(0, Math.min(innerHeight - 40, ev.clientY - sy)); w.style.left = s.pos.x + 'px'; w.style.top = s.pos.y + 'px'; };
      const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); saveSessoes(); };
      addEventListener('mousemove', mv); addEventListener('mouseup', up);
    });
    new ResizeObserver(() => { if (w.isConnected) { s.pos.w = w.offsetWidth; s.pos.h = w.offsetHeight; clearTimeout(w._t); w._t = setTimeout(saveSessoes, 300); } }).observe(w);

    const body = h('div', { class: 'win-body' });
    const salvar = () => saveSessoes();
    const resumoEl = h('div');

    // cabeçalho
    body.append(h('div', { class: 'cab' },
      h('label', { class: 'f' }, 'Nome do aluno', h('input', { value: s.aluno, placeholder: 'Nome completo', oninput: e => { s.aluno = e.target.value; setTitulo(); salvar(); atualizar(); } })),
      h('label', { class: 'f' }, 'Data', h('input', { type: 'date', value: s.data, oninput: e => { s.data = e.target.value; salvar(); atualizar(); } })),
      h('label', { class: 'f' }, 'Professor', h('input', { value: s.professor, placeholder: 'Nome do professor', oninput: e => { s.professor = e.target.value; store.set('ultimoProfessor', s.professor); salvar(); atualizar(); } }))));
    body.append(h('div', { class: 'pinfo' }, h('b', null, p.titulo), ' • conquista: ', p.faixa || '–', ' • notas de ', GRUPOS[p.grupo]));
    if (p.info && p.info.length) body.append(h('div', { class: 'pinfo' }, p.info.join(' • ')));
    body.append(h('div', { class: 'legend' }, ...NIVEIS.map(n => h('span', null, h('i', { style: 'background:' + n.c }), n.n))));

    const dots = (key) => {
      const box = h('div', { class: 'dots' + (s.av[key] ? ' has' : '') });
      NIVEIS.forEach(n => box.append(h('button', { class: 'dot' + (s.av[key] === n.k ? ' on' : ''), style: '--col:' + n.c, title: n.n,
        onclick: () => {
          s.av[key] = s.av[key] === n.k ? undefined : n.k; if (!s.av[key]) delete s.av[key];
          $$('.dot', box).forEach((d, i) => d.classList.toggle('on', NIVEIS[i].k === s.av[key])); box.classList.toggle('has', !!s.av[key]);
          salvar(); atualizar();
        } }, h('span', { class: 'c' }), h('span', { class: 'n' }, n.n))));
      return box;
    };
    const nota = key => h('textarea', { class: 'note', rows: 1, placeholder: 'Anotações do professor (opcional)', oninput: e => { s.notas[key] = e.target.value; salvar(); } }, s.notas[key] || '');

    const notaBlocoEls = [];
    p.blocos.forEach((b, bi) => {
      const nEl = h('span', { class: 'bn' });
      notaBlocoEls[bi] = nEl;
      const bb = h('div', { class: 'rb-body' });
      b.linhas.forEach((l, li) => {
        const key = bi + '-' + li;
        if (l.t === 's') bb.append(h('div', { class: 'r-sec', html: l.x }));
        else if (l.t === 'o') bb.append(h('div', { class: 'r-ori', html: l.x }));
        else if (b.tipo === 'geral' || l.t === 'r') bb.append(h('div', { class: 'r-ref', html: l.x }));
        else if (b.tipo === 'req') {
          const yn = h('div', { class: 'yn' });
          const mk = (v, lab) => h('button', { class: v + (s.req[key] === v ? ' on' : ''), onclick: () => { s.req[key] = v; $$('button', yn).forEach(x => x.classList.toggle('on', x.classList.contains(v))); salvar(); atualizar(); } }, lab);
          yn.append(mk('sim', 'Sim'), mk('nao', 'Não'));
          bb.append(h('div', { class: 'req' }, h('div', { class: 'rq-t', html: l.x }), yn));
        } else {
          bb.append(h('div', { class: 'r-item' }, h('div', { class: 'r-txt', html: l.x }),
            l.escolha ? h('input', { class: 'esc-in', placeholder: 'Qual kata / técnica foi executada?', value: s.escolha[key] || '', oninput: e => { s.escolha[key] = e.target.value; salvar(); } }) : null,
            dots(key), nota(key)));
        }
      });
      if (b.tipo === 'geral') {
        bb.append(h('div', { class: 'r-item', style: 'margin-top:8px;border-top:1px solid #e3d3b2' },
          h('div', { class: 'r-txt' }, h('b', null, 'Avaliação geral do ' + b.nome)), dots(bi + '-g'), nota(bi + '-g')));
      }
      body.append(h('div', { class: 'rb' }, h('div', { class: 'rb-head' }, b.nome, nEl), bb));
    });

    // nota extra
    const ptsIn = (k) => h('input', { type: 'number', min: 0, max: 10, step: 0.5, value: s[k], placeholder: '0 a 10',
      oninput: e => { s[k] = e.target.value; salvar(); atualizar(); } });
    body.append(h('div', { class: 'rb' }, h('div', { class: 'rb-head' }, 'Nota extra', h('span', { class: 'bn' }, 'até 10 pontos no total • cada ponto = +0,1')),
      h('div', { class: 'rb-body' },
        h('div', { class: 'extra', style: 'margin-top:8px' },
          h('label', { class: 'f' }, 'Cursos (quais?)', h('input', { value: s.cursosDesc, oninput: e => { s.cursosDesc = e.target.value; salvar(); } })),
          h('label', { class: 'f' }, 'Pontos', ptsIn('cursosPts'))),
        h('div', { class: 'extra' },
          h('label', { class: 'f' }, 'Técnicas extras (ex.: Sequência Surpresa)', h('input', { value: s.extrasDesc, oninput: e => { s.extrasDesc = e.target.value; salvar(); } })),
          h('label', { class: 'f' }, 'Pontos', ptsIn('extrasPts'))),
        h('div', { class: 'warn', id: 'pw-' + s.sid }))));

    body.append(h('div', { class: 'rb' }, h('div', { class: 'rb-head' }, 'Observações gerais'),
      h('div', { class: 'rb-body' }, h('textarea', { class: 'note', rows: 3, placeholder: 'Comentário do professor sobre o desempenho do aluno', oninput: e => { s.obs = e.target.value; salvar(); } }, s.obs))));

    body.append(resumoEl);
    const bPdf = h('button', { class: 'btn', onclick: () => acaoResultado(s) }, 'Baixar resultado em PDF');
    const bDip = h('button', { class: 'btn', onclick: () => acaoDiploma(s) }, 'Gerar diploma');
    const bEnv = h('button', { class: 'btn primary btn-enviar', onclick: () => acaoEnviar(s) }, 'Enviar para o Gmail da academia');
    const aviso = h('div', { class: 'warn', style: 'text-align:right' });
    body.append(h('div', { class: 'acts-final' }, bPdf, bDip, bEnv), aviso);

    function atualizar() {
      const r = calcular(s);
      r.blocos.forEach((b, i) => { if (notaBlocoEls[i]) notaBlocoEls[i].textContent = b.tipo === 'req' ? '' : 'Nota: ' + nf(b.nota); });
      const soma = clampPts(s.cursosPts) + clampPts(s.extrasPts);
      const pw = $('#pw-' + s.sid, w) || body.querySelector('#pw-' + s.sid);
      if (pw) pw.textContent = soma > 10 ? 'A soma passou de 10 pontos. Será considerado o máximo de 10 pontos (+1,0).' : '';
      resumoEl.innerHTML = '';
      const tb = h('table');
      r.blocos.filter(b => b.tipo !== 'req').forEach(b => tb.append(h('tr', null, h('td', null, 'Nota de ' + b.nome), h('td', null, nf(b.nota)))));
      tb.append(h('tr', null, h('td', null, 'Nota da prova (média dos blocos)'), h('td', null, nf(r.notaProva))));
      tb.append(h('tr', null, h('td', null, 'Nota extra (' + r.pontos + ' pts)'), h('td', null, '+' + nf(r.pontos / 10))));
      tb.append(h('tr', { class: 'fin' }, h('td', null, 'Nota final'), h('td', null, nf(r.final))));
      let st;
      const falta = faltando(s, r);
      if (falta.length) st = h('div', { class: 'status pend' }, 'Falta preencher: ' + falta.join(', ') + '.');
      else st = h('div', { class: 'status ' + (r.aprovado ? 'ap' : 'rp') }, r.aprovado ? 'APROVADO – ' + (p.faixa || '') : 'REPROVADO');
      resumoEl.append(h('div', { class: 'res' }, tb, st, !r.aprovado && r.motivo && !falta.length ? h('div', { class: 'warn' }, r.motivo) : null));
      const ok = !falta.length;
      [bPdf, bEnv].forEach(b => b.disabled = !ok);
      bDip.disabled = !ok || !r.aprovado;
      aviso.textContent = !ok ? 'Complete a prova para liberar o PDF, o diploma e o envio.' : (!r.aprovado ? 'O diploma só é gerado para alunos aprovados.' : '');
    }
    atualizar();
    // redimensionar pelas bordas e pelo canto
    ['r', 'b', 'rb', 'l', 'lb'].forEach(d => {
      const g = h('div', { class: 'rz rz-' + d });
      g.addEventListener('mousedown', ev => {
        ev.preventDefault(); ev.stopPropagation(); focar(s.sid);
        const ox = ev.clientX, oy = ev.clientY, p0 = Object.assign({}, s.pos);
        const mv = m => {
          const dx = m.clientX - ox, dy = m.clientY - oy;
          if (d.includes('r')) s.pos.w = Math.max(420, p0.w + dx);
          if (d.includes('l')) { s.pos.w = Math.max(420, p0.w - dx); s.pos.x = p0.x + (p0.w - s.pos.w); }
          if (d.includes('b')) s.pos.h = Math.max(240, p0.h + dy);
          Object.assign(w.style, { left: s.pos.x + 'px', width: s.pos.w + 'px', height: s.pos.h + 'px' });
        };
        const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); s.max = null; saveSessoes(); };
        addEventListener('mousemove', mv); addEventListener('mouseup', up);
      });
      w.append(g);
    });
    body.addEventListener('wheel', ev => { if (ev.ctrlKey) { ev.preventDefault(); setZoom((s.zoom || 1) + (ev.deltaY < 0 ? .1 : -.1)); } }, { passive: false });
    w.append(head, body);
    setZoom(s.zoom || 1);
    return w;
  }

  function faltando(s, r) {
    const f = [];
    if (!s.aluno.trim()) f.push('nome do aluno');
    if (!s.data) f.push('data');
    if (!s.professor.trim()) f.push('professor');
    if (r.pend) f.push(r.pend + (r.pend > 1 ? ' avaliações' : ' avaliação'));
    if (r.reqPend) f.push(r.reqPend + (r.reqPend > 1 ? ' requisitos' : ' requisito'));
    return f;
  }

  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const dataExt = d => { if (!d) return ''; const [a, m, dd] = d.split('-'); return Number(dd) + ' de ' + MESES[Number(m) - 1] + ' de ' + a; };
  const dataBr = d => { if (!d) return ''; const [a, m, dd] = d.split('-'); return dd + '/' + m + '/' + a; };
  const nomeArq = s => s.replace(/º/g, 'o').replace(/ª/g, 'a').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '').replace(/[\\/:*?"<>|]/g, '').trim();

  function dadosResultado(s) {
    const p = s.prova, r = calcular(s);
    return {
      modNome: MOD_NOME[p.mod], titulo: p.titulo, faixa: p.faixa, aluno: s.aluno.trim(), dataTxt: dataBr(s.data), professor: s.professor.trim(),
      blocos: p.blocos.map((b, bi) => ({
        nome: b.nome, tipo: b.tipo, nota: r.blocos[bi].nota,
        linhas: b.linhas.map((l, li) => {
          const key = bi + '-' + li;
          if (l.t === 's' || l.t === 'o') return { t: l.t, x: txt(l.x) };
          if (b.tipo === 'geral' || l.t === 'r') return { t: 'r', x: txt(l.x) };
          if (b.tipo === 'req') return { t: 'i', x: txt(l.x), req: s.req[key] };
          const v = NV[s.av[key]];
          return { t: 'i', x: txt(l.x), nivel: v && v.n, cor: v && v.c, nota: (s.notas[key] || '').trim(), escolha: l.escolha ? (s.escolha[key] || '').trim() || '(não informado)' : '' };
        }).concat(b.tipo === 'geral' ? [(() => { const v = NV[s.av[bi + '-g']]; return { t: 'i', geral: true, x: 'Avaliação geral do ' + b.nome, nivel: v && v.n, cor: v && v.c, nota: (s.notas[bi + '-g'] || '').trim() }; })()] : [])
      })),
      notaProva: r.notaProva, cursos: { desc: s.cursosDesc.trim(), pts: r.cp }, extras: { desc: s.extrasDesc.trim(), pts: r.ep },
      final: r.final, aprovado: r.aprovado, motivo: r.motivo, obs: s.obs.trim()
    };
  }
  function baixar(blob, nome) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  }
  const arqResultado = s => nomeArq('Histórico da prova - ' + s.aluno + ' - ' + s.prova.titulo) + '.pdf';
  const arqDiploma = s => nomeArq('Diploma - ' + s.aluno + ' - ' + (s.prova.faixa || s.prova.titulo)) + '.pdf';
  async function gerarResultado(s) { return PDF.resultadoPdf(dadosResultado(s)); }
  async function gerarDiploma(s) {
    const r = calcular(s);
    return PDF.modeloPdf(s.prova.mod, modeloDiploma(s.prova.mod), { nome: s.aluno.trim(), faixa: s.prova.faixa || s.prova.titulo, data: dataExt(s.data),
      professor: s.professor.trim(), modalidade: MOD_NOME[s.prova.mod], prova: s.prova.titulo, nota: nf(r.final) });
  }
  async function acaoResultado(s) { try { toast('Gerando PDF do resultado…'); baixar(await gerarResultado(s), arqResultado(s)); toast('PDF do resultado salvo na pasta Downloads.'); } catch (e) { erroPdf(e); } }
  async function acaoDiploma(s) { try { toast('Gerando diploma…'); baixar(await gerarDiploma(s), arqDiploma(s)); toast('Diploma salvo na pasta Downloads.'); } catch (e) { erroPdf(e); } }
  function erroPdf(e) { console.error(e); alert('Não foi possível gerar o PDF.\n\nDetalhe: ' + (e && e.message || e)); }
  const blobB64 = b => new Promise((ok, err) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = err; r.readAsDataURL(b); });
  async function acaoEnviar(s) { try {
    if (online === false && !confirm('Sem internet no momento.\n\nO e-mail não pode ser enviado agora. Deseja salvar os PDFs na pasta Downloads para enviar depois?')) return;
    if (online === false) { const r0 = calcular(s); baixar(await gerarResultado(s), arqResultado(s)); if (r0.aprovado) setTimeout(async () => baixar(await gerarDiploma(s), arqDiploma(s)), 700); toast('PDFs salvos na pasta Downloads. Envie quando a internet voltar.'); return; }
    const r = calcular(s), p = s.prova, aluno = s.aluno.trim();
    const auto = !!(window.ENVIO && window.ENVIO.url);
    const gm = auto ? null : window.open('about:blank', '_blank');
    toast('Gerando os PDFs…');
    const pdfs = [{ nome: arqResultado(s), blob: await gerarResultado(s) }];
    if (r.aprovado) pdfs.push({ nome: arqDiploma(s), blob: await gerarDiploma(s) });
    const assunto = 'Prova de ' + aluno + ' – ' + MOD_NOME[p.mod] + ' – ' + (p.faixa || p.titulo) + ' – ' + (r.aprovado ? 'Aprovado' : 'Reprovado');
    const corpo = ['Resultado de exame de graduação – Athletic Center', '',
      'Aluno: ' + aluno, 'Modalidade: ' + MOD_NOME[p.mod], 'Prova: ' + p.titulo, 'Data: ' + dataBr(s.data), 'Professor: ' + s.professor.trim(), '',
      'Nota da prova: ' + nf(r.notaProva), 'Nota extra: +' + nf(r.pontos / 10), 'Nota final: ' + nf(r.final),
      'Resultado: ' + (r.aprovado ? 'APROVADO – ' + p.faixa : 'REPROVADO' + (r.motivo ? ' (' + r.motivo + ')' : '')), '',
      'Anexos: ' + pdfs.map(x => x.nome).join(' | ')].join('\n');
    if (auto) {
      toast('Enviando e-mail com ' + pdfs.length + (pdfs.length > 1 ? ' PDFs' : ' PDF') + '…');
      try {
        const body = JSON.stringify({ chave: window.ENVIO.chave, remetente: aluno, assunto, corpo,
          anexos: await Promise.all(pdfs.map(async x => ({ nome: x.nome, base64: await blobB64(x.blob) }))) });
        let ok = false;
        try {
          const resp = await fetch(window.ENVIO.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body });
          const js = await resp.json(); ok = !!js.ok; if (!ok) throw new Error(js.erro || 'falha no envio');
        } catch (e1) {
          if (e1 instanceof TypeError) { await fetch(window.ENVIO.url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body }); ok = true; }
          else throw e1;
        }
        if (ok) { s.enviado = new Date().toISOString(); saveSessoes(); alert('E-mail enviado para ' + EMAIL + '!\n\nAssunto: ' + assunto + '\nAnexos:\n' + pdfs.map(x => '- ' + x.nome).join('\n')); return; }
      } catch (e) {
        alert('Não foi possível enviar automaticamente (sem internet ou serviço indisponível).\n\nOs PDFs serão salvos na pasta Downloads e o Gmail será aberto para envio manual.\n\nDetalhe: ' + (e.message || e));
      }
    }
    pdfs.forEach((x, i) => setTimeout(() => baixar(x.blob, x.nome), i * 700));
    const url = 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(EMAIL) + '&su=' + encodeURIComponent(assunto) + '&body=' + encodeURIComponent(corpo);
    if (gm) gm.location.href = url; else window.open(url, '_blank');
    alert('O Gmail foi aberto com o e-mail preenchido.\n\nAgora arraste para o e-mail ' + (pdfs.length > 1 ? 'os 2 arquivos que estão' : 'o arquivo que está') + ' na pasta Downloads:\n\n' + pdfs.map(x => x.nome).join('\n') + '\n\nDepois é só clicar em Enviar.');
  } catch (e) { erroPdf(e); } }


  /* ---------- Baixar prova para o aluno ---------- */
  function listaBaixar(mod) {
    const wrap = h('div');
    wrap.append(h('p', { class: 'hint' }, 'Baixe o conteúdo da prova em PDF para enviar ao aluno estudar. Sai com o emblema de ' + MOD_NOME[mod] + ' e a cor da faixa.'));
    const grid = h('div', { class: 'plist' });
    provasDe(mod).forEach(p => grid.append(h('div', { class: 'pcard' },
      h('h3', null, p.titulo), h('div', { class: 'meta' }, p.faixa + ' • ' + contaItens(p) + ' itens'),
      h('div', { class: 'acts' }, h('button', { class: 'btn small primary', onclick: async () => {
        try {
          toast('Gerando PDF da prova…');
          const blob = await PDF.provaPdf({ mod, modNome: MOD_NOME[mod], titulo: p.titulo, faixa: p.faixa, carencia: p.carencia || '', info: p.info || [],
            blocos: p.blocos.map(b => ({ nome: b.nome, tipo: b.tipo, linhas: b.linhas.map(l => ({ t: l.t, x: l.t === 'i' ? txt(l.x).replace(/^\d+\.\s*/, '') : txt(l.x), escolha: !!l.escolha })).filter(l => l.x) })) });
          baixar(blob, nomeArq('Prova ' + MOD_NOME[mod] + ' - ' + p.titulo) + '.pdf'); toast('PDF da prova salvo na pasta Downloads.');
        } catch (e) { erroPdf(e); }
      } }, 'Baixar PDF')))));
    wrap.append(grid);
    modal('Baixar prova para o aluno – ' + MOD_NOME[mod], wrap, [h('button', { class: 'btn primary', onclick: () => fecharModal() }, 'Fechar')]);
  }

  /* ---------- Diploma e Certificados ---------- */
  const CAMPOS = { nome: 'Nome do aluno', faixa: 'Faixa conquistada', data: 'Data (por extenso)', professor: 'Professor', modalidade: 'Modalidade', prova: 'Nome da prova', nota: 'Nota final' };
  const FONTES = ['Old English Text MT', 'Georgia', 'Times New Roman', 'Palatino Linotype', 'Garamond', 'Arial', 'Segoe UI', 'Calibri', 'Verdana', 'Trebuchet MS', 'Impact', 'Arial Black', 'Brush Script MT', 'Lucida Handwriting', 'Cambria', 'Yu Mincho'];
  function modelosDe(mod) {
    let ms = store.get('modelos_' + mod, null);
    if (!ms) {
      ms = [PDF.modeloPadrao(mod)];
      const velho = store.get('diploma_' + mod, null);   // modelo carregado na versão anterior
      if (velho && velho.img) {
        const m = PDF.modeloPadrao(mod); m.nome = 'Diploma oficial'; m.fundo = { tipo: 'imagem', img: velho.img };
        m.elementos = ['nome', 'faixa', 'data'].map(k => ({ tipo: 'campo', campo: k, x: velho.pos[k].x, y: velho.pos[k].y, s: velho.pos[k].s, cor: velho.pos[k].c, fonte: mod === 'karate' ? 'Georgia' : 'Arial', negrito: true, italico: false, alinh: 'center' }));
        ms[0].diploma = false; m.diploma = true; ms.push(m);
      }
      ms.forEach(m => m.id = m.id || uid());
      store.set('modelos_' + mod, ms);
    }
    return ms;
  }
  const modeloDiploma = mod => { const ms = modelosDe(mod); return ms.find(m => m.diploma) || ms[0]; };
  const valoresExemplo = mod => ({ nome: 'Nome do Aluno Exemplo', faixa: 'Faixa Amarela', data: dataExt(new Date().toISOString().slice(0, 10)), professor: 'Augusto', modalidade: MOD_NOME[mod], prova: 'Branca para Amarela', nota: '6,8' });

  async function abrirDiplomaConfig(mod) {
    let modelos = clone(modelosDe(mod)), atual = modelos.find(m => m.diploma) || modelos[0], sel = null, sujo = false;
    const root = h('div', { class: 'dc' });
    const lista = h('div', { class: 'dc-list' }), palco = h('div', { class: 'dc-stage' }), props = h('div', { class: 'dc-props' });
    root.append(lista, h('div', { class: 'dc-center' }, palco), props);
    let fundoUrl = '', ar = 2339 / 1654;

    async function carregarFundo() {
      const cv = await PDF.fundoCanvas(mod, atual); fundoUrl = cv.toDataURL('image/jpeg', .85); ar = cv.width / cv.height;
    }
    function renderLista() {
      lista.innerHTML = '';
      lista.append(h('div', { class: 'dc-tit' }, 'Modelos'));
      modelos.forEach(m => lista.append(h('button', { class: 'dc-item' + (m === atual ? ' on' : ''), onclick: async () => { atual = m; sel = null; await carregarFundo(); tudo(); } },
        m.nome, m.diploma ? h('span', { class: 'dc-tag' }, 'diploma da prova') : null)));
      lista.append(
        h('button', { class: 'btn small', onclick: async () => { const m = PDF.modeloPadrao(mod); m.id = uid(); m.diploma = false; m.nome = 'Novo modelo ' + (modelos.length + 1); modelos.push(m); atual = m; sel = null; sujo = true; await carregarFundo(); tudo(); } }, '+ Novo modelo'),
        h('button', { class: 'btn small', onclick: async () => { const m = clone(atual); m.id = uid(); m.diploma = false; m.nome += ' (cópia)'; modelos.push(m); atual = m; sujo = true; tudo(); } }, 'Duplicar'),
        h('button', { class: 'btn small danger', onclick: async () => {
          if (modelos.length < 2) { toast('Precisa existir pelo menos um modelo.'); return; }
          if (!confirm('Excluir o modelo "' + atual.nome + '"?')) return;
          const era = atual.diploma; modelos = modelos.filter(x => x !== atual); atual = modelos[0]; if (era) atual.diploma = true; sel = null; sujo = true; await carregarFundo(); tudo();
        } }, 'Excluir'));
    }
    let zoom = 1;
    function renderPalco() {
      palco.innerHTML = ''; palco.style.aspectRatio = ar; palco.style.backgroundImage = 'url(' + fundoUrl + ')'; palco.style.width = (100 * zoom) + '%';
      const Hpx = palco.clientHeight || 400, val = valoresExemplo(mod);
      atual.elementos.forEach(e => {
        let el;
        if (e.tipo === 'caixa') {
          el = h('div', { class: 'dc-el dc-caixa', style: `left:${e.x - e.w / 2}%;top:${e.y - e.h / 2}%;width:${e.w}%;height:${e.h}%;background:${e.cor}` });
        } else if (e.tipo === 'linha') {
          el = h('div', { class: 'dc-el dc-linha', style: `left:${e.x - e.w / 2}%;top:${e.y}%;width:${e.w}%;border-top:${Math.max(1, (e.esp || .18) / 100 * Hpx)}px solid ${e.cor}` });
        } else {
          const t = e.tipo === 'campo' ? (val[e.campo] || '{' + CAMPOS[e.campo] + '}') : String(e.texto || '').replace(/\{(\w+)\}/g, (m, k) => val[k] != null ? val[k] : m);
          const tx = e.alinh === 'left' ? '0' : e.alinh === 'right' ? '-100%' : '-50%';
          const px = e.s / 100 * Hpx;
          el = h('div', { class: 'dc-el' + (e.tipo === 'campo' ? ' campo' : ''), style: `left:${e.x}%;top:${e.y}%;transform:translate(${tx},-50%);color:${e.cor};font:${PDF.fonteCss(e, px)};letter-spacing:${(e.espLetra || 0)}em;line-height:${e.espLinha || 1.2};text-align:${e.alinh || 'center'};white-space:pre` }, t);
          el.title = e.tipo === 'campo' ? 'Campo automático: ' + CAMPOS[e.campo] : 'Texto fixo';
        }
        if (e === sel) {
          el.classList.add('sel');
          const al = h('span', { class: 'dc-alca', title: 'Arraste para aumentar ou diminuir' });
          al.addEventListener('mousedown', ev => {
            ev.preventDefault(); ev.stopPropagation();
            const rc = palco.getBoundingClientRect(), ox = ev.clientX, oy = ev.clientY, s0 = e.s, w0 = e.w, h0 = e.h;
            const mv = m => {
              const dx = (m.clientX - ox) / rc.width * 100, dy = (m.clientY - oy) / rc.height * 100;
              if (e.tipo === 'caixa') { e.w = Math.max(.5, w0 + dx * 2); e.h = Math.max(.5, h0 + dy * 2); }
              else if (e.tipo === 'linha') e.w = Math.max(1, w0 + dx * 2);
              else e.s = Math.max(.5, Math.min(30, s0 * (1 + dy / 8)));
              sujo = true; renderPalco(); renderProps();
            };
            const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); };
            addEventListener('mousemove', mv); addEventListener('mouseup', up);
          });
          el.append(al);
        }
        el.addEventListener('mousedown', ev => {
          if (ev.target.classList.contains('dc-alca')) return;
          ev.preventDefault(); if (sel !== e) { sel = e; renderProps(); $$('.dc-el', palco).forEach(x => x.classList.remove('sel')); el.classList.add('sel'); }
          const rc = palco.getBoundingClientRect(), ox = ev.clientX, oy = ev.clientY, x0 = e.x, y0 = e.y; let moveu = false;
          const mv = m => { moveu = true; e.x = Math.max(0, Math.min(100, x0 + (m.clientX - ox) / rc.width * 100)); e.y = Math.max(0, Math.min(100, y0 + (m.clientY - oy) / rc.height * 100)); sujo = true;
            if (e.tipo === 'caixa') { el.style.left = (e.x - e.w / 2) + '%'; el.style.top = (e.y - e.h / 2) + '%'; }
            else { el.style.left = (e.tipo === 'linha' ? e.x - e.w / 2 : e.x) + '%'; el.style.top = e.y + '%'; } };
          const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); renderPalco(); renderProps(); };
          addEventListener('mousemove', mv); addEventListener('mouseup', up);
        });
        el.addEventListener('dblclick', () => { const ta = $('.dc-props textarea'); if (ta) { ta.focus(); ta.select(); } });
        palco.append(el);
      });
      palco.onmousedown = ev => { if (ev.target === palco) { sel = null; renderProps(); renderPalco(); } };
    }
    // teclado: setas movem (Shift = passo maior), Delete apaga
    const tecla = ev => {
      if ($('#modal').hidden || !sel || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
      const p = ev.shiftKey ? 1 : 0.1, k = ev.key;
      if (k === 'ArrowLeft') sel.x -= p; else if (k === 'ArrowRight') sel.x += p; else if (k === 'ArrowUp') sel.y -= p; else if (k === 'ArrowDown') sel.y += p;
      else if (k === 'Delete') { atual.elementos = atual.elementos.filter(x => x !== sel); sel = null; }
      else return;
      ev.preventDefault(); sujo = true; renderPalco(); renderProps();
    };
    addEventListener('keydown', tecla);
    async function corDoFundo(e) {
      const cv = await PDF.fundoCanvas(mod, atual), c = cv.getContext('2d');
      const x = Math.round((e.x - e.w / 2) / 100 * cv.width), y = Math.round((e.y - e.h / 2) / 100 * cv.height);
      const pts = [[x - 3, y - 3], [x + e.w / 100 * cv.width + 3, y - 3], [x - 3, y + e.h / 100 * cv.height + 3], [x + e.w / 100 * cv.width + 3, y + e.h / 100 * cv.height + 3]];
      let r = 0, g = 0, b = 0;
      pts.forEach(([px, py]) => { const d = c.getImageData(Math.max(0, Math.min(cv.width - 1, px)), Math.max(0, Math.min(cv.height - 1, py)), 1, 1).data; r += d[0]; g += d[1]; b += d[2]; });
      const hx = v => Math.round(v / 4).toString(16).padStart(2, '0'); return '#' + hx(r) + hx(g) + hx(b);
    }
    const campo = (rot, el) => h('label', { class: 'f' }, rot, el);
    function renderProps() {
      props.innerHTML = '';
      const upd = fn => ev => { fn(ev); sujo = true; renderPalco(); };
      props.append(h('div', { class: 'dc-tit' }, 'Modelo'),
        campo('Nome do modelo', h('input', { value: atual.nome, oninput: ev => { atual.nome = ev.target.value; sujo = true; renderLista(); } })),
        h('label', { class: 'dc-chk' }, h('input', { type: 'checkbox', checked: !!atual.diploma, onchange: ev => { modelos.forEach(m => m.diploma = false); atual.diploma = ev.target.checked || modelos.length === 1; if (!atual.diploma) modelos[0].diploma = true; sujo = true; renderLista(); } }), 'Usar como diploma da prova'),
        h('div', { class: 'dc-tit' }, 'Fundo'),
        h('div', { class: 'dc-row' },
          h('button', { class: 'btn small', onclick: () => arq.click() }, 'Carregar imagem ou PDF'),
          h('button', { class: 'btn small', onclick: async () => { atual.fundo = { tipo: 'padrao' }; sujo = true; await carregarFundo(); tudo(); } }, 'Fundo padrão')),
        h('div', { class: 'dc-tit' }, 'Adicionar'),
        h('div', { class: 'dc-row' },
          h('button', { class: 'btn small', onclick: () => novo({ tipo: 'texto', texto: 'Novo texto', x: 50, y: 50, s: 3, cor: '#222222', fonte: 'Georgia', negrito: false, italico: false, alinh: 'center' }) }, '+ Texto'),
          h('button', { class: 'btn small', onclick: () => novo({ tipo: 'campo', campo: 'nome', x: 50, y: 50, s: 4, cor: '#222222', fonte: 'Georgia', negrito: true, italico: false, alinh: 'center' }) }, '+ Campo automático'),
          h('button', { class: 'btn small', onclick: () => novo({ tipo: 'linha', x: 50, y: 80, w: 25, cor: '#222222', esp: .18 }) }, '+ Linha')));
      props.append(h('div', { class: 'dc-row' },
        h('button', { class: 'btn small', onclick: () => novo({ tipo: 'caixa', x: 50, y: 50, w: 20, h: 6, cor: '#ffffff' }) }, '+ Caixa para cobrir texto')));
      props.append(h('div', { class: 'dc-tit' }, 'Zoom'), h('div', { class: 'dc-row' },
        ...[[1, '100%'], [1.5, '150%'], [2, '200%'], [3, '300%']].map(([z, l]) => h('button', { class: 'btn small' + (zoom === z ? ' primary' : ''), onclick: () => { zoom = z; renderPalco(); renderProps(); } }, l))));
      if (!sel) { props.append(h('p', { class: 'hint', style: 'margin-top:10px' }, 'Clique num item do diploma para editar. Arraste para mover; puxe o quadradinho azul para aumentar ou diminuir. Setas do teclado ajustam a posição fino (Shift = passo maior).')); return; }
      const e = sel;
      const num = (rot, get, set, min, max, step) => campo(rot, h('div', { class: 'dc-num' },
        h('input', { type: 'range', min, max, step, value: get(), oninput: upd(ev => { set(Number(ev.target.value)); ev.target.nextSibling.value = ev.target.value; }) }),
        h('input', { type: 'number', min, max, step, value: Math.round(get() * 100) / 100, oninput: upd(ev => { const v = parseFloat(ev.target.value); if (!isNaN(v)) { set(v); ev.target.previousSibling.value = v; } }) })));
      props.append(h('div', { class: 'dc-tit' }, { linha: 'Linha', caixa: 'Caixa para cobrir', campo: 'Campo automático', texto: 'Texto' }[e.tipo]));
      if (e.tipo === 'texto') {
        const ta = h('textarea', { rows: 4, oninput: upd(ev => e.texto = ev.target.value) }, e.texto);
        props.append(campo('Digite o texto (Enter = nova linha)', ta),
          h('div', { class: 'hint', style: 'margin:0' }, 'Inserir no texto um campo que se preenche sozinho:'),
          h('div', { class: 'dc-row' }, ...Object.entries(CAMPOS).map(([k, v]) => h('button', { class: 'btn small', title: v, onclick: () => {
            const i0 = ta.selectionStart ?? ta.value.length, i1 = ta.selectionEnd ?? i0;
            ta.value = ta.value.slice(0, i0) + '{' + k + '}' + ta.value.slice(i1); e.texto = ta.value; sujo = true; renderPalco(); ta.focus();
          } }, v.replace(' (por extenso)', '')))));
      }
      if (e.tipo === 'campo') props.append(campo('Preencher com', h('select', { onchange: upd(ev => e.campo = ev.target.value) }, ...Object.entries(CAMPOS).map(([k, v]) => h('option', { value: k, selected: e.campo === k }, v)))));
      props.append(h('div', { class: 'dc-two' }, num('Posição X (%)', () => e.x, v => e.x = v, 0, 100, .1), num('Posição Y (%)', () => e.y, v => e.y = v, 0, 100, .1)));
      if (e.tipo === 'texto' || e.tipo === 'campo') {
        props.append(campo('Fonte', h('select', { onchange: upd(ev => e.fonte = ev.target.value) }, ...FONTES.map(f => h('option', { value: f, selected: e.fonte === f, style: 'font-family:"' + f + '"' }, f)))),
          num('Tamanho da letra', () => e.s, v => e.s = v, .5, 20, .05),
          num('Espaço entre letras', () => e.espLetra || 0, v => e.espLetra = v, -0.1, 1, .01),
          num('Espaço entre linhas', () => e.espLinha || 1.2, v => e.espLinha = v, .6, 3, .05),
          h('div', { class: 'dc-row' },
            h('button', { class: 'btn small' + (e.negrito ? ' primary' : ''), onclick: () => { e.negrito = !e.negrito; sujo = true; renderPalco(); renderProps(); } }, h('b', null, 'N')),
            h('button', { class: 'btn small' + (e.italico ? ' primary' : ''), onclick: () => { e.italico = !e.italico; sujo = true; renderPalco(); renderProps(); } }, h('i', null, 'I')),
            ...[['left', '⯇'], ['center', '≡'], ['right', '⯈']].map(([v, l]) => h('button', { class: 'btn small' + (e.alinh === v ? ' primary' : ''), title: 'Alinhamento', onclick: () => { e.alinh = v; sujo = true; renderPalco(); renderProps(); } }, l))));
      } else if (e.tipo === 'linha') {
        props.append(num('Comprimento (%)', () => e.w, v => e.w = v, 1, 95, .1), num('Espessura', () => e.esp || .18, v => e.esp = v, .02, 2, .01));
      } else {
        props.append(h('div', { class: 'dc-two' }, num('Largura (%)', () => e.w, v => e.w = v, .5, 100, .1), num('Altura (%)', () => e.h, v => e.h = v, .5, 100, .1)),
          h('button', { class: 'btn small', onclick: async () => { e.cor = await corDoFundo(e); sujo = true; renderPalco(); renderProps(); } }, 'Pegar a cor do fundo'));
      }
      props.append(campo('Cor', h('input', { type: 'color', value: e.cor, oninput: upd(ev => e.cor = ev.target.value) })),
        h('div', { class: 'dc-row' },
          h('button', { class: 'btn small', onclick: () => { const c = clone(e); c.y = Math.min(98, c.y + 4); atual.elementos.push(c); sel = c; sujo = true; renderPalco(); renderProps(); } }, 'Duplicar'),
          h('button', { class: 'btn small', title: 'Trazer para frente', onclick: () => { atual.elementos = atual.elementos.filter(x => x !== e).concat(e); sujo = true; renderPalco(); } }, 'Frente'),
          h('button', { class: 'btn small', title: 'Mandar para trás', onclick: () => { atual.elementos = [e].concat(atual.elementos.filter(x => x !== e)); sujo = true; renderPalco(); } }, 'Trás'),
          h('button', { class: 'btn small danger', onclick: () => { atual.elementos = atual.elementos.filter(x => x !== e); sel = null; sujo = true; renderPalco(); renderProps(); } }, 'Excluir')));
    }
    function novo(e) { atual.elementos.push(e); sel = e; sujo = true; renderPalco(); renderProps(); }
    function tudo() { renderLista(); renderProps(); requestAnimationFrame(renderPalco); }

    const arq = h('input', { type: 'file', accept: 'image/png,image/jpeg,application/pdf', hidden: true, onchange: async ev => {
      const f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
      try {
        toast('Carregando o modelo…');
        let img, extraidos = null;
        if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
          const editar = confirm('Transformar todos os textos do PDF em textos editáveis?\n\nOK = sim: você poderá digitar, mudar tamanho, fonte e espaçamento de cada texto.\nCancelar = usar o PDF só como fundo, sem mexer nos textos dele.');
          const r = await PDF.pdfParaModelo(await f.arrayBuffer(), editar); img = r.img; if (editar) extraidos = r.elementos;
        } else img = await new Promise((ok, err) => { const rd = new FileReader(); rd.onload = () => { const im = new Image(); im.onload = () => {
          const sc = Math.min(1, 2339 / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc);
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', .9)); }; im.onerror = err; im.src = rd.result; }; rd.readAsDataURL(f); });
        atual.fundo = { tipo: 'imagem', img }; sujo = true; sel = null;
        if (extraidos) atual.elementos = extraidos;
        else if (confirm('O arquivo já tem os textos fixos (título, assinaturas)?\n\nOK = sim: deixar só os campos automáticos (nome, faixa e data) para posicionar.\nCancelar = manter todos os textos atuais por cima.'))
          atual.elementos = atual.elementos.filter(e => e.tipo === 'campo').map(e => Object.assign(e, { cor: '#222222' }));
        await carregarFundo(); tudo(); toast('Modelo carregado. Arraste os textos para o lugar certo.');
      } catch (e) { alert('Não foi possível abrir o arquivo.\n\nDetalhe: ' + (e.message || e)); }
    } });
    root.append(arq);

    await carregarFundo();
    const ro = new ResizeObserver(() => renderPalco()); ro.observe(palco);
    tudo();
    const salvar = () => { if (store.set('modelos_' + mod, modelos)) { sujo = false; removeEventListener('keydown', tecla); ro.disconnect(); fecharModal(true); toast('Diplomas e certificados salvos.'); } };
    modal('Diploma e Certificados – ' + MOD_NOME[mod], root, [
      h('button', { class: 'btn', onclick: async () => { try { baixar(await PDF.modeloPdf(mod, atual, valoresExemplo(mod)), nomeArq('Exemplo - ' + atual.nome) + '.pdf'); } catch (e) { erroPdf(e); } } }, 'Baixar exemplo'),
      h('button', { class: 'btn', onclick: () => certificadoAvulso(mod, atual) }, 'Gerar certificado avulso'),
      h('button', { class: 'btn', onclick: () => fecharModal() }, 'Cancelar'),
      h('button', { class: 'btn primary', onclick: salvar }, 'Salvar')],
      () => { if (sujo && !confirm('Sair sem salvar? As alterações nos modelos serão perdidas.')) return false; ro.disconnect(); removeEventListener('keydown', tecla); return true; });
    $('#modal .modal-box').classList.add('largo');
  }

  // gera um certificado/diploma preenchendo os campos à mão (sem prova)
  function certificadoAvulso(mod, modelo) {
    const usados = [...new Set(modelo.elementos.filter(e => e.tipo === 'campo').map(e => e.campo))];
    const val = { modalidade: MOD_NOME[mod], data: dataExt(new Date().toISOString().slice(0, 10)), professor: store.get('ultimoProfessor', '') };
    const box = h('div', { class: 'avulso' }, h('div', { class: 'dc-tit' }, 'Certificado avulso – "' + modelo.nome + '"'),
      ...usados.map(k => h('label', { class: 'f' }, CAMPOS[k], h('input', { value: val[k] || '', oninput: e => val[k] = e.target.value }))),
      h('div', { class: 'dc-row', style: 'margin-top:8px' },
        h('button', { class: 'btn primary', onclick: async () => { try { baixar(await PDF.modeloPdf(mod, modelo, val), nomeArq(modelo.nome + ' - ' + (val.nome || 'certificado')) + '.pdf'); toast('Certificado salvo na pasta Downloads.'); } catch (e) { erroPdf(e); } } }, 'Baixar PDF'),
        h('button', { class: 'btn', onclick: () => box.remove() }, 'Fechar')));
    $('#modal-body').prepend(box); box.scrollIntoView({ behavior: 'smooth' });
  }


  /* ---------- Receber do celular (Kickboxing) ---------- */
  /* ---------- Atualização das provas para o app do celular ---------- */
  $('#btn-atualiz-cel').addEventListener('click', () => {
    const kick = provas.filter(p => p.mod === 'kick');
    if (!kick.length) { toast('Não há provas de Kickboxing para enviar.'); return; }
    const agora = new Date(), dt = agora.toLocaleDateString('pt-BR').replace(/\//g, '-'), hr = agora.toTimeString().slice(0, 5).replace(':', 'h');
    const dados = { tipo: 'athletic-provas-kick', formato: 1, versao: window.APP_VERSAO || '', criado: agora.toISOString(), provas: clone(kick) };
    const nome = 'Atualizacao provas Kick - ' + dt + ' ' + hr + '.json';
    const lista = h('div');
    kick.forEach(p => lista.append(h('div', { class: 'imp-row' }, h('span', null, p.titulo), h('span', { class: 'dup' }, p.faixa || ''))));
    modal('Atualização das provas para o celular', h('div', null,
      h('p', null, 'Vai ser criado um arquivo com as ' + kick.length + ' provas de Kickboxing deste computador, do jeito que estão agora:'),
      lista,
      h('p', { class: 'hint' }, 'Depois: mande o arquivo no grupo do WhatsApp dos professores. Cada professor baixa o arquivo no WhatsApp, abre o app Prova Kick e toca em "Atualizar provas".')), [
      h('button', { class: 'btn', onclick: () => fecharModal() }, 'Cancelar'),
      h('button', { class: 'btn primary', onclick: () => {
        const blob = new Blob([JSON.stringify(dados)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome;
        document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        fecharModal(true);
        toast('Arquivo "' + nome + '" salvo na pasta Downloads. Mande no grupo do WhatsApp.');
      } }, 'Criar arquivo')]);
  });
  $('#btn-receber').addEventListener('click', () => { $('#in-receber').value = ''; $('#in-receber').click(); });
  $('#in-receber').addEventListener('change', async e => {
    const arqs = Array.from(e.target.files || []);
    if (!arqs.length) return;
    const novos = [], erros = [];
    for (const f of arqs) {
      try {
        const d = JSON.parse(await f.text());
        if (!d || d.tipo !== 'athletic-prova-celular' || !Array.isArray(d.sessoes)) throw 0;
        d.sessoes.forEach(s => { if (s && s.prova && s.sid) novos.push(s); });
      } catch (x) { erros.push(f.name); }
    }
    if (!novos.length) { toast(erros.length ? 'Este arquivo não é um resultado do app do celular: ' + erros.join(', ') : 'Nenhum aluno no arquivo.'); return; }
    const jaTem = sid => sessoes.some(s => s.sid === sid);
    const wrap = h('div');
    if (erros.length) wrap.append(h('p', { class: 'warn' }, 'Não foi possível ler: ' + erros.join(', ') + '.'));
    const porProf = {};
    novos.forEach(s => (porProf[s.professor || 'Professor não informado'] = porProf[s.professor || 'Professor não informado'] || []).push(s));
    let aImportar = 0;
    Object.keys(porProf).forEach(pr => {
      wrap.append(h('div', { class: 'imp-prof' }, 'Professor: ' + pr));
      porProf[pr].forEach(s => {
        const r = calcular(s), falta = faltando(s, r), dup = jaTem(s.sid);
        if (!dup) aImportar++;
        wrap.append(h('div', { class: 'imp-row' }, h('span', null, (s.aluno || '(sem nome)') + ' – ' + s.prova.titulo),
          dup ? h('span', { class: 'dup' }, 'já recebido') : falta.length ? h('span', { class: 'pd' }, 'incompleta') :
            h('span', { class: r.aprovado ? 'ap' : 'rp' }, nf(r.final) + ' • ' + (r.aprovado ? 'Aprovado' : 'Reprovado'))));
      });
    });
    const diferentes = novos.filter(s => { const p = provas.find(x => x.id === s.prova.id); return p && JSON.stringify(p.blocos) !== JSON.stringify(s.prova.blocos); });
    if (diferentes.length) wrap.append(h('p', { class: 'warn' }, 'Atenção: a prova usada no celular está diferente da prova deste computador (ela foi editada aqui ou o celular está desatualizado). O resultado usa as técnicas avaliadas no celular.'));
    wrap.append(h('p', { class: 'hint' }, aImportar ? 'Ao confirmar, cada aluno vira uma prova na barra de baixo da tela do Kickboxing. Abra para baixar o PDF, gerar o diploma ou enviar ao Gmail.' : 'Todos estes alunos já foram recebidos antes.'));
    modal('Receber do celular – ' + novos.length + (novos.length > 1 ? ' alunos' : ' aluno'), wrap, [
      h('button', { class: 'btn', onclick: () => fecharModal() }, 'Cancelar'),
      h('button', { class: 'btn primary', disabled: !aImportar, onclick: () => {
        const w = Math.min(820, innerWidth - 40), hh = Math.min(innerHeight - 90, 900);
        let n = 0;
        novos.forEach(s => {
          if (jaTem(s.sid)) return;
          const x = Object.assign({ av: {}, notas: {}, escolha: {}, req: {}, obs: '', cursosDesc: '', cursosPts: '', extrasDesc: '', extrasPts: '', aluno: '', data: '', professor: '' }, s);
          x.prova.mod = 'kick'; x.doCelular = true;
          x.pos = { x: Math.max(10, (innerWidth - w) / 2 + n * 30), y: Math.max(10, 30 + n * 30), w, h: hh }; x.min = true;
          sessoes.push(x); n++;
        });
        saveSessoes(); fecharModal(true); renderJanelas();
        toast(n + (n > 1 ? ' alunos recebidos.' : ' aluno recebido.') + ' Estão na barra de baixo.');
      } }, 'Receber ' + aImportar + (aImportar === 1 ? ' aluno' : ' alunos'))]);
  });

  /* ---------- atualização automática ---------- */
  if (window.electronAPI) {
    // programa instalado (.exe): atualização pelo GitHub
    window.electronAPI.onUpdate(info => {
      $('#update-bar').hidden = false;
      $('#update-bar span').textContent = 'Nova versão disponível do Athletic Center - Provas' + (info && info.versao ? ' (' + info.versao + ')' : '') + '.';
      $('#update-btn').onclick = () => { $('#update-btn').disabled = true; $('#update-btn').textContent = 'Atualizando…'; window.electronAPI.instalar(); };
    });
  } else if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    let recarregando = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!recarregando) { recarregando = true; location.reload(); } });
    navigator.serviceWorker.register('sw.js').then(reg => {
      const avisar = wk => { $('#update-bar').hidden = false; $('#update-btn').onclick = () => wk.postMessage('atualizar'); };
      if (reg.waiting && navigator.serviceWorker.controller) avisar(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) avisar(nw); });
      });
      setInterval(() => reg.update(), 30 * 60 * 1000);
    }).catch(() => {});
  }



  /* ---------- aba do Gmail institucional (texto livre + senha, salvo só neste computador) ---------- */
  (function () {
    const PADRAO = 'Provas Athletic\nE-mail: ' + EMAIL + '\n';
    const d = store.get('gmailInst', { txt: PADRAO, senha: '' });
    const txt = $('#gm-txt'), sen = $('#gm-senha');
    txt.value = d.txt; sen.value = d.senha;
    const salvar = () => store.set('gmailInst', { txt: txt.value, senha: sen.value });
    txt.addEventListener('input', salvar); sen.addEventListener('input', salvar);
    $('#gm-btn').addEventListener('click', () => { $('#gm-pop').hidden = !$('#gm-pop').hidden; });
    $('#gm-x').addEventListener('click', () => $('#gm-pop').hidden = true);
    $('#gm-ver').addEventListener('click', () => { sen.type = sen.type === 'password' ? 'text' : 'password'; });
    $('#gm-cop').addEventListener('click', async () => { try { await navigator.clipboard.writeText(sen.value); toast('Senha copiada.'); } catch (e) { sen.type = 'text'; sen.select(); document.execCommand('copy'); toast('Senha copiada.'); } });
  })();

  /* ---------- indicador de internet (para o envio ao Gmail) ---------- */
  let online = null;
  async function checarInternet() {
    let ok = false;
    if (navigator.onLine !== false) {
      const alvo = (window.ENVIO && window.ENVIO.url) || 'https://www.google.com/generate_204';
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 7000);
      try { await fetch(alvo + (alvo.includes('?') ? '&' : '?') + 'ping=' + Date.now(), { mode: 'no-cors', cache: 'no-store', signal: ctrl.signal }); ok = true; } catch (e) { ok = false; }
      clearTimeout(t);
    }
    if (ok === online) return;
    online = ok;
    const n = $('#net'); n.className = 'net ' + (ok ? 'on' : 'off');
    $('span', n).textContent = ok ? 'Internet conectada' : 'Sem internet – envio ao Gmail indisponível';
    $$('.btn-enviar').forEach(b => b.title = ok ? '' : 'Sem internet agora: os PDFs serão salvos na pasta Downloads para enviar depois.');
  }
  addEventListener('online', checarInternet); addEventListener('offline', checarInternet);
  $('#net').addEventListener('click', () => { online = null; $('#net').className = 'net verificando'; $('#net span').textContent = 'Verificando internet…'; checarInternet(); });
  checarInternet(); setInterval(checarInternet, 30000);

  /* cards clicáveis: o próprio pedaço da imagem vira o botão (sobe, brilha e afunda ao clicar) */
  function prepararCards() {
    $$('.stage').forEach(st => {
      const img = $('img', st); if (!img) return;
      $$('.hot', st).forEach(b => {
        const L = parseFloat(b.style.left), T = parseFloat(b.style.top), W = parseFloat(b.style.width), H = parseFloat(b.style.height);
        b.style.backgroundImage = 'url("' + img.getAttribute('src') + '")';
        b.style.backgroundSize = (10000 / W) + '% ' + (10000 / H) + '%';
        b.style.backgroundPosition = (L / (100 - W) * 100) + '% ' + (T / (100 - H) * 100) + '%';
      });
    });
    const raio = () => $$('.hot').forEach(b => { if (b.offsetWidth) b.style.setProperty('--rad', Math.round(b.offsetWidth * 0.085) + 'px'); });
    raio(); addEventListener('resize', raio); new MutationObserver(raio).observe(document.body, { attributes: true, subtree: true, attributeFilter: ['hidden'] });
  }
  prepararCards();
  mostrar('home');
  document.title = 'Athletic Center - Provas';
  window.__AC = { calcular, provas: () => provas, sessoes: () => sessoes, dadosResultado };
})();
