// ===== Dados de exemplo, motor de cálculo e utilitários =====
const STORAGE_KEY = "zeta-comissoes-v2";

const COLABORADORES = [
  { id: 1, nome: "Ana Souza", equipe: "Crédito", meta: 1500 },
  { id: 2, nome: "Bruno Lima", equipe: "Investimentos", meta: 1200 },
  { id: 3, nome: "Carla Mendes", equipe: "Crédito", meta: 1500 },
  { id: 4, nome: "Diego Alves", equipe: "Serviços", meta: 900 },
];

// Usuários simulados (protótipo sem backend: não substitui autenticação real).
// Segregação de funções: quem importa/ajusta não aprova; quem aprova não paga.
const USUARIOS = [
  ...COLABORADORES.map((c) => ({ id: "c" + c.id, nome: c.nome, perfil: "colaborador", colaboradorId: c.id })),
  { id: "g1", nome: "Marcos Gestor", perfil: "gestor" },
  { id: "g2", nome: "Paula Gestora", perfil: "gestor" },
  { id: "f1", nome: "Fernanda Financeiro", perfil: "financeiro" },
  { id: "f2", nome: "Ricardo Financeiro", perfil: "financeiro" },
];

// Regras são versionadas: nunca são apagadas, apenas encerradas (vigenciaFim) e substituídas.
const REGRAS_INICIAIS = [
  { id: 1, produto: "Crédito Pessoal", tipo: "percentual", percentual: 2.5, carenciaDias: 0, vigenciaInicio: "2026-01-01", vigenciaFim: null, versao: 1 },
  { id: 2, produto: "Investimentos", tipo: "escalonado", carenciaDias: 0, vigenciaInicio: "2026-01-01", vigenciaFim: null, versao: 1,
    faixas: [{ ate: 50000, percentual: 0.5 }, { ate: 200000, percentual: 0.8 }, { ate: null, percentual: 1.2 }] },
  { id: 3, produto: "Serviços Personalizados", tipo: "fixo", valorFixo: 150, carenciaDias: 0, vigenciaInicio: "2026-01-01", vigenciaFim: null, versao: 1 },
];

const CSV_EXEMPLO = `colaborador;produto;cliente;valor;data;status
Ana Souza;Crédito Pessoal;Mercado Bom Preço;40000;2026-11-03;liquidada
Ana Souza;Crédito Pessoal;Padaria Central;15000;2026-11-05;liquidada
Bruno Lima;Investimentos;Fernanda Rocha;120000;2026-11-04;liquidada
Bruno Lima;Investimentos;Oficina Lopes;30000;2026-11-06;liquidada
Carla Mendes;Crédito Pessoal;Clínica Vida;55000;2026-11-02;liquidada
Diego Alves;Serviços Personalizados;Ótica Visão;0;2026-11-07;liquidada
Diego Alves;Serviços Personalizados;Studio Lume;1;2026-11-07;liquidada
Carla Mendes;Seguro Auto;Rafael Dias;8000;2026-11-08;liquidada
Eduardo Reis;Crédito Pessoal;Loja Sol;10000;2026-11-08;liquidada
Ana Souza;Crédito Pessoal;Café Aurora;12000;2026-11-08;cancelada`;

const brl = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const agora = () => new Date().toLocaleString("pt-BR");
const hoje = () => new Date().toISOString().slice(0, 10);
const nomeDe = (id) => (COLABORADORES.find((c) => c.id === id) || {}).nome || "—";
const somaDias = (iso, dias) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10); };

// Regra vigente na data da operação (a versão mais nova entre as que cobrem a data)
function regraVigente(produto, data, regras) {
  return regras
    .filter((r) => r.produto === produto && r.vigenciaInicio <= data && (!r.vigenciaFim || data <= r.vigenciaFim))
    .sort((a, b) => b.versao - a.versao)[0] || null;
}

// Cálculo determinístico em centavos inteiros (sem erro de ponto flutuante acumulado)
function calcular(produto, base, regras, data = hoje()) {
  const r = regraVigente(produto, data, regras);
  if (!r) return null;
  const baseC = Math.round(base * 100);
  let centavos, descricao;
  if (r.tipo === "percentual") {
    centavos = Math.round((baseC * r.percentual) / 100);
    descricao = `${r.percentual}% sobre ${brl(base)}`;
  } else if (r.tipo === "escalonado") {
    const f = r.faixas.find((f) => f.ate === null || base <= f.ate);
    centavos = Math.round((baseC * f.percentual) / 100);
    descricao = `Faixa escalonada ${f.percentual}% sobre ${brl(base)}`;
  } else {
    centavos = Math.round(r.valorFixo * 100);
    descricao = `Valor fixo de ${brl(r.valorFixo)} por operação`;
  }
  return { valor: centavos / 100, descricao: `${descricao} (regra #${r.id} v${r.versao})`, regraId: r.id, regraVersao: r.versao, carenciaDias: r.carenciaDias || 0 };
}

// Chave natural da operação: impede duplicar comissões ao reimportar o mesmo arquivo
const chaveOperacao = (nome, produto, cliente, valor, data) =>
  [nome, produto, cliente, Number(valor).toFixed(2), data].map((s) => String(s).trim().toLowerCase()).join("|");

// Importa vendas (CSV com ";") -> valida -> calcula. Linhas ruins ou repetidas voltam como erros.
function importarCsv(texto, regras, chavesExistentes = [], autor = "sistema") {
  const validas = [], erros = [];
  const vistas = new Set(chavesExistentes);
  texto.split("\n").map((l) => l.trim()).filter(Boolean).forEach((l) => {
    if (/^colaborador/i.test(l)) return;
    const [nome, produto, cliente, v, data, status] = l.split(";").map((s) => (s || "").trim());
    const valor = parseFloat((v || "").replace(",", "."));
    const col = COLABORADORES.find((c) => c.nome.toLowerCase() === (nome || "").toLowerCase());
    const chave = chaveOperacao(nome, produto, cliente, valor, data);
    const motivo = !col ? "Colaborador não cadastrado"
      : !(valor > 0) ? "Valor inválido"
      : !/^\d{4}-\d{2}-\d{2}$/.test(data) ? "Data inválida (use AAAA-MM-DD)"
      : (status || "").toLowerCase() === "cancelada" ? "Operação cancelada, não gera comissão"
      : (status || "").toLowerCase() !== "liquidada" ? "Operação não liquidada, não gera comissão"
      : !regraVigente(produto, data, regras) ? "Produto sem regra de comissão vigente na data da operação"
      : vistas.has(chave) ? "Operação já importada (duplicada)"
      : null;
    if (motivo) return erros.push({ linha: l, motivo });
    vistas.add(chave);
    const c = calcular(produto, valor, regras, data);
    validas.push({
      colaboradorId: col.id, produto, cliente, base: valor, data, chave,
      valor: c.valor, regra: c.descricao, regraId: c.regraId, regraVersao: c.regraVersao,
      elegivelEm: somaDias(data, c.carenciaDias),
      status: "Calculada", contestacao: null, criadoPor: autor, aprovadoPor: null, pagoPor: null,
      historico: [{ em: agora(), por: autor, msg: "Comissão calculada: " + c.descricao }],
    });
  });
  return { validas, erros };
}

// Devolve a comissão com novo status. O histórico só cresce (append-only) e guarda quem agiu.
const evolui = (c, status, msg, por, extra = {}) =>
  ({ ...c, ...extra, status, historico: [...c.historico, Object.freeze({ em: agora(), por, msg })] });

// Regras de segregação de funções. Devolve o motivo do bloqueio ou null.
function bloqueioAprovar(c, usuario) {
  if (usuario.perfil !== "gestor") return "Somente gestores aprovam comissões.";
  if (c.criadoPor === usuario.nome || c.ajustadoPor === usuario.nome) return "Quem calculou ou ajustou não pode aprovar a mesma comissão.";
  if (c.elegivelEm > hoje()) return `Comissão em carência até ${c.elegivelEm}.`;
  return null;
}
function bloqueioPagar(c, usuario) {
  if (usuario.perfil !== "financeiro") return "Somente o financeiro processa pagamentos.";
  if (c.aprovadoPor === usuario.nome) return "Quem aprovou não pode pagar a mesma comissão.";
  return null;
}

// Gestor ou financeiro podem devolver uma comissão aprovada (e ainda não paga) para nova conferência
function bloqueioDevolver(c, usuario) {
  if (!["gestor", "financeiro"].includes(usuario.perfil)) return "Somente gestor ou financeiro devolvem comissões para revisão.";
  if (c.status !== "Aprovada") return "Só é possível devolver comissões aprovadas e ainda não pagas.";
  return null;
}

// ===== Log de atividades =====
// Registro global e append-only de quem fez o quê. Cada entrada guarda um hash encadeado com a
// anterior, o que permite detectar edição ou remoção casual. Sem servidor, quem tem acesso ao
// navegador ainda consegue recalcular tudo: para imutabilidade real o log precisa ficar no backend.
const hashTexto = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0"); };
const corpoLog = (e) => [e.id, e.em, e.usuario, e.perfil, e.acao, e.entidade, e.entidadeId, e.detalhe, e.resultado].join("|");

function registrarLog(logs, { usuario, acao, detalhe = "", entidade = "", entidadeId = "", resultado = "ok" }) {
  const ant = logs[logs.length - 1];
  const e = { id: logs.length + 1, em: new Date().toISOString(), usuario: usuario ? usuario.nome : "sistema", perfil: usuario ? usuario.perfil : "-", acao, entidade, entidadeId, detalhe, resultado };
  e.hash = hashTexto((ant ? ant.hash : "") + corpoLog(e));
  return [...logs, Object.freeze(e)];
}

// Confere o encadeamento. Devolve { ok, quebradoEm } (id da primeira entrada alterada).
function verificarLog(logs) {
  let prev = "";
  for (const e of logs) {
    if (e.hash !== hashTexto(prev + corpoLog(e))) return { ok: false, quebradoEm: e.id };
    prev = e.hash;
  }
  return { ok: true, quebradoEm: null };
}

function dadosIniciais() {
  const { validas } = importarCsv(CSV_EXEMPLO, REGRAS_INICIAIS, [], "Fernanda Financeiro");
  const comissoes = validas.map((c, i) => ({ ...c, id: i + 1 }));
  comissoes[0] = evolui(comissoes[0], "Aprovada", "Aprovada pelo gestor", "Marcos Gestor", { aprovadoPor: "Marcos Gestor" });
  comissoes[0] = evolui(comissoes[0], "Paga", "Pagamento processado e registrado", "Ricardo Financeiro", { pagoPor: "Ricardo Financeiro" });
  comissoes[1] = evolui(comissoes[1], "Aprovada", "Aprovada pelo gestor", "Marcos Gestor", { aprovadoPor: "Marcos Gestor" });
  return { comissoes, regras: REGRAS_INICIAIS, notificacoes: [], logs: [] };
}

function carregar() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || dadosIniciais(); }
  catch (e) { return dadosIniciais(); }
}

function baixarCsv(nome, linhas) {
  const csv = linhas.map((l) => l.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(";")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
  a.download = nome;
  a.click();
}

// Excel de verdade (.xlsx) via SheetJS, carregada no index.html
function baixarXlsx(nome, linhas) {
  const ws = XLSX.utils.aoa_to_sheet(linhas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Comissões");
  XLSX.writeFile(wb, nome);
}

if (typeof module !== "undefined") {
  module.exports = { calcular, importarCsv, regraVigente, evolui, bloqueioAprovar, bloqueioPagar, bloqueioDevolver, registrarLog, verificarLog, chaveOperacao,
    REGRAS_INICIAIS, USUARIOS, COLABORADORES, CSV_EXEMPLO, dadosIniciais, somaDias };
}