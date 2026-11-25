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
  service || "placeholder",
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
    service: "DIVINAS IMPORT API",
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
        error: "Ingresa nombres, ciudad y al menos un producto",
      });
    }

    const { data, error } = await db.rpc("create_store_proforma", {
      p_customer: customer,
      p_items: items,
    });

    if (error) {
      console.error("ERROR AL EJECUTAR create_store_proforma:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });

      return res.status(400).json({
        error: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
    }

    res.status(201).json(data);
  } catch (e) {
    console.error(e);

    res.status(400).json({
      error: e.message || "No se pudo guardar la proforma",
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
        error: "Datos incompletos",
      });
    }

    const { data, error } = await db.rpc("create_store_order", {
      p_customer: customer,
      p_items: items,
      p_payment_method: payment_method || "PENDIENTE",
    });

    if (error) throw error;

    res.status(201).json(data);
  } catch (e) {
    console.error(e);

    res.status(400).json({
      error: e.message || "No se pudo crear pedido",
    });
  }
});

// ========================================
// NORMALIZAR PRECIOS PARA CONTRA ENTREGA
// ========================================

async function normalizeContraEntregaItems(items, collectionType) {
  if (collectionType !== "CONTRA_ENTREGA") {
    return items;
  }

  const productIds = [
    ...new Set(items.map((item) => item.product_id).filter(Boolean)),
  ];

  const { data: products, error } = await db
    .from("products")
    .select("id, price, is_active")
    .in("id", productIds);

  if (error) throw error;

  const productsMap = new Map(
    (products || []).map((product) => [String(product.id), product]),
  );

  return items.map((item) => {
    const product = productsMap.get(String(item.product_id));

    if (!product || product.is_active === false) {
      throw new Error(`No se encontró un producto activo: ${item.product_id}`);
    }

    const regularPrice = Number(product.price);

    return {
      ...item,
      unit_price: regularPrice,
      regular_unit_price: regularPrice,
      discount_percent: 0,
    };
  });
}

// ========================================
// CREAR PROFORMA DESDE ADMINISTRACIÓN
// ========================================

app.post("/api/admin/proformas", auth, async (req, res) => {
  try {
    const { customer, items, delivery_type, shipping_cost, collection_type } =
      req.body;

    const delivery = delivery_type || "POR_DEFINIR";

    const shipping =
      delivery === "ENVIO" ? Math.max(0, Number(shipping_cost) || 0) : 0;

    const collection =
      delivery === "ENVIO" ? collection_type || "PREPAID" : "PREPAID";

    if (!["PREPAID", "CONTRA_ENTREGA"].includes(collection)) {
      return res.status(400).json({
        error: "La modalidad de pago no es válida.",
      });
    }

    // Aplicar precios normales cuando sea contra entrega
    const normalizedItems = await normalizeContraEntregaItems(
      items,
      collection,
    );

    // Crear la proforma utilizando la función SQL existente
    const { data, error } = await db.rpc("create_proforma", {
      p_customer: customer,
      p_items: normalizedItems,
      p_delivery_type: delivery,
      p_created_by: req.user.id,
    });

    if (error) throw error;

    // Guardar los datos de envío y modalidad de pago
    const { error: updateError } = await db
      .from("proformas")
      .update({
        shipping_cost: shipping,
        collection_type: collection,
      })
      .eq("id", data.proforma_id);

    if (updateError) throw updateError;

    res.status(201).json({
      ...data,
      shipping_cost: shipping,
      collection_type: collection,
    });
  } catch (e) {
    console.error("ERROR CREANDO PROFORMA:", e);

    res.status(400).json({
      error: e.message,
    });
  }
});

// ========================================
// ACTUALIZAR PROFORMA PENDIENTE
// ========================================

app.put("/api/admin/proformas/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    const { customer, items, delivery_type, shipping_cost, collection_type } =
      req.body || {};

    if (!id) {
      return res.status(400).json({
        error: "Falta el identificador de la proforma.",
      });
    }

    if (
      !customer?.full_name?.trim() ||
      !customer?.city?.trim() ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({
        error: "Ingresa el nombre, la ciudad y al menos un producto.",
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
          error:
            "Hay productos con datos inválidos. Revisa cantidades y precios.",
        });
      }
    }

    const delivery = delivery_type || "POR_DEFINIR";

    const shipping =
      delivery === "ENVIO" ? Math.max(0, Number(shipping_cost) || 0) : 0;

    const collection =
      delivery === "ENVIO" ? collection_type || "PREPAID" : "PREPAID";

    if (!["PREPAID", "CONTRA_ENTREGA"].includes(collection)) {
      return res.status(400).json({
        error: "La modalidad de pago no es válida.",
      });
    }

    // Aplicar precios normales cuando sea contra entrega
    const normalizedItems = await normalizeContraEntregaItems(
      items,
      collection,
    );

    // Actualizar datos de cliente y productos
    const { data, error } = await db.rpc("update_pending_proforma", {
      p_proforma_id: id,
      p_customer: customer,
      p_items: normalizedItems,
      p_delivery_type: delivery,
    });

    if (error) {
      console.error("ERROR AL ACTUALIZAR PROFORMA:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });

      return res.status(400).json({
        error: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
    }

    // Guardar valor del envío y modalidad de pago
    const { error: shippingError } = await db
      .from("proformas")
      .update({
        shipping_cost: shipping,
        collection_type: collection,
      })
      .eq("id", id)
      .eq("status", "PENDIENTE");

    if (shippingError) {
      console.error("ERROR GUARDANDO DATOS DE ENVÍO:", shippingError);

      return res.status(400).json({
        error: shippingError.message,
      });
    }

    return res.json({
      success: true,
      message: "Proforma actualizada correctamente.",
      data: {
        ...data,
        shipping_cost: shipping,
        collection_type: collection,
      },
    });
  } catch (e) {
    console.error("ERROR INESPERADO AL ACTUALIZAR PROFORMA:", e);

    return res.status(500).json({
      error: e.message || "No se pudo actualizar la proforma.",
    });
  }
});

// ========================================
// CAMBIAR TIPO DE ENTREGA
// ========================================

app.patch("/api/admin/proformas/:id/delivery", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { delivery_type } = req.body;

    const allowedTypes = ["POR_DEFINIR", "ENVIO", "RETIRO", "LOCAL"];

    if (!allowedTypes.includes(delivery_type)) {
      return res.status(400).json({
        error: "Tipo de entrega no válido.",
      });
    }

    const { data, error } = await db
      .from("proformas")
      .update({ delivery_type })
      .eq("id", id)
      .eq("status", "PENDIENTE")
      .select("id,delivery_type")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        error: "No se encontró una proforma pendiente para actualizar.",
      });
    }

    return res.json({
      success: true,
      message: "Tipo de entrega actualizado.",
      data,
    });
  } catch (e) {
    console.error("ERROR CAMBIANDO ENTREGA:", e);

    return res.status(400).json({
      error: e.message,
    });
  }
});

// ========================================
// ANULAR PROFORMA
// ========================================

app.patch("/api/admin/proformas/:id/cancel", auth, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await db
      .from("proformas")
      .update({ status: "ANULADA" })
      .eq("id", id)
      .eq("status", "PENDIENTE")
      .select("id,proforma_number,status")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        error: "No se encontró una proforma pendiente para anular.",
      });
    }

    return res.json({
      success: true,
      message: "Proforma anulada correctamente.",
      data,
    });
  } catch (e) {
    console.error("ERROR ANULANDO PROFORMA:", e);

    return res.status(400).json({
      error: e.message,
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
      p_user_id: req.user.id,
    });

    if (error) throw error;

    res.json(data);
  } catch (e) {
    console.error("ERROR CONFIRMANDO PROFORMA:", e);

    res.status(400).json({
      error: e.message,
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
      error: error.message,
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
      error: error.message,
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
      error: error.message,
    });
  }

  res.json(data);
});

// ========================================
// MANEJO DE ERRORES
// ========================================

/* ========================================
   APARTADOS - CREAR DESDE PROFORMA
======================================== */

app.post("/api/admin/proformas/:id/layaway", auth, async (req, res) => {
  try {
    const { initial_payment, payment_method, payment_reference } =
      req.body || {};
    const amount = Number(initial_payment);

    if (!Number.isFinite(amount) || amount <= 0)
      return res
        .status(400)
        .json({ error: "El abono inicial debe ser mayor a cero." });

    if (
      !["EFECTIVO", "TRANSFERENCIA", "TARJETA", "CONTRA_ENTREGA"].includes(
        payment_method,
      )
    )
      return res.status(400).json({ error: "Método de pago no válido." });

    const { data, error } = await db.rpc("create_layaway_from_proforma", {
      p_proforma_id: req.params.id,
      p_initial_payment: amount,
      p_payment_method: payment_method,
      p_payment_reference: payment_reference || null,
      p_user_id: req.user.id,
    });

    if (error) throw error;
    res.status(201).json(data);
  } catch (e) {
    console.error("ERROR CREANDO APARTADO:", e);
    res.status(400).json({ error: e.message });
  }
});

/* ========================================
   APARTADOS - LISTAR
======================================== */

app.get("/api/admin/layaways", auth, async (req, res) => {
  try {
    const allowed = ["ACTIVO", "COMPLETADO", "VENCIDO", "CANCELADO"];
    let query = db
      .from("layaways")
      .select("*, customers(*), proformas(*)")
      .order("expires_at", { ascending: true });

    if (req.query.status) {
      if (!allowed.includes(req.query.status))
        return res.status(400).json({ error: "Estado no válido." });
      query = query.eq("status", req.query.status);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (e) {
    console.error("ERROR LISTANDO APARTADOS:", e);
    res.status(400).json({ error: e.message });
  }
});

/* ========================================
   APARTADOS - DETALLE E HISTORIAL
======================================== */

app.get("/api/admin/layaways/:id", auth, async (req, res) => {
  try {
    const { data, error } = await db
      .from("layaways")
      .select(
        "*, customers(*), proformas(*, proforma_items(*)), layaway_payments(*)",
      )
      .eq("id", req.params.id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (e) {
    console.error("ERROR OBTENIENDO APARTADO:", e);
    res.status(400).json({ error: e.message });
  }
});

/* ========================================
   APARTADOS - REGISTRAR ABONO
======================================== */

app.post("/api/admin/layaways/:id/payments", auth, async (req, res) => {
  try {
    const { amount, payment_method, payment_reference } = req.body || {};
    const paymentAmount = Number(amount);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0)
      return res.status(400).json({ error: "El abono debe ser mayor a cero." });

    if (
      !["EFECTIVO", "TRANSFERENCIA", "TARJETA", "CONTRA_ENTREGA"].includes(
        payment_method,
      )
    )
      return res.status(400).json({ error: "Método de pago no válido." });

    const { data, error } = await db.rpc("register_layaway_payment", {
      p_layaway_id: req.params.id,
      p_amount: paymentAmount,
      p_payment_method: payment_method,
      p_payment_reference: payment_reference || null,
      p_user_id: req.user.id,
    });

    if (error) throw error;
    res.json(data);
  } catch (e) {
    console.error("ERROR REGISTRANDO ABONO:", e);
    res.status(400).json({ error: e.message });
  }
});

/* ========================================
   APARTADOS - AGREGAR PRODUCTOS
======================================== */

app.post("/api/admin/layaways/:id/items", auth, async (req, res) => {
  try {
    const { items } = req.body || {};

    if (!Array.isArray(items) || !items.length)
      return res.status(400).json({ error: "Debes seleccionar productos." });

    const { data, error } = await db.rpc("add_items_to_layaway", {
      p_layaway_id: req.params.id,
      p_items: items,
      p_user_id: req.user.id,
    });

    if (error) throw error;
    res.json(data);
  } catch (e) {
    console.error("ERROR AGREGANDO PRODUCTOS:", e);
    res.status(400).json({ error: e.message });
  }
});

/* ========================================
   APARTADOS - CONVERTIR EN VENTA
======================================== */

app.post("/api/admin/layaways/:id/convert", auth, async (req, res) => {
  try {
    const { final_payment_method, final_payment_reference } = req.body || {};

    if (
      final_payment_method &&
      !["EFECTIVO", "TRANSFERENCIA", "TARJETA", "CONTRA_ENTREGA"].includes(
        final_payment_method,
      )
    )
      return res.status(400).json({ error: "Método de pago final no válido." });

    const { data, error } = await db.rpc("convert_layaway_to_sale", {
      p_layaway_id: req.params.id,
      p_user_id: req.user.id,
      p_final_payment_method: final_payment_method || null,
      p_final_payment_reference: final_payment_reference || null,
    });

    if (error) throw error;
    res.json(data);
  } catch (e) {
    console.error("ERROR CONVIRTIENDO APARTADO:", e);
    res.status(400).json({ error: e.message });
  }
});

/* ========================================
   APARTADOS - CANCELAR
======================================== */

app.patch("/api/admin/layaways/:id/cancel", auth, async (req, res) => {
  try {
    const { data, error } = await db.rpc("close_layaway", {
      p_layaway_id: req.params.id,
      p_action: "CANCELAR",
      p_user_id: req.user.id,
    });

    if (error) throw error;
    res.json(data);
  } catch (e) {
    console.error("ERROR CANCELANDO APARTADO:", e);
    res.status(400).json({ error: e.message });
  }
});

app.use((err, req, res, next) => {
  console.error("ERROR GENERAL:", err);

  res.status(500).json({
    error: "Error interno",
  });
});

// ========================================
// VALIDAR ADMINISTRADOR
// ========================================

const adminOnly = (req, res, next) => {
  if (req.profile?.role !== "ADMIN") {
    return res.status(403).json({
      error: "No tienes permisos para realizar esta operación",
    });
  }

  next();
};

// ========================================
// OBTENER USUARIOS
// ========================================

app.get("/api/admin/users", auth, adminOnly, async (req, res) => {
  try {
    const { data, error } = await db
      .from("profiles")
      .select("id, full_name, email, role, is_active, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (e) {
    console.error("ERROR OBTENIENDO USUARIOS:", e);

    res.status(400).json({
      error: e.message,
    });
  }
});

// ========================================
// CREAR USUARIO
// ========================================

app.post("/api/admin/users", auth, adminOnly, async (req, res) => {
  try {
    const { full_name, email, password, role } = req.body;

    if (!full_name || !email || !password || !role) {
      throw new Error("Todos los campos son obligatorios");
    }

    if (!["ADMIN", "VENDEDORA"].includes(role)) {
      throw new Error("El rol seleccionado no es válido");
    }

    // Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await db.auth.admin.createUser(
      {
        email,
        password,
        email_confirm: true,
      },
    );

    if (authError) throw authError;

    // Crear perfil
    // Actualizar perfil creado automáticamente por el trigger
    const { data, error } = await db
      .from("profiles")
      .update({
        full_name,
        email,
        role,
        is_active: true,
      })
      .eq("id", authData.user.id)
      .select()
      .single();

    if (error) {
      await db.auth.admin.deleteUser(authData.user.id);
      throw error;
    }

    res.status(201).json(data);
  } catch (e) {
    console.error("ERROR CREANDO USUARIO:", e);

    res.status(400).json({
      error: e.message,
    });
  }
});

// ========================================
// ACTUALIZAR USUARIO
// ========================================

app.put("/api/admin/users/:id", auth, adminOnly, async (req, res) => {
  try {
    const { full_name, email, role, is_active } = req.body;
    const userId = req.params.id;

    if (!["ADMIN", "VENDEDORA"].includes(role)) {
      throw new Error("El rol seleccionado no es válido");
    }

    if (userId === req.user.id && (role !== "ADMIN" || is_active === false)) {
      throw new Error(
        "No puedes quitarte tus propios permisos de administrador ni desactivar tu usuario",
      );
    }

    // Actualizar correo en Supabase Auth
    if (email) {
      const { error: authError } = await db.auth.admin.updateUserById(userId, {
        email,
      });

      if (authError) throw authError;
    }

    // Actualizar perfil
    const { data, error } = await db
      .from("profiles")
      .update({
        full_name,
        email,
        role,
        is_active,
      })
      .eq("id", userId)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (e) {
    console.error("ERROR ACTUALIZANDO USUARIO:", e);

    res.status(400).json({
      error: e.message,
    });
  }
});

// ========================================
// INICIAR SERVIDOR
// ========================================

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`DIVINAS API escuchando en ${port}`);
});
