// ===== Dados de exemplo, motor de cálculo e utilitários =====
const STORAGE_KEY = "zeta-comissoes-v1";

const COLABORADORES = [
  { id: 1, nome: "Ana Souza", equipe: "Crédito", meta: 1500 },
  { id: 2, nome: "Bruno Lima", equipe: "Investimentos", meta: 1200 },
  { id: 3, nome: "Carla Mendes", equipe: "Crédito", meta: 1500 },
  { id: 4, nome: "Diego Alves", equipe: "Serviços", meta: 900 },
];

const REGRAS_INICIAIS = [
  { id: 1, produto: "Crédito Pessoal", tipo: "percentual", percentual: 2.5 },
  { id: 2, produto: "Investimentos", tipo: "escalonado",
    faixas: [{ ate: 50000, percentual: 0.5 }, { ate: 200000, percentual: 0.8 }, { ate: null, percentual: 1.2 }] },
  { id: 3, produto: "Serviços Personalizados", tipo: "fixo", valorFixo: 150 },
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
const nomeDe = (id) => (COLABORADORES.find((c) => c.id === id) || {}).nome || "—";

// Cálculo determinístico, arredondado em centavos
function calcular(produto, base, regras) {
  const r = regras.find((x) => x.produto === produto);
  if (!r) return null;
  let valor, descricao;
  if (r.tipo === "percentual") {
    valor = (base * r.percentual) / 100;
    descricao = `${r.percentual}% sobre ${brl(base)}`;
  } else if (r.tipo === "escalonado") {
    const f = r.faixas.find((f) => f.ate === null || base <= f.ate);
    valor = (base * f.percentual) / 100;
    descricao = `Faixa escalonada ${f.percentual}% sobre ${brl(base)}`;
  } else {
    valor = r.valorFixo;
    descricao = `Valor fixo de ${brl(r.valorFixo)} por operação`;
  }
  return { valor: Math.round(valor * 100) / 100, descricao };
}

// Importa vendas (CSV com ";") -> verifica dados -> calcula. Linhas ruins voltam como erros.
function importarCsv(texto, regras) {
  const validas = [], erros = [];
  texto.split("\n").map((l) => l.trim()).filter(Boolean).forEach((l) => {
    if (/^colaborador/i.test(l)) return;
    const [nome, produto, cliente, v, data, status] = l.split(";").map((s) => (s || "").trim());
    const valor = parseFloat(v.replace(",", "."));
    const col = COLABORADORES.find((c) => c.nome.toLowerCase() === nome.toLowerCase());
    const motivo = !col ? "Colaborador não cadastrado"
      : !(valor > 0) ? "Valor inválido"
      : !/^\d{4}-\d{2}-\d{2}$/.test(data) ? "Data inválida (use AAAA-MM-DD)"
      : status.toLowerCase() === "cancelada" ? "Operação cancelada, não gera comissão"
      : !regras.some((r) => r.produto === produto) ? "Produto sem regra de comissão"
      : null;
    if (motivo) return erros.push({ linha: l, motivo });
    const c = calcular(produto, valor, regras);
    validas.push({
      colaboradorId: col.id, produto, cliente, base: valor, data,
      valor: c.valor, regra: c.descricao, status: "Calculada", contestacao: null,
      historico: [{ em: agora(), msg: "Comissão calculada: " + c.descricao }],
    });
  });
  return { validas, erros };
}

// Devolve a comissão com novo status e registro no histórico (rastreabilidade)
const evolui = (c, status, msg, extra = {}) =>
  ({ ...c, ...extra, status, historico: [...c.historico, { em: agora(), msg }] });

function dadosIniciais() {
  const { validas } = importarCsv(CSV_EXEMPLO, REGRAS_INICIAIS);
  const comissoes = validas.map((c, i) => ({ ...c, id: i + 1 }));
  comissoes[0] = evolui(comissoes[0], "Paga", "Pagamento processado e registrado");
  comissoes[1] = evolui(comissoes[1], "Aprovada", "Aprovada pelo gestor");
  return { comissoes, regras: REGRAS_INICIAIS };
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