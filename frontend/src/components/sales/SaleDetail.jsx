
import { useEffect, useState } from "react";
import { supabase } from "../../supabase";
import { X, Package, UserRound, Receipt } from "lucide-react";

export default function SaleDetail({ sale, customer, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [variants, setVariants] = useState([]);

  useEffect(() => {
    loadDetails();
  }, [sale.id]);

  const loadDetails = async () => {
    setLoading(true);

    try {
      const { data: saleItems, error } = await supabase
        .from("sale_items")
        .select("*")
        .eq("sale_id", sale.id);

      if (error) throw error;

      const rows = saleItems || [];
      setItems(rows);

      const productIds = [
        ...new Set(rows.map((item) => item.product_id).filter(Boolean)),
      ];

      const variantIds = [
        ...new Set(rows.map((item) => item.variant_id).filter(Boolean)),
      ];

      const [productResult, variantResult] = await Promise.all([
        productIds.length
          ? supabase
              .from("products")
              .select("id, name, code")
              .in("id", productIds)
          : Promise.resolve({ data: [], error: null }),

        variantIds.length
          ? supabase
              .from("product_variants")
              .select("id, size, color, sku")
              .in("id", variantIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (productResult.error) throw productResult.error;
      if (variantResult.error) throw variantResult.error;

      setProducts(productResult.data || []);
      setVariants(variantResult.data || []);
    } catch (error) {
      console.error("Error al cargar detalle de venta:", error);
      window.notify?.("No se pudo cargar el detalle de la venta", "error");
    } finally {
      setLoading(false);
    }
  };

  const money = (value) =>
    `$${Number(value || 0).toFixed(2)}`;

  const productById = new Map(products.map((p) => [p.id, p]));
  const variantById = new Map(variants.map((v) => [v.id, v]));

  return (
    <div className="saleDetailOverlay" onMouseDown={onClose}>
      <div
        className="saleDetailModal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="saleDetailHeader">
          <div>
            <span>DETALLE DE VENTA</span>
            <h2>{sale.sale_number}</h2>
          </div>

          <button
            className="saleDetailClose"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X />
          </button>
        </div>

        <div className="saleDetailCustomer">
          <div>
            <UserRound />
          </div>
          <section>
            <strong>{customer?.full_name || "Cliente no disponible"}</strong>
            <p>{customer?.phone || "Sin teléfono registrado"}</p>
            <p>{customer?.city || "Ciudad no registrada"}</p>
          </section>
        </div>

        <div className="saleDetailMetadata">
          <div>
            <span>Fecha</span>
            <strong>
              {sale.created_at
                ? new Date(sale.created_at).toLocaleString("es-EC")
                : "—"}
            </strong>
          </div>

          <div>
            <span>Método de pago</span>
            <strong>{sale.payment_method || "No registrado"}</strong>
          </div>

          <div>
            <span>Referencia de pago</span>
            <strong>{sale.payment_reference || "No registrada"}</strong>
          </div>
        </div>

        <div className="saleDetailItems">
          <h3>
            <Package size={18} />
            Productos vendidos
          </h3>

          {loading ? (
            <p>Cargando productos...</p>
          ) : items.length === 0 ? (
            <p>No hay productos registrados en esta venta.</p>
          ) : (
            items.map((item) => {
              const product = productById.get(item.product_id);
              const variant = variantById.get(item.variant_id);

              return (
                <div className="saleDetailItem" key={item.id}>
                  <div className="saleDetailItemInfo">
                    <strong>
                      {product?.name || "Producto no disponible"}
                    </strong>

                    <small>
                      Código: {product?.code || "—"}
                    </small>

                    {variant && (
                      <small>
                        Talla: {variant.size || "—"} · Color: {variant.color || "—"}
                      </small>
                    )}

                    <small>
                      {item.quantity} × {money(item.unit_price)}
                    </small>

                    {Number(item.discount_percent) > 0 && (
                      <small>
                        Descuento: {item.discount_percent}%
                      </small>
                    )}
                  </div>

                  <strong>{money(item.line_total)}</strong>
                </div>
              );
            })
          )}
        </div>

        <div className="saleDetailTotal">
          <span>
            <Receipt size={18} />
            Total de la venta
          </span>
          <strong>{money(sale.total)}</strong>
        </div>

        <button className="saleDetailFooterButton" onClick={onClose}>
          Cerrar detalle
        </button>
      </div>
    </div>
  );
}
