import React, { useEffect, useMemo, useState } from "react";

import { supabase } from "./supabase";

import Proformas from "./components/proformas/Proformas";

import Categories from "./components/categories/Categories";

import Customers from "./components/customers/Customers";

import Sales from "./components/sales/Sales";

import Inventory from "./components/inventory/Inventory";

import Userss from "./components/users/Users";

import {
  Search,
  ShoppingBag,
  Menu,
  Plus,
  Minus,
  Trash2,
  Package,
  Users,
  Tags,
  ClipboardList,
  Store,
  LogOut,
  ImagePlus,
  CheckCircle,
  Filter,
  ArrowLeft,
  Percent,
  Boxes,
  Receipt,
} from "lucide-react";

const CATS = [
  "Ropa deportiva",

  "Ropa damas",

  "Ropa de niño",

  "Ropa de niña",

  "Ropa de caballeros",

  "Accesorios",

  "Perfumes",

  "Cabello",

  "Zapatos",
];

const money = (n) =>
  "$" +
  Number(n || 0)
    .toFixed(2)

    .replace(/\.00$/, "")
    .replace(/(\.\d)0$/, "$1");

const round50 = (n) => Math.round(n * 2) / 2;

function promoPrice(price, pct) {
  return round50(Number(price) * (1 - Number(pct || 0) / 100));
}

function App() {
  const [products, setProducts] = useState([]),
    [categories, setCategories] = useState([]),
    [discounts, setDiscounts] = useState([]),
    [variants, setVariants] = useState([]);

  const [loading, setLoading] = useState(true),
    [config, setConfig] = useState(!!supabase),
    [query, setQuery] = useState(""),
    [cat, setCat] = useState("Todas"),
    [cart, setCart] = useState([]),
    [page, setPage] = useState("store"),
    [admin, setAdmin] = useState(false),
    [sidebarOpen, setSidebarOpen] = useState(false),
    [user, setUser] = useState(null),
    [modal, setModal] = useState(false),
    [optionProduct, setOptionProduct] = useState(null),
    [selectedVariantId, setSelectedVariantId] = useState(""),
    [selectedQty, setSelectedQty] = useState(1),
    [imageViewer, setImageViewer] = useState(null),
    [edit, setEdit] = useState(null),
    [message, setMessage] = useState(""),
    [loginEmail, setLoginEmail] = useState(""),
    [loginPassword, setLoginPassword] = useState(""),
    [loginError, setLoginError] = useState("");

  const [form, setForm] = useState({
    name: "",

    code: "",

    description: "",

    category: "Ropa damas",

    price: "",

    image_url: "",

    sizes: "S,M,L",

    colors: "Negro,Blanco",

    stock: "0",
  });

  const [customer, setCustomer] = useState({
    full_name: "",

    phone: "",

    city: "",

    address: "",

    delivery_type: "ENVIO",
  });

  const [payment, setPayment] = useState("PENDIENTE"),
    [saleItems, setSaleItems] = useState([]),
    [discountForm, setDiscountForm] = useState({
      name: "Black Weekend",

      category_id: "",

      percentage: 10,

      start_at: "",

      end_at: "",
    });

  const [editingDiscountId, setEditingDiscountId] = useState(null);

  async function load() {
    if (!supabase) {
      setLoading(false);

      return;
    }

    setLoading(true);

    const [p, c, d, v] = await Promise.all([
      supabase

        .from("products")

        .select("*,categories(name)")

        .eq("is_active", true)

        .order("created_at", { ascending: false }),

      supabase.from("categories").select("*").order("name"),

      supabase
        .from("category_discounts")
        .select("*")
        .order("created_at", { ascending: false }),

      supabase.from("product_variants").select("*"),
    ]);

    if (p.data) setProducts(p.data);

    if (c.data) setCategories(c.data);

    if (d.data) setDiscounts(d.data);

    if (v.data) setVariants(v.data);

    setLoading(false);
  }

  useEffect(() => {
    load();

    if (supabase)
      supabase.auth.getSession().then(async ({ data }) => {
        const current = data.session?.user || null;

        setUser(current);

        if (
          window.location.pathname.replace(/\/$/, "") === "/admin" &&
          current
        ) {
          const { data: profile } = await supabase

            .from("profiles")

            .select("role,is_active")

            .eq("id", current.id)

            .single();

          if (
            profile?.is_active &&
            ["ADMIN", "VENDEDORA"].includes(profile.role)
          ) {
            setAdmin(true);

            setPage("dashboard");
          } else {
            await supabase.auth.signOut();

            setUser(null);

            setLoginError(
              "Tu usuario no tiene permisos para ingresar al administrador.",
            );
          }
        }
      });
  }, []);

  const activeDiscount = (product) => {
    const d = discounts.find(
      (x) => x.category_id === product.category_id && x.is_active,
    );

    return d ? Number(d.percentage) : 0;
  };

  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          (cat === "Todas" || p.categories?.name === cat) &&
          `${p.name} ${p.code} ${p.description || ""}`

            .toLowerCase()

            .includes(query.toLowerCase()),
      ),

    [products, cat, query, discounts],
  );

  const openProductOptions = (product) => {
    const productVariants = variants.filter((v) => v.product_id === product.id);
    setOptionProduct(product);
    setSelectedVariantId(productVariants[0]?.id || "");
    setSelectedQty(1);
  };

  const selectedVariant = optionProduct
    ? variants.find(
        (v) => v.id === selectedVariantId && v.product_id === optionProduct.id,
      ) || null
    : null;

  const selectedStock = Math.max(0, Number(selectedVariant?.stock || 0));
  const selectedCartQty = selectedVariant
    ? cart.find((item) => item.variant?.id === selectedVariant.id)?.qty || 0
    : 0;
  const remainingSelectedStock = Math.max(0, selectedStock - selectedCartQty);

  const addSelectedToCart = () => {
    if (!optionProduct || !selectedVariant) {
      alert("Este producto no tiene combinaciones disponibles.");
      return;
    }
    if (selectedStock < 1) {
      alert("Esta combinación está agotada.");
      return;
    }

    const key = `${optionProduct.id}-${selectedVariant.id}`;
    const currentQty = cart.find((item) => item.key === key)?.qty || 0;
    if (currentQty + selectedQty > selectedStock) {
      alert(
        `Solo puedes agregar ${Math.max(0, selectedStock - currentQty)} unidades más de esta combinación.`,
      );
      return;
    }

    setCart((old) => {
      const found = old.find((item) => item.key === key);
      return found
        ? old.map((item) =>
            item.key === key ? { ...item, qty: item.qty + selectedQty } : item,
          )
        : [
            ...old,
            {
              key,
              product: optionProduct,
              variant: selectedVariant,
              qty: selectedQty,
            },
          ];
    });
    setOptionProduct(null);
    setPage("store");
  };

  const subtotal = cart.reduce(
    (s, x) =>
      s + promoPrice(x.product.price, activeDiscount(x.product)) * x.qty,

    0,
  );

  async function signIn(e) {
    e.preventDefault();

    setLoginError("");

    if (!supabase) {
      setLoginError("Falta configurar Supabase en el frontend.");

      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,

      password: loginPassword,
    });

    if (error) {
      setLoginError("Correo o contraseña incorrectos.");

      return;
    }

    const { data: profile, error: profileError } = await supabase

      .from("profiles")

      .select("role,is_active")

      .eq("id", data.user.id)

      .single();

    if (
      profileError ||
      !profile?.is_active ||
      !["ADMIN", "VENDEDORA"].includes(profile.role)
    ) {
      await supabase.auth.signOut();

      setLoginError(
        "Este usuario no tiene permisos para acceder al administrador.",
      );

      return;
    }

    setUser(data.user);

    setAdmin(true);

    setPage("dashboard");

    window.history.replaceState({}, "", "/admin");
  }

  async function saveProduct(e) {
    e.preventDefault();

    const payload = {
      name: form.name,

      code: form.code,

      description: form.description,

      category_id: categories.find((c) => c.name === form.category)?.id,

      price: Number(form.price),

      image_url: form.image_url,

      is_active: true,
    };

    let res = edit
      ? await supabase.from("products").update(payload).eq("id", edit.id)
      : await supabase.from("products").insert(payload).select().single();

    if (res.error) {
      alert(res.error.message);

      return;
    }

    const product = edit ? edit : res.data;

    if (!edit) {
      const sizes = form.sizes

          .split(",")

          .map((s) => s.trim())

          .filter(Boolean),
        colors = form.colors

          .split(",")

          .map((s) => s.trim())

          .filter(Boolean);

      const rows = sizes.flatMap((size) =>
        colors.map((color) => ({
          product_id: product.id,

          size,

          color,

          stock: Number(form.stock) || 0,

          sku: `${form.code}-${size}-${color}`.replaceAll(" ", "-"),
        })),
      );

      await supabase.from("product_variants").insert(rows);
    }

    setModal(false);

    setEdit(null);

    load();

    setMessage("Producto guardado correctamente");
  }

  async function uploadPhoto(file) {
    if (!file) return;

    const ext = file.name.split(".").pop();

    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { data: uploadData, error } = await supabase.storage

      .from("product-images")

      .upload(path, file, { upsert: false });

    if (error) {
      alert(error.message);

      return;
    }

    const { data } = supabase.storage.from("product-images").getPublicUrl(path);

    setForm((f) => ({ ...f, image_url: data.publicUrl }));
  }

  async function checkout() {
    let whatsappWindow = null;

    try {
      const fullName = customer.full_name.trim();

      const phone = customer.phone.trim();

      const city = customer.city.trim();

      if (!fullName || !phone || !city) {
        alert(
          "Ingresa tus nombres, número de teléfono y ciudad para continuar.",
        );

        return;
      }

      if (!cart.length) {
        alert("Tu carrito está vacío.");

        return;
      } // Abrimos la pestaña desde el clic del usuario para evitar que el navegador
      // bloquee WhatsApp después de esperar la respuesta del servidor.

      whatsappWindow = window.open("about:blank", "_blank");

      const payload = {
        customer: {
          full_name: fullName,

          phone,

          city,
        },

        items: cart.map((x) => ({
          product_id: x.product.id,

          variant_id: x.variant?.id || null,

          quantity: x.qty,
        })),
      };

      const apiUrl = import.meta.env.VITE_API_URL;

      if (!apiUrl) {
        throw new Error("Falta configurar VITE_API_URL en el frontend.");
      }

      const r = await fetch(`${apiUrl.replace(/\/$/, "")}/store/proformas`, {
        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify(payload),
      });

      const data = await r.json().catch(() => ({}));

      if (!r.ok) {
        if (whatsappWindow) whatsappWindow.close();

        alert(data.error || "No se pudo guardar la proforma.");

        return;
      }

      const lines = (data.items || [])
        .map((i, index) => {
          const selected = cart[index];
          const variantDetails = selected?.variant
            ? ` | Modelo: ${selected.variant.sku || selected.variant.id} | Color: ${selected.variant.color || "No especificado"} | Talla: ${selected.variant.size || "No especificada"}`
            : "";
          return `• ${i.name} (${i.code})${variantDetails} | ${i.quantity} x ${money(i.unit_price)} = ${money(i.line_total)}`;
        })
        .join("\n");

      const message = `Hola, deseo realizar este pedido en DIVINAS IMPORT.

Proforma: ${data.proforma_number}

Cliente: ${fullName}

Teléfono: ${phone}

Ciudad: ${city}



${lines}



Subtotal: ${money(data.subtotal)}

IVA (0%): ${money(0)}

TOTAL: ${money(data.total)}



Quedo pendiente de confirmar envío o entrega.`;

      const whatsappUrl = `https://wa.me/593986086415?text=${encodeURIComponent(message)}`;

      if (whatsappWindow) {
        whatsappWindow.location.href = whatsappUrl;
      } else {
        // Alternativa si el navegador bloqueó la nueva pestaña.

        window.location.href = whatsappUrl;
      }

      alert(
        "¡Proforma guardada correctamente! Se abrirá WhatsApp para compartir tu pedido.",
      );

      setCart([]);

      setCustomer({
        full_name: "",

        phone: "",

        city: "",

        address: "",

        delivery_type: "ENVIO",
      });

      setPage("store");
    } catch (error) {
      console.error("Error al generar la proforma:", error);

      if (whatsappWindow && !whatsappWindow.closed) whatsappWindow.close();

      alert(
        error.message ||
          "Ocurrió un error al generar tu proforma. Inténtalo nuevamente.",
      );
    }
  }

  async function createDiscount(e) {
    e.preventDefault();

    const wasEditing = Boolean(editingDiscountId);
    const payload = {
      name: discountForm.name.trim(),
      category_id: discountForm.category_id,
      percentage: Number(discountForm.percentage),
      start_at: discountForm.start_at || null,
      end_at: discountForm.end_at || null,
    };

    if (!payload.name || !payload.category_id) {
      alert("Ingresa el nombre y selecciona una categoría.");
      return;
    }

    const result = wasEditing
      ? await supabase
          .from("category_discounts")
          .update(payload)
          .eq("id", editingDiscountId)
      : await supabase
          .from("category_discounts")
          .insert({ ...payload, is_active: true });

    if (result.error) {
      alert(result.error.message);
      return;
    }

    setDiscountForm({
      name: "Black Weekend",
      category_id: "",
      percentage: 10,
      start_at: "",
      end_at: "",
    });
    setEditingDiscountId(null);

    await load();
    setMessage(
      wasEditing
        ? "Descuento actualizado correctamente"
        : "Descuento publicado en la tienda",
    );
  }

  async function toggleDiscount(discount) {
    const { error } = await supabase
      .from("category_discounts")
      .update({ is_active: !discount.is_active })
      .eq("id", discount.id);

    if (error) {
      alert(error.message);
      return;
    }

    await load();
    setMessage(
      discount.is_active ? "Descuento deshabilitado" : "Descuento habilitado",
    );
  }

  function editDiscount(discount) {
    setEditingDiscountId(discount.id);
    setDiscountForm({
      name: discount.name || "",
      category_id: discount.category_id || "",
      percentage: discount.percentage ?? 10,
      start_at: discount.start_at || "",
      end_at: discount.end_at || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelDiscountEdit() {
    setEditingDiscountId(null);
    setDiscountForm({
      name: "Black Weekend",
      category_id: "",
      percentage: 10,
      start_at: "",
      end_at: "",
    });
  }

  async function saveProforma() {
    if (!customer.full_name || !saleItems.length) {
      alert("Ingresa cliente y productos");

      return;
    }

    const totalUnits = saleItems.reduce((n, x) => n + x.qty, 0);

    const payload = {
      customer,

      items: saleItems.map((x) => {
        const pct = activeDiscount(x.product);

        const finalPct = pct > 0 ? pct : totalUnits >= 4 ? 10 : 0;

        return {
          product_id: x.product.id,

          variant_id: x.variant?.id || null,

          quantity: x.qty,

          unit_price: round50(x.product.price * (1 - finalPct / 100)),

          discount_percent: finalPct,
        };
      }),

      delivery_type: customer.delivery_type,
    };

    const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/proformas`, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",

        Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ""}`,
      },

      body: JSON.stringify(payload),
    });

    const data = await r.json();

    if (!r.ok) {
      alert(data.error || "Error al crear proforma");

      return;
    }

    alert(`Proforma ${data.proforma_number} creada`);

    setSaleItems([]);
  }

  async function confirmSale(proformaId) {
    try {
      const apiUrl = import.meta.env.VITE_API_URL;

      if (!apiUrl) {
        throw new Error("Falta configurar VITE_API_URL.");
      }

      const { data } = await supabase.auth.getSession();

      const baseUrl = apiUrl.endsWith("/") ? apiUrl.slice(0, -1) : apiUrl;

      const r = await fetch(
        `${baseUrl}/admin/proformas/${proformaId}/confirm`,

        {
          method: "POST",

          headers: {
            Authorization: `Bearer ${data.session?.access_token || ""}`,
          },
        },
      );

      const result = await r.json();

      if (!r.ok) {
        throw new Error(result.message || "No se pudo confirmar la proforma.");
      }

      alert("Proforma confirmada como venta correctamente.");

      return true;
    } catch (error) {
      console.error("Error al confirmar venta:", error);

      alert(error.message || "Error al confirmar la venta.");

      return false;
    }
  }

  const adminNav = [
    ["dashboard", "Resumen", Store],

    ["products", "Productos", Package],

    ["customers", "Clientes", Users],

    ["categories", "Categorías", Tags],

    ["discounts", "Descuentos", Percent],

    ["proformas", "Proformas", ClipboardList],

    ["sales", "Ventas", Receipt],

    ["inventory", "Inventario", Boxes],

    ["users", "Usuarios", Users],
  ];

  const isAdminUrl = window.location.pathname.replace(/\/$/, "") === "/admin";

  if (isAdminUrl && !user)
    return (
      <div className="loginpage">
               {" "}
        <form className="loginbox" onSubmit={signIn}>
                    <img src="/divinas-logo.png" />         {" "}
          <span>ÁREA ADMINISTRATIVA</span>          <h1>Iniciar sesión</h1>     
              <p>Ingresa con tu cuenta autorizada de DIVINAS IMPORT.</p>       
           {" "}
          <label>
                        Correo electrónico            {" "}
            <input
              type="email"
              required
              autoComplete="username"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
            />
                     {" "}
          </label>
                   {" "}
          <label>
                        Contraseña            {" "}
            <input
              type="password"
              required
              autoComplete="current-password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
            />
                     {" "}
          </label>
                   {" "}
          {loginError && <div className="loginerror">{loginError}</div>}       
           {" "}
          <button className="primary" type="submit">
                        Ingresar          {" "}
          </button>
                    <a href="/">Volver a la tienda</a>       {" "}
        </form>
             {" "}
      </div>
    );

  return (
    <div className="app">
      <style>{`
        .discountFormActions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
        .discountCancel,.discountActions button{border:0;border-radius:8px;padding:10px 14px;font-weight:700;cursor:pointer}
        .discountCancel{background:#f1edf2;color:#5f5263}
        .discountList{display:grid;gap:12px;margin-top:18px}
        .discountItem{display:flex;justify-content:space-between;align-items:center;gap:15px;padding:16px;background:#fff;border:1px solid #eadced;border-radius:12px}
        .discountInfo strong{color:#884798;font-size:15px}
        .discountInfo p{margin:5px 0;color:#76647b;font-size:13px}
        .discountStatus{font-size:11px;font-weight:800}
        .discountActive{color:#16834a}
        .discountInactive{color:#999}
        .discountActions{display:flex;flex-wrap:wrap;gap:8px}
        .discountEdit{background:#f3eaf5;color:#884798}
        .discountDisable{background:#fff0e6;color:#c66a16}
        .discountEnable{background:#e8f7ed;color:#16834a}
        @media(max-width:600px){.discountItem{align-items:flex-start;flex-direction:column}.discountActions{width:100%}}
        .storeImageOverlay,.storeOptionsOverlay{position:fixed;inset:0;z-index:3000;background:rgba(20,15,22,.82);display:flex;align-items:center;justify-content:center;padding:18px}
        .storeImageOverlay{flex-direction:column;gap:12px}
        .storeImageOverlay img{max-width:min(92vw,900px);max-height:82vh;object-fit:contain;border-radius:12px;background:#fff}
        .storeImageOverlay span{color:#fff;font-weight:600}
        .storeImageClose,.storeOptionsClose{position:absolute;top:14px;right:18px;border:0;border-radius:50%;width:42px;height:42px;font-size:30px;line-height:1;background:#fff;color:#241b28;cursor:pointer}
        .storeOptionsOverlay{background:rgba(20,15,22,.62);overflow-y:auto}
        .storeOptionsModal{position:relative;background:#fff;color:#241b28;width:min(100%,520px);max-height:92vh;overflow-y:auto;border-radius:18px;padding:26px;box-shadow:0 18px 60px rgba(0,0,0,.25)}
        .storeOptionsProduct{display:flex;align-items:center;gap:16px;padding-right:34px;margin-bottom:22px}
        .storeOptionsProduct img{width:112px;height:132px;object-fit:cover;border-radius:12px}
        .storeOptionsProduct small{color:#884798}.storeOptionsProduct h2{font-size:20px;margin:6px 0}
        .storeOptionsProduct strong{color:#884798;font-size:20px}
        .storeOptionField{display:flex;flex-direction:column;gap:8px;font-weight:600;margin:16px 0}
        .storeOptionField select,.storeQtySelector input{width:100%;padding:11px;border:1px solid #d8cbdc;border-radius:9px;background:#fff;color:#241b28}
        .storeVariantInfo{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:14px;background:#faf7fb;border-radius:10px;font-size:13px}
        .storeQtySelector{display:flex;align-items:center;gap:12px}
        .storeQtySelector button{width:40px;height:40px;border:1px solid #884798;border-radius:8px;background:#fff;color:#884798;display:grid;place-items:center}
        .storeQtySelector button:disabled,.storeOptionsAdd:disabled{opacity:.4;cursor:not-allowed}
        .storeQtySelector input{max-width:90px;text-align:center}
        .storeOptionsAdd{width:100%;border:0;border-radius:10px;padding:14px;background:#884798;color:#fff;font-weight:700;cursor:pointer;margin-top:12px}
        .storeOutOfStock{color:#b42318;font-weight:600}.storeStockNote{display:block;color:#756b78;font-size:12px;line-height:1.45;margin-top:12px}
        .qty button:disabled{opacity:.35;cursor:not-allowed}
        @media(max-width:560px){.storeOptionsModal{padding:22px 16px;border-radius:16px}.storeOptionsProduct img{width:88px;height:110px}.storeOptionsProduct h2{font-size:17px}.storeImageOverlay img{max-width:96vw;max-height:78vh}}
      `}</style>
           {" "}
      <header className="top">
               {" "}
        <button
          className="iconbtn"
          onClick={() => {
            if (admin) {
              setSidebarOpen(!sidebarOpen);
            } else {
              setPage("store");
            }
          }}
        >
                  <Menu />       {" "}
        </button>
                <img src="/divinas-logo.png" />       {" "}
        <nav>
                   {" "}
          <button
            onClick={() => {
              setAdmin(false);

              setPage("store");
            }}
          >
                        Tienda          {" "}
          </button>
                   {" "}
          <button
            onClick={() => {
              setPage("store");

              setCat("Todas");
            }}
          >
                        Nueva colección          {" "}
          </button>
                    <button onClick={() => setPage("store")}>Ofertas</button>   
             {" "}
        </nav>
               {" "}
        <div className="topright">
                   {" "}
          <button
            className="iconbtn"
            onClick={() => {
              setPage("cart");

              setAdmin(false);
            }}
          >
                        <ShoppingBag />           {" "}
            <b>{cart.reduce((s, x) => s + x.qty, 0)}</b>         {" "}
          </button>
                 {" "}
        </div>
             {" "}
      </header>
           {" "}
      {!admin && page !== "cart" && (
        <>
                   {" "}
          <section className="hero">
                       {" "}
            <div>
                           {" "}
              <span className="eyebrow">DIVINAS IMPORT PRESENTA</span>         
                 {" "}
              <h1>
                                BLACK                 <br />               {" "}
                <em>WEEKEND</em>             {" "}
              </h1>
                           {" "}
              <p>
                                Descuentos del <b>10 · 15 · 20 · 25%</b> por
                categorías              {" "}
              </p>
                            <small>Compra hasta agotar stock</small>           
               {" "}
              <button
                onClick={() =>
                  document

                    .getElementById("catalogo")

                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                                Comprar ahora              {" "}
              </button>
                         {" "}
            </div>
                       {" "}
            <div className="heroart">
                            <div className="sun"></div>             {" "}
              <span>
                                BLACK                 <br />               
                WEEKEND              {" "}
              </span>
                            <b>10–25%</b>           {" "}
            </div>
                     {" "}
          </section>
                   {" "}
          <section className="intro">
                        <span>ESTILO PARA CADA DÍA</span>           {" "}
            <h2>Nueva colección</h2>           {" "}
            <p>Encuentra tus favoritos en DIVINAS IMPORT</p>         {" "}
          </section>
                 {" "}
        </>
      )}
           {" "}
      {!admin && page === "store" && (
        <main id="catalogo" className="store">
                   {" "}
          <aside className="filters">
                       {" "}
            <h3>
                            <Filter size={17} /> Categorías            {" "}
            </h3>
                       {" "}
            {["Todas", ...CATS].map((x) => (
              <button
                className={cat === x ? "selected" : ""}
                onClick={() => setCat(x)}
              >
                                {x}             {" "}
              </button>
            ))}
                     {" "}
          </aside>
                   {" "}
          <section className="catalog">
                       {" "}
            <div className="search">
                            <Search />             {" "}
              <input
                placeholder="¿Qué estás buscando?"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
                         {" "}
            </div>
                       {" "}
            <div className="sectionhead">
                           {" "}
              <div>
                                <small>DIVINAS IMPORT</small>               {" "}
                <h2>{cat === "Todas" ? "Todos los productos" : cat}</h2>       
                     {" "}
              </div>
                            <span>{filtered.length} productos</span>         
               {" "}
            </div>
                       {" "}
            {loading ? (
              <p>Cargando catálogo...</p>
            ) : !filtered.length ? (
              <p className="empty">
                                Pronto tendremos productos disponibles en esta
                categoría.              {" "}
              </p>
            ) : (
              <div className="grid">
                               {" "}
                {filtered.map((p) => {
                  const pct = activeDiscount(p),
                    price = promoPrice(p.price, pct);

                  return (
                    <article className="product">
                                           {" "}
                      <div className="photo">
                                               {" "}
                        {pct > 0 && <label className="sale">-{pct}%</label>}   
                                           {" "}
                        {p.image_url ? (
                          <img
                            src={p.image_url}
                            alt={p.name}
                            onClick={() => setImageViewer(p)}
                            style={{ cursor: "zoom-in" }}
                          />
                        ) : (
                          <div className="placeholder">DIVINAS</div>
                        )}
                                               {" "}
                        <button
                          className="quick"
                          onClick={() => openProductOptions(p)}
                        >
                                                    Seleccionar opciones        
                                         {" "}
                        </button>
                                             {" "}
                      </div>
                                            <h3>{p.name}</h3>                   
                        <small>{p.code}</small>                     {" "}
                      <div className="prices">
                                               {" "}
                        {pct > 0 && <del>{money(p.price)}</del>}               
                                <b>{money(price)}</b>                     {" "}
                      </div>
                                           {" "}
                      <button
                        className="add"
                        onClick={() => openProductOptions(p)}
                      >
                                                Añadir <Plus size={15} />       
                                     {" "}
                      </button>
                                         {" "}
                    </article>
                  );
                })}
                             {" "}
              </div>
            )}
                     {" "}
          </section>
                 {" "}
        </main>
      )}
           {" "}
      {!admin && page === "cart" && (
        <main className="checkout">
                   {" "}
          <button className="back" onClick={() => setPage("store")}>
                        <ArrowLeft /> Seguir comprando          {" "}
          </button>
                    <h1>Tu carrito</h1>         {" "}
          {!cart.length ? (
            <p>Tu carrito está vacío.</p>
          ) : (
            <div className="checkoutgrid">
                           {" "}
              <section>
                               {" "}
                {cart.map((x) => (
                  <div className="cartrow">
                                       {" "}
                    <div className="cartimg">
                                           {" "}
                      {x.product.image_url && <img src={x.product.image_url} />}
                                         {" "}
                    </div>
                                       {" "}
                    <div>
                                            <b>{x.product.name}</b>             
                             {" "}
                      <p>
                                               {" "}
                        {money(
                          promoPrice(
                            x.product.price,

                            activeDiscount(x.product),
                          ),
                        )}
                                             {" "}
                      </p>
                                         {" "}
                    </div>
                                       {" "}
                    <div className="qty">
                                           {" "}
                      <button
                        onClick={() =>
                          setCart((c) =>
                            c.map((i) =>
                              i.key === x.key
                                ? { ...i, qty: Math.max(1, i.qty - 1) }
                                : i,
                            ),
                          )
                        }
                      >
                                                <Minus />                   
                         {" "}
                      </button>
                                            {x.qty}                     {" "}
                      <button
                        disabled={
                          !x.variant || x.qty >= Number(x.variant.stock || 0)
                        }
                        title="No hay más unidades disponibles"
                        onClick={() =>
                          setCart((c) =>
                            c.map((i) =>
                              i.key === x.key &&
                              i.qty < Number(i.variant?.stock || 0)
                                ? { ...i, qty: i.qty + 1 }
                                : i,
                            ),
                          )
                        }
                      >
                                                <Plus />                   
                         {" "}
                      </button>
                      <small>
                        Stock: {Math.max(0, Number(x.variant?.stock || 0))}
                      </small>
                                           {" "}
                      <button
                        onClick={() =>
                          setCart((c) => c.filter((i) => i.key !== x.key))
                        }
                      >
                                                <Trash2 />                   
                         {" "}
                      </button>
                                         {" "}
                    </div>
                                     {" "}
                  </div>
                ))}
                             {" "}
              </section>
                           {" "}
              <aside className="summary">
                                <h2>Resumen</h2>               {" "}
                <p>
                                    Subtotal <b>{money(subtotal)}</b>           
                     {" "}
                </p>
                               {" "}
                <p>
                                    IVA (0%) <b>$0.00</b>               {" "}
                </p>
                               {" "}
                <p>
                                    Total <b>{money(subtotal)}</b>             
                   {" "}
                </p>
                               {" "}
                <label>
                                    Nombres y apellidos                  {" "}
                  <input
                    required
                    value={customer.full_name}
                    onChange={(e) =>
                      setCustomer({ ...customer, full_name: e.target.value })
                    }
                  />
                                 {" "}
                </label>
                               {" "}
                <label>
                                    Número de teléfono / WhatsApp              
                     {" "}
                  <input
                    required
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="Ej. 0987654321"
                    value={customer.phone}
                    onChange={(e) =>
                      setCustomer({ ...customer, phone: e.target.value })
                    }
                  />
                                 {" "}
                </label>
                               {" "}
                <label>
                                    Ciudad                  {" "}
                  <input
                    required
                    value={customer.city}
                    onChange={(e) =>
                      setCustomer({ ...customer, city: e.target.value })
                    }
                  />
                                 {" "}
                </label>
                               {" "}
                <button className="primary" onClick={checkout}>
                                    Enviar proforma por WhatsApp ·{" "}
                  {money(subtotal)}               {" "}
                </button>
                               {" "}
                <small>
                                    Guardaremos tu proforma y te enviaremos a
                  WhatsApp para                   compartirla con DIVINAS
                  IMPORT. El envío o entrega se coordina                  
                  después.                {" "}
                </small>
                             {" "}
              </aside>
                         {" "}
            </div>
          )}
                 {" "}
        </main>
      )}
           {" "}
      {admin && (
        <div className="admin">
                   {" "}
          {sidebarOpen && (
            <div
              className="sidebarOverlay"
              onClick={() => setSidebarOpen(false)}
            />
          )}
          <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
                        <h3>ADMINISTRACIÓN</h3>           {" "}
            {adminNav.map(([id, label, Icon]) => (
              <button
                className={page === id ? "active" : ""}
                onClick={() => {
                  setPage(id);
                  setSidebarOpen(false);
                }}
              >
                                <Icon size={17} />                {label}       
                     {" "}
              </button>
            ))}
                       {" "}
            <button
              className="logout"
              onClick={async () => {
                await supabase.auth.signOut();

                setUser(null);

                setAdmin(false);

                setPage("store");
              }}
            >
                            <LogOut /> Cerrar sesión            {" "}
            </button>
                     {" "}
          </aside>
                   {" "}
          <section className="admincontent">
                       {" "}
            <div className="adminhead">
                           {" "}
              <div>
                                <small>DIVINAS IMPORT / ADMIN</small>           
                   {" "}
                <h1>
                                   {" "}
                  {adminNav.find((x) => x[0] === page)?.[1] || "Administración"}
                                 {" "}
                </h1>
                             {" "}
              </div>
                           {" "}
              {message && <span className="notice">{message}</span>}         
               {" "}
            </div>
                       {" "}
            {page === "dashboard" && (
              <div className="dashboard">
                               {" "}
                <div className="dashboardWelcome">
                                   {" "}
                  <div>
                                        <span>PANEL DE CONTROL</span>           
                            <h2>¡Bienvenida a DIVINAS IMPORT!</h2>             
                          <p>Administra tu tienda y revisa su actividad.</p>   
                                 {" "}
                  </div>
                                   {" "}
                  <div className="dashboardDate">
                                        <small>FECHA ACTUAL</small>             
                         {" "}
                    <strong>
                                           {" "}
                      {new Date().toLocaleDateString("es-EC", {
                        day: "numeric",

                        month: "long",

                        year: "numeric",
                      })}
                                         {" "}
                    </strong>
                                     {" "}
                  </div>
                                 {" "}
                </div>
                               {" "}
                <div className="dashboardStats">
                                   {" "}
                  <div className="dashboardStat">
                                        <span>PRODUCTOS</span>                 
                      <strong>{products.length}</strong>                   {" "}
                    <small>Productos registrados</small>                 {" "}
                  </div>
                                   {" "}
                  <div className="dashboardStat">
                                        <span>CATEGORÍAS</span>                 
                      <strong>{categories.length}</strong>                   {" "}
                    <small>Categorías disponibles</small>                 {" "}
                  </div>
                                   {" "}
                  <div className="dashboardStat">
                                        <span>PROMOCIONES ACTIVAS</span>       
                                <strong>{discounts.length}</strong>             
                          <small>Promociones configuradas</small>               
                     {" "}
                  </div>
                                   {" "}
                  <div className="dashboardStat">
                                        <span>ARTÍCULOS EN CARRITO</span>       
                               {" "}
                    <strong>
                                           {" "}
                      {cart.reduce((total, item) => total + item.qty, 0)}       
                                 {" "}
                    </strong>
                                       {" "}
                    <small>Unidades en el carrito actual</small>               
                     {" "}
                  </div>
                                 {" "}
                </div>
                               {" "}
                <div className="dashboardBottom">
                                   {" "}
                  <div className="dashboardInfo">
                                        <h3>Gestión de tu tienda</h3>           
                           {" "}
                    <p>Accede rápidamente a las principales operaciones.</p>   
                                   {" "}
                    <div className="dashboardActions">
                                           {" "}
                      <button
                        onClick={() => {
                          setPage("products");
                          setSidebarOpen(false);
                        }}
                      >
                                                + Nuevo producto                
                             {" "}
                      </button>
                                           {" "}
                      <button
                        onClick={() => {
                          setPage("sales");
                          setSidebarOpen(false);
                        }}
                      >
                                                Ver ventas                    
                         {" "}
                      </button>
                                           {" "}
                      <button
                        onClick={() => {
                          setPage("inventory");
                          setSidebarOpen(false);
                        }}
                      >
                                                Consultar inventario            
                                 {" "}
                      </button>
                                           {" "}
                      <button
                        onClick={() => {
                          setPage("customers");
                          setSidebarOpen(false);
                        }}
                      >
                                                Ver clientes                    
                         {" "}
                      </button>
                                         {" "}
                    </div>
                                     {" "}
                  </div>
                                   {" "}
                  <div className="dashboardInfo dashboardSummary">
                                        <h3>Resumen general</h3>               
                       {" "}
                    <div>
                                            <span>Productos registrados</span> 
                                          <strong>{products.length}</strong>   
                                     {" "}
                    </div>
                                       {" "}
                    <div>
                                            <span>Categorías creadas</span>     
                                      <strong>{categories.length}</strong>     
                                   {" "}
                    </div>
                                       {" "}
                    <div>
                                            <span>Promociones activas</span>   
                                        <strong>{discounts.length}</strong>     
                                   {" "}
                    </div>
                                     {" "}
                  </div>
                                 {" "}
                </div>
                             {" "}
              </div>
            )}
                       {" "}
            {page === "products" && (
              <>
                               {" "}
                <button
                  className="primary"
                  onClick={() => {
                    setEdit(null);

                    setForm({
                      name: "",

                      code: "",

                      description: "",

                      category: "Ropa damas",

                      price: "",

                      image_url: "",

                      sizes: "S,M,L",

                      colors: "Negro,Blanco",

                      stock: "0",
                    });

                    setModal(true);
                  }}
                >
                                    <Plus /> Nuevo producto                {" "}
                </button>
                               {" "}
                <div className="table">
                                   {" "}
                  <div className="tr th">
                                        <span>Producto</span>                   {" "}
                    <span>Código</span>                   {" "}
                    <span>Categoría</span>                   {" "}
                    <span>Precio</span>                    <span>Acciones</span>
                                     {" "}
                  </div>
                                   {" "}
                  {products.map((p) => (
                    <div className="tr">
                                            <span>{p.name}</span>               
                            <span>{p.code}</span>                     {" "}
                      <span>{p.categories?.name}</span>                     {" "}
                      <span>{money(p.price)}</span>                     {" "}
                      <button
                        onClick={() => {
                          setEdit(p);

                          setForm({
                            ...form,

                            ...p,

                            category: p.categories?.name || "Ropa damas",
                          });

                          setModal(true);
                        }}
                      >
                                                Editar                    
                         {" "}
                      </button>
                                         {" "}
                    </div>
                  ))}
                                 {" "}
                </div>
                             {" "}
              </>
            )}
                       {" "}
            {page === "categories" && <Categories onCategoriesChange={load} />} 
                     {" "}
            {page === "discounts" && (
              <div className="panel">
                <h2>
                  {editingDiscountId
                    ? "Editar descuento"
                    : "Crear descuento por categoría"}
                </h2>

                <form onSubmit={createDiscount} className="formgrid">
                  <label>
                    Nombre
                    <input
                      required
                      value={discountForm.name}
                      onChange={(e) =>
                        setDiscountForm({
                          ...discountForm,
                          name: e.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    Categoría
                    <select
                      required
                      value={discountForm.category_id}
                      onChange={(e) =>
                        setDiscountForm({
                          ...discountForm,
                          category_id: e.target.value,
                        })
                      }
                    >
                      <option value="">Selecciona</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Porcentaje
                    <select
                      value={discountForm.percentage}
                      onChange={(e) =>
                        setDiscountForm({
                          ...discountForm,
                          percentage: e.target.value,
                        })
                      }
                    >
                      {[10, 15, 20, 25].map((x) => (
                        <option key={x} value={x}>
                          {x}%
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="discountFormActions">
                    <button className="primary" type="submit">
                      {editingDiscountId
                        ? "Guardar cambios"
                        : "Publicar descuento"}
                    </button>
                    {editingDiscountId && (
                      <button
                        type="button"
                        className="discountCancel"
                        onClick={cancelDiscountEdit}
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </form>

                <h3>Gestión de descuentos</h3>

                <div className="discountList">
                  {discounts.length === 0 ? (
                    <p>No hay descuentos registrados.</p>
                  ) : (
                    discounts.map((d) => (
                      <div className="discountItem" key={d.id}>
                        <div className="discountInfo">
                          <strong>{d.name}</strong>
                          <p>
                            {categories.find((c) => c.id === d.category_id)
                              ?.name || "Categoría"}{" "}
                            · {d.percentage}%
                          </p>
                          <span
                            className={
                              d.is_active
                                ? "discountStatus discountActive"
                                : "discountStatus discountInactive"
                            }
                          >
                            {d.is_active ? "Activo" : "Deshabilitado"}
                          </span>
                        </div>

                        <div className="discountActions">
                          <button
                            type="button"
                            className="discountEdit"
                            onClick={() => editDiscount(d)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className={
                              d.is_active ? "discountDisable" : "discountEnable"
                            }
                            onClick={() => toggleDiscount(d)}
                          >
                            {d.is_active ? "Deshabilitar" : "Habilitar"}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
                        {page === "customers" && <Customers />}           {" "}
            {page === "proformas" && (
              <Proformas
                products={products}
                discounts={discounts}
                onConfirmSale={confirmSale}
              />
            )}
                        {page === "sales" && <Sales />}           {" "}
            {page === "inventory" && <Inventory />}           {" "}
            {page === "users" && <Userss />}         {" "}
          </section>
                 {" "}
        </div>
      )}
           {" "}
      {imageViewer && (
        <div className="storeImageOverlay" onClick={() => setImageViewer(null)}>
          <button
            type="button"
            className="storeImageClose"
            onClick={() => setImageViewer(null)}
          >
            ×
          </button>
          <img
            src={imageViewer.image_url}
            alt={imageViewer.name}
            onClick={(e) => e.stopPropagation()}
          />
          <span>{imageViewer.name}</span>
        </div>
      )}
      {optionProduct && (
        <div
          className="storeOptionsOverlay"
          onClick={() => setOptionProduct(null)}
        >
          <section
            className="storeOptionsModal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="storeOptionsClose"
              onClick={() => setOptionProduct(null)}
            >
              ×
            </button>
            <div className="storeOptionsProduct">
              {optionProduct.image_url && (
                <img src={optionProduct.image_url} alt={optionProduct.name} />
              )}
              <div>
                <small>{optionProduct.code}</small>
                <h2>{optionProduct.name}</h2>
                <strong>
                  {money(
                    promoPrice(
                      optionProduct.price,
                      activeDiscount(optionProduct),
                    ),
                  )}
                </strong>
              </div>
            </div>
            <label className="storeOptionField">
              Modelo, color y talla
              <select
                value={selectedVariantId}
                onChange={(e) => {
                  setSelectedVariantId(e.target.value);
                  setSelectedQty(1);
                }}
              >
                {variants
                  .filter((v) => v.product_id === optionProduct.id)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.sku || "Modelo"} · {v.color || "Sin color"} · Talla{" "}
                      {v.size || "Única"} · Stock: {Number(v.stock || 0)}
                    </option>
                  ))}
              </select>
            </label>
            {selectedVariant ? (
              <>
                <div className="storeVariantInfo">
                  <span>
                    Modelo: <b>{selectedVariant.sku || selectedVariant.id}</b>
                  </span>
                  <span>
                    Color: <b>{selectedVariant.color || "No especificado"}</b>
                  </span>
                  <span>
                    Talla: <b>{selectedVariant.size || "Única"}</b>
                  </span>
                  <span>
                    Disponible: <b>{selectedStock}</b>
                  </span>
                </div>
                {remainingSelectedStock > 0 ? (
                  <label className="storeOptionField">
                    Cantidad
                    <div className="storeQtySelector">
                      <button
                        type="button"
                        disabled={selectedQty <= 1}
                        onClick={() =>
                          setSelectedQty((q) => Math.max(1, q - 1))
                        }
                      >
                        <Minus size={16} />
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={remainingSelectedStock}
                        value={selectedQty}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          setSelectedQty(
                            Math.min(
                              remainingSelectedStock,
                              Math.max(1, Number.isFinite(value) ? value : 1),
                            ),
                          );
                        }}
                      />
                      <button
                        type="button"
                        disabled={selectedQty >= remainingSelectedStock}
                        onClick={() =>
                          setSelectedQty((q) =>
                            Math.min(remainingSelectedStock, q + 1),
                          )
                        }
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </label>
                ) : (
                  <p className="storeOutOfStock">
                    Agotado para esta combinación.
                  </p>
                )}
              </>
            ) : (
              <p className="storeOutOfStock">
                Este producto no tiene variantes registradas.
              </p>
            )}
            <button
              type="button"
              className="storeOptionsAdd"
              disabled={!selectedVariant || remainingSelectedStock < 1}
              onClick={addSelectedToCart}
            >
              Agregar al carrito
            </button>
            <small className="storeStockNote">
              La proforma no reserva ni descuenta inventario. El stock se valida
              nuevamente al confirmar la venta.
            </small>
          </section>
        </div>
      )}
      {modal && (
        <div className="overlay">
                   {" "}
          <form className="modal" onSubmit={saveProduct}>
                       {" "}
            <button
              type="button"
              className="close"
              onClick={() => setModal(false)}
            >
                            ×            {" "}
            </button>
                        <h2>{edit ? "Editar producto" : "Nuevo producto"}</h2> 
                     {" "}
            <label>
                            Nombre              {" "}
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
                         {" "}
            </label>
                       {" "}
            <label>
                            Código              {" "}
              <input
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
                         {" "}
            </label>
                       {" "}
            <label>
                            Descripción              {" "}
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
                         {" "}
            </label>
                       {" "}
            <label>
                            Categoría              {" "}
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                               {" "}
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
                             {" "}
              </select>
                         {" "}
            </label>
                       {" "}
            <label>
                            Precio              {" "}
              <input
                required
                type="number"
                step=".01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
                         {" "}
            </label>
                       {" "}
            <label>
                            Foto del producto              {" "}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => uploadPhoto(e.target.files[0])}
              />
                         {" "}
            </label>
                       {" "}
            {form.image_url && <img className="preview" src={form.image_url} />}
                       {" "}
            <label>
                            Tallas separadas por coma              {" "}
              <input
                value={form.sizes}
                onChange={(e) => setForm({ ...form, sizes: e.target.value })}
              />
                         {" "}
            </label>
                       {" "}
            <label>
                            Colores separados por coma              {" "}
              <input
                value={form.colors}
                onChange={(e) => setForm({ ...form, colors: e.target.value })}
              />
                         {" "}
            </label>
                       {" "}
            <label>
                            Stock inicial por combinación              {" "}
              <input
                type="number"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
              />
                         {" "}
            </label>
                        <button className="primary">Guardar producto</button>   
                 {" "}
          </form>
                 {" "}
        </div>
      )}
         {" "}
    </div>
  );
}

export default App;
