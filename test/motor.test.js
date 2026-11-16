const test = require("node:test");
const assert = require("node:assert/strict");
const m = require("../data.js");

const R = m.REGRAS_INICIAIS;
const U = Object.fromEntries(m.USUARIOS.map((u) => [u.id, u]));

test("percentual: 2,5% sobre 40.000 = 1.000", () => {
  assert.equal(m.calcular("Crédito Pessoal", 40000, R, "2026-11-03").valor, 1000);
});

test("escalonado usa a faixa do valor da operação", () => {
  assert.equal(m.calcular("Investimentos", 30000, R, "2026-11-03").valor, 150);
  assert.equal(m.calcular("Investimentos", 120000, R, "2026-11-03").valor, 960);
  assert.equal(m.calcular("Investimentos", 300000, R, "2026-11-03").valor, 3600);
});

test("valor fixo ignora a base", () => {
  assert.equal(m.calcular("Serviços Personalizados", 1, R, "2026-11-03").valor, 150);
});

test("arredondamento em centavos é determinístico", () => {
  const regras = [{ id: 9, produto: "X", tipo: "percentual", percentual: 0.1, carenciaDias: 0, vigenciaInicio: "2026-01-01", vigenciaFim: null, versao: 1 }];
  assert.equal(m.calcular("X", 0.3, regras, "2026-11-01").valor, 0);
  assert.equal(m.calcular("X", 1234.56, regras, "2026-11-01").valor, 1.23);
});

test("vigência: usa a versão vigente na data da operação", () => {
  const regras = [
    { id: 1, produto: "P", tipo: "percentual", percentual: 1, carenciaDias: 0, vigenciaInicio: "2026-01-01", vigenciaFim: "2026-06-30", versao: 1 },
    { id: 2, produto: "P", tipo: "percentual", percentual: 2, carenciaDias: 0, vigenciaInicio: "2026-07-01", vigenciaFim: null, versao: 2 },
  ];
  assert.equal(m.calcular("P", 1000, regras, "2026-03-10").valor, 10);
  assert.equal(m.calcular("P", 1000, regras, "2026-08-10").valor, 20);
  assert.equal(m.calcular("P", 1000, regras, "2025-12-31"), null);
});

const CSV = "colaborador;produto;cliente;valor;data;status\nAna Souza;Crédito Pessoal;Loja A;1000;2026-11-03;liquidada";

test("importação é idempotente: o mesmo arquivo não duplica comissões", () => {
  const a = m.importarCsv(CSV, R, [], "Fernanda Financeiro");
  assert.equal(a.validas.length, 1);
  const b = m.importarCsv(CSV, R, a.validas.map((c) => c.chave), "Fernanda Financeiro");
  assert.equal(b.validas.length, 0);
  assert.match(b.erros[0].motivo, /duplicada/);
});

test("duplicata dentro do mesmo arquivo também é recusada", () => {
  const r = m.importarCsv(CSV + "\nAna Souza;Crédito Pessoal;Loja A;1000;2026-11-03;liquidada", R);
  assert.equal(r.validas.length, 1);
  assert.equal(r.erros.length, 1);
});

test("recusa cancelada, colaborador inexistente, valor e data inválidos, produto sem regra", () => {
  const linhas = [
    "Ana Souza;Crédito Pessoal;A;100;2026-11-03;cancelada",
    "Zé Ninguém;Crédito Pessoal;A;100;2026-11-03;liquidada",
    "Ana Souza;Crédito Pessoal;A;0;2026-11-03;liquidada",
    "Ana Souza;Crédito Pessoal;A;100;03/11/2026;liquidada",
    "Ana Souza;Seguro Auto;A;100;2026-11-03;liquidada",
  ].join("\n");
  const r = m.importarCsv(linhas, R);
  assert.equal(r.validas.length, 0);
  assert.equal(r.erros.length, 5);
});

test("carência define a data de elegibilidade e bloqueia a aprovação", () => {
  const regras = [{ ...R[0], carenciaDias: 30 }];
  const c = m.importarCsv(CSV.replace("2026-11-03", "2099-01-01"), regras, [], "Fernanda Financeiro").validas[0];
  assert.equal(c.elegivelEm, "2099-01-31");
  assert.match(m.bloqueioAprovar(c, U.g1), /carência/);
});

test("segregação: quem calculou/ajustou não aprova; quem aprovou não paga", () => {
  const c = m.importarCsv(CSV, R, [], "Fernanda Financeiro").validas[0];
  assert.equal(m.bloqueioAprovar(c, U.g1), null);
  assert.ok(m.bloqueioAprovar(c, U.f1), "financeiro não aprova");
  assert.ok(m.bloqueioAprovar({ ...c, ajustadoPor: "Marcos Gestor" }, U.g1), "quem ajustou não aprova");
  assert.equal(m.bloqueioAprovar({ ...c, ajustadoPor: "Marcos Gestor" }, U.g2), null);
  assert.ok(m.bloqueioPagar(c, U.g1), "gestor não paga");
  assert.ok(m.bloqueioPagar({ ...c, aprovadoPor: "Fernanda Financeiro" }, U.f1), "quem aprovou não paga");
  assert.equal(m.bloqueioPagar({ ...c, aprovadoPor: "Marcos Gestor" }, U.f1), null);
});

test("histórico é append-only e registra o autor", () => {
  const c = m.importarCsv(CSV, R, [], "Fernanda Financeiro").validas[0];
  const e = m.evolui(c, "Estornada", "Estornada. Motivo: erro", "Ricardo Financeiro");
  assert.equal(c.historico.length, 1);
  assert.equal(e.historico.length, 2);
  assert.equal(e.historico[1].por, "Ricardo Financeiro");
  assert.ok(Object.isFrozen(e.historico[1]));
  assert.equal(e.status, "Estornada");
});

test("devolução: gestor e financeiro devolvem só comissões aprovadas", () => {
  const c = m.importarCsv(CSV, R, [], "Fernanda Financeiro").validas[0];
  assert.ok(m.bloqueioDevolver(c, U.f1), "calculada não é devolvida");
  const ap = { ...c, status: "Aprovada" };
  assert.equal(m.bloqueioDevolver(ap, U.f1), null);
  assert.equal(m.bloqueioDevolver(ap, U.g2), null);
  assert.ok(m.bloqueioDevolver(ap, U.c1), "colaborador não devolve");
  assert.ok(m.bloqueioDevolver({ ...c, status: "Paga" }, U.f1), "paga não é devolvida");
});