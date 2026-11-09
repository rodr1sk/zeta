package br.com.zeta;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.util.*;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class ZetaController {

    private final JdbcTemplate db;

    ZetaController(JdbcTemplate db) { this.db = db; }

    private static final String SEL =
        "SELECT c.id, c.colaborador_id AS colaboradorId, col.nome AS colaborador, c.produto, c.cliente, " +
        "c.base, c.data_operacao AS data, c.valor, c.regra_descricao AS regra, c.status, " +
        "c.contestacao_motivo AS contestacaoMotivo, c.contestacao_resposta AS contestacaoResposta " +
        "FROM comissoes c JOIN colaboradores col ON col.id = c.colaborador_id ";

    record Calc(BigDecimal valor, String desc) {}

    // ---------- Cadastros ----------
    @GetMapping("/colaboradores")
    List<Map<String, Object>> colaboradores() {
        return db.queryForList("SELECT id, nome, equipe, meta FROM colaboradores ORDER BY nome");
    }

    @GetMapping("/regras")
    List<Map<String, Object>> regras() {
        var lista = db.queryForList("SELECT id, produto, tipo, percentual, valor_fixo AS valorFixo FROM regras ORDER BY id");
        for (var r : lista) {
            if ("escalonado".equals(r.get("tipo"))) {
                r.put("faixas", db.queryForList(
                    "SELECT ate, percentual FROM regra_faixas WHERE regra_id = ? ORDER BY ate IS NULL, ate", r.get("id")));
            }
        }
        return lista;
    }

    @PostMapping("/regras")
    Map<String, Object> novaRegra(@RequestBody Map<String, Object> b) {
        String produto = String.valueOf(b.get("produto")).trim();
        String tipo = String.valueOf(b.get("tipo"));
        BigDecimal valor = new BigDecimal(String.valueOf(b.get("valor")));
        if (produto.isEmpty() || valor.signum() <= 0 || !(tipo.equals("percentual") || tipo.equals("fixo")))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe produto, tipo (percentual ou fixo) e valor maior que zero");
        db.update("INSERT INTO regras (produto, tipo, percentual, valor_fixo) VALUES (?,?,?,?)",
            produto, tipo, tipo.equals("percentual") ? valor : null, tipo.equals("fixo") ? valor : null);
        return Map.of("ok", true);
    }

    @DeleteMapping("/regras/{id}")
    Map<String, Object> removerRegra(@PathVariable int id) {
        db.update("DELETE FROM regras WHERE id = ?", id);
        return Map.of("ok", true);
    }

    // ---------- Consultas ----------
    @GetMapping("/comissoes")
    List<Map<String, Object>> listar(@RequestParam(required = false) Long colaboradorId,
                                     @RequestParam(required = false) String status) {
        StringBuilder sql = new StringBuilder(SEL + "WHERE 1=1 ");
        List<Object> args = new ArrayList<>();
        if (colaboradorId != null) { sql.append("AND c.colaborador_id = ? "); args.add(colaboradorId); }
        if (status != null) { sql.append("AND c.status = ? "); args.add(status); }
        return db.queryForList(sql.append("ORDER BY c.id").toString(), args.toArray());
    }

    // Extrato detalhado, com o histórico completo
    @GetMapping("/comissoes/{id}")
    Map<String, Object> extrato(@PathVariable long id) {
        var l = db.queryForList(SEL + "WHERE c.id = ?", id);
        if (l.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Comissão não encontrada");
        var c = l.get(0);
        c.put("historico", db.queryForList(
            "SELECT criado_em AS em, mensagem AS msg FROM comissao_historico WHERE comissao_id = ? ORDER BY id", id));
        return c;
    }

    // ---------- Importação e cálculo ----------
    @PostMapping(value = "/importacao", consumes = "text/plain")
    Map<String, Object> importar(@RequestBody String csv) {
        int ok = 0;
        List<Map<String, String>> erros = new ArrayList<>();
        for (String linha : csv.split("\\R")) {
            linha = linha.trim();
            if (linha.isEmpty() || linha.toLowerCase().startsWith("colaborador")) continue;
            String[] p = linha.split(";", -1);
            String motivo = null; BigDecimal valor = null; LocalDate data = null; Calc c = null;
            List<Map<String, Object>> cols = List.of();
            if (p.length < 6) motivo = "Linha incompleta (esperado 6 colunas)";
            else {
                cols = db.queryForList("SELECT id FROM colaboradores WHERE LOWER(nome) = LOWER(?)", p[0].trim());
                try { valor = new BigDecimal(p[3].trim().replace(",", ".")); } catch (Exception e) { /* tratado abaixo */ }
                try { data = LocalDate.parse(p[4].trim()); } catch (Exception e) { /* tratado abaixo */ }
                if (cols.isEmpty()) motivo = "Colaborador não cadastrado";
                else if (valor == null || valor.signum() <= 0) motivo = "Valor inválido";
                else if (data == null) motivo = "Data inválida (use AAAA-MM-DD)";
                else if (p[5].trim().equalsIgnoreCase("cancelada")) motivo = "Operação cancelada, não gera comissão";
                else if ((c = calcular(p[1].trim(), valor)) == null) motivo = "Produto sem regra de comissão";
            }
            if (motivo != null) { erros.add(Map.of("linha", linha, "motivo", motivo)); continue; }

            final int colId = ((Number) cols.get(0).get("id")).intValue();
            final BigDecimal base = valor; final LocalDate dt = data; final Calc calc = c;
            final String produto = p[1].trim(), cliente = p[2].trim();
            KeyHolder kh = new GeneratedKeyHolder();
            db.update(con -> {
                PreparedStatement ps = con.prepareStatement(
                    "INSERT INTO comissoes (colaborador_id, produto, cliente, base, data_operacao, valor, regra_descricao) " +
                    "VALUES (?,?,?,?,?,?,?)", Statement.RETURN_GENERATED_KEYS);
                ps.setInt(1, colId); ps.setString(2, produto); ps.setString(3, cliente);
                ps.setBigDecimal(4, base); ps.setDate(5, Date.valueOf(dt));
                ps.setBigDecimal(6, calc.valor()); ps.setString(7, calc.desc());
                return ps;
            }, kh);
            hist(kh.getKey().longValue(), "Comissão calculada: " + calc.desc());
            ok++;
        }
        return Map.of("calculadas", ok, "erros", erros);
    }

    // Cálculo determinístico, com BigDecimal arredondado em centavos
    private Calc calcular(String produto, BigDecimal base) {
        var rs = db.queryForList("SELECT id, tipo, percentual, valor_fixo FROM regras WHERE produto = ?", produto);
        if (rs.isEmpty()) return null;
        var r = rs.get(0);
        String tipo = (String) r.get("tipo");
        if (tipo.equals("fixo")) {
            BigDecimal v = (BigDecimal) r.get("valor_fixo");
            return new Calc(v, "Valor fixo de " + brl(v) + " por operação");
        }
        BigDecimal pct;
        if (tipo.equals("percentual")) pct = (BigDecimal) r.get("percentual");
        else {
            var f = db.queryForList("SELECT percentual FROM regra_faixas WHERE regra_id = ? AND (ate IS NULL OR ate >= ?) " +
                                    "ORDER BY ate IS NULL, ate LIMIT 1", r.get("id"), base);
            if (f.isEmpty()) return null;
            pct = (BigDecimal) f.get(0).get("percentual");
        }
        BigDecimal v = base.multiply(pct).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        return new Calc(v, (tipo.equals("escalonado") ? "Faixa escalonada " : "") +
                           pct.stripTrailingZeros().toPlainString() + "% sobre " + brl(base));
    }

    // ---------- Fluxo de aprovação e pagamento ----------
    @PostMapping("/comissoes/{id}/aprovar")
    Map<String, Object> aprovar(@PathVariable long id) {
        mudar(id, "Aprovada", "Aprovada pelo gestor", "Calculada");
        return Map.of("ok", true);
    }

    @PostMapping("/comissoes/aprovar-todas")
    Map<String, Object> aprovarTodas() {
        List<Long> ids = db.queryForList("SELECT id FROM comissoes WHERE status = 'Calculada'", Long.class);
        ids.forEach(i -> mudar(i, "Aprovada", "Aprovada pelo gestor", "Calculada"));
        return Map.of("aprovadas", ids.size());
    }

    @PostMapping("/comissoes/{id}/ajustar")
    Map<String, Object> ajustar(@PathVariable long id, @RequestBody Map<String, String> b) {
        String just = b.getOrDefault("justificativa", "").trim();
        if (just.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O ajuste exige justificativa");
        BigDecimal novo = new BigDecimal(b.get("valor")).setScale(2, RoundingMode.HALF_UP);
        BigDecimal antigo = db.queryForObject("SELECT valor FROM comissoes WHERE id = ?", BigDecimal.class, id);
        mudar(id, "Calculada", "Ajuste de " + brl(antigo) + " para " + brl(novo) + ". Justificativa: " + just, "Calculada");
        db.update("UPDATE comissoes SET valor = ? WHERE id = ?", novo, id);
        return Map.of("ok", true);
    }

    @PostMapping("/comissoes/{id}/pagar")
    Map<String, Object> pagar(@PathVariable long id) {
        mudar(id, "Paga", "Pagamento processado e registrado. Confirmação enviada ao colaborador", "Aprovada");
        return Map.of("ok", true);
    }

    @PostMapping("/comissoes/{id}/contestar")
    Map<String, Object> contestar(@PathVariable long id, @RequestBody Map<String, String> b) {
        String motivo = b.getOrDefault("motivo", "").trim();
        if (motivo.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o motivo");
        mudar(id, "Contestada", "Contestação aberta: " + motivo, "Calculada", "Aprovada");
        db.update("UPDATE comissoes SET contestacao_motivo = ?, contestacao_resposta = NULL WHERE id = ?", motivo, id);
        return Map.of("ok", true);
    }

    @PostMapping("/comissoes/{id}/responder")
    Map<String, Object> responder(@PathVariable long id, @RequestBody Map<String, String> b) {
        String resp = b.getOrDefault("resposta", "").trim();
        if (resp.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe a resposta");
        mudar(id, "Calculada", "Contestação respondida: " + resp, "Contestada");
        db.update("UPDATE comissoes SET contestacao_resposta = ? WHERE id = ?", resp, id);
        return Map.of("ok", true);
    }

    // ---------- Utilitários ----------
    // Só muda o status se o atual permitir (evita pagar sem aprovar) e registra no histórico
    private void mudar(long id, String para, String msg, String... de) {
        String in = String.join(",", Collections.nCopies(de.length, "?"));
        List<Object> args = new ArrayList<>(List.of(para, id));
        args.addAll(List.of(de));
        int n = db.update("UPDATE comissoes SET status = ? WHERE id = ? AND status IN (" + in + ")", args.toArray());
        if (n == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "O status atual da comissão não permite esta ação");
        hist(id, msg);
    }

    private void hist(long id, String msg) {
        db.update("INSERT INTO comissao_historico (comissao_id, mensagem) VALUES (?,?)", id, msg);
    }

    private static String brl(BigDecimal v) {
        return NumberFormat.getCurrencyInstance(Locale.forLanguageTag("pt-BR")).format(v);
    }
}