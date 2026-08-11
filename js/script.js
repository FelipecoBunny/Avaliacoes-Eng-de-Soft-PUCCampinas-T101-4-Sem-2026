// Caminho do arquivo de dados (relativo, funciona no GitHub Pages)
const DATA_URL = 'data/materias.json';

async function init() {
  try {
    const resposta = await fetch(DATA_URL);
    const dados = await resposta.json();
    const materias = dados.materias.map(prepararMateria);

    renderSemana(materias);
    renderMaterias(materias);
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

// Recebe uma matéria do JSON e devolve com as avaliações já
// ordenadas por data e com o "status" calculado (concluida / proxima / futura)
function prepararMateria(materia) {
  const hoje = hojeSemHora();

  const avaliacoes = materia.avaliacoes
    .map(a => ({ ...a, dataObj: new Date(a.data + 'T00:00:00') }))
    .sort((a, b) => a.dataObj - b.dataObj);

  let jaTemProxima = false;
  avaliacoes.forEach(a => {
    if (a.dataObj < hoje) {
      a.status = 'concluida';
    } else if (!jaTemProxima) {
      a.status = 'proxima';
      jaTemProxima = true;
    } else {
      a.status = 'futura';
    }
  });

  return { ...materia, avaliacoes };
}

function iconePorStatus(status) {
  return { concluida: '✓', proxima: '❗', futura: '📅' }[status] || '📅';
}

function formatarData(dataObj) {
  return dataObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

// ---------- Seção "Essa semana" ----------
function renderSemana(materias) {
  const hoje = hojeSemHora();
  const limite = new Date(hoje);
  limite.setDate(limite.getDate() + 7);

  const daSemana = [];
  materias.forEach(m => {
    m.avaliacoes.forEach(a => {
      if (a.dataObj >= hoje && a.dataObj <= limite) {
        daSemana.push({ ...a, materiaNome: m.nome, professorNome: m.professor.nome });
      }
    });
  });
  daSemana.sort((a, b) => a.dataObj - b.dataObj);

  const container = document.getElementById('semana-lista');

  if (daSemana.length === 0) {
    container.innerHTML = '<p class="semana-vazia">Nenhuma prova ou trabalho nos próximos 7 dias 🎉</p>';
    return;
  }

  container.innerHTML = daSemana.map(a => `
    <article class="semana-card">
      <p class="semana-card__materia">${escapeHtml(a.materiaNome)}</p>
      <p class="semana-card__professor">${escapeHtml(a.professorNome)}</p>
      <p class="semana-card__data">${formatarData(a.dataObj)}</p>
      <p class="semana-card__avaliacao">${escapeHtml(a.nome)}</p>
    </article>
  `).join('');
}

// ---------- Grid de matérias ----------
function renderMaterias(materias) {
  const grid = document.getElementById('materias-grid');
  grid.innerHTML = materias.map(materiaParaHtml).join('');

  // Depois de inserir no DOM, liga o evento de calcular média em cada input
  materias.forEach(m => {
    const card = document.querySelector(`[data-materia-id="${m.id}"]`);
    card.querySelectorAll('input[data-id]').forEach(input => {
      input.addEventListener('input', () => atualizarMedia(m, card));
    });
  });
}

function materiaParaHtml(m) {
  return `
    <article class="materia-card" data-materia-id="${m.id}">
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
        ${m.avaliacoes.map(avaliacaoParaHtml).join('')}
      </div>
      <footer class="materia-card__footer">
        <span>Média simulada</span>
        <strong class="media-valor" data-media>—</strong>
      </footer>
    </article>
  `;
}

function avaliacaoParaHtml(a) {
  return `
    <div class="avaliacao-row ${a.status}">
      <span class="avaliacao-nome">${iconePorStatus(a.status)} ${escapeHtml(a.nome)}: ${formatarData(a.dataObj)}</span>
      <input type="number" min="0" max="10" step="0.1" placeholder="nota" data-id="${a.id}">
    </div>
  `;
}

// Recalcula a média sempre que uma nota é digitada.
// Só calcula quando TODAS as notas da matéria estiverem preenchidas.
function atualizarMedia(materia, card) {
  const inputs = card.querySelectorAll('input[data-id]');
  const valores = {};
  let completo = true;

  inputs.forEach(input => {
    const valor = input.value.trim().replace(',', '.');
    if (valor === '') {
      completo = false;
      return;
    }
    valores[input.dataset.id] = parseFloat(valor);
  });

  const saida = card.querySelector('[data-media]');

  if (!completo) {
    saida.textContent = '—';
    saida.className = 'media-valor';
    return;
  }

  try {
    // Monta uma função com as notas como variáveis e roda a fórmula do JSON
    const nomes = Object.keys(valores);
    const numeros = Object.values(valores);
    const resultado = new Function(...nomes, `return ${materia.formula};`)(...numeros);

    saida.textContent = resultado.toFixed(2);
    saida.className = 'media-valor ' + (resultado >= 6 ? 'aprovado' : 'reprovando');
  } catch (erro) {
    saida.textContent = 'erro na fórmula';
    saida.className = 'media-valor';
    console.error(`Erro ao calcular a média de "${materia.nome}":`, erro);
  }
}

// Evita que nome de matéria/professor vindo do JSON quebre o HTML
function escapeHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

init();
