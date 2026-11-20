
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../supabase";
import { X, Package, UserRound, Receipt, Download } from "lucide-react";
import html2canvas from "html2canvas";

export default function SaleDetail({ sale, customer, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [variants, setVariants] = useState([]);
  const [downloading, setDownloading] = useState(false);

  const receiptRef = useRef(null);

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

  const money = (value) => `$${Number(value || 0).toFixed(2)}`;

  const productById = new Map(products.map((p) => [p.id, p]));
  const variantById = new Map(variants.map((v) => [v.id, v]));

  const downloadReceipt = async () => {
    if (!receiptRef.current || loading || items.length === 0) {
      window.notify?.("Espera a que carguen los productos de la venta", "warning");
      return;
    }

    setDownloading(true);

    try {
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });

      const link = document.createElement("a");
      const saleNumber = String(sale.sale_number || sale.id)
        .replace(/[^a-zA-Z0-9-_]/g, "-");

      link.download = `DIVINAS-IMPORT-${saleNumber}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      window.notify?.("Comprobante descargado correctamente", "success");
    } catch (error) {
      console.error("Error generando comprobante:", error);
      window.notify?.("No se pudo generar la imagen del comprobante", "error");
    } finally {
      setDownloading(false);
    }
  };

  const saleDate = sale.created_at
    ? new Date(sale.created_at).toLocaleString("es-EC", {
        dateStyle: "long",
        timeStyle: "short",
      })
    : "—";

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
            <strong>{saleDate}</strong>
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

                    <small>Código: {product?.code || "—"}</small>

                    {variant && (
                      <small>
                        Talla: {variant.size || "—"} · Color:{" "}
                        {variant.color || "—"}
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

        <div className="saleDetailActions">
          <button
            className="saleDetailDownload"
            onClick={downloadReceipt}
            disabled={loading || downloading || items.length === 0}
          >
            <Download size={18} />
            {downloading ? "Generando imagen..." : "Descargar comprobante PNG"}
          </button>

          <button className="saleDetailFooterButton" onClick={onClose}>
            Cerrar detalle
          </button>
        </div>

        {/* Comprobante que se convierte en imagen PNG */}
        <div className="saleReceiptCapture">
          <div className="saleReceipt" ref={receiptRef}>
            <div className="saleReceiptBrand">
              <div className="saleReceiptBrandName">
                DIVINAS <span>IMPORT</span>
              </div>
              <p>MODA PARA TODA LA FAMILIA</p>
              <div className="saleReceiptAccent" />
              <h2>COMPROBANTE DE VENTA</h2>
              <span className="saleReceiptStatus">VENTA REGISTRADA</span>
            </div>

            <div className="saleReceiptNumber">
              <span>N.º DE VENTA</span>
              <strong>{sale.sale_number || "—"}</strong>
            </div>

            <div className="saleReceiptBlock">
              <h3>DATOS DEL CLIENTE</h3>
              <p>
                <strong>Cliente:</strong>{" "}
                {customer?.full_name || "Cliente no disponible"}
              </p>
              <p>
                <strong>Teléfono:</strong>{" "}
                {customer?.phone || "No registrado"}
              </p>
              <p>
                <strong>Ciudad:</strong> {customer?.city || "No registrada"}
              </p>
              {customer?.address && (
                <p>
                  <strong>Dirección:</strong> {customer.address}
                </p>
              )}
            </div>

            <div className="saleReceiptBlock">
              <h3>INFORMACIÓN DE LA VENTA</h3>
              <p>
                <strong>Fecha:</strong> {saleDate}
              </p>
              <p>
                <strong>Método de pago:</strong>{" "}
                {sale.payment_method || "No registrado"}
              </p>
              {sale.payment_reference && (
                <p>
                  <strong>Referencia:</strong> {sale.payment_reference}
                </p>
              )}
            </div>

            <div className="saleReceiptBlock">
              <h3>DETALLE DE PRODUCTOS</h3>

              <div className="saleReceiptTableHeader">
                <span>PRODUCTO</span>
                <span>CANT.</span>
                <span>TOTAL</span>
              </div>

              {items.map((item) => {
                const product = productById.get(item.product_id);
                const variant = variantById.get(item.variant_id);

                return (
                  <div className="saleReceiptProduct" key={item.id}>
                    <div>
                      <strong>
                        {product?.name || "Producto no disponible"}
                      </strong>
                      <small>Código: {product?.code || "—"}</small>
                      {variant && (
                        <small>
                          Talla: {variant.size || "—"} · Color:{" "}
                          {variant.color || "—"}
                        </small>
                      )}
                      <small>
                        Precio unitario: {money(item.unit_price)}
                      </small>
                      {Number(item.discount_percent) > 0 && (
                        <small>
                          Descuento aplicado: {item.discount_percent}%
                        </small>
                      )}
                    </div>

                    <strong>{item.quantity}</strong>
                    <strong>{money(item.line_total)}</strong>
                  </div>
                );
              })}
            </div>

            <div className="saleReceiptFinalTotal">
              <span>TOTAL A PAGAR</span>
              <strong>{money(sale.total)}</strong>
            </div>

            <div className="saleReceiptFooter">
              <strong>¡GRACIAS POR TU COMPRA!</strong>
              <p>DIVINAS IMPORT · Moda para toda la familia</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
