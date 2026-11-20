import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase";
import "./sale-form.css";

export default function SaleForm({ onClose, onSuccess }) {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [variants, setVariants] = useState([]);
  const [discounts, setDiscounts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [customerMode, setCustomerMode] = useState("existing");
  const [customerId, setCustomerId] = useState("");
  const [customerData, setCustomerData] = useState({
    full_name: "",
    phone: "",
    email: "",
    city: "",
    address: "",
  });

  const [productSearch, setProductSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [cart, setCart] = useState([]);

  const [paymentMethod, setPaymentMethod] = useState("EFECTIVO");
  const [paymentReference, setPaymentReference] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    try {
      const [customerResult, productResult, variantResult, discountResult] =
        await Promise.all([
          supabase
            .from("customers")
            .select("id, full_name, phone, email, city, address")
            .order("full_name"),

          supabase
            .from("products")
            .select("id, name, code, price, category_id, image_url")
            .eq("is_active", true)
            .order("name"),

          supabase
            .from("product_variants")
            .select("id, product_id, size, color, sku, stock"),

          supabase
            .from("category_discounts")
            .select("id, category_id, percentage, start_at, end_at, created_at")
            .eq("is_active", true),
        ]);

      if (customerResult.error) throw customerResult.error;
      if (productResult.error) throw productResult.error;
      if (variantResult.error) throw variantResult.error;
      if (discountResult.error) throw discountResult.error;

      setCustomers(customerResult.data || []);
      setProducts(productResult.data || []);
      setVariants(variantResult.data || []);
      setDiscounts(discountResult.data || []);
    } catch (error) {
      console.error("Error cargando formulario de venta:", error);
      window.notify?.("No se pudieron cargar los datos de la venta", "error");
    } finally {
      setLoading(false);
    }
  }

  const availableProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();

    if (!term) return products;

    return products.filter((product) =>
      [product.name, product.code].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(term),
      ),
    );
  }, [products, productSearch]);

  const selectedProduct = products.find(
    (product) => product.id === selectedProductId,
  );

  const productVariants = variants.filter(
    (variant) => variant.product_id === selectedProductId,
  );

  const selectedVariant = productVariants.find(
    (variant) => variant.id === selectedVariantId,
  );

  const getDiscount = (product) => {
    if (!product) return 0;

    const now = Date.now();

    const validDiscounts = discounts
      .filter((discount) => {
        if (discount.category_id !== product.category_id) return false;

        const starts =
          !discount.start_at || new Date(discount.start_at).getTime() <= now;

        const ends =
          !discount.end_at || new Date(discount.end_at).getTime() >= now;

        return starts && ends;
      })
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

    return Number(validDiscounts[0]?.percentage || 0);
  };

  const totalUnits = cart.reduce((sum, item) => sum + item.quantity, 0);

  const cartWithPrices = cart.map((item) => {
    const categoryDiscount = getDiscount(item.product);
    const discount =
      categoryDiscount > 0 ? categoryDiscount : totalUnits > 4 ? 10 : 0;

    const unitPrice =
      Math.round(Number(item.product.price) * (1 - discount / 100) * 2) / 2;

    return {
      ...item,
      discount,
      unitPrice,
      lineTotal: unitPrice * item.quantity,
    };
  });

  const total = cartWithPrices.reduce((sum, item) => sum + item.lineTotal, 0);

  const money = (value) => `$${Number(value || 0).toFixed(2)}`;

  function addToCart() {
    if (!selectedProduct) {
      window.notify?.("Selecciona un producto", "warning");
      return;
    }

    const qty = Number(quantity);

    if (!Number.isInteger(qty) || qty <= 0) {
      window.notify?.("Ingresa una cantidad válida", "warning");
      return;
    }

    if (productVariants.length > 0 && !selectedVariant) {
      window.notify?.("Selecciona una talla o variante", "warning");
      return;
    }

    if (selectedVariant && qty > Number(selectedVariant.stock)) {
      window.notify?.("No hay suficiente stock disponible", "warning");
      return;
    }

    const existing = cart.find(
      (item) =>
        item.product.id === selectedProduct.id &&
        item.variantId === (selectedVariant?.id || null),
    );

    const alreadyInCart = existing?.quantity || 0;

    if (
      selectedVariant &&
      alreadyInCart + qty > Number(selectedVariant.stock)
    ) {
      window.notify?.("La cantidad supera el stock disponible", "warning");
      return;
    }

    setCart((current) => {
      const found = current.find(
        (item) =>
          item.product.id === selectedProduct.id &&
          item.variantId === (selectedVariant?.id || null),
      );

      if (found) {
        return current.map((item) =>
          item === found ? { ...item, quantity: item.quantity + qty } : item,
        );
      }

      return [
        ...current,
        {
          product: selectedProduct,
          variantId: selectedVariant?.id || null,
          variant: selectedVariant || null,
          quantity: qty,
        },
      ];
    });

    setSelectedProductId("");
    setSelectedVariantId("");
    setProductSearch("");
    setQuantity(1);
  }

  function changeQuantity(index, value) {
    const qty = Number(value);

    if (!Number.isInteger(qty) || qty <= 0) return;

    const item = cart[index];

    if (item.variant && qty > Number(item.variant.stock)) {
      window.notify?.("La cantidad supera el stock disponible", "warning");
      return;
    }

    setCart((current) =>
      current.map((row, i) => (i === index ? { ...row, quantity: qty } : row)),
    );
  }

  function removeItem(index) {
    setCart((current) => current.filter((_, i) => i !== index));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (cart.length === 0) {
      window.notify?.("Agrega productos a la venta", "warning");
      return;
    }

    let customerPayload;

    if (customerMode === "existing") {
      if (!customerId) {
        window.notify?.("Selecciona un cliente", "warning");
        return;
      }

      customerPayload = { id: customerId };
    } else {
      if (!customerData.full_name.trim()) {
        window.notify?.("Ingresa el nombre del cliente", "warning");
        return;
      }

      customerPayload = customerData;
    }

    if (paymentMethod === "TRANSFERENCIA" && !paymentReference.trim()) {
      window.notify?.("Ingresa la referencia de la transferencia", "warning");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        throw new Error("No se encontró la sesión del usuario");
      }

      const items = cart.map((item) => ({
        product_id: item.product.id,
        variant_id: item.variantId,
        quantity: item.quantity,
      }));

      const { data, error } = await supabase.rpc("create_direct_sale", {
        p_customer: customerPayload,
        p_items: items,
        p_payment_method: paymentMethod,
        p_payment_reference: paymentReference.trim() || null,
        p_created_by: user.id,
      });

      if (error) throw error;

      window.notify?.(
        `Venta registrada correctamente. Total: ${money(data.total)}`,
        "success",
      );

      onSuccess?.();
      onClose?.();
    } catch (error) {
      console.error("Error registrando venta:", error);
      window.notify?.(
        error.message || "No se pudo registrar la venta",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="saleFormOverlay">
        <div className="saleFormModal">
          <p>Cargando información...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="saleFormOverlay">
      <form className="saleFormModal" onSubmit={handleSubmit}>
        <div className="saleFormHeader">
          <div>
            <h2>Nueva venta</h2>
            <p>Registra una venta directa de DIVINAS IMPORT.</p>
          </div>

          <button
            type="button"
            className="saleFormClose"
            onClick={onClose}
            disabled={saving}
          >
            ×
          </button>
        </div>

        <div className="saleFormSection">
          <h3>1. Cliente</h3>

          <div className="saleFormTabs">
            <button
              type="button"
              className={customerMode === "existing" ? "active" : ""}
              onClick={() => setCustomerMode("existing")}
            >
              Cliente existente
            </button>

            <button
              type="button"
              className={customerMode === "new" ? "active" : ""}
              onClick={() => setCustomerMode("new")}
            >
              Nuevo cliente
            </button>
          </div>

          {customerMode === "existing" ? (
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
            >
              <option value="">Seleccionar cliente...</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.full_name}
                  {customer.phone ? ` - ${customer.phone}` : ""}
                </option>
              ))}
            </select>
          ) : (
            <div className="saleFormCustomerGrid">
              <input
                placeholder="Nombre completo *"
                value={customerData.full_name}
                onChange={(e) =>
                  setCustomerData({
                    ...customerData,
                    full_name: e.target.value,
                  })
                }
                required
              />

              <input
                placeholder="Teléfono"
                value={customerData.phone}
                onChange={(e) =>
                  setCustomerData({
                    ...customerData,
                    phone: e.target.value,
                  })
                }
              />

              <input
                type="email"
                placeholder="Correo electrónico"
                value={customerData.email}
                onChange={(e) =>
                  setCustomerData({
                    ...customerData,
                    email: e.target.value,
                  })
                }
              />

              <input
                placeholder="Ciudad"
                value={customerData.city}
                onChange={(e) =>
                  setCustomerData({
                    ...customerData,
                    city: e.target.value,
                  })
                }
              />

              <input
                placeholder="Dirección"
                value={customerData.address}
                onChange={(e) =>
                  setCustomerData({
                    ...customerData,
                    address: e.target.value,
                  })
                }
              />
            </div>
          )}
        </div>

        <div className="saleFormSection">
          <h3>2. Productos</h3>

          <div className="saleFormProductSearch">
            <input
              type="search"
              placeholder="Buscar producto por nombre o código..."
              value={productSearch}
              onChange={(e) => {
                setProductSearch(e.target.value);
                setSelectedProductId("");
                setSelectedVariantId("");
              }}
            />

            {productSearch.trim() && (
              <div className="saleFormProductResults">
                {availableProducts.length === 0 ? (
                  <p>No se encontraron productos.</p>
                ) : (
                  availableProducts.slice(0, 8).map((product) => (
                    <button
                      type="button"
                      key={product.id}
                      onClick={() => {
                        setSelectedProductId(product.id);
                        setProductSearch(
                          `${product.name}${product.code ? ` (${product.code})` : ""}`,
                        );
                        setSelectedVariantId("");
                      }}
                    >
                      <span>{product.name}</span>
                      <strong>{money(product.price)}</strong>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {selectedProduct && (
            <div className="saleFormAddProduct">
              <div className="saleFormSelectedProduct">
                <strong>{selectedProduct.name}</strong>
                <span>
                  {selectedProduct.code || "Sin código"} ·{" "}
                  {money(selectedProduct.price)}
                </span>
              </div>

              {productVariants.length > 0 && (
                <select
                  value={selectedVariantId}
                  onChange={(e) => setSelectedVariantId(e.target.value)}
                  required
                >
                  <option value="">Seleccionar talla / color...</option>
                  {productVariants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {[variant.size, variant.color, `Stock: ${variant.stock}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </option>
                  ))}
                </select>
              )}

              {productVariants.length === 0 && (
                <p className="saleFormWarning">
                  Este producto no tiene variantes registradas.
                </p>
              )}

              <div className="saleFormAddControls">
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  aria-label="Cantidad"
                />

                <button type="button" onClick={addToCart}>
                  Agregar al carrito
                </button>
              </div>

              {selectedVariant && (
                <small>
                  Stock disponible: {selectedVariant.stock} unidades
                </small>
              )}
            </div>
          )}

          <div className="saleFormCart">
            <h4>Productos agregados ({totalUnits} unidades)</h4>

            {cart.length === 0 ? (
              <p className="saleFormEmptyCart">
                Todavía no has agregado productos.
              </p>
            ) : (
              cartWithPrices.map((item, index) => (
                <div
                  className="saleFormCartItem"
                  key={`${item.product.id}-${item.variantId || "sin-variante"}`}
                >
                  <div className="saleFormCartInfo">
                    <strong>{item.product.name}</strong>
                    <span>
                      {item.variant
                        ? [item.variant.size, item.variant.color]
                            .filter(Boolean)
                            .join(" · ")
                        : "Sin variante"}
                    </span>
                    <small>
                      {money(item.unitPrice)} c/u · Descuento: {item.discount}%
                    </small>
                  </div>

                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => changeQuantity(index, e.target.value)}
                    aria-label={`Cantidad de ${item.product.name}`}
                  />

                  <strong>{money(item.lineTotal)}</strong>

                  <button
                    type="button"
                    className="saleFormRemove"
                    onClick={() => removeItem(index)}
                    aria-label="Eliminar producto"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="saleFormSection">
          <h3>3. Pago</h3>

          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
          >
            <option value="EFECTIVO">Efectivo</option>
            <option value="TRANSFERENCIA">Transferencia</option>
            <option value="TARJETA">Tarjeta</option>
            <option value="CONTRA_ENTREGA">Contra entrega</option>
          </select>

          {paymentMethod === "TRANSFERENCIA" && (
            <input
              placeholder="Número de referencia de transferencia"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
            />
          )}
        </div>

        <div className="saleFormTotal">
          <div>
            <span>Total de unidades</span>
            <strong>{totalUnits}</strong>
          </div>
          <div>
            <span>Descuento por volumen</span>
            <strong>
              {totalUnits > 4
                ? "10% en productos sin descuento de categoría"
                : "No aplica"}
            </strong>
          </div>
          <div className="saleFormGrandTotal">
            <span>Total a pagar</span>
            <strong>{money(total)}</strong>
          </div>
        </div>

        <div className="saleFormActions">
          <button
            type="button"
            className="saleFormCancel"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="saleFormSubmit"
            disabled={saving || cart.length === 0}
          >
            {saving ? "Registrando..." : "Registrar venta"}
          </button>
        </div>
      </form>
    </div>
  );
}
