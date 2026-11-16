// ===== Componentes compartilhados =====
function StatusBadge({ status }) {
  const cor = { Calculada: "secondary", Aprovada: "primary", Paga: "success", Contestada: "warning", Estornada: "danger" }[status] || "dark";
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
function Extrato({ c, onClose }) {
  return (
    <div className="modal d-block extrato-modal" style={{ background: "rgba(15,42,46,.6)" }} onClick={onClose}>
      <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Extrato da comissão #{c.id}</h5>
            <button className="btn btn-sm btn-outline-secondary ms-auto me-2 no-print" onClick={() => window.print()}>Baixar PDF</button>
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
              <dt className="col-4">Elegível em</dt><dd className="col-8">{c.elegivelEm || c.data}</dd>
              <dt className="col-4">Status</dt><dd className="col-8"><StatusBadge status={c.status} /></dd>
            </dl>
            {c.devolucao && c.status === "Calculada" && (
              <div className="alert alert-warning py-2">
                <strong>Devolvida para revisão</strong> por {c.devolucao.por} ({c.devolucao.perfil}): {c.devolucao.motivo}
              </div>
            )}
            {c.contestacao && (
              <div className="alert alert-warning py-2">
                <strong>Contestação:</strong> {c.contestacao.motivo}
                {c.contestacao.resposta && <div><strong>Resposta:</strong> {c.contestacao.resposta}</div>}
              </div>
            )}
            <h6>Histórico</h6>
            <ul className="list-unstyled small mb-0">
              {c.historico.map((h, i) => <li key={i}><span className="text-secondary">{h.em}</span> · {h.por ? <strong>{h.por}</strong> : null}{h.por ? ": " : ""}{h.msg}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// Tabela reutilizada por gestor, relatórios e colaborador.
// Sem rolagem horizontal: em telas largas é uma tabela comum; em telas estreitas cada linha vira um cartão.
function TabelaComissoes({ lista, acoes, mostrarColaborador = true }) {
  if (!lista.length) return <p className="text-secondary mb-0">Nenhuma comissão encontrada.</p>;
  return (
    <table className="table table-hover align-middle mb-0 tabela-comissoes">
      <thead>
        <tr>
          <th>#</th>{mostrarColaborador && <th>Colaborador</th>}<th>Produto / Cliente</th>
          <th className="text-end">Base</th><th className="text-end">Comissão</th><th>Status</th>{acoes && <th></th>}
        </tr>
      </thead>
      <tbody>
        {lista.map((c) => (
          <tr key={c.id}>
            <td data-label="#">{c.id}</td>
            {mostrarColaborador && <td data-label="Colaborador">{nomeDe(c.colaboradorId)}</td>}
            <td data-label="Produto">
              <div>{c.produto}<div className="small text-secondary">{c.cliente}</div></div>
            </td>
            <td data-label="Base" className="text-end">{brl(c.base)}</td>
            <td data-label="Comissão" className="text-end valor-comissao">{brl(c.valor)}</td>
            <td data-label="Status"><StatusBadge status={c.status} /></td>
            {acoes && (
              <td className="acoes">
                <div className="d-flex flex-wrap gap-1 justify-content-end">{acoes(c)}</div>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}