// ===== Páginas =====

// Só comissões já aprovadas (ou pagas) contam para meta e ranking
const CONTA_META = ["Aprovada", "Paga"];

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
        <div className="col-6 col-xl-3"><Kpi titulo="Estornadas" valor={brl(soma(["Estornada"]))} detalhe="fora do desempenho" /></div>
      </div>
      <div className="panel">
        <h5 className="mb-1">Desempenho da equipe (meta de comissão)</h5>
        <p className="small text-secondary">Considera apenas comissões aprovadas ou pagas.</p>
        {COLABORADORES.map((p) => {
          const t = comissoes.filter((c) => CONTA_META.includes(c.status) && c.colaboradorId === p.id).reduce((s, c) => s + c.valor, 0);
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
      <Ranking comissoes={comissoes} />
    </>
  );
}

// Ranking por comissões aprovadas ou pagas
function Ranking({ comissoes }) {
  const lista = COLABORADORES.map((p) => ({ ...p, total: comissoes.filter((c) => CONTA_META.includes(c.status) && c.colaboradorId === p.id).reduce((s, c) => s + c.valor, 0) }))
    .sort((a, b) => b.total - a.total);
  return (
    <div className="panel mt-4">
      <h5 className="mb-3">Ranking</h5>
      <ol className="mb-0">{lista.map((p) => <li key={p.id}>{p.nome} <small className="text-secondary">{p.equipe}</small> · <strong>{brl(p.total)}</strong></li>)}</ol>
    </div>
  );
}

// Sistema financeiro: importar dados de vendas e calcular
function Importar({ regras, onImportar }) {
  const [texto, setTexto] = React.useState(CSV_EXEMPLO);
  const [res, setRes] = React.useState(null);
  const [carregando, setCarregando] = React.useState(false);

  // Resultado de uma importação que chegou ao fim (com ou sem linhas recusadas)
  const mostrar = (calculadas, erros) => {
    const tipo = calculadas === 0 ? "falha" : erros.length ? "aviso" : "sucesso";
    const mensagem = {
      sucesso: "Importação concluída com sucesso. Todas as linhas viraram comissões.",
      aviso: "Importação concluída com avisos. Algumas linhas não foram importadas.",
      falha: erros.length ? "A importação falhou. Nenhuma linha pôde ser importada." : "Nenhuma linha de dados encontrada no arquivo.",
    }[tipo];
    setRes({ tipo, calculadas, erros, mensagem });
  };

  const processar = async () => {
    setCarregando(true);
    try {
      const r = await onImportar(texto);
      mostrar(r.calculadas, r.erros);
    } catch (e) {
      setRes({ tipo: "falha", calculadas: 0, erros: [], geral: true, mensagem: "A importação falhou: " + e.message });
    } finally {
      setCarregando(false);
    }
  };

  const lerArquivo = (e) => { const f = e.target.files[0]; if (f) { setRes(null); f.text().then(setTexto); } };
  const baixarErros = () => baixarCsv("linhas-com-erro.csv", [["Linha", "Motivo"], ...res.erros.map((e) => [e.linha, e.motivo])]);

  const estilo = { sucesso: ["success", "✓"], aviso: ["warning", "!"], falha: ["danger", "✕"] };

  return (
    <div className="panel">
      {res && (() => {
        const [cor, icone] = estilo[res.tipo];
        return (
          <div className="mb-4" role="alert">
            <div className={`alert alert-${cor} d-flex align-items-center gap-3 mb-3`}>
              <span className="fs-3 fw-bold" aria-hidden="true">{icone}</span>
              <div><strong>{res.mensagem}</strong></div>
            </div>
            {!res.geral && (
              <div className="row g-3 mb-3">
                <div className="col-4"><Kpi titulo="Linhas lidas" valor={res.calculadas + res.erros.length} detalhe="no arquivo" /></div>
                <div className="col-4"><Kpi titulo="Comissões geradas" valor={res.calculadas} detalhe="enviadas para conferência" ouro /></div>
                <div className="col-4"><Kpi titulo="Linhas recusadas" valor={res.erros.length} detalhe="precisam de correção" /></div>
              </div>
            )}
            {res.erros.length > 0 && (
              <div>
                <div className="d-flex align-items-center mb-2">
                  <h6 className="mb-0">Linhas que não foram importadas</h6>
                  <button className="btn btn-sm btn-outline-secondary ms-auto" onClick={baixarErros}>Baixar lista em CSV</button>
                </div>
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-2">
                    <thead><tr><th>Linha</th><th>Motivo</th></tr></thead>
                    <tbody>{res.erros.map((e, i) => <tr key={i}><td><code>{e.linha}</code></td><td className="text-danger fw-semibold">{e.motivo}</td></tr>)}</tbody>
                  </table>
                </div>
                <p className="small text-secondary mb-0">Corrija só estas linhas e importe de novo. Operações já importadas são recusadas como duplicadas, então reenviar o arquivo inteiro não gera comissões repetidas.</p>
              </div>
            )}
          </div>
        );
      })()}

      <p className="text-secondary">Colunas (separadas por ponto e vírgula): colaborador; produto; cliente; valor; data; status.</p>
      <input type="file" accept=".csv,.txt" className="form-control mb-2" onChange={lerArquivo} />
      <textarea className="form-control mb-3 font-monospace" rows="9" value={texto} onChange={(e) => setTexto(e.target.value)}></textarea>
      <button className="btn btn-primary" onClick={processar} disabled={carregando}>
        {carregando ? "Importando…" : "Importar e calcular comissões"}
      </button>
    </div>
  );
}

// Gestor aprova; financeiro paga e estorna. Os botões seguem o perfil e as regras de segregação.
const STATUS = ["Todas", "Calculada", "Aprovada", "Paga", "Contestada", "Estornada"];
function Comissoes({ comissoes, acoes, usuario }) {
  const [filtro, setFiltro] = React.useState("Todas");
  const [ver, setVer] = React.useState(null);
  const lista = comissoes.filter((c) => filtro === "Todas" || c.status === filtro);
  const gestor = usuario.perfil === "gestor", fin = usuario.perfil === "financeiro";
  return (
    <div className="panel">
      <div className="d-flex flex-wrap gap-2 mb-3">
        <select className="form-select w-auto" aria-label="Status" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          {STATUS.map((s) => <option key={s}>{s}</option>)}
        </select>
        {gestor && <button className="btn btn-outline-primary ms-auto" onClick={acoes.aprovarTodas}>Aprovar todas as calculadas</button>}
      </div>
      <TabelaComissoes lista={lista} acoes={(c) => (
        <>
          <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => setVer(c)}>Extrato</button>
          {gestor && c.status === "Calculada" && <>
            <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => acoes.ajustar(c)}>Ajustar</button>
            <button className="btn btn-sm btn-primary" onClick={() => acoes.aprovar(c.id)}>Aprovar</button>
          </>}
          {gestor && c.status === "Aprovada" && <>
            <span className="small text-secondary me-1">Aguardando o financeiro</span>
            <button className="btn btn-sm btn-outline-warning" onClick={() => acoes.devolver(c)}>Devolver</button>
          </>}
          {c.status === "Calculada" && c.devolucao && <span className="badge text-bg-warning me-1" title={c.devolucao.motivo}>Devolvida</span>}
          {gestor && c.status === "Contestada" && <button className="btn btn-sm btn-warning" onClick={() => acoes.responder(c)}>Responder</button>}
          {fin && c.status === "Aprovada" && <button className="btn btn-sm btn-success me-1" onClick={() => acoes.pagar(c.id)}>Processar pagamento</button>}
          {fin && c.status === "Aprovada" && <button className="btn btn-sm btn-outline-warning me-1" onClick={() => acoes.devolver(c)}>Devolver ao gestor</button>}
          {fin && ["Aprovada", "Paga"].includes(c.status) && <button className="btn btn-sm btn-outline-danger" onClick={() => acoes.estornar(c)}>Estornar</button>}
        </>
      )} />
      {ver && <Extrato c={comissoes.find((x) => x.id === ver.id)} onClose={() => setVer(null)} />}
    </div>
  );
}

// Gestor: regras versionadas, com vigência, carência e faixas escalonadas
function Regras({ regras, onAdicionar, onEncerrar }) {
  const vazio = { produto: "", tipo: "percentual", valor: "", faixas: "50000:0.5; 200000:0.8; :1.2", carencia: "0", inicio: hoje() };
  const [f, setF] = React.useState(vazio);
  const descrever = (r) => r.tipo === "percentual" ? r.percentual + "% sobre a operação"
    : r.tipo === "fixo" ? brl(r.valorFixo) + " por operação"
    : r.faixas.map((x) => `${x.percentual}% ${x.ate ? "até " + brl(x.ate) : "acima"}`).join(" · ");
  // Faixas no formato "limite:percentual; limite:percentual; :percentual" (limite vazio = sem teto)
  const lerFaixas = (s) => s.split(";").map((p) => p.trim()).filter(Boolean).map((p) => {
    const [a, b] = p.split(":"); return { ate: a.trim() ? parseFloat(a.replace(",", ".")) : null, percentual: parseFloat((b || "").replace(",", ".")) };
  });
  const adicionar = (e) => {
    e.preventDefault();
    const base = { produto: f.produto.trim(), tipo: f.tipo, carenciaDias: parseInt(f.carencia, 10) || 0, vigenciaInicio: f.inicio, vigenciaFim: null };
    if (!base.produto || !/^\d{4}-\d{2}-\d{2}$/.test(f.inicio)) return alert("Informe o produto e a data de início da vigência.");
    if (f.tipo === "escalonado") {
      const faixas = lerFaixas(f.faixas);
      const ordemOk = faixas.every((x, i) => x.percentual > 0 && (x.ate === null ? i === faixas.length - 1 : i === 0 || (faixas[i - 1].ate !== null && x.ate > faixas[i - 1].ate)));
      if (!faixas.length || !ordemOk) return alert("Faixas inválidas. Use limites crescentes e termine com uma faixa sem limite. Ex.: 50000:0.5; 200000:0.8; :1.2");
      onAdicionar({ ...base, faixas });
    } else {
      const n = parseFloat(String(f.valor).replace(",", "."));
      if (!(n > 0)) return alert("Informe um valor maior que zero.");
      onAdicionar(f.tipo === "percentual" ? { ...base, percentual: n } : { ...base, valorFixo: n });
    }
    setF(vazio);
  };
  const ordenadas = [...regras].sort((a, b) => a.produto.localeCompare(b.produto) || b.versao - a.versao);
  return (
    <div className="panel">
      <p className="text-secondary small">Regras não são apagadas: cadastrar uma nova regra para o mesmo produto encerra a anterior na véspera da vigência e mantém o histórico. A comissão usa a regra vigente na data da operação.</p>
      <table className="table align-middle">
        <thead><tr><th>Produto</th><th>Versão</th><th>Regra</th><th>Carência</th><th>Vigência</th><th></th></tr></thead>
        <tbody>
          {ordenadas.map((r) => (
            <tr key={r.id} className={r.vigenciaFim && r.vigenciaFim < hoje() ? "text-secondary" : ""}>
              <td>{r.produto}</td><td>v{r.versao}</td><td>{descrever(r)}</td><td>{r.carenciaDias} dia(s)</td>
              <td>{r.vigenciaInicio} a {r.vigenciaFim || "em aberto"}</td>
              <td className="text-end">{!r.vigenciaFim && <button className="btn btn-sm btn-outline-danger" onClick={() => onEncerrar(r.id)}>Encerrar hoje</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <form className="row g-2" onSubmit={adicionar}>
        <div className="col-md-3"><input className="form-control" aria-label="Produto" placeholder="Produto" value={f.produto} onChange={(e) => setF({ ...f, produto: e.target.value })} /></div>
        <div className="col-md-2">
          <select className="form-select" aria-label="Tipo" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
            <option value="percentual">Percentual</option><option value="fixo">Valor fixo</option><option value="escalonado">Escalonado</option>
          </select>
        </div>
        <div className="col-md-4">
          {f.tipo === "escalonado"
            ? <input className="form-control" aria-label="Faixas" placeholder="limite:% ; limite:% ; :%" value={f.faixas} onChange={(e) => setF({ ...f, faixas: e.target.value })} />
            : <input className="form-control" aria-label="Valor" placeholder={f.tipo === "percentual" ? "% da operação" : "R$ por operação"} value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} />}
        </div>
        <div className="col-md-1"><input className="form-control" aria-label="Carência em dias" title="Carência (dias)" value={f.carencia} onChange={(e) => setF({ ...f, carencia: e.target.value })} /></div>
        <div className="col-md-2"><input type="date" className="form-control" aria-label="Início da vigência" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} /></div>
        <div className="col-12"><button className="btn btn-primary">Cadastrar regra</button></div>
      </form>
    </div>
  );
}

// Relatórios: filtros por colaborador, produto, status e período; exportação CSV, Excel e PDF
function Relatorios({ comissoes }) {
  const [col, setCol] = React.useState("0");
  const [st, setSt] = React.useState("Todas");
  const [prod, setProd] = React.useState("Todos");
  const [de, setDe] = React.useState("");
  const [ate, setAte] = React.useState("");
  const produtos = [...new Set(comissoes.map((c) => c.produto))];
  const lista = comissoes.filter((c) => (col === "0" || c.colaboradorId === +col) && (st === "Todas" || c.status === st)
    && (prod === "Todos" || c.produto === prod) && (!de || c.data >= de) && (!ate || c.data <= ate));
  const total = lista.reduce((t, c) => t + c.valor, 0);
  const linhas = () => [["ID", "Colaborador", "Produto", "Cliente", "Base", "Comissão", "Status", "Data", "Regra"],
    ...lista.map((c) => [c.id, nomeDe(c.colaboradorId), c.produto, c.cliente, c.base, c.valor, c.status, c.data, c.regra])];
  return (
    <div className="panel">
      <div className="d-flex flex-wrap gap-2 mb-3 align-items-center no-print">
        <select className="form-select w-auto" aria-label="Colaborador" value={col} onChange={(e) => setCol(e.target.value)}>
          <option value="0">Todos os colaboradores</option>
          {COLABORADORES.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <select className="form-select w-auto" aria-label="Produto" value={prod} onChange={(e) => setProd(e.target.value)}>
          <option>Todos</option>{produtos.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select className="form-select w-auto" aria-label="Status" value={st} onChange={(e) => setSt(e.target.value)}>
          {STATUS.map((s) => <option key={s}>{s}</option>)}
        </select>
        <input type="date" className="form-control w-auto" aria-label="Data inicial" value={de} onChange={(e) => setDe(e.target.value)} />
        <input type="date" className="form-control w-auto" aria-label="Data final" value={ate} onChange={(e) => setAte(e.target.value)} />
      </div>
      <div className="d-flex flex-wrap gap-2 mb-3 align-items-center">
        <strong>Total: {brl(total)}</strong>
        <div className="ms-auto d-flex gap-2 no-print">
          <button className="btn btn-outline-primary" onClick={() => baixarCsv("relatorio-comissoes.csv", linhas())}>CSV</button>
          <button className="btn btn-outline-primary" onClick={() => baixarXlsx("relatorio-comissoes.xlsx", linhas())}>Excel</button>
          <button className="btn btn-outline-primary" onClick={() => window.print()}>PDF</button>
        </div>
      </div>
      <TabelaComissoes lista={lista} />
    </div>
  );
}

// Colaborador: consultar, ver extrato, filtrar por produto/período, contestar e receber avisos
function MinhasComissoes({ comissoes, colaboradorId, notificacoes, onContestar }) {
  const [ver, setVer] = React.useState(null);
  const [prod, setProd] = React.useState("Todos");
  const [de, setDe] = React.useState("");
  const [ate, setAte] = React.useState("");
  const todas = comissoes.filter((c) => c.colaboradorId === colaboradorId);
  const minhas = todas.filter((c) => (prod === "Todos" || c.produto === prod) && (!de || c.data >= de) && (!ate || c.data <= ate));
  const soma = (st) => todas.filter((c) => c.status === st).reduce((t, c) => t + c.valor, 0);
  return (
    <>
      {notificacoes.length > 0 && (
        <div className="alert alert-info py-2 no-print">
          <strong>Avisos</strong>
          <ul className="mb-0 small">{[...notificacoes].reverse().slice(0, 5).map((n) => <li key={n.id}>{n.em} · {n.msg}</li>)}</ul>
        </div>
      )}
      <div className="row g-3 mb-4">
        <div className="col-md-3"><Kpi titulo="Em análise" valor={brl(soma("Calculada") + soma("Contestada"))} detalhe="calculadas ou contestadas" /></div>
        <div className="col-md-3"><Kpi titulo="A receber" valor={brl(soma("Aprovada"))} detalhe="aprovadas" ouro /></div>
        <div className="col-md-3"><Kpi titulo="Recebido" valor={brl(soma("Paga"))} detalhe="pagas" /></div>
        <div className="col-md-3"><Kpi titulo="Estornado" valor={brl(soma("Estornada"))} detalhe="revertidas" /></div>
      </div>
      <div className="panel">
        <div className="d-flex flex-wrap gap-2 mb-3 no-print">
          <select className="form-select w-auto" aria-label="Produto" value={prod} onChange={(e) => setProd(e.target.value)}>
            <option>Todos</option>{[...new Set(todas.map((c) => c.produto))].map((p) => <option key={p}>{p}</option>)}
          </select>
          <input type="date" className="form-control w-auto" aria-label="Data inicial" value={de} onChange={(e) => setDe(e.target.value)} />
          <input type="date" className="form-control w-auto" aria-label="Data final" value={ate} onChange={(e) => setAte(e.target.value)} />
        </div>
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


// Gestor e financeiro: log de atividades (quem fez o quê, quando e com qual resultado)
function LogAtividades({ logs }) {
  const [usu, setUsu] = React.useState("Todos");
  const [acao, setAcao] = React.useState("Todas");
  const [res, setRes] = React.useState("Todos");
  const [q, setQ] = React.useState("");
  const integridade = React.useMemo(() => verificarLog(logs), [logs]);
  const filtrados = logs.filter((e) => (usu === "Todos" || e.usuario === usu) && (acao === "Todas" || e.acao === acao)
    && (res === "Todos" || e.resultado === res) && (!q || (e.detalhe + e.entidadeId).toLowerCase().includes(q.toLowerCase())));
  const recentes = [...filtrados].reverse();
  const quando = (iso) => new Date(iso).toLocaleString("pt-BR");
  const exportar = () => baixarCsv("log-atividades.csv", [["#", "Data/hora", "Usuário", "Perfil", "Ação", "Entidade", "Id", "Resultado", "Detalhe"],
    ...filtrados.map((e) => [e.id, quando(e.em), e.usuario, e.perfil, e.acao, e.entidade, e.entidadeId, e.resultado, e.detalhe])]);
  return (
    <div className="panel">
      <div className={"alert py-2 small " + (integridade.ok ? "alert-success" : "alert-danger")} role="status">
        {integridade.ok ? `Encadeamento do log íntegro (${logs.length} registro(s)).` : `Atenção: o log foi alterado a partir do registro #${integridade.quebradoEm}.`}
        {" "}Neste protótipo o log fica no navegador; imutabilidade real exige servidor.
      </div>
      <div className="d-flex flex-wrap gap-2 mb-3 align-items-center">
        <select className="form-select w-auto" aria-label="Usuário" value={usu} onChange={(e) => setUsu(e.target.value)}>
          <option>Todos</option>{[...new Set(logs.map((e) => e.usuario))].map((u) => <option key={u}>{u}</option>)}
        </select>
        <select className="form-select w-auto" aria-label="Ação" value={acao} onChange={(e) => setAcao(e.target.value)}>
          <option>Todas</option>{[...new Set(logs.map((e) => e.acao))].map((a) => <option key={a}>{a}</option>)}
        </select>
        <select className="form-select w-auto" aria-label="Resultado" value={res} onChange={(e) => setRes(e.target.value)}>
          <option>Todos</option><option value="ok">ok</option><option value="bloqueado">bloqueado</option>
        </select>
        <input className="form-control w-auto" aria-label="Buscar" placeholder="Buscar no detalhe ou #" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn-outline-primary ms-auto" onClick={exportar}>Exportar CSV</button>
      </div>
      {!recentes.length ? <p className="text-secondary mb-0">Nenhum registro encontrado.</p> : (
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0">
            <thead><tr><th>#</th><th>Data/hora</th><th>Usuário</th><th>Ação</th><th>Resultado</th><th>Detalhe</th></tr></thead>
            <tbody>
              {recentes.slice(0, 200).map((e) => (
                <tr key={e.id}>
                  <td>{e.id}</td><td className="text-nowrap">{quando(e.em)}</td>
                  <td>{e.usuario}<div className="small text-secondary">{e.perfil}</div></td>
                  <td><code>{e.acao}</code></td>
                  <td><span className={"badge text-bg-" + (e.resultado === "ok" ? "success" : "danger")}>{e.resultado}</span></td>
                  <td>{e.detalhe}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {recentes.length > 200 && <p className="small text-secondary mt-2 mb-0">Mostrando os 200 mais recentes de {recentes.length}. Use os filtros ou exporte o CSV para ver todos.</p>}
        </div>
      )}
    </div>
  );
}