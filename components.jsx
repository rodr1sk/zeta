// ===== Componentes compartilhados =====
function StatusBadge({ status }) {
  const cor = { Calculada: "secondary", Aprovada: "primary", Paga: "success", Contestada: "warning" }[status] || "dark";
  return <span className={`badge text-bg-${cor}`}>{status}</span>;
}

function Kpi({ titulo, valor, detalhe, ouro }) {
  return (
    <div className={"kpi" + (ouro ? " ouro" : "")}>
      <div className="text-secondary small">{titulo}</div>
      <div className="valor">{valor}</div>
      <div className="small text-secondary">{detalhe}</div>
    </div>
  );
}

// Extrato detalhado: mostra regra, base, valor e todo o histórico da comissão
function Extrato({ c: base, onClose }) {
  const [c, setC] = React.useState({ ...base, historico: [] });
  React.useEffect(() => { api.extrato(base.id).then(setC).catch(() => {}); }, [base.id]);
  return (
    <div className="modal d-block" style={{ background: "rgba(15,42,46,.6)" }} onClick={onClose}>
      <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Extrato da comissão #{c.id}</h5>
            <button className="btn-close" aria-label="Fechar" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <dl className="row mb-3">
              <dt className="col-4">Colaborador</dt><dd className="col-8">{nomeDe(c.colaboradorId)}</dd>
              <dt className="col-4">Produto</dt><dd className="col-8">{c.produto}</dd>
              <dt className="col-4">Cliente</dt><dd className="col-8">{c.cliente}</dd>
              <dt className="col-4">Operação</dt><dd className="col-8">{brl(c.base)} em {c.data}</dd>
              <dt className="col-4">Regra</dt><dd className="col-8">{c.regra}</dd>
              <dt className="col-4">Comissão</dt><dd className="col-8 valor-comissao">{brl(c.valor)}</dd>
              <dt className="col-4">Status</dt><dd className="col-8"><StatusBadge status={c.status} /></dd>
            </dl>
            {c.contestacao && (
              <div className="alert alert-warning py-2">
                <strong>Contestação:</strong> {c.contestacao.motivo}
                {c.contestacao.resposta && <div><strong>Resposta:</strong> {c.contestacao.resposta}</div>}
              </div>
            )}
            <h6>Histórico</h6>
            <ul className="list-unstyled small mb-0">
              {c.historico.map((h, i) => <li key={i}><span className="text-secondary">{h.em}</span> · {h.msg}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// Tabela reutilizada por gestor, relatórios e colaborador
function TabelaComissoes({ lista, acoes, mostrarColaborador = true }) {
  if (!lista.length) return <p className="text-secondary mb-0">Nenhuma comissão encontrada.</p>;
  return (
    <div className="table-responsive">
      <table className="table table-hover align-middle mb-0">
        <thead>
          <tr>
            <th>#</th>{mostrarColaborador && <th>Colaborador</th>}<th>Produto</th><th>Cliente</th>
            <th className="text-end">Base</th><th className="text-end">Comissão</th><th>Status</th><th></th>
          </tr>
        </thead>
        <tbody>
          {lista.map((c) => (
            <tr key={c.id}>
              <td>{c.id}</td>
              {mostrarColaborador && <td>{nomeDe(c.colaboradorId)}</td>}
              <td>{c.produto}</td><td>{c.cliente}</td>
              <td className="text-end">{brl(c.base)}</td>
              <td className="text-end valor-comissao">{brl(c.valor)}</td>
              <td><StatusBadge status={c.status} /></td>
              <td className="text-end text-nowrap">{acoes && acoes(c)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}