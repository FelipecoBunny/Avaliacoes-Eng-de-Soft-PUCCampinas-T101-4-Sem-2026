// Caminhos dos arquivos de dados (relativos, funcionam no GitHub Pages)
const DATA_URL = 'data/materias.json';
const NOTAS_URL = 'data/notas.json';
const EMENTAS_URL = 'data/ementas.json';

// Índices por id de matéria, montados no init() e usados pelo modal
let materiasIndex = {};
let notasIndex = {};
let ementasIndex = {};

// Estado do "calcular automaticamente" dentro do modal aberto no momento.
// Formato por variável: { ativo, qtd, pesos, valores: [], pesosValores: [] }
// É reiniciado toda vez que o modal abre (mesmo comportamento dos inputs manuais).
let expansaoState = {};

// Conjunto único de ícones (mesma família visual: traço 2px, cantos arredondados)
const ICONES = {
  concluida: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8.3 12.5l2.4 2.4L16 9.3"/></svg>',
  proxima: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="7.5" x2="12" y2="13.2"/><circle cx="12" cy="16.4" r="0.6" fill="currentColor" stroke="none"/></svg>',
  futura: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><line x1="3.5" y1="10" x2="20.5" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/></svg>',
};

function iconePorStatus(status) {
  const svg = ICONES[status] || ICONES.futura;
  return `<span class="icone icone--${status}">${svg}</span>`;
}

const ICONE_SETA = '<span class="icone icone--seta"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/></svg></span>';

const ICONE_CALC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="12" x2="8" y2="12.01"/><line x1="12" y1="12" x2="12" y2="12.01"/><line x1="16" y1="12" x2="16" y2="12.01"/><line x1="8" y1="16" x2="8" y2="16.01"/><line x1="12" y1="16" x2="12" y2="16.01"/><line x1="16" y1="16" x2="16" y2="16.01"/></svg>';

async function init() {
  try {
    const [respMaterias, respNotas, respEmentas] = await Promise.all([
      fetch(DATA_URL, { cache: 'no-store' }),
      fetch(NOTAS_URL, { cache: 'no-store' }),
      fetch(EMENTAS_URL, { cache: 'no-store' }),
    ]);
    const dados = await respMaterias.json();
    const dadosNotas = respNotas.ok ? await respNotas.json() : { notas: [] };
    const dadosEmentas = respEmentas.ok ? await respEmentas.json() : { ementas: [] };

    const materias = dados.materias.map(prepararMateria);
    materias.forEach(m => { materiasIndex[m.id] = m; });
    dadosNotas.notas.forEach(n => { notasIndex[n.id] = n; });
    dadosEmentas.ementas.forEach(e => { ementasIndex[e.id] = e; });

    renderSemana(materias);
    renderMaterias(materias);
    configurarModal();
  } catch (erro) {
    document.getElementById('materias-grid').innerHTML =
      '<p class="erro">Não foi possível carregar os dados. Confira o arquivo data/materias.json.</p>';
    console.error(erro);
  }
}

// Data de hoje, zerando as horas pra comparar só o dia
function hojeSemHora() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Recebe o valor bruto de "data" do JSON e devolve ou um objeto Date válido,
// ou um texto especial pra quando não tem data de verdade.
function resolverData(bruto) {
  if (bruto === 0 || bruto === '0') {
    return { dataObj: null, textoEspecial: 'Sem data' };
  }
  if (bruto === undefined || bruto === null || bruto === '') {
    return { dataObj: null, textoEspecial: 'Não definido' };
  }
  const d = new Date(bruto + 'T00:00:00');
  if (isNaN(d.getTime())) {
    return { dataObj: null, textoEspecial: 'Não definido' };
  }
  return { dataObj: d, textoEspecial: null };
}

// Recebe uma matéria do JSON e devolve com as avaliações já
// ordenadas por data (as sem data vão pro final) e com o "status"
// calculado (concluida / proxima / futura)
function prepararMateria(materia) {
  const hoje = hojeSemHora();
  const limite = new Date(hoje);
  limite.setDate(limite.getDate() + 7);

  const avaliacoes = materia.avaliacoes
    .map(a => ({ ...a, ...resolverData(a.data) }))
    .sort((a, b) => {
      if (!a.dataObj && !b.dataObj) return 0;
      if (!a.dataObj) return 1;
      if (!b.dataObj) return -1;
      return a.dataObj - b.dataObj;
    });

  avaliacoes.forEach(a => {
    if (!a.dataObj) {
      a.status = 'futura'; // sem data conhecida -> tratada como card normal
    } else if (a.dataObj < hoje) {
      a.status = 'concluida';
    } else if (a.dataObj <= limite) {
      a.status = 'proxima'; // dentro dos próximos 7 dias -> destaque
    } else {
      a.status = 'futura'; // mais longe -> card normal
    }
  });

  return { ...materia, avaliacoes };
}

function formatarData(dataObj) {
  return dataObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function formatarNumero(n) {
  return n.toFixed(2).replace('.', ',');
}

// Texto de data pra exibir: usa o texto especial (Não definido / Sem data)
// quando não há uma data válida, senão formata normalmente.
function textoData(a) {
  return a.textoEspecial ?? formatarData(a.dataObj);
}

// ---------- Seção "Essa semana" ----------
function renderSemana(materias) {
  const hoje = hojeSemHora();
  const limite = new Date(hoje);
  limite.setDate(limite.getDate() + 7);

  const daSemana = [];
  materias.forEach(m => {
    m.avaliacoes.forEach(a => {
      if (a.dataObj && a.dataObj >= hoje && a.dataObj <= limite) {
        daSemana.push({ ...a, materiaNome: m.nome, professorNome: m.professor.nome });
      }
    });
  });
  daSemana.sort((a, b) => a.dataObj - b.dataObj);

  const container = document.getElementById('semana-lista');

  if (daSemana.length === 0) {
    container.innerHTML = `
      <p class="semana-vazia">${iconePorStatus('concluida')} Nenhuma prova ou trabalho nos próximos 7 dias</p>
    `;
    return;
  }

  container.innerHTML = daSemana.map(a => `
    <article class="semana-card">
      <div class="semana-card__topo">
        <span class="semana-card__avaliacao">${iconePorStatus('proxima')}<span>${escapeHtml(a.nome)}</span></span>
        <span class="semana-card__data">${formatarData(a.dataObj)}</span>
      </div>
      <p class="semana-card__materia">${escapeHtml(a.materiaNome)}</p>
      <p class="semana-card__professor">${escapeHtml(a.professorNome)}</p>
    </article>
  `).join('');
}

// ---------- Grid de matérias ----------
function renderMaterias(materias) {
  const grid = document.getElementById('materias-grid');
  grid.innerHTML = materias.map(materiaParaHtml).join('');
}

function materiaParaHtml(m) {
  const semAvaliacoes = m.avaliacoes.length === 0;
  const corpoAvaliacoes = semAvaliacoes
    ? '<p class="avaliacoes-vazio">Nenhuma avaliação encontrada</p>'
    : m.avaliacoes.map(avaliacaoParaHtml).join('');

  const ementa = ementasIndex[m.id];
  const textoEmenta = ementa?.ementaAntiga ? 'Abrir Ementa (Desatualizada)' : 'Abrir Ementa';
  const textoSimular = ementa?.ementaAntiga ? 'Simular Média (Desatualizado)' : 'Simular Média';

  return `
    <article class="materia-card">
      <header class="materia-card__header">
        <img class="materia-card__foto" src="${m.professor.foto}"
             alt="Foto de ${escapeHtml(m.professor.nome)}"
             onerror="this.style.display='none'">
        <div>
          <h3>${escapeHtml(m.nome)}</h3>
          <p>${escapeHtml(m.professor.nome)}</p>
        </div>
      </header>
      <div class="materia-card__body">
        ${corpoAvaliacoes}
        <div class="materia-card__acoes${semAvaliacoes ? ' materia-card__acoes--vazio' : ''}">
          <button type="button" class="link-ementa" data-materia-id="${m.id}">
            <span>${textoEmenta}</span>
            ${ICONE_SETA}
          </button>
          <button type="button" class="btn-simular" data-materia-id="${m.id}">${textoSimular}</button>
        </div>
      </div>
    </article>
  `;
}

function avaliacaoParaHtml(a) {
  return `
    <div class="avaliacao-row avaliacao-row--${a.status}">
      <span class="avaliacao-label">${iconePorStatus(a.status)}<span class="avaliacao-nome">${escapeHtml(a.nome)}</span></span>
      <span class="avaliacao-data">${textoData(a)}</span>
    </div>
  `;
}

// Evita que nome de matéria/professor vindo do JSON quebre o HTML
function escapeHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

// Abre em nova aba o link de ementa cadastrado pra essa matéria no
// ementas.json. Se o campo ainda não foi preenchido, não faz nada.
function abrirEmenta(materiaId) {
  const link = ementasIndex[materiaId]?.link;
  if (!link) return;
  window.open(link, '_blank', 'noopener');
}

// ---------- Modal "Simular média" ----------
function configurarModal() {
  const overlay = document.getElementById('modal-overlay');

  // Delegação: um único listener cuida de todos os botões "Simular notas",
  // mesmo que a grade seja re-renderizada depois
  document.getElementById('materias-grid').addEventListener('click', (evento) => {
    const botaoSimular = evento.target.closest('.btn-simular');
    if (botaoSimular) abrirModal(botaoSimular.dataset.materiaId);

    const botaoEmenta = evento.target.closest('.link-ementa');
    if (botaoEmenta) abrirEmenta(botaoEmenta.dataset.materiaId);
  });

  document.getElementById('modal-fechar').addEventListener('click', fecharModal);
  overlay.addEventListener('click', (evento) => {
    if (evento.target === overlay) fecharModal();
  });
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && !overlay.hidden) fecharModal();
  });
}

function abrirModal(materiaId) {
  const materia = materiasIndex[materiaId];
  const notas = notasIndex[materiaId];
  if (!materia || !notas) return;

  expansaoState = {}; // cada abertura de modal começa com os painéis fechados

  document.getElementById('modal-foto').src = materia.professor.foto;
  document.getElementById('modal-foto').style.display = '';
  document.getElementById('modal-foto').alt = `Foto de ${materia.professor.nome}`;
  document.getElementById('modal-titulo').textContent = materia.nome;
  document.getElementById('modal-professor').textContent = materia.professor.nome;

  const camposEl = document.getElementById('modal-campos');
  camposEl.innerHTML = notas.variaveis.map(v => `
    <div class="modal-campo">
      <div class="modal-linha">
        <span class="modal-linha__nome">${escapeHtml(v.nomeExibicao)} <span class="modal-linha__sigla">(${escapeHtml(v.variavel)})</span></span>
        <input type="text" inputmode="decimal" class="modal-input" data-variavel="${v.variavel}" placeholder="${v.necessary === false ? 'Opc.' : '0,0'}" autocomplete="off">
      </div>
      ${v.notaMaxima !== undefined ? `
      <p class="modal-nota-maxima" id="nota-maxima-${v.variavel}">Nota Máxima: ${formatarNumero(v.notaMaxima)}</p>
      ` : ''}
      ${v.expansivel ? `
      <div class="modal-calc-linha">
        <button type="button" class="modal-calc-toggle" data-variavel="${v.variavel}" aria-expanded="false" aria-controls="expand-${v.variavel}" title="Calcular automaticamente">${ICONE_CALC}<span>Calcular Média</span></button>
      </div>
      <div id="expand-${v.variavel}" class="modal-expand" hidden></div>
      ` : ''}
    </div>
  `).join('');

  camposEl.querySelectorAll('.modal-input').forEach(input => {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/[^0-9,.]/g, ''); // só números, vírgula e ponto
      calcularMediaModal(notas);
    });
  });

  camposEl.querySelectorAll('.modal-calc-toggle').forEach(botao => {
    botao.addEventListener('click', () => alternarExpansao(botao.dataset.variavel, notas));
  });

  document.getElementById('modal-media-valor').textContent = '—';

  const alvoFormula = document.getElementById('modal-formula-katex');
  alvoFormula.innerHTML = '';
  try {
    katex.render(notas.formulaLatex, alvoFormula, { throwOnError: false, displayMode: true });
  } catch (erro) {
    alvoFormula.textContent = notas.formula;
  }

  const tituloFormula = document.getElementById('modal-formula-titulo');
  tituloFormula.textContent = ementasIndex[materiaId]?.ementaAntiga
    ? 'Fórmula (Ementa Desatualizada)'
    : 'Fórmula';

  const overlay = document.getElementById('modal-overlay');
  overlay.hidden = false;
  document.body.style.overflow = 'hidden';
  camposEl.querySelector('.modal-input')?.focus();
}

function fecharModal() {
  document.getElementById('modal-overlay').hidden = true;
  document.body.style.overflow = '';
}

// Recalcula a média final do modal; só calcula quando todos os campos
// estiverem preenchidos. O resultado sempre é exibido com vírgula.
function calcularMediaModal(notas) {
  const inputs = document.querySelectorAll('#modal-campos .modal-input[data-variavel]');
  const valores = {};
  let completo = true;
  let acimaDoMaximo = false;

  inputs.forEach(input => {
    const variavel = input.dataset.variavel;
    const infoVariavel = notas.variaveis.find(v => v.variavel === variavel);
    const bruto = input.value.trim().replace(',', '.');
    const numero = parseFloat(bruto);
    const valido = bruto !== '' && !isNaN(numero);
    const opcional = infoVariavel?.necessary === false;

    if (valido) {
      valores[variavel] = numero;
    } else if (opcional) {
      valores[variavel] = 0; // campo opcional vazio não trava o cálculo
    } else {
      completo = false;
    }

    if (infoVariavel?.notaMaxima !== undefined) {
      const excedeu = valido && numero > infoVariavel.notaMaxima;
      if (excedeu) acimaDoMaximo = true;
      document.getElementById(`nota-maxima-${variavel}`)
        ?.classList.toggle('modal-nota-maxima--erro', excedeu);
    }
  });

  const saida = document.getElementById('modal-media-valor');
  saida.classList.remove('modal-media-valor--erro');

  if (acimaDoMaximo) {
    saida.textContent = 'Valor acima do permitido';
    saida.classList.add('modal-media-valor--erro');
    return;
  }

  if (!completo) {
    saida.textContent = '—';
    return;
  }

  try {
    const nomes = Object.keys(valores);
    const numeros = Object.values(valores);
    const resultado = new Function(...nomes, `return ${notas.formula};`)(...numeros);
    saida.textContent = resultado.toFixed(2).replace('.', ',');
  } catch (erro) {
    saida.textContent = 'erro na fórmula';
    saida.classList.add('modal-media-valor--erro');
    console.error(`Erro ao calcular a média de "${notas.id}":`, erro);
  }
}

// ---------- Cálculo automático (média expansível) ----------
const EXPANSAO_QTD_MIN = 1;
const EXPANSAO_QTD_MAX = 10;

// Abre/fecha o painel de uma variável. Ao fechar, o input principal volta
// a ser editável manualmente, mantendo o último valor calculado.
function alternarExpansao(variavel, notas) {
  if (!expansaoState[variavel]) {
    expansaoState[variavel] = { ativo: false, qtd: 2, pesos: false, valores: [], pesosValores: [] };
  }
  const state = expansaoState[variavel];
  state.ativo = !state.ativo;

  const painel = document.getElementById(`expand-${variavel}`);
  const botao = document.querySelector(`.modal-calc-toggle[data-variavel="${variavel}"]`);
  const inputPrincipal = document.querySelector(`.modal-input[data-variavel="${variavel}"]`);

  if (state.ativo) {
    renderPainelExpansao(variavel, notas);
    painel.hidden = false;
    botao.classList.add('modal-calc-toggle--ativo');
    botao.setAttribute('aria-expanded', 'true');
    botao.title = 'Voltar para entrada manual';
    inputPrincipal.readOnly = true;
    inputPrincipal.classList.add('modal-input--calculado');
    atualizarValorCalculado(variavel, notas);
  } else {
    painel.hidden = true;
    botao.classList.remove('modal-calc-toggle--ativo');
    botao.setAttribute('aria-expanded', 'false');
    botao.title = 'Calcular automaticamente';
    inputPrincipal.readOnly = false;
    inputPrincipal.classList.remove('modal-input--calculado');
    calcularMediaModal(notas);
  }
}

// Desenha (ou redesenha, ao mudar quantidade/pesos) o conteúdo do painel:
// stepper de quantidade, checkbox de pesos e o grid de notas.
function renderPainelExpansao(variavel, notas) {
  const state = expansaoState[variavel];
  const painel = document.getElementById(`expand-${variavel}`);

  painel.innerHTML = `
    <div class="modal-expand__linha">
      <span class="modal-expand__label">Quantidade de notas</span>
      <div class="modal-stepper" role="group" aria-label="Quantidade de notas">
        <button type="button" class="modal-stepper__btn" data-acao="menos" aria-label="Diminuir quantidade">−</button>
        <span class="modal-stepper__valor">${state.qtd}</span>
        <button type="button" class="modal-stepper__btn" data-acao="mais" aria-label="Aumentar quantidade">+</button>
      </div>
    </div>
    <div class="modal-expand__linha">
      <label class="modal-expand__label" for="pesos-${variavel}">Notas têm pesos diferentes</label>
      <input type="checkbox" id="pesos-${variavel}" class="modal-checkbox" ${state.pesos ? 'checked' : ''}>
    </div>
    <div class="modal-expand-notas">${gerarNotasGridHtml(state)}</div>
  `;

  painel.querySelector('[data-acao="menos"]').addEventListener('click', () => alterarQtd(variavel, notas, -1));
  painel.querySelector('[data-acao="mais"]').addEventListener('click', () => alterarQtd(variavel, notas, 1));

  painel.querySelector(`#pesos-${variavel}`).addEventListener('change', (evento) => {
    state.pesos = evento.target.checked;
    renderPainelExpansao(variavel, notas); // redesenha pra mostrar/esconder os campos de peso
    atualizarValorCalculado(variavel, notas);
  });

  anexarListenersNotasGrid(variavel, notas);
}

function gerarNotasGridHtml(state) {
  let html = '';
  for (let i = 0; i < state.qtd; i++) {
    const valor = state.valores[i];
    const peso = state.pesosValores[i];
    html += `
      <div class="modal-nota-mini">
        <label>Nota ${i + 1}</label>
        <input type="text" inputmode="decimal" class="modal-input modal-input--sm" data-idx="${i}" data-tipo="valor" placeholder="0,0" value="${valor === undefined ? '' : String(valor).replace('.', ',')}" autocomplete="off">
        ${state.pesos ? `<input type="text" inputmode="decimal" class="modal-input modal-input--sm modal-input--peso" data-idx="${i}" data-tipo="peso" placeholder="peso" value="${peso === undefined ? '' : String(peso).replace('.', ',')}" autocomplete="off">` : ''}
      </div>
    `;
  }
  return html;
}

function anexarListenersNotasGrid(variavel, notas) {
  const state = expansaoState[variavel];
  const painel = document.getElementById(`expand-${variavel}`);

  painel.querySelectorAll('.modal-nota-mini input').forEach(input => {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/[^0-9,.]/g, '');
      const idx = Number(input.dataset.idx);
      const bruto = input.value.trim().replace(',', '.');
      const numero = bruto === '' ? undefined : parseFloat(bruto);
      const destino = input.dataset.tipo === 'valor' ? state.valores : state.pesosValores;
      destino[idx] = isNaN(numero) ? undefined : numero;
      atualizarValorCalculado(variavel, notas);
    });
  });
}

function alterarQtd(variavel, notas, delta) {
  const state = expansaoState[variavel];
  const novaQtd = Math.min(EXPANSAO_QTD_MAX, Math.max(EXPANSAO_QTD_MIN, state.qtd + delta));
  if (novaQtd === state.qtd) return;
  state.qtd = novaQtd;
  renderPainelExpansao(variavel, notas);
  atualizarValorCalculado(variavel, notas);
}

// Média simples ou ponderada (soma dos pesos como divisor, sem exigir que
// os pesos somem 1 ou 100 — só a proporção entre eles importa).
// Retorna null enquanto os campos necessários não estiverem completos.
function calcularMediaExpansao(state) {
  const valores = state.valores.slice(0, state.qtd);
  if (valores.length < state.qtd || valores.some(v => typeof v !== 'number' || isNaN(v))) {
    return null;
  }

  if (!state.pesos) {
    const soma = valores.reduce((acc, v) => acc + v, 0);
    return soma / valores.length;
  }

  const pesos = state.pesosValores.slice(0, state.qtd);
  if (pesos.length < state.qtd || pesos.some(p => typeof p !== 'number' || isNaN(p) || p < 0)) {
    return null;
  }
  const somaPesos = pesos.reduce((acc, p) => acc + p, 0);
  if (somaPesos === 0) return null;

  const somaPonderada = valores.reduce((acc, v, i) => acc + v * pesos[i], 0);
  return somaPonderada / somaPesos;
}

// Recalcula a média do painel e reflete no input principal (readonly),
// disparando também o recálculo da média final do modal.
function atualizarValorCalculado(variavel, notas) {
  const state = expansaoState[variavel];
  const media = calcularMediaExpansao(state);
  const inputPrincipal = document.querySelector(`.modal-input[data-variavel="${variavel}"]`);
  inputPrincipal.value = media === null ? '' : media.toFixed(2).replace('.', ',');
  calcularMediaModal(notas);
}

init();