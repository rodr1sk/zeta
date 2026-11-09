// ===== Páginas =====

// Gestor: acompanhar desempenho da equipe
function Dashboard({ comissoes }) {
  const soma = (st) => comissoes.filter((c) => st.includes(c.status)).reduce((t, c) => t + c.valor, 0);
  return (
    <>
      <div className="row g-3 mb-4">
        <div className="col-6 col-xl-3"><Kpi titulo="Aguardando conferência" valor={brl(soma(["Calculada"]))} detalhe="comissões calculadas" /></div>
        <div className="col-6 col-xl-3"><Kpi titulo="Aprovadas a pagar" valor={brl(soma(["Aprovada"]))} detalhe="liberadas ao financeiro" ouro /></div>
        <div className="col-6 col-xl-3"><Kpi titulo="Pagas" valor={brl(soma(["Paga"]))} detalhe="no histórico" /></div>
        <div className="col-6 col-xl-3"><Kpi titulo="Contestadas" valor={brl(soma(["Contestada"]))} detalhe="em análise" /></div>
      </div>
      <div className="panel">
        <h5 className="mb-3">Desempenho da equipe (meta de comissão)</h5>
        {COLABORADORES.map((p) => {
          const t = comissoes.filter((c) => c.colaboradorId === p.id).reduce((s, c) => s + c.valor, 0);
          return (
            <div key={p.id} className="mb-3">
              <div className="d-flex justify-content-between">
                <span>{p.nome} <small className="text-secondary">{p.equipe}</small></span>
                <span>{brl(t)} de {brl(p.meta)}</span>
              </div>
              <div className="progress"><div className="progress-bar" style={{ width: Math.min(100, (t / p.meta) * 100) + "%" }}></div></div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// Sistema financeiro: importar dados de vendas e calcular
function Importar({ regras, onImportar }) {
  const [texto, setTexto] = React.useState(CSV_EXEMPLO);
  const [erros, setErros] = React.useState([]);
  const [ok, setOk] = React.useState(null);
  const processar = async () => {
    try {
      const r = await onImportar(texto);
      setErros(r.erros); setOk(r.calculadas);
    } catch (e) { alert(e.message); }
  };
  const lerArquivo = (e) => { const f = e.target.files[0]; if (f) f.text().then(setTexto); };
  return (
    <div className="panel">
      <p className="text-secondary">Colunas (separadas por ponto e vírgula): colaborador; produto; cliente; valor; data; status.</p>
      <input type="file" accept=".csv,.txt" className="form-control mb-2" onChange={lerArquivo} />
      <textarea className="form-control mb-3 font-monospace" rows="9" value={texto} onChange={(e) => setTexto(e.target.value)}></textarea>
      <button className="btn btn-primary" onClick={processar}>Importar e calcular comissões</button>
      {ok !== null && <div className="alert alert-success mt-3 mb-0">{ok} comissões calculadas e enviadas para conferência.</div>}
      {erros.length > 0 && (
        <div className="mt-3">
          <h6>Linhas para reformulação ({erros.length})</h6>
          <ul className="small">{erros.map((e, i) => <li key={i}><code>{e.linha}</code> — <strong>{e.motivo}</strong></li>)}</ul>
        </div>
      )}
    </div>
  );
}

// Gestor: conferir, ajustar, aprovar, responder contestações; financeiro: pagar
function Comissoes({ comissoes, acoes }) {
  const [filtro, setFiltro] = React.useState("Todas");
  const [ver, setVer] = React.useState(null);
  const lista = comissoes.filter((c) => filtro === "Todas" || c.status === filtro);
  return (
    <div className="panel">
      <div className="d-flex flex-wrap gap-2 mb-3">
        <select className="form-select w-auto" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          {["Todas", "Calculada", "Aprovada", "Paga", "Contestada"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <button className="btn btn-outline-primary ms-auto" onClick={acoes.aprovarTodas}>Aprovar todas as calculadas</button>
      </div>
      <TabelaComissoes lista={lista} acoes={(c) => (
        <>
          <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => setVer(c)}>Extrato</button>
          {c.status === "Calculada" && <>
            <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => acoes.ajustar(c)}>Ajustar</button>
            <button className="btn btn-sm btn-primary" onClick={() => acoes.aprovar(c.id)}>Aprovar</button>
          </>}
          {c.status === "Aprovada" && <button className="btn btn-sm btn-success" onClick={() => acoes.pagar(c.id)}>Processar pagamento</button>}
          {c.status === "Contestada" && <button className="btn btn-sm btn-warning" onClick={() => acoes.responder(c)}>Responder</button>}
        </>
      )} />
      {ver && <Extrato c={comissoes.find((x) => x.id === ver.id)} onClose={() => setVer(null)} />}
    </div>
  );
}

// Gestor: cadastrar regras de comissão
function Regras({ regras, onAdicionar, onRemover }) {
  const [f, setF] = React.useState({ produto: "", tipo: "percentual", valor: "" });
  const descrever = (r) => r.tipo === "percentual" ? r.percentual + "% sobre a operação"
    : r.tipo === "fixo" ? brl(r.valorFixo) + " por operação"
    : r.faixas.map((x) => `${x.percentual}% ${x.ate ? "até " + brl(x.ate) : "acima"}`).join(" · ");
  const adicionar = (e) => {
    e.preventDefault();
    const n = parseFloat(String(f.valor).replace(",", "."));
    if (!f.produto.trim() || !(n > 0)) return alert("Informe o produto e um valor maior que zero.");
    onAdicionar({ produto: f.produto.trim(), tipo: f.tipo, valor: n });
    setF({ produto: "", tipo: "percentual", valor: "" });
  };
  return (
    <div className="panel">
      <table className="table align-middle">
        <thead><tr><th>Produto</th><th>Tipo</th><th>Regra</th><th></th></tr></thead>
        <tbody>
          {regras.map((r) => (
            <tr key={r.id}>
              <td>{r.produto}</td><td>{r.tipo}</td><td>{descrever(r)}</td>
              <td className="text-end"><button className="btn btn-sm btn-outline-danger" onClick={() => onRemover(r.id)}>Remover</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <form className="row g-2" onSubmit={adicionar}>
        <div className="col-md-4"><input className="form-control" placeholder="Produto" value={f.produto} onChange={(e) => setF({ ...f, produto: e.target.value })} /></div>
        <div className="col-md-3">
          <select className="form-select" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
            <option value="percentual">Percentual</option><option value="fixo">Valor fixo</option>
          </select>
        </div>
        <div className="col-md-3"><input className="form-control" placeholder={f.tipo === "percentual" ? "% da operação" : "R$ por operação"} value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} /></div>
        <div className="col-md-2"><button className="btn btn-primary w-100">Cadastrar regra</button></div>
      </form>
    </div>
  );
}

// Gestor: relatórios com filtros e exportação
function Relatorios({ comissoes }) {
  const [col, setCol] = React.useState("0");
  const [st, setSt] = React.useState("Todas");
  const lista = comissoes.filter((c) => (col === "0" || c.colaboradorId === +col) && (st === "Todas" || c.status === st));
  const total = lista.reduce((t, c) => t + c.valor, 0);
  const exportar = () => baixarCsv("relatorio-comissoes.csv", [
    ["ID", "Colaborador", "Produto", "Cliente", "Base", "Comissão", "Status", "Data"],
    ...lista.map((c) => [c.id, nomeDe(c.colaboradorId), c.produto, c.cliente, c.base, c.valor, c.status, c.data]),
  ]);
  return (
    <div className="panel">
      <div className="d-flex flex-wrap gap-2 mb-3 align-items-center">
        <select className="form-select w-auto" value={col} onChange={(e) => setCol(e.target.value)}>
          <option value="0">Todos os colaboradores</option>
          {COLABORADORES.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <select className="form-select w-auto" value={st} onChange={(e) => setSt(e.target.value)}>
          {["Todas", "Calculada", "Aprovada", "Paga", "Contestada"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <strong className="ms-auto">Total: {brl(total)}</strong>
        <button className="btn btn-outline-primary" onClick={exportar}>Exportar CSV</button>
      </div>
      <TabelaComissoes lista={lista} />
    </div>
  );
}

// Colaborador: consultar, ver extrato detalhado e contestar
function MinhasComissoes({ comissoes, colaboradorId, onContestar }) {
  const [ver, setVer] = React.useState(null);
  const minhas = comissoes.filter((c) => c.colaboradorId === colaboradorId);
  const soma = (st) => minhas.filter((c) => c.status === st).reduce((t, c) => t + c.valor, 0);
  return (
    <>
      <div className="row g-3 mb-4">
        <div className="col-md-4"><Kpi titulo="Em análise" valor={brl(soma("Calculada") + soma("Contestada"))} detalhe="calculadas ou contestadas" /></div>
        <div className="col-md-4"><Kpi titulo="A receber" valor={brl(soma("Aprovada"))} detalhe="aprovadas" ouro /></div>
        <div className="col-md-4"><Kpi titulo="Recebido" valor={brl(soma("Paga"))} detalhe="pagas" /></div>
      </div>
      <div className="panel">
        <TabelaComissoes lista={minhas} mostrarColaborador={false} acoes={(c) => (
          <>
            <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => setVer(c)}>Extrato</button>
            {["Calculada", "Aprovada"].includes(c.status) && <button className="btn btn-sm btn-outline-warning" onClick={() => onContestar(c)}>Contestar</button>}
          </>
        )} />
      </div>
      {ver && <Extrato c={comissoes.find((x) => x.id === ver.id)} onClose={() => setVer(null)} />}
    </>
  );
}