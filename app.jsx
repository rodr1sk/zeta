// ===== App: carrega dados da API e dispara as ações do fluxo =====
function App() {
  const [comissoes, setComissoes] = React.useState([]);
  const [regras, setRegras] = React.useState([]);
  const [pronto, setPronto] = React.useState(false);
  const [erro, setErro] = React.useState("");
  const [perfil, setPerfil] = React.useState("gestor");
  const [pagina, setPagina] = React.useState("dashboard");
  const [colabId, setColabId] = React.useState(1);
  const [aviso, setAviso] = React.useState("");

  const carregarTudo = async () => {
    const [cols, rs, cs] = await Promise.all([api.colaboradores(), api.regras(), api.comissoes()]);
    COLABORADORES.splice(0, COLABORADORES.length, ...cols);
    setRegras(rs);
    setComissoes(cs);
    setColabId((id) => (cols.some((c) => c.id === id) ? id : cols[0] && cols[0].id));
  };
  const iniciar = () => {
    setErro("");
    carregarTudo().then(() => setPronto(true)).catch((e) => setErro(e.message));
  };
  React.useEffect(iniciar, []);

  const avisar = (m) => { setAviso(m); setTimeout(() => setAviso(""), 3500); };
  const recarregar = () => api.comissoes().then(setComissoes);
  // Executa uma chamada à API, atualiza a lista e mostra o resultado
  const executar = async (fn, ok) => {
    try { await fn(); await recarregar(); if (ok) avisar(ok); }
    catch (e) { alert(e.message); }
  };

  const acoes = {
    aprovar: (id) => executar(() => api.aprovar(id), "Comissão aprovada."),
    aprovarTodas: () => executar(() => api.aprovarTodas(), "Comissões calculadas foram aprovadas."),
    ajustar: (c) => {
      const v = parseFloat((prompt(`Novo valor para a comissão #${c.id} (atual ${brl(c.valor)}):`) || "").replace(",", "."));
      if (!(v >= 0)) return;
      const just = prompt("Justificativa do ajuste:");
      if (!just) return alert("O ajuste exige uma justificativa.");
      executar(() => api.ajustar(c.id, v, just), "Cálculo ajustado e reenviado para conferência.");
    },
    pagar: (id) => executar(() => api.pagar(id), "Pagamento processado e histórico atualizado."),
    responder: (c) => {
      const r = prompt(`Resposta à contestação de ${nomeDe(c.colaboradorId)}:\n"${c.contestacao ? c.contestacao.motivo : ""}"`);
      if (!r) return;
      executar(() => api.responder(c.id, r), "Resposta registrada. A comissão voltou para conferência.");
    },
  };

  const contestar = (c) => {
    const m = prompt(`Por que você contesta a comissão #${c.id} (${brl(c.valor)})?`);
    if (!m) return;
    executar(() => api.contestar(c.id, m), "Contestação enviada ao gestor.");
  };

  const importar = async (texto) => {
    const r = await api.importar(texto);
    await recarregar();
    return r;
  };

  const adicionarRegra = (regra) =>
    executar(async () => { await api.novaRegra(regra); setRegras(await api.regras()); }, "Regra cadastrada.");
  const removerRegra = (id) =>
    executar(async () => { await api.removerRegra(id); setRegras(await api.regras()); }, "Regra removida.");

  const menus = {
    gestor: [["dashboard", "Desempenho da equipe"], ["importar", "Importar vendas"], ["comissoes", "Aprovar e pagar"], ["regras", "Regras de comissão"], ["relatorios", "Relatórios"]],
    colaborador: [["minhas", "Minhas comissões"]],
  };
  const trocarPerfil = (p) => { setPerfil(p); setPagina(menus[p][0][0]); };
  const titulo = menus[perfil].find((m) => m[0] === pagina)[1];

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand mb-4">zeta<span>.</span></div>
        <label className="small mb-1" htmlFor="perfil">Entrar como</label>
        <select id="perfil" className="form-select form-select-sm mb-2" value={perfil} onChange={(e) => trocarPerfil(e.target.value)}>
          <option value="gestor">Gestor / Financeiro</option>
          <option value="colaborador">Colaborador</option>
        </select>
        {perfil === "colaborador" && (
          <select className="form-select form-select-sm mb-2" aria-label="Colaborador" value={colabId} onChange={(e) => setColabId(+e.target.value)}>
            {COLABORADORES.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        )}
        <nav className="nav flex-column mt-3 gap-1">
          {menus[perfil].map(([id, nome]) => (
            <button key={id} className={"nav-link" + (pagina === id ? " active" : "")} onClick={() => setPagina(id)}>{nome}</button>
          ))}
        </nav>
        <button className="btn btn-sm btn-outline-light mt-4" onClick={() => executar(carregarTudo, "Dados atualizados.")}>Atualizar dados</button>
      </aside>

      <main className="content">
        <h1 className="titulo h3 mb-4">{titulo}</h1>
        {aviso && <div className="alert alert-info py-2" role="status">{aviso}</div>}
        {erro && (
          <div className="alert alert-danger" role="alert">
            {erro} <button className="btn btn-sm btn-outline-danger ms-2" onClick={iniciar}>Tentar de novo</button>
          </div>
        )}
        {!pronto && !erro && <p className="text-secondary">Carregando dados da API…</p>}
        {pronto && <>
          {pagina === "dashboard" && <Dashboard comissoes={comissoes} />}
          {pagina === "importar" && <Importar regras={regras} onImportar={importar} />}
          {pagina === "comissoes" && <Comissoes comissoes={comissoes} acoes={acoes} />}
          {pagina === "regras" && <Regras regras={regras} onAdicionar={adicionarRegra} onRemover={removerRegra} />}
          {pagina === "relatorios" && <Relatorios comissoes={comissoes} />}
          {pagina === "minhas" && <MinhasComissoes comissoes={comissoes} colaboradorId={colabId} onContestar={contestar} />}
        </>}
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);