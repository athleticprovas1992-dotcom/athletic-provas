/* Athletic Center - Prova Kick (celular)
   O professor avalia vários alunos ao mesmo tempo: todos ficam na mesma técnica e ele
   passa de aluno em aluno (arrastando para o lado ou tocando nas abas).
   No final gera um arquivo .json que é enviado pelo WhatsApp ao professor chefe,
   que o abre no app do computador em Kickboxing > "Receber do celular". */
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
      else if (k === 'value') e.value = v == null ? '' : v;
      else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach(c => { if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c)); });
    return e;
  };
  const clone = o => JSON.parse(JSON.stringify(o));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const hoje = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };

  const store = {
    get(k, d) { try { const v = localStorage.getItem('acc_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('acc_' + k, JSON.stringify(v)); } catch (e) { toast('Não foi possível salvar: memória do celular cheia.'); } }
  };
  let toastT;
  function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2800); }

  /* ---------- notas e cálculo (iguais ao app do computador) ---------- */
  const NIVEIS = [
    { k: 'mi', n: 'Muito insuficiente', c: '#d32f2f' },
    { k: 'in', n: 'Insuficiente', c: '#e65100' },
    { k: 'su', n: 'Suficiente', c: '#fbc02d' },
    { k: 'bo', n: 'Bom', c: '#8bc34a' },
    { k: 'mb', n: 'Muito bom', c: '#14532d' },
    { k: 'ex', n: 'Excepcional', c: '#1565c0' }
  ];
  const valor = (k, g) => ({ mi: 0, in: (g + 1) / 2, su: g + 1, bo: g + 1 + 1 / 3, mb: g + 1 + 2 / 3, ex: g + 2 })[k];
  const r1 = v => Math.round(v * 10 + 1e-9) / 10;
  const nf = v => v == null || isNaN(v) ? '–' : r1(v).toFixed(1).replace('.', ',');
  const GRUPOS = { 5: '5 a 7', 6: '6 a 8', 7: '7 a 9' };
  const clampPts = v => { v = parseFloat(String(v || '0').replace(',', '.')); return isNaN(v) ? 0 : Math.max(0, Math.min(10, v)); };
  const txt = html => { const d = document.createElement('div'); d.innerHTML = String(html).replace(/<br\s*\/?>/gi, '\n'); return d.textContent.trim(); };

  function calcular(s) {
    const p = s.prova, g = Number(p.grupo) || 5;
    let total = 0, ruins = 0, pend = 0, reqPend = 0, reqNao = [];
    const blocos = p.blocos.map((b, bi) => {
      if (b.tipo === 'req') {
        b.linhas.forEach((l, li) => { if (l.t !== 'i') return; const v = s.req[bi + '-' + li]; if (!v) reqPend++; else if (v === 'nao') reqNao.push(txt(l.x)); });
        return { nome: b.nome, tipo: 'req', nota: null };
      }
      const vals = [];
      const conta = v => { total++; if (!v) pend++; else { vals.push(valor(v, g)); if (v === 'mi' || v === 'in') ruins++; } };
      if (b.tipo === 'geral') conta(s.av[bi + '-g']);
      else b.linhas.forEach((l, li) => { if (l.t === 'i') conta(s.av[bi + '-' + li]); });
      return { nome: b.nome, tipo: b.tipo, nota: vals.length ? r1(vals.reduce((a, c) => a + c, 0) / vals.length) : null };
    });
    const comNota = blocos.filter(b => b.tipo !== 'req' && b.nota != null);
    const notaProva = comNota.length ? r1(comNota.reduce((a, b) => a + b.nota, 0) / comNota.length) : null;
    const pontos = Math.min(10, clampPts(s.cursosPts) + clampPts(s.extrasPts));
    const final = notaProva == null ? null : r1(notaProva + pontos / 10);
    const pctRuim = total ? ruins / total : 0;
    const reprovNotas = total > 0 && pctRuim >= 0.8;
    let motivo = '';
    if (reprovNotas) motivo = Math.round(pctRuim * 100) + '% das avaliações foram Muito insuficiente ou Insuficiente (limite: 80%).';
    if (reqNao.length) motivo = (motivo ? motivo + ' ' : '') + 'Requisito não cumprido: ' + reqNao.join('; ') + '.';
    return { blocos, notaProva, final, pontos, pend, reqPend, aprovado: !reprovNotas && !reqNao.length, motivo };
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

  /* ---------- provas do Kickboxing ---------- */
  // Provas: as do arquivo de atualização do professor chefe (se houver) ou as que vêm com o app.
  const PADRAO = (window.PROVAS_PADRAO || []).filter(p => p.mod === 'kick');
  let ATUALIZ = null, PROVAS = PADRAO;
  function carregarProvas() {
    ATUALIZ = store.get('provasAtualiz', null);
    PROVAS = ATUALIZ && Array.isArray(ATUALIZ.provas) && ATUALIZ.provas.length ? ATUALIZ.provas : PADRAO;
  }
  carregarProvas();
  const dataHora = iso => { try { const d = new Date(iso); return d.toLocaleDateString('pt-BR') + ' às ' + d.toTimeString().slice(0, 5); } catch (e) { return ''; } };

  // Transforma a prova numa sequência de passos (uma técnica por tela).
  function passosDe(p) {
    const ps = [];
    p.blocos.forEach((b, bi) => {
      let sec = '', ori = '';
      if (b.tipo === 'geral') {
        ps.push({ tipo: 'av', key: bi + '-g', bloco: b.nome, texto: 'Avaliação geral do ' + b.nome,
          refs: b.linhas.filter(l => l.t !== 'o').map(l => l.x), ori: b.linhas.filter(l => l.t === 'o').map(l => l.x).join(' ') });
        return;
      }
      b.linhas.forEach((l, li) => {
        if (l.t === 's') { sec = l.x; return; }
        if (l.t === 'o') { ori = l.x; return; }
        if (l.t !== 'i') return;
        ps.push({ tipo: b.tipo === 'req' ? 'req' : 'av', key: bi + '-' + li, bloco: b.nome, sec, ori, texto: l.x, escolha: !!l.escolha });
      });
    });
    ps.push({ tipo: 'fim', bloco: 'Nota extra, observações e resultado' });
    return ps;
  }
  const feitoNoPasso = (s, ps) => ps.tipo === 'fim' ? !faltando(s, calcular(s)).length : ps.tipo === 'req' ? !!s.req[ps.key] : !!s.av[ps.key];

  /* ---------- estado ---------- */
  // turma = { provaId, prova, data, professor, alunos:[sessão], atual, passo }
  let turma = store.get('turma', null);
  const salvar = () => store.set('turma', turma);
  const novaSessao = nome => ({ sid: uid(), prova: clone(turma.prova), aluno: nome || '', data: turma.data, professor: turma.professor,
    av: {}, notas: {}, escolha: {}, req: {}, obs: '', cursosDesc: '', cursosPts: '', extrasDesc: '', extrasPts: '' });

  const app = $('#app');
  function tela(...els) { app.innerHTML = ''; els.forEach(e => e && app.append(e)); scrollTo(0, 0); const n = $('#nav'); if (n) n.remove(); }

  /* ---------- 1. escolher a prova ---------- */
  function telaInicio() {
    $('#btn-menu').hidden = true; $('#sub').textContent = 'Prova de Kickboxing';
    let escolhida = null;
    const prof = h('input', { value: store.get('professor', ''), placeholder: 'Seu nome', autocomplete: 'name' });
    const data = h('input', { type: 'date', value: hoje() });
    const lista = h('div');
    PROVAS.forEach(p => {
      const c = h('div', { class: 'pcard', onclick: () => { escolhida = p; $$('.pcard', lista).forEach(x => x.classList.toggle('on', x === c)); } },
        h('h3', null, p.titulo), h('div', { class: 'meta' }, p.faixa + ' • notas de ' + GRUPOS[p.grupo]));
      lista.append(c);
    });
    tela(
      h('div', { class: 'pinfo' }, ATUALIZ ? 'Provas atualizadas pelo professor chefe em ' + dataHora(ATUALIZ.criado) + '.' : 'Provas originais do app.',
        h('button', { class: 'btn small', style: 'display:block;margin-top:8px', onclick: atualizarProvas }, '🔄 Atualizar provas')),
      h('h2', null, 'Nova prova'),
      h('label', { class: 'f' }, 'Professor', prof),
      h('label', { class: 'f' }, 'Data da prova', data),
      h('div', { class: 'f' }, 'Qual prova você vai aplicar?'), lista,
      h('button', { class: 'btn primary full', onclick: () => {
        if (!prof.value.trim()) { toast('Escreva o seu nome de professor.'); prof.focus(); return; }
        if (!escolhida) { toast('Toque na prova que você vai aplicar.'); return; }
        store.set('professor', prof.value.trim());
        turma = { provaId: escolhida.id, prova: clone(escolhida), data: data.value || hoje(), professor: prof.value.trim(), alunos: [], atual: 0, passo: 0 };
        salvar(); telaAlunos(true);
      } }, 'Continuar ▶'));
  }

  /* ---------- 2. alunos do bloco ---------- */
  function telaAlunos(primeira) {
    $('#btn-menu').hidden = !turma.alunos.length; $('#sub').textContent = turma.prova.titulo;
    const box = h('div');
    const nomes = turma.alunos.length ? turma.alunos.map(a => a.aluno) : ['', '', ''];
    const linha = (v) => {
      const inp = h('input', { value: v, placeholder: 'Nome completo do aluno', autocapitalize: 'words' });
      const row = h('div', { class: 'al-row' }, h('span', { class: 'num' }), inp,
        h('button', { class: 'x', title: 'Remover', onclick: () => {
          const i = $$('.al-row', box).indexOf(row), a = turma.alunos[i];
          if (a && Object.keys(a.av).length + Object.keys(a.req).length && !confirm('Remover ' + (a.aluno || 'este aluno') + '? As notas dele serão apagadas.')) return;
          if (a) turma.alunos.splice(i, 1);
          row.remove(); numerar(); salvar();
        } }, '✕'));
      box.append(row); numerar(); return inp;
    };
    const numerar = () => $$('.al-row .num', box).forEach((n, i) => n.textContent = i + 1);
    nomes.forEach(n => linha(n));
    tela(
      h('h2', null, 'Alunos do seu bloco'),
      h('div', { class: 'pinfo' }, h('b', null, turma.prova.titulo), ' • ', turma.professor, ' • ', turma.data.split('-').reverse().join('/')),
      h('p', { class: 'hint' }, 'Escreva o nome de cada aluno que você vai avaliar. Você pode acrescentar mais depois.'),
      box,
      h('button', { class: 'btn full', onclick: () => linha('').focus() }, '+ Mais um aluno'),
      h('button', { class: 'btn primary full', onclick: () => {
        const vals = $$('.al-row input', box).map(i => i.value.trim());
        // mantém as notas de quem já existia (pela posição) e cria os novos
        const novos = [];
        vals.forEach((v, i) => { if (!v) return; const a = turma.alunos[i]; if (a) { a.aluno = v; novos.push(a); } else novos.push(novaSessao(v)); });
        if (!novos.length) { toast('Escreva o nome de pelo menos um aluno.'); return; }
        turma.alunos = novos; turma.atual = Math.min(turma.atual, novos.length - 1); salvar(); telaProva();
      } }, primeira ? 'Começar a avaliar ▶' : 'Voltar para a prova ▶'));
  }

  /* ---------- 3. avaliação (vários alunos, mesma técnica) ---------- */
  let passos = [];
  function telaProva(direcao) {
    $('#btn-menu').hidden = false; $('#sub').textContent = turma.prova.titulo + ' • ' + turma.professor;
    passos = passosDe(turma.prova);
    turma.passo = Math.max(0, Math.min(turma.passo, passos.length - 1));
    turma.atual = Math.max(0, Math.min(turma.atual, turma.alunos.length - 1));
    const ps = passos[turma.passo], s = turma.alunos[turma.atual];

    // abas
    const abas = h('div', { id: 'abas' });
    turma.alunos.forEach((a, i) => abas.append(h('button', { class: 'aba' + (i === turma.atual ? ' on' : '') + (feitoNoPasso(a, ps) ? ' feito' : ''),
      onclick: () => irAluno(i) }, h('i'), a.aluno.split(' ')[0] || 'Aluno ' + (i + 1))));
    abas.append(h('button', { class: 'aba mais', onclick: () => telaAlunos(false) }, '+ aluno'));

    // cartão
    const pontos = h('div', { class: 'pontos' }, ...turma.alunos.map((a, i) => h('i', { class: (feitoNoPasso(a, ps) ? 'tem' : '') + (i === turma.atual ? ' atual' : '') })));
    const body = h('div', { class: 'card-body' },
      h('div', { class: 'aluno-nome' }, s.aluno || 'Aluno ' + (turma.atual + 1)),
      h('div', { style: 'text-align:center;font-size:12.5px;color:var(--muted)' }, 'Aluno ' + (turma.atual + 1) + ' de ' + turma.alunos.length + ' • arraste para o lado para trocar'),
      pontos);
    if (ps.tipo === 'fim') body.append(...passoFinal(s));
    else {
      if (ps.sec) body.append(h('div', { class: 'r-sec', html: ps.sec }));
      if (ps.ori) body.append(h('div', { class: 'r-ori', html: ps.ori }));
      body.append(h('div', { class: 'r-txt', html: ps.texto }));
      (ps.refs || []).forEach(r => body.append(h('div', { class: 'r-ref', html: r })));
      if (ps.escolha) body.append(h('input', { class: 'esc-in', placeholder: 'Qual técnica foi executada?', value: s.escolha[ps.key] || '',
        oninput: e => { s.escolha[ps.key] = e.target.value; salvar(); } }));
      if (ps.tipo === 'req') {
        const yn = h('div', { class: 'yn', style: 'margin-top:10px' });
        [['sim', 'Sim'], ['nao', 'Não']].forEach(([v, lab]) => yn.append(h('button', { class: v + (s.req[ps.key] === v ? ' on' : ''),
          onclick: () => { s.req[ps.key] = v; salvar(); depoisDaNota(); } }, lab)));
        body.append(yn);
      } else {
        const dots = h('div', { class: 'dots' + (s.av[ps.key] ? ' has' : ''), style: 'margin-top:10px' });
        NIVEIS.forEach(n => dots.append(h('button', { class: 'dot' + (s.av[ps.key] === n.k ? ' on' : ''), style: '--col:' + n.c,
          onclick: () => {
            if (s.av[ps.key] === n.k) { delete s.av[ps.key]; salvar(); telaProva(); return; }
            s.av[ps.key] = n.k; salvar(); depoisDaNota();
          } }, h('span', { class: 'c' }), h('span', { class: 'n' }, n.n))));
        body.append(dots);
      }
      body.append(h('textarea', { class: 'note', rows: 1, placeholder: 'Anotação (opcional)', oninput: e => { s.notas[ps.key] = e.target.value; salvar(); } }, s.notas[ps.key] || ''));
    }
    const notaBloco = ps.tipo === 'fim' ? '' : (() => { const b = calcular(s).blocos.find(x => x.nome === ps.bloco); return b && b.tipo !== 'req' ? 'Nota: ' + nf(b.nota) : ''; })();
    const card = h('div', { class: 'card' + (direcao ? ' sai-' + (direcao > 0 ? 'd' : 'e') : '') },
      h('div', { class: 'rb-head' }, ps.bloco, h('span', { class: 'bn' }, notaBloco)), body);
    swipe(card);
    tela(abas, card);
    if (direcao) requestAnimationFrame(() => requestAnimationFrame(() => card.classList.remove('sai-d', 'sai-e')));
    const aba = $('.aba.on', abas); if (aba) aba.scrollIntoView({ inline: 'center', block: 'nearest' });

    // barra inferior: técnicas
    const todos = turma.alunos.every(a => feitoNoPasso(a, ps));
    const nav = h('div', { id: 'nav' },
      h('button', { class: 'btn', disabled: turma.passo === 0, onclick: () => irPasso(turma.passo - 1) }, '◀ Anterior'),
      h('button', { class: 'pos', style: 'border:0;background:transparent', onclick: listaTecnicas }, h('b', null, ps.tipo === 'fim' ? 'Final' : 'Técnica'), h('br'), (turma.passo + 1) + ' de ' + passos.length, h('br'), '☰ lista'),
      turma.passo < passos.length - 1
        ? h('button', { class: 'btn primary' + (todos ? ' pulsa' : ''), onclick: () => irPasso(turma.passo + 1) }, 'Próxima ▶')
        : h('button', { class: 'btn wa', onclick: telaEnviar }, 'Enviar ✓'));
    document.body.append(nav);
  }

  // depois de dar a nota: vai sozinho para o próximo aluno que ainda não tem nota nesta técnica
  function depoisDaNota() {
    const ps = passos[turma.passo], n = turma.alunos.length;
    for (let k = 1; k < n; k++) {
      const i = (turma.atual + k) % n;
      if (!feitoNoPasso(turma.alunos[i], ps)) { telaProva(); setTimeout(() => irAluno(i), 350); return; }
    }
    telaProva();
    toast(n > 1 ? 'Todos os alunos avaliados nesta técnica. Toque em "Próxima".' : 'Avaliado. Toque em "Próxima".');
  }
  function irAluno(i) {
    if (i < 0 || i >= turma.alunos.length || i === turma.atual) return;
    const d = i > turma.atual ? 1 : -1; turma.atual = i; salvar(); telaProva(d);
  }
  function irPasso(p) {
    if (p < 0 || p >= passos.length) return;
    turma.passo = p;
    // começa a nova técnica pelo primeiro aluno sem nota
    const i = turma.alunos.findIndex(a => !feitoNoPasso(a, passos[p]));
    turma.atual = i >= 0 ? i : 0; salvar(); telaProva();
  }
  function swipe(el) {
    let x0 = null, y0 = 0;
    el.addEventListener('touchstart', e => { if (e.target.closest('textarea,input')) { x0 = null; return; } x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    el.addEventListener('touchend', e => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) irAluno(turma.atual + (dx < 0 ? 1 : -1));
    });
  }

  // última tela de cada aluno: nota extra, observações e resultado
  function passoFinal(s) {
    const resumo = h('div');
    const atualizar = () => {
      const r = calcular(s), falta = faltando(s, r);
      const tb = h('table');
      r.blocos.filter(b => b.tipo !== 'req').forEach(b => tb.append(h('tr', null, h('td', null, 'Nota de ' + b.nome), h('td', null, nf(b.nota)))));
      tb.append(h('tr', null, h('td', null, 'Nota da prova'), h('td', null, nf(r.notaProva))));
      tb.append(h('tr', null, h('td', null, 'Nota extra (' + r.pontos + ' pts)'), h('td', null, '+' + nf(r.pontos / 10))));
      tb.append(h('tr', { class: 'fin' }, h('td', null, 'Nota final'), h('td', null, nf(r.final))));
      const st = falta.length ? h('div', { class: 'status pend' }, 'Falta preencher: ' + falta.join(', ') + '.')
        : h('div', { class: 'status ' + (r.aprovado ? 'ap' : 'rp') }, r.aprovado ? 'APROVADO – ' + (s.prova.faixa || '') : 'REPROVADO');
      resumo.innerHTML = ''; resumo.append(h('div', { class: 'res' }, tb, st, !r.aprovado && r.motivo && !falta.length ? h('div', { class: 'warn' }, r.motivo) : null));
    };
    const campo = (k, ph, type) => h('input', { value: s[k], placeholder: ph, type: type || 'text', inputmode: type === 'number' ? 'decimal' : null,
      oninput: e => { s[k] = e.target.value; salvar(); atualizar(); } });
    atualizar();
    return [
      h('div', { class: 'blk' }, 'Nota extra (até 10 pontos no total • cada ponto = +0,1)'),
      h('div', { class: 'extra' }, h('label', { class: 'f' }, 'Cursos (quais?)', campo('cursosDesc', '')), h('label', { class: 'f' }, 'Pontos', campo('cursosPts', '0', 'number'))),
      h('div', { class: 'extra' }, h('label', { class: 'f' }, 'Técnicas extras', campo('extrasDesc', '')), h('label', { class: 'f' }, 'Pontos', campo('extrasPts', '0', 'number'))),
      h('label', { class: 'f' }, 'Observações gerais', h('textarea', { rows: 3, placeholder: 'Comentário sobre o desempenho do aluno', oninput: e => { s.obs = e.target.value; salvar(); } }, s.obs)),
      resumo];
  }

  /* ---------- folhas: lista de técnicas e menu ---------- */
  function folha(...els) { const b = $('#sheet-box'); b.innerHTML = ''; els.forEach(e => b.append(e)); $('#sheet').hidden = false; }
  const fecharFolha = () => $('#sheet').hidden = true;
  $('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet') fecharFolha(); });

  function listaTecnicas() {
    const box = h('div'); let bl = '';
    passos.forEach((ps, i) => {
      if (ps.bloco !== bl) { bl = ps.bloco; box.append(h('div', { class: 'blk' }, bl)); }
      const n = turma.alunos.filter(a => feitoNoPasso(a, ps)).length, tot = turma.alunos.length;
      box.append(h('button', { class: 'lt' + (i === turma.passo ? ' on' : ''), onclick: () => { fecharFolha(); irPasso(i); } },
        h('span', null, (i + 1) + '. ' + (ps.tipo === 'fim' ? 'Final do aluno' : txt(ps.texto))), h('small', { class: n === tot ? 'ok' : '' }, n === tot ? '✓' : n + '/' + tot)));
    });
    folha(h('h3', null, 'Técnicas da prova'), box, h('button', { class: 'btn full', onclick: fecharFolha }, 'Fechar'));
    const on = $('.lt.on', box); if (on) on.scrollIntoView({ block: 'center' });
  }

  $('#btn-menu').addEventListener('click', () => {
    if (!turma) return;
    folha(h('h3', null, 'Menu'),
      h('button', { class: 'btn full', onclick: () => { fecharFolha(); telaProva(); } }, 'Voltar para a prova'),
      h('button', { class: 'btn full', onclick: () => { fecharFolha(); telaAlunos(false); } }, 'Alunos: acrescentar, corrigir nome ou remover'),
      h('button', { class: 'btn full', onclick: () => { fecharFolha(); listaTecnicas(); } }, 'Lista de técnicas'),
      h('button', { class: 'btn wa full', onclick: () => { fecharFolha(); telaEnviar(); } }, 'Enviar resultados pelo WhatsApp'),
      h('button', { class: 'btn full', onclick: () => { fecharFolha(); atualizarProvas(); } }, '🔄 Atualizar provas (arquivo do professor chefe)'),
      h('button', { class: 'btn danger full', onclick: () => {
        if (!confirm('Apagar esta prova e todos os alunos dela do celular?\n\nFaça isso só depois de enviar os resultados.')) return;
        turma = null; salvar(); fecharFolha(); telaInicio();
      } }, 'Começar outra prova (apaga esta)'),
      h('p', { class: 'hint', style: 'text-align:center' }, 'Versão ' + (window.APP_VERSAO || '')));
  });

  /* ---------- atualizar provas pelo arquivo do professor chefe ---------- */
  function atualizarProvas() {
    const inp = h('input', { type: 'file', accept: '.json,application/json,text/plain,*/*' });
    inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      let d;
      try { d = JSON.parse(await f.text()); } catch (e) { d = null; }
      if (d && d.tipo === 'athletic-prova-celular') { toast('Esse arquivo é de resultados de alunos, não de atualização de provas.'); return; }
      if (!d || d.tipo !== 'athletic-provas-kick' || !Array.isArray(d.provas) || !d.provas.length || !d.provas.every(p => p && p.id && Array.isArray(p.blocos))) {
        toast('Esse arquivo não é uma atualização de provas. Escolha o arquivo "Atualizacao provas Kick".'); return;
      }
      if (ATUALIZ && ATUALIZ.criado && d.criado && new Date(d.criado) < new Date(ATUALIZ.criado) &&
        !confirm('Esse arquivo é MAIS ANTIGO que as provas que já estão no celular (' + dataHora(ATUALIZ.criado) + ').\n\nUsar mesmo assim?')) return;
      const lista = h('div');
      d.provas.forEach(p => lista.append(h('div', { class: 'envio-al' }, h('span', null, p.titulo), h('span', { class: 'pd' }, p.faixa || ''))));
      folha(h('h3', null, 'Atualizar provas'),
        h('p', null, 'Arquivo criado em ' + dataHora(d.criado) + ', com ' + d.provas.length + ' provas:'), lista,
        turma ? h('p', { class: 'warn' }, 'A prova que você está aplicando agora continua igual. As provas novas valem a partir da próxima prova.') : null,
        h('button', { class: 'btn primary full', onclick: () => {
          store.set('provasAtualiz', { criado: d.criado || new Date().toISOString(), versao: d.versao || '', provas: d.provas });
          carregarProvas(); fecharFolha(); toast('Provas atualizadas!');
          if (!turma) telaInicio();
        } }, 'Atualizar'),
        h('button', { class: 'btn full', onclick: fecharFolha }, 'Cancelar'));
    });
    inp.click();
  }

  /* ---------- 4. enviar ---------- */
  function telaEnviar() {
    const lista = h('div');
    let completos = 0;
    turma.alunos.forEach(a => {
      const r = calcular(a), f = faltando(a, r);
      if (!f.length) completos++;
      lista.append(h('div', { class: 'envio-al' }, h('span', null, a.aluno || '(sem nome)'),
        f.length ? h('span', { class: 'pd' }, 'incompleta') : h('span', { class: r.aprovado ? 'ap' : 'rp' }, nf(r.final) + ' • ' + (r.aprovado ? 'Aprovado' : 'Reprovado'))));
    });
    const inc = turma.alunos.length - completos;
    tela(
      h('h2', null, 'Enviar resultados'),
      h('div', { class: 'pinfo' }, h('b', null, turma.prova.titulo), ' • ', turma.professor, ' • ', turma.data.split('-').reverse().join('/')),
      lista,
      inc ? h('p', { class: 'warn' }, inc + (inc > 1 ? ' provas estão incompletas. Elas serão enviadas assim mesmo, e o professor chefe poderá terminar no computador.' : ' prova está incompleta. Ela será enviada assim mesmo, e o professor chefe poderá terminar no computador.')) : null,
      h('p', { class: 'hint' }, 'Toque no botão verde, escolha o WhatsApp e mande para o professor chefe. Ele abre o arquivo no app do computador.'),
      h('button', { class: 'btn wa full', onclick: enviar }, 'Enviar pelo WhatsApp'),
      h('button', { class: 'btn full', onclick: baixarArquivo }, 'Salvar arquivo no celular'),
      h('button', { class: 'btn full', onclick: () => telaProva() }, '◀ Voltar para a prova'));
  }
  function arquivo() {
    const dados = { tipo: 'athletic-prova-celular', formato: 1, versao: window.APP_VERSAO || '', criado: new Date().toISOString(),
      professor: turma.professor, provaId: turma.provaId, sessoes: turma.alunos.map(a => clone(a)) };
    const limpo = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w -]/g, '').trim();
    const nome = 'Kick - ' + limpo(turma.prova.titulo) + ' - ' + limpo(turma.professor) + ' - ' + turma.data.split('-').reverse().join('-') + '.json';
    return new File([JSON.stringify(dados)], nome, { type: 'application/json' });
  }
  async function enviar() {
    const f = arquivo();
    if (navigator.canShare && navigator.canShare({ files: [f] })) {
      try { await navigator.share({ files: [f], title: f.name, text: 'Resultados da prova de Kickboxing – ' + turma.professor }); perguntarLimpar(); }
      catch (e) { if (e.name !== 'AbortError') { toast('Não deu para compartilhar. O arquivo será salvo no celular.'); baixarArquivo(); } }
    } else { toast('Este celular não compartilha arquivos direto. O arquivo foi salvo: envie pelo WhatsApp como documento.'); baixarArquivo(); }
  }
  function baixarArquivo() {
    const f = arquivo(), u = URL.createObjectURL(f), a = h('a', { href: u, download: f.name });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
    setTimeout(perguntarLimpar, 800);
  }
  function perguntarLimpar() {
    folha(h('h3', null, 'Resultados enviados?'),
      h('p', null, 'Se o professor chefe já recebeu o arquivo, você pode limpar o celular para a próxima prova.'),
      h('button', { class: 'btn primary full', onclick: () => { turma = null; salvar(); fecharFolha(); telaInicio(); toast('Pronto para a próxima prova.'); } }, 'Sim, limpar e começar outra'),
      h('button', { class: 'btn full', onclick: fecharFolha }, 'Ainda não, manter os alunos'));
  }

  /* ---------- início ---------- */
  if (turma && turma.alunos && turma.alunos.length) telaProva(); else if (turma) telaAlunos(true); else telaInicio();

  /* ---------- atualização (mesmo sistema do app do computador) ---------- */
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    let recarregando = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!recarregando) { recarregando = true; location.reload(); } });
    navigator.serviceWorker.register('sw.js').then(reg => {
      const avisar = wk => { $('#update-bar').hidden = false; $('#update-btn').onclick = () => wk.postMessage('atualizar'); };
      if (reg.waiting && navigator.serviceWorker.controller) avisar(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) avisar(nw); });
      });
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update(); });
    }).catch(() => {});
  }
})();
