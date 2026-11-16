// ===== App: estado, perfis e ações do fluxo =====
const MENUS = {
  gestor: [["dashboard", "Desempenho e ranking"], ["comissoes", "Conferir e aprovar"], ["regras", "Regras de comissão"], ["relatorios", "Relatórios"]],
  financeiro: [["importar", "Importar vendas"], ["comissoes", "Pagar e estornar"], ["relatorios", "Relatórios"]],
  colaborador: [["minhas", "Minhas comissões"]],
};
const ROTULO_PERFIL = { gestor: "Gestor", financeiro: "Financeiro", colaborador: "Colaborador" };

function Entrada({ onEntrar }) {
  return (
    <div className="content mx-auto" style={{ maxWidth: 720 }}>
      <div className="brand mb-2 text-dark">zeta<span>.</span></div>
      <h1 className="h4 mb-1">Controle de Comissões</h1>
      <div className="alert alert-warning py-2 small">Protótipo sem servidor: escolher o usuário abaixo <strong>simula</strong> o login. Autenticação real (senha, MFA) exige um backend.</div>
      {Object.keys(MENUS).map((p) => (
        <div key={p} className="mb-3">
          <h2 className="h6 text-secondary">{ROTULO_PERFIL[p]}</h2>
          <div className="d-flex flex-wrap gap-2">
            {USUARIOS.filter((u) => u.perfil === p).map((u) => <button key={u.id} className="btn btn-outline-primary" onClick={() => onEntrar(u)}>{u.nome}</button>)}
          </div>
        </div>
      ))}
    </div>
  );
}

function App() {
  const inicial = React.useMemo(carregar, []);
  const [comissoes, setComissoes] = React.useState(inicial.comissoes);
  const [regras, setRegras] = React.useState(inicial.regras);
  const [notificacoes, setNotificacoes] = React.useState(inicial.notificacoes || []);
  const [usuario, setUsuario] = React.useState(null);
  const [pagina, setPagina] = React.useState("");
  const [aviso, setAviso] = React.useState("");

  React.useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ comissoes, regras, notificacoes })); } catch (e) {}
  }, [comissoes, regras, notificacoes]);

  const avisar = (m) => { setAviso(m); setTimeout(() => setAviso(""), 4000); };
  const mudar = (id, fn) => setComissoes((cs) => cs.map((c) => (c.id === id ? fn(c) : c)));
  const notificar = (colaboradorId, msg) => setNotificacoes((n) => [...n, { id: n.length + 1, colaboradorId, em: agora(), msg, lida: false }]);
  const por = usuario && usuario.nome;
  const achar = (id) => comissoes.find((c) => c.id === id);

  const acoes = {
    aprovar: (id) => {
      const c = achar(id), b = bloqueioAprovar(c, usuario);
      if (b) return avisar("Bloqueado: " + b);
      mudar(id, (x) => evolui(x, "Aprovada", "Aprovada pelo gestor", por, { aprovadoPor: por, devolucao: null }));
      notificar(c.colaboradorId, `Sua comissão #${id} (${brl(c.valor)}) foi aprovada.`);
      avisar("Comissão aprovada.");
    },
    aprovarTodas: () => {
      const aprovaveis = comissoes.filter((c) => c.status === "Calculada" && !bloqueioAprovar(c, usuario));
      const ids = new Set(aprovaveis.map((c) => c.id));
      setComissoes((cs) => cs.map((c) => ids.has(c.id) ? evolui(c, "Aprovada", "Aprovada pelo gestor", por, { aprovadoPor: por, devolucao: null }) : c));
      aprovaveis.forEach((c) => notificar(c.colaboradorId, `Sua comissão #${c.id} (${brl(c.valor)}) foi aprovada.`));
      const puladas = comissoes.filter((c) => c.status === "Calculada").length - ids.size;
      avisar(`${ids.size} aprovada(s).` + (puladas ? ` ${puladas} não puderam ser aprovadas por você (segregação de funções ou carência).` : ""));
    },
    ajustar: (c) => {
      const v = parseFloat((prompt(`Novo valor para a comissão #${c.id} (atual ${brl(c.valor)}):`) || "").replace(",", "."));
      if (!(v >= 0)) return;
      const just = prompt("Justificativa do ajuste:");
      if (!just) return alert("O ajuste exige uma justificativa.");
      mudar(c.id, (x) => evolui(x, "Calculada", `Ajuste de ${brl(x.valor)} para ${brl(v)}. Justificativa: ${just}`, por, { valor: Math.round(v * 100) / 100, ajustadoPor: por }));
      avisar("Cálculo ajustado. Outro gestor precisa aprová-lo.");
    },
    pagar: (id) => {
      const c = achar(id), b = bloqueioPagar(c, usuario);
      if (b) return avisar("Bloqueado: " + b);
      mudar(id, (x) => evolui(x, "Paga", "Pagamento processado e registrado", por, { pagoPor: por }));
      notificar(c.colaboradorId, `Pagamento da comissão #${id} (${brl(c.valor)}) processado.`);
      avisar("Pagamento processado e histórico atualizado.");
    },
    estornar: (c) => {
      if (usuario.perfil !== "financeiro") return avisar("Bloqueado: somente o financeiro estorna comissões.");
      const m = prompt(`Motivo do estorno da comissão #${c.id} (${brl(c.valor)}):`);
      if (!m) return alert("O estorno exige um motivo.");
      const clawback = c.status === "Paga" ? " Valor a descontar (clawback) em pagamento futuro." : "";
      mudar(c.id, (x) => evolui(x, "Estornada", `Estornada. Motivo: ${m}.${clawback}`, por, { estornadaPor: por }));
      notificar(c.colaboradorId, `Sua comissão #${c.id} (${brl(c.valor)}) foi estornada.`);
      avisar("Comissão estornada.");
    },
    devolver: (c) => {
      const b = bloqueioDevolver(c, usuario);
      if (b) return avisar("Bloqueado: " + b);
      const m = prompt(`Motivo para devolver a comissão #${c.id} (${brl(c.valor)}) para revisão:`);
      if (!m) return alert("A devolução exige um motivo.");
      mudar(c.id, (x) => evolui(x, "Calculada", `Devolvida para revisão por ${usuario.perfil === "financeiro" ? "financeiro" : "gestor"}. Motivo: ${m}`, por,
        { aprovadoPor: null, devolucao: { por, perfil: usuario.perfil, motivo: m } }));
      avisar("Comissão devolvida para nova conferência do gestor.");
    },
    responder: (c) => {
      const r = prompt(`Resposta à contestação de ${nomeDe(c.colaboradorId)}:\n"${c.contestacao.motivo}"`);
      if (!r) return;
      mudar(c.id, (x) => evolui(x, "Calculada", "Contestação respondida: " + r, por, { contestacao: { ...x.contestacao, resposta: r }, ajustadoPor: por }));
      notificar(c.colaboradorId, `Sua contestação da comissão #${c.id} foi respondida.`);
      avisar("Resposta registrada. Outro gestor precisa aprovar a comissão.");
    },
  };

  const contestar = (c) => {
    const m = prompt(`Por que você contesta a comissão #${c.id} (${brl(c.valor)})?`);
    if (!m) return;
    mudar(c.id, (x) => evolui(x, "Contestada", "Contestação aberta: " + m, por, { contestacao: { motivo: m, resposta: null } }));
    avisar("Contestação enviada ao gestor.");
  };

  const importar = (texto) => {
    const r = importarCsv(texto, regras, comissoes.map((c) => c.chave), por);
    setComissoes((cs) => {
      let id = cs.reduce((m, c) => Math.max(m, c.id), 0);
      return [...cs, ...r.validas.map((c) => ({ ...c, id: ++id }))];
    });
    return r;
  };

  // Regra nova para um produto encerra a versão anterior na véspera da nova vigência (versionamento)
  const adicionarRegra = (nova) => setRegras((rs) => {
    const doProduto = rs.filter((r) => r.produto === nova.produto);
    const versao = doProduto.reduce((m, r) => Math.max(m, r.versao), 0) + 1;
    const id = rs.reduce((m, r) => Math.max(m, r.id), 0) + 1;
    const fecha = (r) => r.produto === nova.produto && !r.vigenciaFim && r.vigenciaInicio < nova.vigenciaInicio
      ? { ...r, vigenciaFim: somaDias(nova.vigenciaInicio, -1) } : r;
    return [...rs.map(fecha), { ...nova, id, versao }];
  });
  const encerrarRegra = (id) => setRegras((rs) => rs.map((r) => r.id === id && !r.vigenciaFim ? { ...r, vigenciaFim: hoje() } : r));

  const entrar = (u) => { setUsuario(u); setPagina(MENUS[u.perfil][0][0]); };
  const restaurar = () => {
    if (!confirm("Restaurar os dados de exemplo? Suas alterações serão perdidas.")) return;
    const d = dadosIniciais(); setComissoes(d.comissoes); setRegras(d.regras); setNotificacoes([]);
  };

  if (!usuario) return <Entrada onEntrar={entrar} />;
  const menu = MENUS[usuario.perfil];
  const titulo = (menu.find((m) => m[0] === pagina) || menu[0])[1];

  return (
    <div className="layout">
      <aside className="sidebar no-print">
        <div className="brand mb-4">zeta<span>.</span></div>
        <div className="small mb-1">{usuario.nome}</div>
        <div className="small text-secondary mb-2">{ROTULO_PERFIL[usuario.perfil]}</div>
        <button className="btn btn-sm btn-outline-light mb-2" onClick={() => setUsuario(null)}>Sair</button>
        <nav className="nav flex-column mt-3 gap-1">
          {menu.map(([id, nome]) => (
            <button key={id} className={"nav-link" + (pagina === id ? " active" : "")} onClick={() => setPagina(id)}>{nome}</button>
          ))}
        </nav>
        <button className="btn btn-sm btn-outline-light mt-4" onClick={restaurar}>Restaurar dados de exemplo</button>
      </aside>

      <main className="content">
        <h1 className="titulo h3 mb-4">{titulo}</h1>
        {aviso && <div className="alert alert-info py-2 no-print" role="status">{aviso}</div>}
        {pagina === "dashboard" && <Dashboard comissoes={comissoes} />}
        {pagina === "importar" && <Importar regras={regras} onImportar={importar} />}
        {pagina === "comissoes" && <Comissoes comissoes={comissoes} acoes={acoes} usuario={usuario} />}
        {pagina === "regras" && <Regras regras={regras} onAdicionar={adicionarRegra} onEncerrar={encerrarRegra} />}
        {pagina === "relatorios" && <Relatorios comissoes={comissoes} />}
        {pagina === "minhas" && <MinhasComissoes comissoes={comissoes} colaboradorId={usuario.colaboradorId} notificacoes={notificacoes.filter((n) => n.colaboradorId === usuario.colaboradorId)} onContestar={contestar} />}
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);