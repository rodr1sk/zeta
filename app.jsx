// ===== App: estado, perfis e ações do fluxo =====
function App() {
  const inicial = React.useMemo(carregar, []);
  const [comissoes, setComissoes] = React.useState(inicial.comissoes);
  const [regras, setRegras] = React.useState(inicial.regras);
  const [perfil, setPerfil] = React.useState("gestor");
  const [pagina, setPagina] = React.useState("dashboard");
  const [colabId, setColabId] = React.useState(1);
  const [aviso, setAviso] = React.useState("");

  React.useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ comissoes, regras })); } catch (e) {}
  }, [comissoes, regras]);

  const avisar = (m) => { setAviso(m); setTimeout(() => setAviso(""), 3500); };
  const mudar = (id, fn) => setComissoes((cs) => cs.map((c) => (c.id === id ? fn(c) : c)));

  const acoes = {
    aprovar: (id) => { mudar(id, (c) => evolui(c, "Aprovada", "Aprovada pelo gestor")); avisar("Comissão aprovada."); },
    aprovarTodas: () => {
      setComissoes((cs) => cs.map((c) => c.status === "Calculada" ? evolui(c, "Aprovada", "Aprovada pelo gestor") : c));
      avisar("Comissões calculadas foram aprovadas.");
    },
    ajustar: (c) => {
      const v = parseFloat((prompt(`Novo valor para a comissão #${c.id} (atual ${brl(c.valor)}):`) || "").replace(",", "."));
      if (!(v >= 0)) return;
      const just = prompt("Justificativa do ajuste:");
      if (!just) return alert("O ajuste exige uma justificativa.");
      mudar(c.id, (x) => evolui(x, "Calculada", `Ajuste de ${brl(x.valor)} para ${brl(v)}. Justificativa: ${just}`, { valor: Math.round(v * 100) / 100 }));
      avisar("Cálculo ajustado e reenviado para conferência.");
    },
    pagar: (id) => {
      mudar(id, (c) => evolui(c, "Paga", "Pagamento processado e registrado. Confirmação enviada ao colaborador"));
      avisar("Pagamento processado e histórico atualizado.");
    },
    responder: (c) => {
      const r = prompt(`Resposta à contestação de ${nomeDe(c.colaboradorId)}:\n"${c.contestacao.motivo}"`);
      if (!r) return;
      mudar(c.id, (x) => evolui(x, "Calculada", "Contestação respondida: " + r, { contestacao: { ...x.contestacao, resposta: r } }));
      avisar("Resposta registrada. A comissão voltou para conferência.");
    },
  };

  const contestar = (c) => {
    const m = prompt(`Por que você contesta a comissão #${c.id} (${brl(c.valor)})?`);
    if (!m) return;
    mudar(c.id, (x) => evolui(x, "Contestada", "Contestação aberta: " + m, { contestacao: { motivo: m, resposta: null } }));
    avisar("Contestação enviada ao gestor.");
  };

  const importar = (texto) => {
    const r = importarCsv(texto, regras);
    setComissoes((cs) => {
      let id = cs.reduce((m, c) => Math.max(m, c.id), 0);
      return [...cs, ...r.validas.map((c) => ({ ...c, id: ++id }))];
    });
    return r;
  };

  const menus = {
    gestor: [["dashboard", "Desempenho da equipe"], ["importar", "Importar vendas"], ["comissoes", "Aprovar e pagar"], ["regras", "Regras de comissão"], ["relatorios", "Relatórios"]],
    colaborador: [["minhas", "Minhas comissões"]],
  };
  const trocarPerfil = (p) => { setPerfil(p); setPagina(menus[p][0][0]); };
  const titulo = menus[perfil].find((m) => m[0] === pagina)[1];

  const restaurar = () => {
    if (!confirm("Restaurar os dados de exemplo? Suas alterações serão perdidas.")) return;
    const d = dadosIniciais(); setComissoes(d.comissoes); setRegras(d.regras);
  };

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
        <button className="btn btn-sm btn-outline-light mt-4" onClick={restaurar}>Restaurar dados de exemplo</button>
      </aside>

      <main className="content">
        <h1 className="titulo h3 mb-4">{titulo}</h1>
        {aviso && <div className="alert alert-info py-2" role="status">{aviso}</div>}
        {pagina === "dashboard" && <Dashboard comissoes={comissoes} />}
        {pagina === "importar" && <Importar regras={regras} onImportar={importar} />}
        {pagina === "comissoes" && <Comissoes comissoes={comissoes} acoes={acoes} />}
        {pagina === "regras" && <Regras regras={regras} setRegras={setRegras} />}
        {pagina === "relatorios" && <Relatorios comissoes={comissoes} />}
        {pagina === "minhas" && <MinhasComissoes comissoes={comissoes} colaboradorId={colabId} onContestar={contestar} />}
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);