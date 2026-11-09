// ===== Cliente da API e utilitários =====
// Endereço do back-end Java (Spring Boot). Altere aqui se mudar a porta.
const API = "http://localhost:8080/api";

// Preenchido com os dados do banco quando o sistema carrega
const COLABORADORES = [];

const CSV_EXEMPLO = `colaborador;produto;cliente;valor;data;status
Ana Souza;Crédito Pessoal;Mercado Bom Preço;40000;2026-11-03;liquidada
Ana Souza;Crédito Pessoal;Padaria Central;15000;2026-11-05;liquidada
Bruno Lima;Investimentos;Fernanda Rocha;120000;2026-11-04;liquidada
Bruno Lima;Investimentos;Oficina Lopes;30000;2026-11-06;liquidada
Carla Mendes;Crédito Pessoal;Clínica Vida;55000;2026-11-02;liquidada
Diego Alves;Serviços Personalizados;Studio Lume;1;2026-11-07;liquidada
Carla Mendes;Seguro Auto;Rafael Dias;8000;2026-11-08;liquidada
Eduardo Reis;Crédito Pessoal;Loja Sol;10000;2026-11-08;liquidada
Ana Souza;Crédito Pessoal;Café Aurora;12000;2026-11-08;cancelada`;

const brl = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const nomeDe = (id) => (COLABORADORES.find((c) => c.id === id) || {}).nome || "—";

// Chamada HTTP com mensagens de erro claras
async function http(caminho, opcoes = {}) {
  let r;
  try {
    r = await fetch(API + caminho, opcoes);
  } catch (e) {
    throw new Error("Não foi possível conectar à API em " + API + ". Verifique se o back-end está rodando.");
  }
  if (!r.ok) {
    let msg;
    try { msg = (await r.json()).message; } catch (e) { /* sem corpo */ }
    throw new Error(msg || "Erro " + r.status);
  }
  return r.json();
}
const post = (caminho, corpo = {}) =>
  http(caminho, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });

// Ajusta o formato da API ao que as telas esperam
const norm = (c) => ({
  ...c,
  contestacao: c.contestacaoMotivo ? { motivo: c.contestacaoMotivo, resposta: c.contestacaoResposta } : null,
  historico: (c.historico || []).map((h) => ({ em: new Date(h.em).toLocaleString("pt-BR"), msg: h.msg })),
});

const api = {
  colaboradores: () => http("/colaboradores"),
  regras: () => http("/regras"),
  novaRegra: (regra) => post("/regras", regra),
  removerRegra: (id) => http("/regras/" + id, { method: "DELETE" }),
  comissoes: () => http("/comissoes").then((l) => l.map(norm)),
  extrato: (id) => http("/comissoes/" + id).then(norm),
  importar: (texto) => http("/importacao", { method: "POST", headers: { "Content-Type": "text/plain; charset=utf-8" }, body: texto }),
  aprovar: (id) => post(`/comissoes/${id}/aprovar`),
  aprovarTodas: () => post("/comissoes/aprovar-todas"),
  ajustar: (id, valor, justificativa) => post(`/comissoes/${id}/ajustar`, { valor: String(valor), justificativa }),
  pagar: (id) => post(`/comissoes/${id}/pagar`),
  contestar: (id, motivo) => post(`/comissoes/${id}/contestar`, { motivo }),
  responder: (id, resposta) => post(`/comissoes/${id}/responder`, { resposta }),
};

function baixarCsv(nome, linhas) {
  const csv = linhas.map((l) => l.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(";")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
  a.download = nome;
  a.click();
}