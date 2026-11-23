import { useEffect, useState } from "react";
import { money, round50 } from "./utils";
import { supabase } from "../../supabase";

export default function ProformaForm({
  products,
  discounts,
  variants = [],
  proforma,
  initialDraft = null,
  onSave,
  onClose,
}) {
  const [customer, setCustomer] = useState({
    full_name: "",
    phone: "",
    city: "",
  });

  const [items, setItems] = useState([]);
  const [productCode, setProductCode] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [saving, setSaving] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerResults, setShowCustomerResults] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  // NUEVOS CAMPOS DE ENVÍO
  const [deliveryType, setDeliveryType] = useState("POR_DEFINIR");
  const [shippingCost, setShippingCost] = useState("0");
  const [collectionType, setCollectionType] = useState("PREPAID");

  // Cargar clientes registrados para poder seleccionarlos por nombre o teléfono.
  useEffect(() => {
    let active = true;

    async function loadCustomers() {
      try {
        setLoadingCustomers(true);
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token || "";
        const api = import.meta.env.VITE_API_URL;

        if (!api) return;

        const response = await fetch(
          `${api.replace(/\/$/, "")}/admin/customers`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        const result = await response.json().catch(() => []);

        if (!response.ok) {
          throw new Error(
            result.error || "No se pudieron cargar los clientes.",
          );
        }

        if (active) setCustomers(Array.isArray(result) ? result : []);
      } catch (error) {
        console.error("Error cargando clientes:", error);
      } finally {
        if (active) setLoadingCustomers(false);
      }
    }

    loadCustomers();
    return () => {
      active = false;
    };
  }, []);

  const filteredCustomers = customers
    .filter((item) => {
      const term = customerSearch.trim().toLowerCase();
      if (!term) return false;
      return `${item.full_name || ""} ${item.phone || ""} ${item.city || ""}`
        .toLowerCase()
        .includes(term);
    })
    .slice(0, 8);

  function selectCustomer(item) {
    setCustomer({
      full_name: item.full_name || "",
      phone: item.phone || "",
      city: item.city || "",
    });
    setCustomerSearch(item.full_name || "");
    setShowCustomerResults(false);
  }

  // Cargar información de la proforma al editar
  useEffect(() => {
    if (proforma) {
      setCustomer({
        full_name: proforma.customers?.full_name || "",
        phone: proforma.customers?.phone || "",
        city: proforma.customers?.city || "",
      });
      setCustomerSearch(proforma.customers?.full_name || "");

      setItems(
        (proforma.proforma_items || []).map((item) => ({
          product_id: item.product_id,
          line_key: `${item.product_id}:${item.variant_id || "sin-variante"}`,
          variant_id: item.variant_id || null,
          variant: item.product_variants || null,
          name:
            item.products?.name ||
            item.product_name_snapshot ||
            item.product_name ||
            "",
          image_url:
            item.products?.image_url ||
            products.find(
              (product) => String(product.id) === String(item.product_id),
            )?.image_url ||
            "",
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          regular_unit_price: Number(
            item.regular_unit_price ??
              products.find(
                (product) => String(product.id) === String(item.product_id),
              )?.price ??
              item.unit_price,
          ),
          discount_percent: Number(item.discount_percent || 0),
        })),
      );

      // Cargar información del envío
      setDeliveryType(proforma.delivery_type || "POR_DEFINIR");
      setShippingCost(String(proforma.shipping_cost ?? 0));
      setCollectionType(proforma.collection_type || "PREPAID");
    } else if (initialDraft) {
      setCustomer({
        full_name: initialDraft.customer?.full_name || "",
        phone: initialDraft.customer?.phone || "",
        city: initialDraft.customer?.city || "",
      });
      setCustomerSearch(initialDraft.customer?.full_name || "");

      setItems(
        (initialDraft.items || []).map((item) => {
          const product = products.find(
            (p) => String(p.id) === String(item.product_id),
          );
          const variant =
            variants.find((v) => String(v.id) === String(item.variant_id)) ||
            item.variant ||
            null;
          return {
            line_key: `${item.product_id}:${item.variant_id || "sin-variante"}`,
            product_id: item.product_id,
            variant_id: item.variant_id || null,
            variant,
            name: item.name || product?.name || "Producto",
            image_url: item.image_url || product?.image_url || "",
            quantity: Math.max(1, Number(item.quantity) || 1),
            unit_price: Number(item.unit_price ?? product?.price ?? 0),
            regular_unit_price: Number(
              item.regular_unit_price ?? item.unit_price ?? product?.price ?? 0,
            ),
            discount_percent: Number(item.discount_percent || 0),
          };
        }),
      );

      setDeliveryType(initialDraft.delivery_type || "POR_DEFINIR");
      setShippingCost(String(initialDraft.shipping_cost ?? 0));
      setCollectionType(initialDraft.collection_type || "PREPAID");
    } else {
      setCustomer({
        full_name: "",
        phone: "",
        city: "",
      });
      setCustomerSearch("");

      setItems([]);

      setDeliveryType("POR_DEFINIR");
      setShippingCost("0");
      setCollectionType("PREPAID");
    }

    setProductCode("");
    setSearchResults([]);
  }, [proforma, initialDraft, products, variants]);

  // Agregar producto mostrando el precio con el descuento vigente.
  // El resumen final se calcula con el precio normal, sin descuento.
  function addProduct(productId) {
    const product = products.find((p) => String(p.id) === String(productId));

    if (!product) return;

    const discount = discounts.find(
      (d) => d.category_id === product.category_id && d.is_active !== false,
    );
    const percentage = Number(discount?.percentage || 0);
    const regularPrice = round50(Number(product.price));
    const discountedPrice = round50(regularPrice * (1 - percentage / 100));

    const productVariants = variants.filter(
      (variant) => String(variant.product_id) === String(product.id),
    );

    // Si el producto tiene variantes, iniciar con la primera registrada.
    // El usuario puede cambiar talla/color desde la línea agregada.
    const selectedVariant = productVariants[0] || null;
    const variantId = selectedVariant?.id || null;
    const lineKey = `${product.id}:${variantId || "sin-variante"}`;

    setItems((current) => {
      const existing = current.find((item) => item.line_key === lineKey);

      if (existing) {
        return current.map((item) =>
          item.line_key === lineKey
            ? { ...item, quantity: Number(item.quantity) + 1 }
            : item,
        );
      }

      return [
        ...current,
        {
          line_key: lineKey,
          product_id: product.id,
          variant_id: variantId,
          variant: selectedVariant,
          name: product.name,
          image_url: product.image_url || "",
          quantity: 1,
          unit_price: discountedPrice,
          regular_unit_price: regularPrice,
          discount_percent: percentage,
        },
      ];
    });
  }

  // Cambiar talla/color conserva cada combinación como una línea independiente.
  function updateItemVariant(lineKey, variantId) {
    setItems((current) => {
      const item = current.find((row) => row.line_key === lineKey);
      if (!item) return current;

      const nextVariant =
        variants.find((variant) => String(variant.id) === String(variantId)) ||
        null;
      const nextKey = `${item.product_id}:${nextVariant?.id || "sin-variante"}`;

      if (
        current.some(
          (row) => row.line_key === nextKey && row.line_key !== lineKey,
        )
      ) {
        return current
          .map((row) =>
            row.line_key === nextKey
              ? {
                  ...row,
                  quantity: Number(row.quantity) + Number(item.quantity),
                }
              : row.line_key === lineKey
                ? null
                : row,
          )
          .filter(Boolean);
      }

      return current.map((row) =>
        row.line_key === lineKey
          ? {
              ...row,
              line_key: nextKey,
              variant_id: nextVariant?.id || null,
              variant: nextVariant,
            }
          : row,
      );
    });
  }

  // Buscar por código o nombre
  function searchProduct(value) {
    setProductCode(value);

    const search = value.trim().toLowerCase();

    if (!search) {
      setSearchResults([]);
      return;
    }

    const results = products.filter((product) => {
      if (product.is_active === false) return false;

      const code = String(product.code || "").toLowerCase();
      const name = String(product.name || "").toLowerCase();

      return code.includes(search) || name.includes(search);
    });

    setSearchResults(results.slice(0, 8));
  }

  // Seleccionar producto encontrado
  function selectProduct(productId) {
    addProduct(productId);
    setProductCode("");
    setSearchResults([]);
  }

  // Permitir agregar con Enter o lector de barras
  function handleProductKeyDown(e) {
    if (e.key !== "Enter") return;

    e.preventDefault();

    if (searchResults.length === 1) {
      selectProduct(searchResults[0].id);
      return;
    }

    const exactMatch = products.find(
      (product) =>
        product.is_active !== false &&
        String(product.code || "").toLowerCase() ===
          productCode.trim().toLowerCase(),
    );

    if (exactMatch) {
      selectProduct(exactMatch.id);
    }
  }

  // Actualizar cantidad de una línea específica.
  function updateQuantity(lineKey, quantity) {
    setItems((current) =>
      current.map((item) =>
        item.line_key === lineKey
          ? {
              ...item,
              quantity: Math.max(1, Number(quantity) || 1),
            }
          : item,
      ),
    );
  }

  // Eliminar producto
  function removeProduct(lineKey) {
    setItems((current) => current.filter((item) => item.line_key !== lineKey));
  }

  // Totales: se muestran ambos valores para distinguir el precio normal
  // del valor promocional que realmente pagará el cliente.
  const subtotalWithoutDiscount = items.reduce(
    (sum, item) =>
      sum +
      Number(item.regular_unit_price ?? item.unit_price) *
        Number(item.quantity),
    0,
  );

  const subtotalWithDiscount = items.reduce(
    (sum, item) => sum + Number(item.unit_price) * Number(item.quantity),
    0,
  );

  const discountTotal = Math.max(
    0,
    subtotalWithoutDiscount - subtotalWithDiscount,
  );

  // Calcular envío
  const shipping =
    deliveryType === "ENVIO" ? Math.max(0, Number(shippingCost) || 0) : 0;

  const totalWithoutDiscount = subtotalWithoutDiscount + shipping;
  const totalToPay = subtotalWithDiscount + shipping;

  // Valores que paga cada parte
  const amountToDivinas =
    deliveryType === "ENVIO" && collectionType === "CONTRA_ENTREGA"
      ? shipping
      : totalToPay;

  const amountToCarrier =
    deliveryType === "ENVIO" && collectionType === "CONTRA_ENTREGA"
      ? subtotalWithDiscount
      : 0;

  // Guardar proforma
  async function submit(e) {
    e.preventDefault();

    if (saving) return;

    if (!customer.full_name.trim() || !customer.city.trim()) {
      alert("Ingresa el nombre y la ciudad del cliente.");
      return;
    }

    if (!items.length) {
      alert("Agrega al menos un producto.");
      return;
    }

    if (
      deliveryType === "ENVIO" &&
      (!shippingCost || Number(shippingCost) < 0)
    ) {
      alert("Ingresa un valor de envío válido.");
      return;
    }

    setSaving(true);

    try {
      await onSave({
        customer: {
          full_name: customer.full_name.trim(),
          phone: customer.phone.trim(),
          city: customer.city.trim(),
        },

        items: items.map((item) => ({
          product_id: item.product_id,
          variant_id: item.variant_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          regular_unit_price: item.regular_unit_price ?? item.unit_price,
          discount_percent: item.discount_percent,
        })),

        delivery_type: deliveryType,

        // NUEVOS DATOS DE ENVÍO
        shipping_cost: shipping,
        collection_type: deliveryType === "ENVIO" ? collectionType : "PREPAID",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="proformaModal"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) {
          onClose();
        }
      }}
    >
      <form className="panel" onSubmit={submit}>
        <div className="proformaFormHeader">
          <div>
            <h2>{proforma ? "Editar proforma" : "Nueva proforma"}</h2>
            <p>Ingresa los datos del cliente y agrega los productos.</p>
          </div>

          <button
            type="button"
            className="proformaCloseButton"
            onClick={onClose}
            disabled={saving}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        {/* DATOS DEL CLIENTE */}
        <div className="proformaCustomerFields">
          <div
            className="proformaCustomerSearch"
            style={{ position: "relative", gridColumn: "1 / -1" }}
          >
            <label htmlFor="customerSearch">Buscar cliente existente</label>
            <input
              id="customerSearch"
              type="text"
              placeholder="Escribe el nombre o teléfono del cliente..."
              value={customerSearch}
              onChange={(e) => {
                const value = e.target.value;
                setCustomerSearch(value);
                setShowCustomerResults(true);
                if (!value.trim()) {
                  setCustomer({ full_name: "", phone: "", city: "" });
                }
              }}
              onFocus={() => setShowCustomerResults(true)}
              autoComplete="off"
              disabled={saving}
            />
            {showCustomerResults && customerSearch.trim() && (
              <div
                className="proformaSearchResults"
                style={{
                  position: "absolute",
                  zIndex: 20,
                  top: "100%",
                  left: 0,
                  right: 0,
                  maxHeight: 220,
                  overflowY: "auto",
                  background: "#fff",
                  boxShadow: "0 8px 24px rgba(0,0,0,.12)",
                }}
              >
                {filteredCustomers.length ? (
                  filteredCustomers.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className="proformaSearchResult"
                      onClick={() => selectCustomer(item)}
                    >
                      <span>
                        <strong>{item.full_name}</strong>
                        <small>
                          {item.phone || "Sin teléfono"} ·{" "}
                          {item.city || "Sin ciudad"}
                        </small>
                      </span>
                      <b>Seleccionar</b>
                    </button>
                  ))
                ) : (
                  <p style={{ padding: 12, margin: 0 }}>
                    {loadingCustomers
                      ? "Cargando clientes..."
                      : "No se encontraron clientes registrados."}
                  </p>
                )}
              </div>
            )}
            <small>
              También puedes escribir los datos de un cliente nuevo abajo.
            </small>
          </div>

          <label>
            Nombre del cliente
            <input
              required
              type="text"
              placeholder="Nombre completo"
              value={customer.full_name}
              onChange={(e) => {
                setCustomer({ ...customer, full_name: e.target.value });
                setCustomerSearch(e.target.value);
              }}
            />
          </label>

          <label>
            Teléfono
            <input
              type="tel"
              placeholder="Número de teléfono"
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
              type="text"
              placeholder="Ciudad del cliente"
              value={customer.city}
              onChange={(e) =>
                setCustomer({ ...customer, city: e.target.value })
              }
            />
          </label>
        </div>

        {/* BUSCADOR DE PRODUCTOS */}
        <div className="proformaProductSearch">
          <label htmlFor="productCode">
            Agregar producto por código o nombre
          </label>

          <input
            id="productCode"
            type="text"
            placeholder="Escribe o escanea el código del producto..."
            value={productCode}
            onChange={(e) => searchProduct(e.target.value)}
            onKeyDown={handleProductKeyDown}
            autoComplete="off"
          />

          {searchResults.length > 0 && (
            <div className="proformaSearchResults">
              {searchResults.map((product) => (
                <button
                  type="button"
                  key={product.id}
                  onClick={() => selectProduct(product.id)}
                  className="proformaSearchResult"
                >
                  <span>
                    <strong>{product.name}</strong>
                    <small>Código: {product.code || "Sin código"}</small>
                  </span>

                  <b>{money(product.price)}</b>
                </button>
              ))}
            </div>
          )}

          {productCode.trim() && searchResults.length === 0 && (
            <p className="proformaNoResults">No se encontraron productos.</p>
          )}
        </div>

        {/* LISTA DE PRODUCTOS */}
        <div className="proformaProductsSection">
          <div className="proformaProductsHeader">
            <h3>Productos agregados</h3>
            <span>{items.length} productos</span>
          </div>

          {items.length === 0 ? (
            <div className="proformaEmptyProducts">
              <span>🛍️</span>
              <p>Aún no has agregado productos.</p>
              <small>Busca un producto por su código o nombre.</small>
            </div>
          ) : (
            <div className="proformaItemsList">
              {items.map((item) => (
                <div
                  className="proformaFormItem"
                  key={
                    item.line_key ||
                    `${item.product_id}:${item.variant_id || "sin-variante"}`
                  }
                >
                  {proforma && item.image_url && (
                    <button
                      type="button"
                      className="proformaImageThumb"
                      onClick={() =>
                        setImagePreview({
                          url: item.image_url,
                          name: item.name,
                        })
                      }
                      aria-label={`Ampliar fotografía de ${item.name}`}
                    >
                      <img
                        src={item.image_url}
                        alt={item.name}
                        loading="lazy"
                      />
                    </button>
                  )}
                  <div className="proformaItemInfo">
                    <strong>{item.name}</strong>
                    {(() => {
                      const itemVariants = variants.filter(
                        (variant) =>
                          String(variant.product_id) ===
                          String(item.product_id),
                      );
                      if (!itemVariants.length) {
                        return <small>Sin variantes registradas</small>;
                      }
                      return (
                        <label className="proformaVariantSelector">
                          <span>Modelo · color · talla</span>
                          <select
                            value={item.variant_id || ""}
                            onChange={(e) =>
                              updateItemVariant(item.line_key, e.target.value)
                            }
                            disabled={saving}
                          >
                            {itemVariants.map((variant) => (
                              <option key={variant.id} value={variant.id}>
                                {variant.sku || "Variante"} ·{" "}
                                {variant.color || "Sin color"} · Talla{" "}
                                {variant.size || "Única"}
                              </option>
                            ))}
                          </select>
                          {item.variant && (
                            <small>
                              Color: {item.variant.color || "—"} · Talla:{" "}
                              {item.variant.size || "—"}
                            </small>
                          )}
                        </label>
                      );
                    })()}
                    {item.discount_percent > 0 && (
                      <small>Descuento: {item.discount_percent}%</small>
                    )}
                  </div>

                  <div className="proformaItemQuantity">
                    <label>Cantidad</label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) =>
                        updateQuantity(item.line_key, e.target.value)
                      }
                    />
                  </div>

                  <div className="proformaItemPrice">
                    <small>Subtotal con descuento</small>
                    <b>{money(item.unit_price * item.quantity)}</b>
                  </div>

                  <button
                    type="button"
                    className="proformaRemoveButton"
                    onClick={() => removeProduct(item.line_key)}
                    disabled={saving}
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* NUEVA SECCIÓN DE ENTREGA Y ENVÍO */}
        <div className="proformaShippingSection">
          <h3>Entrega y envío</h3>

          <label>
            Tipo de entrega
            <select
              value={deliveryType}
              onChange={(e) => {
                const value = e.target.value;
                setDeliveryType(value);

                if (value !== "ENVIO") {
                  setShippingCost("0");
                  setCollectionType("PREPAID");
                }
              }}
              disabled={saving}
            >
              <option value="POR_DEFINIR">Por definir</option>
              <option value="ENVIO">Envío</option>
              <option value="RETIRO">Retiro en tienda</option>
              <option value="LOCAL">Compra directa en local</option>
            </select>
          </label>

          {deliveryType === "ENVIO" && (
            <>
              <label>
                Valor del envío ($)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={shippingCost}
                  onChange={(e) => setShippingCost(e.target.value)}
                  placeholder="Ej. 5.00"
                  disabled={saving}
                />
              </label>

              <label>
                Modalidad de pago
                <select
                  value={collectionType}
                  onChange={(e) => setCollectionType(e.target.value)}
                  disabled={saving}
                >
                  <option value="PREPAID">
                    Pago anticipado: productos + envío
                  </option>
                  <option value="CONTRA_ENTREGA">
                    Contra entrega: envío a nosotros y productos a
                    transportadora
                  </option>
                </select>
              </label>
            </>
          )}
        </div>

        {/* TOTALES */}
        <div className="proformaTotals">
          <div>
            <span>Subtotal sin descuento</span>
            <strong>{money(subtotalWithoutDiscount)}</strong>
          </div>

          {discountTotal > 0 && (
            <div>
              <span>Descuento aplicado</span>
              <strong>-{money(discountTotal)}</strong>
            </div>
          )}

          <div>
            <span>Valor del envío</span>
            <strong>{money(shipping)}</strong>
          </div>

          <div>
            <span>Total con descuento</span>
            <strong>{money(totalToPay)}</strong>
          </div>

          <div className="proformaPayableTotal">
            <span>Total a pagar</span>
            <strong>{money(totalToPay)}</strong>
          </div>

          {deliveryType === "ENVIO" && (
            <>
              <div>
                <span>Recibe DIVINAS IMPORT</span>
                <strong>{money(amountToDivinas)}</strong>
              </div>

              {amountToCarrier > 0 && (
                <div>
                  <span>Paga a la transportadora</span>
                  <strong>{money(amountToCarrier)}</strong>
                </div>
              )}
            </>
          )}

          <small>IVA (0%): $0.00</small>
        </div>

        {/* ACCIONES */}
        <div className="proformaActions">
          <button
            type="button"
            className="proformaCancelButton"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>

          <button className="primary" type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Guardar proforma"}
          </button>
        </div>
      </form>

      {imagePreview && (
        <div
          className="proformaImagePreviewOverlay"
          onClick={() => setImagePreview(null)}
        >
          <button
            type="button"
            className="proformaImagePreviewClose"
            onClick={() => setImagePreview(null)}
            aria-label="Cerrar"
          >
            ×
          </button>
          <img
            src={imagePreview.url}
            alt={imagePreview.name}
            onClick={(e) => e.stopPropagation()}
          />
          <strong>{imagePreview.name}</strong>
        </div>
      )}
    </div>
  );
}
