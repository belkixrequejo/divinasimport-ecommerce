
import { useEffect, useState } from "react";
import { money, round50 } from "./utils";

export default function ProformaForm({
  products,
  discounts,
  proforma,
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

  // NUEVOS CAMPOS DE ENVÍO
  const [deliveryType, setDeliveryType] = useState("POR_DEFINIR");
  const [shippingCost, setShippingCost] = useState("0");
  const [collectionType, setCollectionType] = useState("PREPAID");

  // Cargar información de la proforma al editar
  useEffect(() => {
    if (proforma) {
      setCustomer({
        full_name: proforma.customers?.full_name || "",
        phone: proforma.customers?.phone || "",
        city: proforma.customers?.city || "",
      });

      setItems(
        (proforma.proforma_items || []).map((item) => ({
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          name:
            item.products?.name ||
            item.product_name_snapshot ||
            item.product_name ||
            "",
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          discount_percent: Number(item.discount_percent || 0),
        }))
      );

      // Cargar información del envío
      setDeliveryType(proforma.delivery_type || "POR_DEFINIR");
      setShippingCost(String(proforma.shipping_cost ?? 0));
      setCollectionType(proforma.collection_type || "PREPAID");
    } else {
      setCustomer({
        full_name: "",
        phone: "",
        city: "",
      });

      setItems([]);

      // Valores iniciales
      setDeliveryType("POR_DEFINIR");
      setShippingCost("0");
      setCollectionType("PREPAID");
    }

    setProductCode("");
    setSearchResults([]);
  }, [proforma]);

  // Agregar producto
  function addProduct(productId) {
    const product = products.find(
      (p) => String(p.id) === String(productId)
    );

    if (!product) return;

    const discount = discounts.find(
      (d) => d.category_id === product.category_id
    );

    const percentage = Number(discount?.percentage || 0);

    const price = round50(
      Number(product.price) * (1 - percentage / 100)
    );

    setItems((current) => {
      const existing = current.find(
        (item) => item.product_id === product.id
      );

      if (existing) {
        return current.map((item) =>
          item.product_id === product.id
            ? {
                ...item,
                quantity: Number(item.quantity) + 1,
              }
            : item
        );
      }

      return [
        ...current,
        {
          product_id: product.id,
          variant_id: null,
          name: product.name,
          quantity: 1,
          unit_price: price,
          discount_percent: percentage,
        },
      ];
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
          productCode.trim().toLowerCase()
    );

    if (exactMatch) {
      selectProduct(exactMatch.id);
    }
  }

  // Actualizar cantidad
  function updateQuantity(productId, quantity) {
    setItems((current) =>
      current.map((item) =>
        item.product_id === productId
          ? {
              ...item,
              quantity: Math.max(1, Number(quantity) || 1),
            }
          : item
      )
    );
  }

  // Eliminar producto
  function removeProduct(productId) {
    setItems((current) =>
      current.filter((item) => item.product_id !== productId)
    );
  }

  // Calcular total de productos
  const productsTotal = items.reduce(
    (sum, item) =>
      sum + Number(item.unit_price) * Number(item.quantity),
    0
  );

  // Calcular envío
  const shipping =
    deliveryType === "ENVIO"
      ? Math.max(0, Number(shippingCost) || 0)
      : 0;

  // Total general
  const total = productsTotal + shipping;

  // Valores que paga cada parte
  const amountToDivinas =
    deliveryType === "ENVIO" &&
    collectionType === "CONTRA_ENTREGA"
      ? shipping
      : total;

  const amountToCarrier =
    deliveryType === "ENVIO" &&
    collectionType === "CONTRA_ENTREGA"
      ? productsTotal
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
          discount_percent: item.discount_percent,
        })),

        delivery_type: deliveryType,

        // NUEVOS DATOS DE ENVÍO
        shipping_cost: shipping,
        collection_type:
          deliveryType === "ENVIO"
            ? collectionType
            : "PREPAID",
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
            <h2>
              {proforma ? "Editar proforma" : "Nueva proforma"}
            </h2>
            <p>
              Ingresa los datos del cliente y agrega los productos.
            </p>
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
          <label>
            Nombre del cliente
            <input
              required
              type="text"
              placeholder="Nombre completo"
              value={customer.full_name}
              onChange={(e) =>
                setCustomer({
                  ...customer,
                  full_name: e.target.value,
                })
              }
            />
          </label>

          <label>
            Teléfono
            <input
              type="tel"
              placeholder="Número de teléfono"
              value={customer.phone}
              onChange={(e) =>
                setCustomer({
                  ...customer,
                  phone: e.target.value,
                })
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
                setCustomer({
                  ...customer,
                  city: e.target.value,
                })
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
                    <small>
                      Código: {product.code || "Sin código"}
                    </small>
                  </span>

                  <b>{money(product.price)}</b>
                </button>
              ))}
            </div>
          )}

          {productCode.trim() && searchResults.length === 0 && (
            <p className="proformaNoResults">
              No se encontraron productos.
            </p>
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
                  key={item.product_id}
                >
                  <div className="proformaItemInfo">
                    <strong>{item.name}</strong>
                    {item.discount_percent > 0 && (
                      <small>
                        Descuento: {item.discount_percent}%
                      </small>
                    )}
                  </div>

                  <div className="proformaItemQuantity">
                    <label>Cantidad</label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) =>
                        updateQuantity(
                          item.product_id,
                          e.target.value
                        )
                      }
                    />
                  </div>

                  <div className="proformaItemPrice">
                    <small>Subtotal</small>
                    <b>
                      {money(item.unit_price * item.quantity)}
                    </b>
                  </div>

                  <button
                    type="button"
                    className="proformaRemoveButton"
                    onClick={() => removeProduct(item.product_id)}
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
                  onChange={(e) =>
                    setCollectionType(e.target.value)
                  }
                  disabled={saving}
                >
                  <option value="PREPAID">
                    Pago anticipado: productos + envío
                  </option>
                  <option value="CONTRA_ENTREGA">
                    Contra entrega: envío a nosotros y productos a transportadora
                  </option>
                </select>
              </label>
            </>
          )}
        </div>

        {/* TOTALES */}
        <div className="proformaTotals">
          <div>
            <span>Subtotal de productos</span>
            <strong>{money(productsTotal)}</strong>
          </div>

          <div>
            <span>Valor del envío</span>
            <strong>{money(shipping)}</strong>
          </div>

          <div>
            <span>Total de la proforma</span>
            <strong>{money(total)}</strong>
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

          <button
            className="primary"
            type="submit"
            disabled={saving}
          >
            {saving ? "Guardando..." : "Guardar proforma"}
          </button>
        </div>
      </form>
    </div>
  );
}
