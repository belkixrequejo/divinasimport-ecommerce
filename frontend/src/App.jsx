import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import Proformas from "./components/proformas/Proformas";
import Categories from "./components/categories/Categories";
import Customers from "./components/customers/Customers";
import Sales from "./components/sales/Sales";
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
    .replace(/\.00$/, "");
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
    [user, setUser] = useState(null),
    [modal, setModal] = useState(false),
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
      supabase.from("category_discounts").select("*").eq("is_active", true),
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
    const d = discounts.find((x) => x.category_id === product.category_id);
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
  const add = (p, variant = null) =>
    setCart((old) => {
      const id = p.id + (variant?.id || "");
      const found = old.find((x) => x.key === id);
      return found
        ? old.map((x) => (x.key === id ? { ...x, qty: x.qty + 1 } : x))
        : [...old, { key: id, product: p, variant, qty: 1 }];
    });
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
      }

      // Abrimos la pestaña desde el clic del usuario para evitar que el navegador
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
        .map(
          (i) =>
            `• ${i.name} (${i.code}) | ${i.quantity} x ${money(i.unit_price)} = ${money(i.line_total)}`,
        )
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
    const { error } = await supabase.from("category_discounts").insert({
      name: discountForm.name,
      category_id: discountForm.category_id,
      percentage: Number(discountForm.percentage),
      start_at: discountForm.start_at || null,
      end_at: discountForm.end_at || null,
      is_active: true,
    });
    if (error) alert(error.message);
    else {
      setDiscountForm({
        name: "Black Weekend",
        category_id: "",
        percentage: 10,
        start_at: "",
        end_at: "",
      });
      load();
      setMessage("Descuento publicado en la tienda");
    }
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
        <form className="loginbox" onSubmit={signIn}>
          <img src="/divinas-logo.png" />
          <span>ÁREA ADMINISTRATIVA</span>
          <h1>Iniciar sesión</h1>
          <p>Ingresa con tu cuenta autorizada de DIVINAS IMPORT.</p>
          <label>
            Correo electrónico
            <input
              type="email"
              required
              autoComplete="username"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              required
              autoComplete="current-password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
            />
          </label>
          {loginError && <div className="loginerror">{loginError}</div>}
          <button className="primary" type="submit">
            Ingresar
          </button>
          <a href="/">Volver a la tienda</a>
        </form>
      </div>
    );
  return (
    <div className="app">
      <header className="top">
        <button
          className="iconbtn"
          onClick={() => setPage(admin ? "dashboard" : "store")}
        >
          <Menu />
        </button>
        <img src="/divinas-logo.png" />
        <nav>
          <button
            onClick={() => {
              setAdmin(false);
              setPage("store");
            }}
          >
            Tienda
          </button>
          <button
            onClick={() => {
              setPage("store");
              setCat("Todas");
            }}
          >
            Nueva colección
          </button>
          <button onClick={() => setPage("store")}>Ofertas</button>
        </nav>
        <div className="topright">
          <button
            className="iconbtn"
            onClick={() => {
              setPage("cart");
              setAdmin(false);
            }}
          >
            <ShoppingBag />
            <b>{cart.reduce((s, x) => s + x.qty, 0)}</b>
          </button>
        </div>
      </header>
      {!admin && page !== "cart" && (
        <>
          <section className="hero">
            <div>
              <span className="eyebrow">DIVINAS IMPORT PRESENTA</span>
              <h1>
                BLACK
                <br />
                <em>WEEKEND</em>
              </h1>
              <p>
                Descuentos del <b>10 · 15 · 20 · 25%</b> por categorías
              </p>
              <small>Compra hasta agotar stock</small>
              <button
                onClick={() =>
                  document
                    .getElementById("catalogo")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Comprar ahora
              </button>
            </div>
            <div className="heroart">
              <div className="sun"></div>
              <span>
                BLACK
                <br />
                WEEKEND
              </span>
              <b>10–25%</b>
            </div>
          </section>
          <section className="intro">
            <span>ESTILO PARA CADA DÍA</span>
            <h2>Nueva colección</h2>
            <p>Encuentra tus favoritos en DIVINAS IMPORT</p>
          </section>
        </>
      )}
      {!admin && page === "store" && (
        <main id="catalogo" className="store">
          <aside className="filters">
            <h3>
              <Filter size={17} /> Categorías
            </h3>
            {["Todas", ...CATS].map((x) => (
              <button
                className={cat === x ? "selected" : ""}
                onClick={() => setCat(x)}
              >
                {x}
              </button>
            ))}
          </aside>
          <section className="catalog">
            <div className="search">
              <Search />
              <input
                placeholder="¿Qué estás buscando?"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="sectionhead">
              <div>
                <small>DIVINAS IMPORT</small>
                <h2>{cat === "Todas" ? "Todos los productos" : cat}</h2>
              </div>
              <span>{filtered.length} productos</span>
            </div>
            {loading ? (
              <p>Cargando catálogo...</p>
            ) : !filtered.length ? (
              <p className="empty">
                Pronto tendremos productos disponibles en esta categoría.
              </p>
            ) : (
              <div className="grid">
                {filtered.map((p) => {
                  const pct = activeDiscount(p),
                    price = promoPrice(p.price, pct);
                  return (
                    <article className="product">
                      <div className="photo">
                        {pct > 0 && <label className="sale">-{pct}%</label>}
                        {p.image_url ? (
                          <img src={p.image_url} />
                        ) : (
                          <div className="placeholder">DIVINAS</div>
                        )}
                        <button className="quick" onClick={() => add(p)}>
                          Agregar al carrito
                        </button>
                      </div>
                      <h3>{p.name}</h3>
                      <small>{p.code}</small>
                      <div className="prices">
                        {pct > 0 && <del>{money(p.price)}</del>}
                        <b>{money(price)}</b>
                      </div>
                      <button className="add" onClick={() => add(p)}>
                        Añadir <Plus size={15} />
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      )}
      {!admin && page === "cart" && (
        <main className="checkout">
          <button className="back" onClick={() => setPage("store")}>
            <ArrowLeft /> Seguir comprando
          </button>
          <h1>Tu carrito</h1>
          {!cart.length ? (
            <p>Tu carrito está vacío.</p>
          ) : (
            <div className="checkoutgrid">
              <section>
                {cart.map((x) => (
                  <div className="cartrow">
                    <div className="cartimg">
                      {x.product.image_url && <img src={x.product.image_url} />}
                    </div>
                    <div>
                      <b>{x.product.name}</b>
                      <p>
                        {money(
                          promoPrice(
                            x.product.price,
                            activeDiscount(x.product),
                          ),
                        )}
                      </p>
                    </div>
                    <div className="qty">
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
                      </button>
                      {x.qty}
                      <button
                        onClick={() =>
                          setCart((c) =>
                            c.map((i) =>
                              i.key === x.key ? { ...i, qty: i.qty + 1 } : i,
                            ),
                          )
                        }
                      >
                        <Plus />
                      </button>
                      <button
                        onClick={() =>
                          setCart((c) => c.filter((i) => i.key !== x.key))
                        }
                      >
                        <Trash2 />
                      </button>
                    </div>
                  </div>
                ))}
              </section>
              <aside className="summary">
                <h2>Resumen</h2>
                <p>
                  Subtotal <b>{money(subtotal)}</b>
                </p>
                <p>
                  IVA (0%) <b>$0.00</b>
                </p>
                <p>
                  Total <b>{money(subtotal)}</b>
                </p>
                <label>
                  Nombres y apellidos
                  <input
                    required
                    value={customer.full_name}
                    onChange={(e) =>
                      setCustomer({ ...customer, full_name: e.target.value })
                    }
                  />
                </label>
                <label>
                  Número de teléfono / WhatsApp
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
                </label>
                <label>
                  Ciudad
                  <input
                    required
                    value={customer.city}
                    onChange={(e) =>
                      setCustomer({ ...customer, city: e.target.value })
                    }
                  />
                </label>
                <button className="primary" onClick={checkout}>
                  Enviar proforma por WhatsApp · {money(subtotal)}
                </button>
                <small>
                  Guardaremos tu proforma y te enviaremos a WhatsApp para
                  compartirla con DIVINAS IMPORT. El envío o entrega se coordina
                  después.
                </small>
              </aside>
            </div>
          )}
        </main>
      )}
      {admin && (
        <div className="admin">
          <aside className="sidebar">
            <h3>ADMINISTRACIÓN</h3>
            {adminNav.map(([id, label, Icon]) => (
              <button
                className={page === id ? "active" : ""}
                onClick={() => setPage(id)}
              >
                <Icon size={17} />
                {label}
              </button>
            ))}
            <button
              className="logout"
              onClick={async () => {
                await supabase.auth.signOut();
                setUser(null);
                setAdmin(false);
                setPage("store");
              }}
            >
              <LogOut /> Cerrar sesión
            </button>
          </aside>
          <section className="admincontent">
            <div className="adminhead">
              <div>
                <small>DIVINAS IMPORT / ADMIN</small>
                <h1>
                  {adminNav.find((x) => x[0] === page)?.[1] || "Administración"}
                </h1>
              </div>
              {message && <span className="notice">{message}</span>}
            </div>
            {page === "dashboard" && (
              <div className="stats">
                <div>
                  <small>Productos</small>
                  <h2>{products.length}</h2>
                </div>
                <div>
                  <small>Categorías</small>
                  <h2>{categories.length}</h2>
                </div>
                <div>
                  <small>Promociones activas</small>
                  <h2>{discounts.length}</h2>
                </div>
                <div>
                  <small>Artículos en carrito</small>
                  <h2>{cart.length}</h2>
                </div>
              </div>
            )}
            {page === "products" && (
              <>
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
                  <Plus /> Nuevo producto
                </button>
                <div className="table">
                  <div className="tr th">
                    <span>Producto</span>
                    <span>Código</span>
                    <span>Categoría</span>
                    <span>Precio</span>
                    <span>Acciones</span>
                  </div>
                  {products.map((p) => (
                    <div className="tr">
                      <span>{p.name}</span>
                      <span>{p.code}</span>
                      <span>{p.categories?.name}</span>
                      <span>{money(p.price)}</span>
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
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
            {page === "categories" && <Categories onCategoriesChange={load} />}
            {page === "discounts" && (
              <div className="panel">
                <h2>Crear descuento por categoría</h2>
                <form onSubmit={createDiscount} className="formgrid">
                  <label>
                    Nombre
                    <input
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
                        <option value={c.id}>{c.name}</option>
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
                      {[10, 15, 20, 25, 23].map((x) => (
                        <option>{x}</option>
                      ))}
                    </select>
                  </label>
                  <button className="primary">Publicar descuento</button>
                </form>
                <h3>Descuentos activos</h3>
                {discounts.map((d) => (
                  <p>
                    {d.name} · {d.percentage}%
                  </p>
                ))}
              </div>
            )}
            {page === "customers" && <Customers />}
            {page === "proformas" && (
              <Proformas
                products={products}
                discounts={discounts}
                onConfirmSale={confirmSale}
              />
            )}

            {page === "sales" && <Sales />}

            {["inventory", "users"].includes(page) && (
              <div className="panel">
                <h2>{adminNav.find((x) => x[0] === page)?.[1]}</h2>
                <p>
                  Este módulo utiliza las tablas y operaciones protegidas de
                  Supabase.
                </p>
              </div>
            )}
          </section>
        </div>
      )}
      {modal && (
        <div className="overlay">
          <form className="modal" onSubmit={saveProduct}>
            <button
              type="button"
              className="close"
              onClick={() => setModal(false)}
            >
              ×
            </button>
            <h2>{edit ? "Editar producto" : "Nuevo producto"}</h2>
            <label>
              Nombre
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              Código
              <input
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </label>
            <label>
              Descripción
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </label>
            <label>
              Categoría
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATS.map((c) => (
                  <option>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Precio
              <input
                required
                type="number"
                step=".01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </label>
            <label>
              Foto del producto
              <input
                type="file"
                accept="image/*"
                onChange={(e) => uploadPhoto(e.target.files[0])}
              />
            </label>
            {form.image_url && <img className="preview" src={form.image_url} />}
            <label>
              Tallas separadas por coma
              <input
                value={form.sizes}
                onChange={(e) => setForm({ ...form, sizes: e.target.value })}
              />
            </label>
            <label>
              Colores separados por coma
              <input
                value={form.colors}
                onChange={(e) => setForm({ ...form, colors: e.target.value })}
              />
            </label>
            <label>
              Stock inicial por combinación
              <input
                type="number"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
              />
            </label>
            <button className="primary">Guardar producto</button>
          </form>
        </div>
      )}
    </div>
  );
}
export default App;
