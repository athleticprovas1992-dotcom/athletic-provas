/* Geração de PDF sem bibliotecas externas: cada página é desenhada num canvas
   e embutida no PDF como imagem JPEG. */
(function () {
  const enc = s => { const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 255; return a; };

  function canvasJpeg(cv) {
    const b64 = cv.toDataURL('image/jpeg', 0.92).split(',')[1];
    const bin = atob(b64); const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }

  /* pages: [{canvas, w, h}] com w/h em pontos (A4 = 595 x 842) */
  function buildPdf(pages) {
    const chunks = []; let len = 0; const offs = [];
    const push = d => { const u = typeof d === 'string' ? enc(d) : d; chunks.push(u); len += u.length; };
    push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    const n = pages.length;
    // 1 = catalog, 2 = pages, depois 3 objetos por página
    const kids = pages.map((_, i) => (3 + i * 3) + ' 0 R').join(' ');
    const obj = (id, body) => { offs[id] = len; push(id + ' 0 obj\n'); push(body); push('\nendobj\n'); };
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [' + kids + '] /Count ' + n + ' >>');
    pages.forEach((p, i) => {
      const pid = 3 + i * 3, cid = pid + 1, iid = pid + 2;
      const jpg = canvasJpeg(p.canvas);
      obj(pid, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + p.w + ' ' + p.h + '] /Resources << /XObject << /Im' + i + ' ' + iid + ' 0 R >> >> /Contents ' + cid + ' 0 R >>');
      const cs = 'q ' + p.w + ' 0 0 ' + p.h + ' 0 0 cm /Im' + i + ' Do Q';
      obj(cid, '<< /Length ' + cs.length + ' >>\nstream\n' + cs + '\nendstream');
      offs[iid] = len;
      push(iid + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + p.canvas.width + ' /Height ' + p.canvas.height +
        ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpg.length + ' >>\nstream\n');
      push(jpg); push('\nendstream\nendobj\n');
    });
    const total = 3 + n * 3;
    const xref = len;
    let x = 'xref\n0 ' + total + '\n0000000000 65535 f \n';
    for (let id = 1; id < total; id++) x += String(offs[id]).padStart(10, '0') + ' 00000 n \n';
    push(x);
    push('trailer\n<< /Size ' + total + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF');
    return new Blob(chunks, { type: 'application/pdf' });
  }

  /* ---------- utilidades de texto ---------- */
  function wrap(ctx, text, maxW) {
    const out = [];
    String(text).split('\n').forEach(par => {
      const words = par.split(/\s+/).filter(Boolean); let line = '';
      if (!words.length) { out.push(''); return; }
      words.forEach(w => {
        const t = line ? line + ' ' + w : w;
        if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
      });
      out.push(line);
    });
    return out;
  }

  const loadImg = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });

  /* ---------- PDF do resultado ---------- */
  async function resultadoPdf(d) {
    // d: {modNome, titulo, faixa, aluno, data, professor, blocos:[{nome, tipo, nota, linhas:[{t,x,nivel,cor,nota,escolha,req}]}],
    //     notaProva, cursos, extras, pontos, extraValor, final, aprovado, motivo, obs}
    const W = 1240, H = 1754, M = 80, F = 'Segoe UI, Arial, sans-serif';
    const pages = []; let cv, ctx, y;
    const logo = await loadImg(window.LOGO_PEQ).catch(() => null);
    const newPage = () => {
      cv = document.createElement('canvas'); cv.width = W; cv.height = H; ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#b3121b'; ctx.fillRect(0, 0, W, 12);
      pages.push({ canvas: cv, w: 595, h: 842 });
      y = M;
      ctx.font = '15px ' + F; ctx.fillStyle = '#999';
      ctx.textAlign = 'right'; ctx.fillText('Athletic Center - Provas  •  ' + d.aluno + '  •  página ' + pages.length, W - M, H - 40); ctx.textAlign = 'left';
    };
    const need = h => { if (y + h > H - 90) newPage(); };
    const txt = (s, size, opt) => {
      opt = opt || {}; ctx.font = (opt.b ? 'bold ' : '') + (opt.i ? 'italic ' : '') + size + 'px ' + F;
      ctx.fillStyle = opt.c || '#222';
      const lines = wrap(ctx, s, opt.w || (W - 2 * M - (opt.x || 0)));
      lines.forEach(l => { need(size * 1.35); ctx.fillText(l, M + (opt.x || 0), y + size); y += size * 1.35; });
    };

    newPage();
    if (logo) ctx.drawImage(logo, M, y - 10, 110, 110);
    ctx.fillStyle = '#7a0c0c'; ctx.font = 'bold 40px ' + F; ctx.fillText('ATHLETIC CENTER', M + 135, y + 35);
    ctx.fillStyle = '#333'; ctx.font = '25px ' + F; ctx.fillText('Resultado do Exame de Graduação – ' + d.modNome, M + 135, y + 75);
    y += 125;
    ctx.fillStyle = '#f6ecd8'; ctx.fillRect(M, y, W - 2 * M, 150);
    ctx.fillStyle = '#222'; ctx.font = 'bold 22px ' + F;
    const lab = (l, v, xx, yy) => { ctx.font = '17px ' + F; ctx.fillStyle = '#7b6a58'; ctx.fillText(l, xx, yy); ctx.font = 'bold 23px ' + F; ctx.fillStyle = '#222'; ctx.fillText(v, xx, yy + 28); };
    lab('Aluno', d.aluno, M + 20, y + 35); lab('Data', d.dataTxt, M + 760, y + 35);
    lab('Prova', d.titulo, M + 20, y + 100); lab('Professor', d.professor, M + 760, y + 100);
    y += 180;

    d.blocos.forEach(b => {
      need(70);
      ctx.fillStyle = '#b3121b'; ctx.fillRect(M, y, W - 2 * M, 44);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 22px ' + F; ctx.fillText(b.nome, M + 14, y + 30);
      ctx.textAlign = 'right'; ctx.font = 'bold 20px ' + F;
      ctx.fillText(b.tipo === 'req' ? 'Requisitos' : ('Nota: ' + (b.nota == null ? '–' : b.nota.toFixed(1).replace('.', ','))), W - M - 14, y + 30);
      ctx.textAlign = 'left'; y += 58;
      b.linhas.forEach(l => {
        if (l.t === 's') { y += 4; txt(l.x, 19, { b: true, c: '#7a0c0c' }); y += 2; return; }
        if (l.t === 'o') { txt(l.x, 16, { i: true, c: '#777' }); return; }
        if (l.t === 'r') { txt('• ' + l.x, 18, { x: 10 }); return; }
        // item avaliado / requisito / avaliação geral
        ctx.font = '18px ' + F;
        const lines = wrap(ctx, l.x, W - 2 * M - 300);
        need(lines.length * 25 + 14);
        const y0 = y;
        lines.forEach(t => { ctx.fillStyle = '#222'; ctx.font = (l.geral ? 'bold ' : '') + '18px ' + F; ctx.fillText(t, M + 10, y + 19); y += 25; });
        // avaliação
        const ax = W - M - 270;
        if (l.req) {
          ctx.fillStyle = l.req === 'sim' ? '#1b7a2e' : '#c62828'; ctx.font = 'bold 18px ' + F;
          ctx.fillText(l.req === 'sim' ? 'SIM – cumprido' : 'NÃO – não cumprido', ax + 10, y0 + 19);
        } else if (l.nivel) {
          ctx.beginPath(); ctx.arc(ax + 14, y0 + 13, 11, 0, Math.PI * 2); ctx.fillStyle = l.cor; ctx.fill();
          ctx.fillStyle = '#222'; ctx.font = 'bold 17px ' + F; ctx.fillText(l.nivel, ax + 34, y0 + 19);
        }
        if (l.escolha) { ctx.font = 'italic 16px ' + F; ctx.fillStyle = '#555'; need(24); ctx.fillText('Kata executado: ' + l.escolha, M + 24, y + 17); y += 24; }
        if (l.nota) { txt('Anotação: ' + l.nota, 16, { i: true, c: '#555', x: 24, w: W - 2 * M - 300 }); }
        y += 6;
        ctx.strokeStyle = '#eee'; ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(W - M, y); ctx.stroke(); y += 6;
      });
      y += 16;
    });

    // resumo
    const nb = d.blocos.filter(b => b.tipo !== 'req').length;
    const boxH = 20 + (nb + 3) * 32 + 42 + 10;
    need(boxH + 100);
    ctx.fillStyle = '#f6ecd8'; ctx.fillRect(M, y, W - 2 * M, boxH); y += 20;
    const row = (l, v, big) => { ctx.font = (big ? 'bold 26px ' : '20px ') + F; ctx.fillStyle = '#222'; ctx.fillText(l, M + 20, y + 22); ctx.textAlign = 'right'; ctx.fillText(v, W - M - 20, y + 22); ctx.textAlign = 'left'; y += big ? 42 : 32; };
    const nf = v => v.toFixed(1).replace('.', ',');
    d.blocos.filter(b => b.tipo !== 'req').forEach(b => row('Nota de ' + b.nome, b.nota == null ? '–' : nf(b.nota)));
    row('Nota da prova (média dos blocos)', nf(d.notaProva));
    row('Nota extra – Cursos (' + d.cursos.pts + ' pts)' + (d.cursos.desc ? ': ' + d.cursos.desc : ''), '+' + nf(d.cursos.pts / 10));
    row('Nota extra – Técnicas extras (' + d.extras.pts + ' pts)' + (d.extras.desc ? ': ' + d.extras.desc : ''), '+' + nf(d.extras.pts / 10));
    row('NOTA FINAL', nf(d.final), true);
    y += 30;
    need(70);
    ctx.fillStyle = d.aprovado ? '#1b7a2e' : '#c62828'; ctx.fillRect(M, y, W - 2 * M, 60);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 28px ' + F; ctx.textAlign = 'center';
    ctx.fillText(d.aprovado ? 'APROVADO – ' + d.faixa : 'REPROVADO', W / 2, y + 40); ctx.textAlign = 'left'; y += 76;
    if (!d.aprovado && d.motivo) txt('Motivo: ' + d.motivo, 18, { c: '#c62828', b: true });
    if (d.obs) { y += 10; txt('Observações gerais do professor', 20, { b: true, c: '#7a0c0c' }); txt(d.obs, 18); }
    y += 50; need(90);
    ctx.strokeStyle = '#444'; ctx.beginPath(); ctx.moveTo(W / 2 - 220, y + 40); ctx.lineTo(W / 2 + 220, y + 40); ctx.stroke();
    ctx.font = '18px ' + F; ctx.fillStyle = '#333'; ctx.textAlign = 'center'; ctx.fillText(d.professor + ' – Professor avaliador', W / 2, y + 66); ctx.textAlign = 'left';
    return buildPdf(pages);
  }

  /* ---------- Diplomas e certificados (modelos editáveis) ---------- */
  const DW = 2339, DH = 1654;   // A4 deitado em ~200 dpi

  // fundo decorativo padrão (sem textos – os textos são elementos editáveis)
  async function fundoDecorado(mod) {
    const W = DW, H = DH, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    const logo = await loadImg(mod === 'kick' ? window.LOGO_KICK : window.LOGO_GRD).catch(() => null);
    if (mod === 'karate') {
      const g = c.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, W * 0.7); g.addColorStop(0, '#fbf5e8'); g.addColorStop(1, '#ead9b6');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.strokeStyle = '#b3121b'; c.lineWidth = 26; c.strokeRect(60, 60, W - 120, H - 120);
      c.strokeStyle = '#7a0c0c'; c.lineWidth = 5; c.strokeRect(110, 110, W - 220, H - 220);
      c.globalAlpha = .07; c.fillStyle = '#b3121b'; c.beginPath(); c.arc(W / 2, H / 2 + 60, 560, 0, 7); c.fill(); c.globalAlpha = 1;
    } else {
      c.fillStyle = '#121212'; c.fillRect(0, 0, W, H);
      const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, 'rgba(179,18,27,.35)'); g.addColorStop(.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(179,18,27,.35)');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.strokeStyle = '#d0161f'; c.lineWidth = 26; c.strokeRect(60, 60, W - 120, H - 120);
      c.strokeStyle = '#ffffff'; c.lineWidth = 4; c.strokeRect(110, 110, W - 220, H - 220);
      c.fillStyle = '#d0161f'; c.fillRect(110, 380, 30, 900); c.fillRect(W - 140, 380, 30, 900);
    }
    if (logo) {
      if (mod === 'kick') [[300, 290], [W - 300, 290]].forEach(([x, y]) => { c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, 140, 0, 7); c.fill(); c.drawImage(logo, x - 135, y - 135, 270, 270); });
      else { c.drawImage(logo, 165, 160, 270, 270); c.drawImage(logo, W - 435, 160, 270, 270); }
    }
    return cv;
  }

  // modelo padrão: tudo o que é texto vira elemento editável
  function modeloPadrao(mod) {
    const k = mod === 'karate';
    const serif = 'Georgia', sans = 'Arial', imp = 'Impact';
    const tinta = k ? '#2a1a12' : '#ffffff', ver = k ? '#b3121b' : '#ff3b3b', sub = k ? '#3a2a20' : '#dddddd';
    const T = (texto, x, y, s, cor, fonte, extra) => Object.assign({ tipo: 'texto', texto, x, y, s, cor, fonte, negrito: false, italico: false, alinh: 'center' }, extra || {});
    const C = (campo, x, y, s, cor, fonte, extra) => Object.assign({ tipo: 'campo', campo, x, y, s, cor, fonte, negrito: true, italico: false, alinh: 'center' }, extra || {});
    const L = (x, y, w, cor) => ({ tipo: 'linha', x, y, w, cor, esp: 0.18 });
    return { nome: 'Diploma de graduação', fundo: { tipo: 'padrao' }, diploma: true, elementos: [
      T('ATHLETIC CENTER', 50, 14.5, 4.5, k ? '#7a0c0c' : '#ffffff', k ? serif : imp, { negrito: true }),
      T(k ? '空 手 道' : 'K I C K B O X I N G', 50, 19.6, 2.9, k ? '#2a1a12' : '#ff3b3b', k ? 'Yu Mincho' : imp, { negrito: !k }),
      T('DIPLOMA', 50, 28.5, 9, k ? '#b3121b' : '#ffffff', k ? serif : imp, { negrito: true }),
      T(k ? 'Karatê-Dō Shotokan' : 'Academia Athletic Center – Catalão GO', 50, 34.2, 2.7, sub, k ? serif : sans, { italico: k }),
      T('Certificamos que', 50, 40.5, 2.5, sub, k ? serif : sans),
      C('nome', 50, 47, 5.2, tinta, k ? serif : sans),
      T('foi aprovado(a) no Exame de Graduação de ' + (k ? 'Karatê' : 'Kickboxing') + ', conquistando a', 50, 55.5, 2.5, sub, k ? serif : sans),
      C('faixa', 50, 63.5, 4.2, ver, k ? serif : sans),
      C('data', 50, 73, 2.2, sub, k ? serif : sans),
      L(28, 84, 28, tinta), L(72, 84, 28, tinta),
      T('Augusto', 28, 87.6, 2.8, tinta, k ? serif : sans, { negrito: true }),
      T('Professor', 28, 90.6, 2.05, tinta, k ? serif : sans),
      T('Acácio', 72, 87.6, 2.8, tinta, k ? serif : sans, { negrito: true }),
      T('Professor', 72, 90.6, 2.05, tinta, k ? serif : sans)
    ] };
  }

  const fonteCss = (e, px) => (e.italico ? 'italic ' : '') + (e.negrito ? 'bold ' : '') + px + 'px "' + e.fonte + '", ' +
    (/Mincho/.test(e.fonte) ? '"MS Mincho", serif' : /Georgia|Times|Palatino|Garamond/.test(e.fonte) ? 'serif' : 'sans-serif');

  async function fundoCanvas(mod, modelo) {
    if (modelo.fundo && modelo.fundo.tipo === 'imagem' && modelo.fundo.img) {
      const im = await loadImg(modelo.fundo.img); const cv = document.createElement('canvas');
      const sc = 2339 / Math.max(im.width, im.height);
      cv.width = Math.round(im.width * sc); cv.height = Math.round(im.height * sc);
      cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); return cv;
    }
    return fundoDecorado(mod);
  }

  // valores: {nome, faixa, data, professor, modalidade, prova, nota}
  async function renderModelo(mod, modelo, valores) {
    const cv = await fundoCanvas(mod, modelo), c = cv.getContext('2d'), W = cv.width, H = cv.height;
    (modelo.elementos || []).forEach(e => {
      if (e.tipo === 'caixa') {
        c.fillStyle = e.cor; c.fillRect((e.x - e.w / 2) / 100 * W, (e.y - e.h / 2) / 100 * H, e.w / 100 * W, e.h / 100 * H); return;
      }
      if (e.tipo === 'linha') {
        c.strokeStyle = e.cor; c.lineWidth = Math.max(2, (e.esp || 0.18) / 100 * H);
        c.beginPath(); c.moveTo((e.x - e.w / 2) / 100 * W, e.y / 100 * H); c.lineTo((e.x + e.w / 2) / 100 * W, e.y / 100 * H); c.stroke(); return;
      }
      const texto = e.tipo === 'campo' ? (valores[e.campo] || '') : String(e.texto || '').replace(/\{(\w+)\}/g, (m, k) => valores[k] != null ? valores[k] : m);
      if (!texto) return;
      const linhas = String(texto).split('\n');
      let size = e.s / 100 * H;
      const aplica = () => { c.font = fonteCss(e, size); try { c.letterSpacing = ((e.espLetra || 0) * size) + 'px'; } catch (x) {} };
      aplica();
      const larg = () => Math.max(...linhas.map(l => c.measureText(l).width));
      if (e.tipo === 'campo') while (larg() > W * 0.9 && size > 8) { size *= .95; aplica(); }
      c.fillStyle = e.cor; c.textAlign = e.alinh || 'center'; c.textBaseline = 'middle';
      const lh = size * (e.espLinha || 1.2), y0 = e.y / 100 * H - (linhas.length - 1) * lh / 2;
      linhas.forEach((l, i) => c.fillText(l, e.x / 100 * W, y0 + i * lh));
      try { c.letterSpacing = '0px'; } catch (x) {}
    });
    return cv;
  }
  async function modeloPdf(mod, modelo, valores) {
    const cv = await renderModelo(mod, modelo, valores); const land = cv.width >= cv.height;
    return buildPdf([{ canvas: cv, w: land ? 842 : 595, h: land ? 595 : 842 }]);
  }

  // PDF -> imagem (1ª página), usando o pdf.js embutido
  let pdfjsLib = null;
  async function carregarPdfJs() {
    if (pdfjsLib) return pdfjsLib;
    if (!window.__PDFJS_SRC) await new Promise((ok, err) => { const s = document.createElement('script'); s.src = 'lib/pdfjs-embutido.js'; s.onload = ok; s.onerror = () => err(new Error('não foi possível carregar o leitor de PDF')); document.head.append(s); });
    const u = t => URL.createObjectURL(new Blob([t], { type: 'text/javascript' }));
    pdfjsLib = await import(u(window.__PDFJS_SRC.lib));
    pdfjsLib.GlobalWorkerOptions.workerSrc = u(window.__PDFJS_SRC.worker);
    return pdfjsLib;
  }
  // PDF -> fundo sem os textos + lista de textos editáveis (posição, fonte, tamanho)
  const FONTE_PDF = n => {
    n = (n || '').replace(/^[A-Z]{6}\+/, '');
    const m = [[/old ?english/i, 'Old English Text MT'], [/times/i, 'Times New Roman'], [/calibri/i, 'Calibri'], [/cambria/i, 'Cambria'], [/arial ?black/i, 'Arial Black'],
      [/arial|helvetica/i, 'Arial'], [/georgia/i, 'Georgia'], [/garamond/i, 'Garamond'], [/palatino|book ?antiqua/i, 'Palatino Linotype'], [/verdana/i, 'Verdana'],
      [/segoe/i, 'Segoe UI'], [/impact/i, 'Impact'], [/brush/i, 'Brush Script MT'], [/lucida ?hand/i, 'Lucida Handwriting'], [/trebuchet/i, 'Trebuchet MS'], [/mincho|ms ?gothic|yu/i, 'Yu Mincho']];
    for (const [r, f] of m) if (r.test(n)) return f;
    return n.split(/[-,]/)[0] || 'Times New Roman';
  };
  async function pdfParaModelo(arrayBuffer, extrairTextos) {
    const lib = await carregarPdfJs();
    const doc = await lib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    const pg = await doc.getPage(1); const v1 = pg.getViewport({ scale: 1 });
    const sc = 2339 / Math.max(v1.width, v1.height); const vp = pg.getViewport({ scale: sc });
    const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
    const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    const P = CanvasRenderingContext2D.prototype, ft = P.fillText, st = P.strokeText;
    if (extrairTextos) { P.fillText = function () {}; P.strokeText = function () {}; }
    try { await pg.render({ canvasContext: ctx, viewport: vp }).promise; } finally { P.fillText = ft; P.strokeText = st; }
    const img = cv.toDataURL('image/jpeg', .92);
    if (!extrairTextos) return { img, elementos: [] };
    const tc = await pg.getTextContent();
    const PW = v1.width, PH = v1.height;
    const itens = tc.items.filter(it => it.str && it.str.trim() !== '' || (it.str === ' ')).map(it => {
      const t = it.transform, size = Math.hypot(t[2], t[3]) || Math.abs(t[3]) || 12;
      let nome = ''; try { const f = pg.commonObjs.get(it.fontName); nome = (f && (f.name || f.loadedName)) || ''; } catch (e) {}
      if (!nome && tc.styles[it.fontName]) nome = tc.styles[it.fontName].fontFamily;
      return { s: it.str, x: t[4], y: t[5], w: it.width, size, nome };
    });
    // agrupa por linha (mesma altura) e separa blocos distantes na mesma linha
    itens.sort((a, b) => b.y - a.y || a.x - b.x);
    const linhas = [];
    itens.forEach(it => {
      let L = linhas.find(l => Math.abs(l.y - it.y) < Math.max(2, it.size * 0.3));
      if (!L) { L = { y: it.y, itens: [] }; linhas.push(L); }
      L.itens.push(it);
    });
    const elementos = [];
    const CAMPO = { NOME: 'nome', FAIXA: 'faixa', DATA: 'data', PROFESSOR: 'professor', MODALIDADE: 'modalidade', NOTA: 'nota', PROVA: 'prova' };
    linhas.forEach(L => {
      L.itens.sort((a, b) => a.x - b.x);
      const grupos = []; let g = null;
      L.itens.forEach(it => {
        if (!it.s.trim() && it.w > it.size * 1.5) { g = null; return; }
        if (g && it.x - (g.x + g.w) < g.size * 3) { const gap = it.x - (g.x + g.w); g.txt += (gap > g.size * 0.15 && !/\s$/.test(g.txt) && !/^\s/.test(it.s) ? ' ' : '') + it.s; g.w = it.x + it.w - g.x; g.partes.push(it); }
        else { g = { x: it.x, w: it.w, txt: it.s, size: it.size, partes: [it] }; grupos.push(g); }
      });
      grupos.forEach(gr => {
        const txt = gr.txt.replace(/\s+$/, ''); if (!txt.trim()) return;
        const dom = gr.partes.reduce((a, b) => (b.s.length > a.s.length ? b : a));
        const size = Math.max(...gr.partes.map(p => p.size));
        const negrito = /bold|black|heavy/i.test(dom.nome), italico = /italic|oblique/i.test(dom.nome);
        const base = { x: gr.x / PW * 100, y: (PH - L.y - size * 0.32) / PH * 100, s: size / PH * 100 * 0.98, cor: '#000000', fonte: FONTE_PDF(dom.nome), negrito, italico, alinh: 'left', espLetra: 0, espLinha: 1.2 };
        const so = txt.trim().toUpperCase();
        if (CAMPO[so]) { elementos.push(Object.assign(base, { tipo: 'campo', campo: CAMPO[so], x: (gr.x + gr.w / 2) / PW * 100, alinh: 'center' })); return; }
        const comCampos = txt.replace(/\b(NOME|FAIXA|DATA|PROFESSOR|MODALIDADE)\b/g, m => '{' + CAMPO[m] + '}');
        elementos.push(Object.assign(base, { tipo: 'texto', texto: comCampos }));
      });
    });
    return { img, elementos, ar: cv.width / cv.height };
  }
  async function pdfParaImagem(arrayBuffer) { return (await pdfParaModelo(arrayBuffer, false)).img; }

  /* ---------- Conteúdo da prova para o aluno ---------- */
  const COR_FAIXA = [['preta', '#111111'], ['marrom', '#5d3a1a'], ['roxa', '#6a1b9a'], ['azul escuro', '#0d2c6b'], ['azul', '#1565c0'],
    ['verde', '#2e7d32'], ['laranja', '#ef6c00'], ['amarela', '#f2c200'], ['branca', '#f5f5f5']];
  const corFaixa = f => { f = (f || '').toLowerCase(); for (const [k, c] of COR_FAIXA) if (f.includes(k)) return c; return '#888888'; };

  async function provaPdf(d) {
    // d: {mod, modNome, titulo, faixa, info:[], blocos:[{nome,tipo,linhas:[{t,x,escolha}]}]}
    const W = 1240, H = 1754, M = 90, F = 'Segoe UI, Arial, sans-serif';
    const kick = d.mod === 'kick';
    const AC = kick ? '#d0161f' : '#b3121b', AC2 = kick ? '#141414' : '#7a0c0c', PAPEL = kick ? '#ffffff' : '#fffaf0';
    const logo = await loadImg(kick ? window.LOGO_KICK : window.LOGO_GRD).catch(() => null);
    const pages = []; let cv, c, y;
    const rodape = () => {
      c.strokeStyle = AC; c.lineWidth = 3; c.beginPath(); c.moveTo(M, H - 80); c.lineTo(W - M, H - 80); c.stroke();
      c.font = '17px ' + F; c.fillStyle = '#777'; c.textAlign = 'left';
      c.fillText('Academia Athletic Center – Catalão GO  •  ' + d.modNome + '  •  ' + d.titulo, M, H - 48);
      c.textAlign = 'right'; c.fillText('página ' + pages.length, W - M, H - 48); c.textAlign = 'left';
    };
    const novaPagina = (primeira) => {
      cv = document.createElement('canvas'); cv.width = W; cv.height = H; c = cv.getContext('2d');
      c.fillStyle = PAPEL; c.fillRect(0, 0, W, H);
      if (logo) { c.globalAlpha = .05; c.drawImage(logo, W / 2 - 380, H / 2 - 300, 760, 760); c.globalAlpha = 1; }
      pages.push({ canvas: cv, w: 595, h: 842 });
      if (!primeira) {
        const g = c.createLinearGradient(0, 0, W, 0); g.addColorStop(0, AC2); g.addColorStop(1, AC);
        c.fillStyle = g; c.fillRect(0, 0, W, 90);
        if (logo) { c.fillStyle = '#fff'; c.beginPath(); c.arc(M + 30, 45, 34, 0, 7); c.fill(); c.drawImage(logo, M - 2, 13, 64, 64); }
        c.fillStyle = '#fff'; c.font = 'bold 26px ' + F; c.fillText('Conteúdo de Prova – ' + d.titulo, M + 85, 55);
        y = 130;
      }
      rodape();
    };
    const precisa = hh => { if (y + hh > H - 110) { novaPagina(false); return true; } return false; };

    // ----- capa / cabeçalho -----
    novaPagina(true);
    const g = c.createLinearGradient(0, 0, W, 320);
    if (kick) { g.addColorStop(0, '#0b0b0b'); g.addColorStop(.6, '#2a0507'); g.addColorStop(1, '#b3121b'); }
    else { g.addColorStop(0, '#5e080c'); g.addColorStop(.55, '#9b0f15'); g.addColorStop(1, '#d81f26'); }
    c.fillStyle = g; c.fillRect(0, 0, W, 300);
    c.globalAlpha = .12; c.fillStyle = '#fff'; for (let i = 0; i < 14; i++) { c.fillRect(W - 520 + i * 40, -40, 12, 380); } c.globalAlpha = 1;
    c.fillStyle = kick ? '#d0161f' : '#f3c66b'; c.fillRect(0, 300, W, 10);
    c.fillStyle = '#fff'; c.beginPath(); c.arc(M + 105, 150, 112, 0, 7); c.fill();
    c.strokeStyle = kick ? '#d0161f' : '#f3c66b'; c.lineWidth = 8; c.stroke();
    if (logo) c.drawImage(logo, M + 5, 50, 200, 200);
    c.fillStyle = '#fff'; c.font = '600 22px ' + F; c.fillText('A C A D E M I A', M + 250, 105);
    c.font = 'bold 54px ' + F; c.fillText('ATHLETIC CENTER', M + 250, 162);
    c.font = '24px ' + F; c.fillStyle = kick ? '#ff6b6b' : '#ffe3a3';
    c.fillText(kick ? 'K I C K B O X I N G   •   Catalão – GO' : 'K A R A T Ê - D Ō   S H O T O K A N   •   Catalão – GO', M + 250, 205);
    y = 370;
    c.fillStyle = AC; c.font = 'bold 22px ' + F; c.fillText('C O N T E Ú D O   D E   P R O V A', M, y); y += 62;
    c.fillStyle = '#1d1d1d'; c.font = 'bold 54px ' + F;
    const tl = wrap(c, d.titulo, W - 2 * M); tl.forEach(t => { c.fillText(t, M, y); y += 62; });
    // faixa (cinto)
    y += 6; const fc = corFaixa(d.faixa);
    c.save(); c.shadowColor = 'rgba(0,0,0,.25)'; c.shadowBlur = 10; c.shadowOffsetY = 4;
    c.fillStyle = fc; c.beginPath(); c.roundRect(M, y, W - 2 * M, 58, 10); c.fill(); c.restore();
    c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 2; for (const yy of [y + 14, y + 44]) { c.beginPath(); c.moveTo(M + 12, yy); c.lineTo(W - M - 12, yy); c.stroke(); }
    c.fillStyle = fc; c.save(); c.translate(W / 2, y + 29); c.fillRect(-46, -40, 92, 80); c.restore();
    const claro = ['#f5f5f5', '#f2c200'].includes(fc);
    c.fillStyle = claro ? '#222' : '#fff'; c.font = 'bold 24px ' + F; c.textAlign = 'center';
    c.fillText('Conquista: ' + (d.faixa || ''), W / 2, y + 38); c.textAlign = 'left'; y += 100;
    if (d.info && d.info.length) {
      c.font = '20px ' + F; let x = M;
      d.info.forEach(t => {
        const tw = c.measureText(t).width + 40; if (x + tw > W - M) { x = M; y += 50; }
        c.fillStyle = kick ? '#fde8e8' : '#f6ecd8'; c.beginPath(); c.roundRect(x, y - 30, tw, 42, 21); c.fill();
        c.fillStyle = AC2; c.fillText(t, x + 20, y - 2); x += tw + 12;
      });
      y += 50;
    }
    if (d.carencia) {
      c.save(); c.shadowColor = 'rgba(0,0,0,.15)'; c.shadowBlur = 8; c.shadowOffsetY = 3;
      c.fillStyle = kick ? '#141414' : '#fff3d6'; c.beginPath(); c.roundRect(M, y - 6, W - 2 * M, 74, 14); c.fill(); c.restore();
      c.fillStyle = AC; c.beginPath(); c.arc(M + 42, y + 31, 22, 0, 7); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 4; c.beginPath(); c.arc(M + 42, y + 31, 13, 0, 7); c.stroke();
      c.beginPath(); c.moveTo(M + 42, y + 22); c.lineTo(M + 42, y + 31); c.lineTo(M + 49, y + 36); c.stroke();
      c.font = '600 19px ' + F; c.fillStyle = kick ? '#ff6b6b' : '#8a5a00'; c.fillText('TEMPO MÍNIMO DE TREINO PARA FAZER A PROVA', M + 82, y + 22);
      c.font = 'bold 28px ' + F; c.fillStyle = kick ? '#fff' : '#3a2a20'; c.fillText(d.carencia, M + 82, y + 56);
      y += 96;
    }
    c.font = 'italic 19px ' + F; c.fillStyle = '#666';
    wrap(c, 'Estude todo o conteúdo abaixo. Na prova, cada técnica é avaliada de Muito insuficiente a Excepcional.', W - 2 * M).forEach(t => { c.fillText(t, M, y); y += 27; });
    y += 20;

    // ----- blocos -----
    d.blocos.forEach(b => {
      precisa(150);
      // título do bloco
      const bg = c.createLinearGradient(M, 0, W - M, 0); bg.addColorStop(0, AC2); bg.addColorStop(1, AC);
      c.fillStyle = bg; c.beginPath(); c.roundRect(M, y, W - 2 * M, 60, 12); c.fill();
      c.fillStyle = '#fff'; c.font = 'bold 30px ' + F; c.fillText(b.nome.toUpperCase(), M + 26, y + 41);
      const nItens = b.linhas.filter(l => l.t === 'i').length;
      const etiqueta = b.tipo === 'geral' ? 'avaliação geral' : b.tipo === 'req' ? 'requisitos' : nItens + (nItens === 1 ? ' item' : ' itens');
      c.font = '600 19px ' + F; c.textAlign = 'right'; c.fillText(etiqueta.toUpperCase(), W - M - 24, y + 38); c.textAlign = 'left';
      y += 82; let n = 0;
      b.linhas.forEach(l => {
        if (l.t === 's') {
          precisa(70); y += 6;
          c.fillStyle = AC; c.fillRect(M, y - 4, 6, 32);
          c.fillStyle = AC2; c.font = 'bold 22px ' + F; wrap(c, l.x.toUpperCase(), W - 2 * M - 30).forEach(t => { c.fillText(t, M + 20, y + 21); y += 30; });
          y += 10; return;
        }
        if (l.t === 'o') {
          c.font = 'italic 18px ' + F; const ls = wrap(c, l.x, W - 2 * M - 60); precisa(ls.length * 26 + 30);
          c.fillStyle = kick ? '#f4f4f4' : '#f7f0e2'; c.beginPath(); c.roundRect(M + 10, y - 6, W - 2 * M - 20, ls.length * 26 + 22, 8); c.fill();
          c.fillStyle = '#666'; ls.forEach(t => { c.fillText(t, M + 32, y + 20); y += 26; }); y += 26; return;
        }
        if (b.tipo === 'geral' || l.t === 'r') {
          c.font = '21px ' + F; const ls = wrap(c, l.x, W - 2 * M - 70); precisa(ls.length * 30 + 10);
          c.fillStyle = AC; c.beginPath(); c.arc(M + 26, y + 12, 6, 0, 7); c.fill();
          c.fillStyle = '#222'; ls.forEach(t => { c.fillText(t, M + 48, y + 20); y += 30; }); y += 6; return;
        }
        n++;
        c.font = '21px ' + F; const ls = wrap(c, l.x, W - 2 * M - 90); const hh = Math.max(52, ls.length * 30 + 22);
        precisa(hh + (l.escolha ? 30 : 0));
        if (n % 2 === 0) { c.fillStyle = kick ? 'rgba(0,0,0,.035)' : 'rgba(179,18,27,.045)'; c.fillRect(M, y - 8, W - 2 * M, hh + (l.escolha ? 30 : 0)); }
        c.fillStyle = AC; c.beginPath(); c.arc(M + 26, y + 16, 19, 0, 7); c.fill();
        c.fillStyle = '#fff'; c.font = 'bold 19px ' + F; c.textAlign = 'center'; c.fillText(String(n), M + 26, y + 23); c.textAlign = 'left';
        c.fillStyle = '#1d1d1d'; c.font = '21px ' + F; let yy = y; ls.forEach(t => { c.fillText(t, M + 62, yy + 23); yy += 30; });
        if (l.escolha) { c.font = 'italic 18px ' + F; c.fillStyle = AC; c.fillText('Kata/técnica à escolha: __________________________', M + 62, yy + 22); yy += 30; }
        y = Math.max(yy, y + 40) + 14;
      });
      if (b.tipo === 'geral') { c.font = 'italic 18px ' + F; c.fillStyle = '#777'; precisa(40); c.fillText('Este bloco recebe uma avaliação geral na prova.', M + 48, y + 16); y += 34; }
      y += 26;
    });
    // mensagem final
    precisa(140); y += 10;
    c.fillStyle = kick ? '#141414' : '#f6ecd8'; c.beginPath(); c.roundRect(M, y, W - 2 * M, 100, 14); c.fill();
    c.fillStyle = kick ? '#fff' : AC2; c.font = 'bold 26px ' + F; c.textAlign = 'center';
    c.fillText(kick ? 'Disciplina, foco e respeito. Bons treinos!' : 'Oss! Treine com disciplina, foco e respeito.', W / 2, y + 48);
    c.font = '19px ' + F; c.fillStyle = kick ? '#ff6b6b' : '#7b6a58'; c.fillText('Academia Athletic Center – Catalão GO', W / 2, y + 80); c.textAlign = 'left';
    return buildPdf(pages);
  }

  window.PDF = { resultadoPdf, provaPdf, modeloPadrao, fundoCanvas, renderModelo, modeloPdf, pdfParaImagem, pdfParaModelo, fonteCss };
})();
