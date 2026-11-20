
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { createClient } from "@supabase/supabase-js";

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: process.env.FRONTEND_URL?.split(",") || true }));
app.use(express.json({ limit: "3mb" }));
app.use(morgan("dev"));

const url = process.env.SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anon = process.env.SUPABASE_ANON_KEY;

if (!url || !service || !anon) {
  console.warn("Faltan variables de Supabase en backend/.env");
}

const db = createClient(
  url || "https://placeholder.supabase.co",
  service || "placeholder"
);

// ========================================
// AUTENTICACIÓN
// ========================================

async function auth(req, res, next) {
  try {
    const token = (req.headers.authorization || "").replace(/^Bearer /, "");

    if (!token) {
      return res.status(401).json({ error: "Sesión requerida" });
    }

    const client = createClient(url, anon);
    const { data, error } = await client.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({ error: "Sesión inválida" });
    }

    const { data: profile } = await db
      .from("profiles")
      .select("role,is_active")
      .eq("id", data.user.id)
      .single();

    if (!profile?.is_active || !["ADMIN", "VENDEDORA"].includes(profile.role)) {
      return res.status(403).json({ error: "Sin permisos" });
    }

    req.user = data.user;
    req.profile = profile;

    next();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// ========================================
// HEALTH CHECK
// ========================================

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "DIVINAS IMPORT API"
  });
});

// ========================================
// PROFORMAS DE TIENDA ONLINE
// ========================================

app.post("/api/store/proformas", async (req, res) => {
  try {
    const { customer, items } = req.body;

    if (
      !customer?.full_name?.trim() ||
      !customer?.city?.trim() ||
      !Array.isArray(items) ||
      !items.length
    ) {
      return res.status(400).json({
        error: "Ingresa nombres, ciudad y al menos un producto"
      });
    }

    const { data, error } = await db.rpc("create_store_proforma", {
      p_customer: customer,
      p_items: items
    });

    if (error) {
      console.error("ERROR AL EJECUTAR create_store_proforma:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });

      return res.status(400).json({
        error: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
    }

    res.status(201).json(data);

  } catch (e) {
    console.error(e);

    res.status(400).json({
      error: e.message || "No se pudo guardar la proforma"
    });
  }
});

// ========================================
// PEDIDOS DE TIENDA
// ========================================

app.post("/api/store/orders", async (req, res) => {
  try {
    const { customer, items, payment_method } = req.body;

    if (
      !customer?.full_name ||
      !customer?.phone ||
      !Array.isArray(items) ||
      !items.length
    ) {
      return res.status(400).json({
        error: "Datos incompletos"
      });
    }

    const { data, error } = await db.rpc("create_store_order", {
      p_customer: customer,
      p_items: items,
      p_payment_method: payment_method || "PENDIENTE"
    });

    if (error) throw error;

    res.status(201).json(data);

  } catch (e) {
    console.error(e);

    res.status(400).json({
      error: e.message || "No se pudo crear pedido"
    });
  }
});

// ========================================
// CREAR PROFORMA DESDE ADMINISTRACIÓN
// ========================================

app.post("/api/admin/proformas", auth, async (req, res) => {
  try {
    const { customer, items, delivery_type } = req.body;

    const { data, error } = await db.rpc("create_proforma", {
      p_customer: customer,
      p_items: items,
      p_delivery_type: delivery_type || "ENVIO",
      p_created_by: req.user.id
    });

    if (error) throw error;

    res.status(201).json(data);

  } catch (e) {
    console.error("ERROR CREANDO PROFORMA:", e);

    res.status(400).json({
      error: e.message
    });
  }
});

// ========================================
// ACTUALIZAR PROFORMA PENDIENTE
// ========================================

app.put("/api/admin/proformas/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { customer, items, delivery_type } = req.body || {};

    if (!id) {
      return res.status(400).json({
        error: "Falta el identificador de la proforma."
      });
    }

    if (
      !customer?.full_name?.trim() ||
      !customer?.city?.trim() ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({
        error: "Ingresa el nombre, la ciudad y al menos un producto."
      });
    }

    for (const item of items) {
      if (
        !item?.product_id ||
        !Number.isInteger(Number(item.quantity)) ||
        Number(item.quantity) < 1 ||
        !Number.isFinite(Number(item.unit_price)) ||
        Number(item.unit_price) < 0
      ) {
        return res.status(400).json({
          error: "Hay productos con datos inválidos. Revisa cantidades y precios."
        });
      }
    }

    const { data, error } = await db.rpc("update_pending_proforma", {
      p_proforma_id: id,
      p_customer: customer,
      p_items: items,
      p_delivery_type: delivery_type || "POR_DEFINIR"
    });

    if (error) {
      console.error("ERROR AL ACTUALIZAR PROFORMA:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });

      return res.status(400).json({
        error: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
    }

    return res.json({
      success: true,
      message: "Proforma actualizada correctamente.",
      data
    });

  } catch (e) {
    console.error("ERROR INESPERADO AL ACTUALIZAR PROFORMA:", e);

    return res.status(500).json({
      error: e.message || "No se pudo actualizar la proforma."
    });
  }
});

// ========================================
// CONFIRMAR PROFORMA COMO VENTA
// ========================================

app.post("/api/admin/proformas/:id/confirm", auth, async (req, res) => {
  try {
    const { data, error } = await db.rpc("confirm_proforma_as_sale", {
      p_proforma_id: req.params.id,
      p_user_id: req.user.id
    });

    if (error) throw error;

    res.json(data);

  } catch (e) {
    console.error("ERROR CONFIRMANDO PROFORMA:", e);

    res.status(400).json({
      error: e.message
    });
  }
});

// ========================================
// LISTAR PROFORMAS
// ========================================

app.get("/api/admin/proformas", auth, async (req, res) => {
  const { data, error } = await db
    .from("proformas")
    .select("*,customers(*)")
    .order("created_at", { ascending: false });

  if (error) {
    return res.status(400).json({
      error: error.message
    });
  }

  res.json(data);
});

// ========================================
// LISTAR VENTAS
// ========================================

app.get("/api/admin/sales", auth, async (req, res) => {
  const { data, error } = await db
    .from("sales")
    .select("*,customers(*)")
    .order("created_at", { ascending: false });

  if (error) {
    return res.status(400).json({
      error: error.message
    });
  }

  res.json(data);
});

// ========================================
// LISTAR CLIENTES
// ========================================

app.get("/api/admin/customers", auth, async (req, res) => {
  const { data, error } = await db
    .from("customers")
    .select("*")
    .order("full_name");

  if (error) {
    return res.status(400).json({
      error: error.message
    });
  }

  res.json(data);
});

// ========================================
// MANEJO DE ERRORES
// ========================================

app.use((err, req, res, next) => {
  console.error("ERROR GENERAL:", err);

  res.status(500).json({
    error: "Error interno"
  });
});

// ========================================
// INICIAR SERVIDOR
// ========================================

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`DIVINAS API escuchando en ${port}`);
});
