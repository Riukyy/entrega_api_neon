import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pkg from "pg";

dotenv.config();

const { Pool } = pkg;
const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function auth(req, res, next) {
  const token = req.headers["x-api-token"];
  if (!token || token !== process.env.API_TOKEN) {
    return res.status(401).json({ error: "Não autorizado" });
  }
  next();
}

// Health check (sem auth)
app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* =========================
   DIA TRABALHO (CRUD)
========================= */
app.get("/dia-trabalho", auth, async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM dia_trabalho ORDER BY data DESC");
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/dia-trabalho", auth, async (req, res) => {
  try {
    const {
      data, turno, km_rodado, ganho_bruto,
      combustivel_informado, hora_inicio, hora_fim, observacoes
    } = req.body;

    const r = await pool.query(
      `INSERT INTO dia_trabalho
       (data, turno, km_rodado, ganho_bruto, combustivel_informado, hora_inicio, hora_fim, observacoes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [data, turno, km_rodado, ganho_bruto, combustivel_informado, hora_inicio, hora_fim, observacoes]
    );

    res.status(201).json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/dia-trabalho/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      data, turno, km_rodado, ganho_bruto,
      combustivel_informado, hora_inicio, hora_fim, observacoes
    } = req.body;

    const r = await pool.query(
      `UPDATE dia_trabalho
       SET data=$1, turno=$2, km_rodado=$3, ganho_bruto=$4,
           combustivel_informado=$5, hora_inicio=$6, hora_fim=$7, observacoes=$8
       WHERE id=$9
       RETURNING *`,
      [data, turno, km_rodado, ganho_bruto, combustivel_informado, hora_inicio, hora_fim, observacoes, id]
    );

    if (r.rowCount === 0) return res.status(404).json({ error: "Não encontrado" });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/dia-trabalho/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query("DELETE FROM dia_trabalho WHERE id=$1", [id]);
    if (r.rowCount === 0) return res.status(404).json({ error: "Não encontrado" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =========================
   ABASTECIMENTOS (CRUD)
========================= */
app.get("/abastecimentos", auth, async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM abastecimentos ORDER BY data DESC");
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/abastecimentos", auth, async (req, res) => {
  try {
    const { data, hora, valor_abastecido, litros, preco_por_litro, observacoes } = req.body;
    const r = await pool.query(
      `INSERT INTO abastecimentos (data, hora, valor_abastecido, litros, preco_por_litro, observacoes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [data, hora, valor_abastecido, litros, preco_por_litro, observacoes]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =========================
   MANUTENÇÕES (CRUD)
========================= */
app.get("/manutencoes", auth, async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM manutencoes ORDER BY data DESC");
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/manutencoes", auth, async (req, res) => {
  try {
    const { data, hora, tipo_manutencao, descricao, custo, quilometragem_km, local_oficina } = req.body;

    const r = await pool.query(
      `INSERT INTO manutencoes (data, hora, tipo_manutencao, descricao, custo, quilometragem_km, local_oficina)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [data, hora, tipo_manutencao, descricao, custo, quilometragem_km, local_oficina]
    );

    // Se for troca de óleo, atualizar controle_oleo
    if (String(tipo_manutencao).toLowerCase().includes("óleo")) {
      await pool.query(
        `UPDATE controle_oleo
         SET data_ultima_troca=$1, atualizado_em=now()
         WHERE id = (SELECT id FROM controle_oleo ORDER BY id LIMIT 1)`,
        [data]
      );
    }

    res.status(201).json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("API rodando na porta", process.env.PORT || 3000);
});
