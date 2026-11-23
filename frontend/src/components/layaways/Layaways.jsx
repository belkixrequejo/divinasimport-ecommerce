import { useEffect, useState } from "react";
import { supabase } from "../../supabase";
import {
  RefreshCw,
  Search,
  Wallet,
  PackagePlus,
  CheckCircle,
  XCircle,
  Clock,
  History,
  X,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL;

const money = (value) => `$${Number(value || 0).toFixed(2)}`;

const paymentMethods = [
  "EFECTIVO",
  "TRANSFERENCIA",
  "TARJETA",
  "CONTRA_ENTREGA",
];

export default function Layaways({
  products = [],
  productVariants = [],
  onRecoverProforma,
}) {
  const [layaways, setLayaways] = useState([]);
  const [selected, setSelected] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("ACTIVO");
  const [search, setSearch] = useState("");

  const [modal, setModal] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("EFECTIVO");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  const [newItems, setNewItems] = useState([]);
  const [variants, setVariants] = useState([]);

  async function request(path, options = {}) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token || ""}`,
        ...options.headers,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Ocurrió un error.");
    }

    return result;
  }

  async function loadLayaways() {
    setLoading(true);

    try {
      const result = await request(`/admin/layaways?status=${status}`);

      setLayaways(result || []);
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLayaways();
  }, [status]);

  async function openDetail(layaway) {
    try {
      const result = await request(`/admin/layaways/${layaway.id}`);

      setSelected(result);
      setPayments(result.layaway_payments || []);
    } catch (error) {
      alert(error.message);
    }
  }

  function openPayment() {
    setAmount("");
    setMethod("EFECTIVO");
    setReference("");
    setModal("payment");
  }

  async function savePayment(e) {
    e.preventDefault();

    try {
      setSaving(true);

      await request(`/admin/layaways/${selected.id}/payments`, {
        method: "POST",
        body: JSON.stringify({
          amount: Number(amount),
          payment_method: method,
          payment_reference: reference || null,
        }),
      });

      alert("Abono registrado correctamente.");
      setModal("");
      await openDetail(selected);
      await loadLayaways();
    } catch (error) {
      alert(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function convertSale() {
    const totalPaid = payments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0,
    );

    const total = Number(selected.proformas?.total || 0);
    const balance = Math.max(0, total - totalPaid);

    let finalMethod = null;

    if (balance > 0) {
      finalMethod = window.prompt(
        `Saldo pendiente: ${money(balance)}\n\nEscribe: EFECTIVO, TRANSFERENCIA o TARJETA`,
      );

      if (!finalMethod) return;

      finalMethod = finalMethod.trim().toUpperCase();

      if (!paymentMethods.includes(finalMethod)) {
        alert("Método de pago no válido.");
        return;
      }
    }

    if (
      !window.confirm("¿Confirmas la conversión de este apartado en venta?")
    ) {
      return;
    }

    try {
      setSaving(true);

      await request(`/admin/layaways/${selected.id}/convert`, {
        method: "POST",
        body: JSON.stringify({
          final_payment_method: finalMethod,
        }),
      });

      alert("Apartado convertido en venta correctamente.");
      setSelected(null);
      await loadLayaways();
    } catch (error) {
      alert(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function cancelLayaway() {
    const confirmed = await window.confirmAction(
      "Se liberará el stock reservado y se conservará el historial de abonos.",
      {
        title: "¿Cancelar este apartado?",
        confirmText: "Sí, cancelar",
        cancelText: "No, volver",
        type: "warning",
      },
    );

    if (!confirmed) return;

    try {
      setSaving(true);

      await request(`/admin/layaways/${selected.id}/cancel`, {
        method: "PATCH",
      });

      const sourceProforma = selected.proformas || {};
      const customer = selected.customers || sourceProforma.customers || {};

      const recoveredItems = (sourceProforma.proforma_items || []).map(
        (item) => {
          const product = products.find(
            (p) => String(p.id) === String(item.product_id),
          );

          const variant =
            productVariants.find(
              (v) => String(v.id) === String(item.variant_id),
            ) || null;

          return {
            product_id: item.product_id,
            variant_id: item.variant_id || null,
            variant,
            name:
              item.product_name_snapshot ||
              item.product_name ||
              item.products?.name ||
              product?.name ||
              "Producto",
            quantity: Number(item.quantity || 1),
            unit_price: Number(
              item.regular_unit_price ?? item.unit_price ?? product?.price ?? 0,
            ),
            discount_percent: 0,
          };
        },
      );

      const draft = {
        customer: {
          full_name: customer.full_name || "",
          phone: customer.phone || "",
          city: customer.city || "",
        },
        items: recoveredItems,
        delivery_type: sourceProforma.delivery_type || "POR_DEFINIR",
        shipping_cost: sourceProforma.shipping_cost ?? 0,
        collection_type: sourceProforma.collection_type || "PREPAID",
      };

      window.notify(
        "Apartado cancelado correctamente. Se liberó el stock reservado.",
        "success",
      );

      setSelected(null);
      await loadLayaways();

      if (recoveredItems.length && onRecoverProforma) {
        onRecoverProforma(draft);

        window.notify(
          "Se abrió una nueva proforma con los productos recuperados.",
          "success",
        );
      } else if (!recoveredItems.length) {
        window.notify(
          "El apartado se canceló, pero no se encontraron productos para recuperar.",
          "warning",
        );
      } else {
        window.notify(
          "El apartado se canceló, pero no se pudo abrir la nueva proforma.",
          "warning",
        );
      }
    } catch (error) {
      window.notify(error.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function loadVariants(productId) {
    const { data, error } = await supabase
      .from("product_variants")
      .select("id,product_id,size,color,stock,reserved_stock,sku")
      .eq("product_id", productId);

    if (error) {
      alert(error.message);
      return;
    }

    setVariants(data || []);
  }

  function addNewItem() {
    setNewItems((old) => [
      ...old,
      { product_id: "", variant_id: "", quantity: 1 },
    ]);
    setVariants([]);
  }

  async function saveNewItems() {
    const validItems = newItems.filter(
      (item) => item.product_id && item.variant_id && Number(item.quantity) > 0,
    );

    if (!validItems.length) {
      alert("Selecciona al menos un producto y una variante.");
      return;
    }

    try {
      setSaving(true);

      await request(`/admin/layaways/${selected.id}/items`, {
        method: "POST",
        body: JSON.stringify({
          items: validItems.map((item) => ({
            product_id: item.product_id,
            variant_id: item.variant_id,
            quantity: Number(item.quantity),
          })),
        }),
      });

      alert("Productos agregados correctamente.");
      setModal("");
      setNewItems([]);
      await openDetail(selected);
      await loadLayaways();
    } catch (error) {
      alert(error.message);
    } finally {
      setSaving(false);
    }
  }

  const filtered = layaways.filter((item) => {
    const text = [
      item.proformas?.proforma_number,
      item.customers?.full_name,
      item.customers?.phone,
    ]
      .join(" ")
      .toLowerCase();

    return text.includes(search.toLowerCase());
  });

  const paid = payments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0,
  );

  const total = Number(selected?.proformas?.total || 0);
  const balance = Math.max(0, total - paid);

  return (
    <div className="panel layawaysModule">
      <div className="adminhead">
        <div>
          <h2>Apartados</h2>
          <p>Gestiona reservas, abonos y entregas de clientes.</p>
        </div>

        <button className="add" onClick={loadLayaways}>
          <RefreshCw size={16} /> Actualizar
        </button>
      </div>

      <div className="layawayFilters">
        {["ACTIVO", "COMPLETADO", "VENCIDO", "CANCELADO"].map((value) => (
          <button
            key={value}
            className={status === value ? "active" : ""}
            onClick={() => setStatus(value)}
          >
            {value}
          </button>
        ))}
      </div>

      <div className="search layawaySearch">
        <Search size={18} />
        <input
          placeholder="Buscar por cliente, teléfono o proforma..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p>Cargando apartados...</p>
      ) : filtered.length === 0 ? (
        <p>No hay apartados en este estado.</p>
      ) : (
        <div className="layawayGrid">
          {filtered.map((item) => (
            <article className="layawayCard" key={item.id}>
              <div className="layawayCardTop">
                <div>
                  <small>PROFORMA</small>
                  <h3>{item.proformas?.proforma_number}</h3>
                </div>
                <span className={`layawayBadge ${item.status.toLowerCase()}`}>
                  {item.status}
                </span>
              </div>

              <h4>{item.customers?.full_name}</h4>
              <p>{item.customers?.phone || "Sin teléfono"}</p>

              <div className="layawayInfo">
                <span>Total</span>
                <strong>{money(item.proformas?.total)}</strong>
              </div>

              <div className="layawayInfo">
                <span>Vence</span>
                <strong>
                  {new Date(item.expires_at).toLocaleDateString("es-EC")}
                </strong>
              </div>

              <button className="primary" onClick={() => openDetail(item)}>
                Ver apartado
              </button>
            </article>
          ))}
        </div>
      )}

      {selected && (
        <div className="layawayOverlay">
          <div className="layawayModal">
            <div className="layawayModalHeader">
              <div>
                <small>GESTIÓN DE APARTADO</small>
                <h2>{selected.proformas?.proforma_number}</h2>
                <p>{selected.customers?.full_name}</p>
              </div>

              <button onClick={() => setSelected(null)}>
                <X />
              </button>
            </div>

            <div className="layawayTotals">
              <div>
                <small>Total</small>
                <strong>{money(total)}</strong>
              </div>
              <div>
                <small>Abonado</small>
                <strong>{money(paid)}</strong>
              </div>
              <div>
                <small>Saldo</small>
                <strong>{money(balance)}</strong>
              </div>
            </div>

            <h3>Productos apartados</h3>

            {(selected.proformas?.proforma_items || []).map((item) => (
              <div className="layawayProduct" key={item.id}>
                <span>{item.product_name_snapshot || item.product_id}</span>
                <strong>
                  {item.quantity} × {money(item.unit_price)}
                </strong>
              </div>
            ))}

            <div className="layawayActions">
              {selected.status === "ACTIVO" && (
                <>
                  <button onClick={openPayment}>
                    <Wallet size={16} /> Registrar abono
                  </button>

                  <button
                    onClick={() => {
                      setNewItems([]);
                      setModal("items");
                      addNewItem();
                    }}
                  >
                    <PackagePlus size={16} /> Agregar productos
                  </button>

                  <button
                    className="primary"
                    disabled={saving}
                    onClick={convertSale}
                  >
                    <CheckCircle size={16} /> Convertir en venta
                  </button>

                  <button
                    className="danger"
                    disabled={saving}
                    onClick={cancelLayaway}
                  >
                    <XCircle size={16} /> Cancelar apartado
                  </button>
                </>
              )}
            </div>

            <h3>
              <History size={17} /> Historial de abonos
            </h3>

            {payments.length ? (
              payments.map((payment) => (
                <div className="layawayPayment" key={payment.id}>
                  <div>
                    <strong>{money(payment.amount)}</strong>
                    <small>{payment.payment_method}</small>
                  </div>
                  <small>
                    {new Date(payment.paid_at).toLocaleString("es-EC")}
                  </small>
                </div>
              ))
            ) : (
              <p>No hay abonos registrados.</p>
            )}

            <p className="layawayExpiry">
              <Clock size={16} />
              Vencimiento:{" "}
              {new Date(selected.expires_at).toLocaleString("es-EC")}
            </p>
          </div>
        </div>
      )}

      {modal === "payment" && selected && (
        <div className="layawayOverlay">
          <form className="layawayForm" onSubmit={savePayment}>
            <button
              type="button"
              className="layawayClose"
              onClick={() => setModal("")}
            >
              <X />
            </button>

            <h2>Registrar abono</h2>
            <p>
              Saldo pendiente: <strong>{money(balance)}</strong>
            </p>

            <label>
              Valor del abono
              <input
                type="number"
                min="0.01"
                max={balance}
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>

            <label>
              Método de pago
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                {paymentMethods.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>

            <label>
              Referencia (opcional)
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </label>

            <button className="primary" disabled={saving}>
              {saving ? "Guardando..." : "Guardar abono"}
            </button>
          </form>
        </div>
      )}

      {modal === "items" && selected && (
        <div className="layawayOverlay">
          <div className="layawayForm">
            <button className="layawayClose" onClick={() => setModal("")}>
              <X />
            </button>

            <h2>Agregar productos</h2>

            {newItems.map((item, index) => (
              <div className="layawayNewItem" key={index}>
                <label>
                  Producto
                  <select
                    value={item.product_id}
                    onChange={async (e) => {
                      const productId = e.target.value;
                      setNewItems((old) =>
                        old.map((x, i) =>
                          i === index
                            ? { ...x, product_id: productId, variant_id: "" }
                            : x,
                        ),
                      );
                      await loadVariants(productId);
                    }}
                  >
                    <option value="">Seleccionar producto</option>
                    {products.map((product) => (
                      <option value={product.id} key={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Variante
                  <select
                    value={item.variant_id}
                    onChange={(e) =>
                      setNewItems((old) =>
                        old.map((x, i) =>
                          i === index
                            ? { ...x, variant_id: e.target.value }
                            : x,
                        ),
                      )
                    }
                  >
                    <option value="">Seleccionar talla/color</option>
                    {variants
                      .filter((v) => v.product_id === item.product_id)
                      .map((v) => (
                        <option value={v.id} key={v.id}>
                          {v.size} · {v.color} · Disponible:{" "}
                          {v.stock - v.reserved_stock}
                        </option>
                      ))}
                  </select>
                </label>

                <label>
                  Cantidad
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) =>
                      setNewItems((old) =>
                        old.map((x, i) =>
                          i === index ? { ...x, quantity: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </label>
              </div>
            ))}

            <button type="button" onClick={addNewItem}>
              + Añadir otra línea
            </button>

            <button
              className="primary"
              disabled={saving}
              onClick={saveNewItems}
            >
              {saving ? "Guardando..." : "Guardar productos"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
