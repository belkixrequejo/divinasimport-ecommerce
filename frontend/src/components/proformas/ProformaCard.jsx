import { useRef, useState } from "react";
import { money } from "./utils";
import { Download } from "lucide-react";
import html2canvas from "html2canvas";

export default function ProformaCard({
  proforma,
  onEdit,
  onCancel,
  onConfirm,
  onDeliveryChange,
  onLayaway,
}) {
  const [processing, setProcessing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showLayaway, setShowLayaway] = useState(false);
  const [initialPayment, setInitialPayment] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("EFECTIVO");
  const [paymentReference, setPaymentReference] = useState("");
  const [layawayReceipt, setLayawayReceipt] = useState(null);

  const receiptRef = useRef(null);

  const status = proforma.status;
  const canEdit = status === "PENDIENTE";

  const items = proforma.proforma_items || [];
  const customer = proforma.customers || {};

  const totalItems = items.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0,
  );

  const subtotal = Number(
    proforma.subtotal ??
      items.reduce(
        (sum, item) =>
          sum +
          Number(
            item.line_total ??
              Number(item.unit_price || 0) * Number(item.quantity || 0),
          ),
        0,
      ),
  );

  const deliveryType = proforma.delivery_type || "POR_DEFINIR";

  const shippingCost =
    deliveryType === "ENVIO" ? Number(proforma.shipping_cost || 0) : 0;

  const collectionType = proforma.collection_type || "PREPAID";

  const vatAmount = Number(proforma.vat_amount || 0);

  const total = subtotal + shippingCost + vatAmount;

  // El apartado se calcula con precios normales, sin descuentos.
  // La proforma original mantiene su total promocional.
  const subtotalWithoutDiscount = items.reduce(
    (sum, item) =>
      sum +
      Number(
        item.regular_unit_price ?? item.products?.price ?? item.unit_price ?? 0,
      ) *
        Number(item.quantity || 0),
    0,
  );

  const layawayTotal = subtotalWithoutDiscount + shippingCost + vatAmount;

  const amountToDivinas =
    collectionType === "CONTRA_ENTREGA" ? shippingCost : total;

  const amountToCarrier = collectionType === "CONTRA_ENTREGA" ? subtotal : 0;

  const collectionLabel =
    collectionType === "CONTRA_ENTREGA" ? "Contra entrega" : "Pago anticipado";

  const saleDate = proforma.created_at
    ? new Date(proforma.created_at).toLocaleString("es-EC", {
        dateStyle: "long",
        timeStyle: "short",
      })
    : "—";

  async function askConfirmation(message, options) {
    if (typeof window.confirmAction === "function") {
      return await window.confirmAction(message, options);
    }

    return window.confirm(message);
  }

  async function handleCancel() {
    if (processing) return;

    try {
      if (typeof window.confirmAction !== "function") {
        window.notify?.(
          "No está disponible el modal de confirmación.",
          "error",
        );
        return;
      }

      const accepted = await window.confirmAction(
        "¿Deseas anular esta proforma? Se conservará el registro y no se eliminará su historial.",
        {
          title: "Anular proforma",
          confirmText: "Sí, anular",
          cancelText: "Volver",
          type: "warning",
        },
      );

      if (!accepted) return;

      setProcessing(true);
      await onCancel(proforma.id);
    } catch (error) {
      console.error("Error al anular proforma:", error);
      window.notify?.(
        error.message || "No se pudo anular la proforma.",
        "error",
      );
    } finally {
      setProcessing(false);
    }
  }

  async function handleConfirm() {
    if (processing) return;

    try {
      const accepted = await askConfirmation(
        "¿Deseas confirmar esta proforma como venta? Esta operación puede descontar las existencias de los productos.",
        {
          title: "Confirmar venta",
          confirmText: "Sí, confirmar venta",
          cancelText: "Cancelar",
        },
      );

      if (!accepted) return;

      setProcessing(true);
      await onConfirm(proforma.id);
    } catch (error) {
      window.notify?.(
        error.message || "No se pudo confirmar la venta.",
        "error",
      );
    } finally {
      setProcessing(false);
    }
  }

  async function handleLayaway(e) {
    e.preventDefault();

    if (processing) return;

    if (typeof onLayaway !== "function") {
      window.notify?.(
        "Falta conectar la acción de apartar desde Proformas.jsx.",
        "error",
      );
      return;
    }

    const amount = Number(initialPayment);

    if (!Number.isFinite(amount) || amount <= 0) {
      window.notify?.("Ingresa un abono inicial válido.", "error");
      return;
    }

    if (amount > layawayTotal) {
      window.notify?.(
        "El abono no puede superar el total del apartado sin descuento.",
        "error",
      );
      return;
    }

    try {
      setProcessing(true);

      const result = await onLayaway(proforma.id, {
        initial_payment: amount,
        payment_method: paymentMethod,
        payment_reference: paymentReference.trim() || null,
      });

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      setLayawayReceipt({
        total: layawayTotal,
        initialPayment: amount,
        balance: Math.max(0, layawayTotal - amount),
        expiresAt,
        paymentMethod,
        paymentReference: paymentReference.trim() || null,
        result,
      });

      setShowLayaway(false);
      setInitialPayment("");
      setPaymentReference("");
      setPaymentMethod("EFECTIVO");
    } catch (error) {
      window.notify?.(
        error.message || "No se pudo crear el apartado.",
        "error",
      );
    } finally {
      setProcessing(false);
    }
  }

  async function downloadProforma() {
    if (!receiptRef.current || downloading) return;

    setDownloading(true);

    try {
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: true,
      });

      const link = document.createElement("a");

      const number = String(proforma.proforma_number || proforma.id).replace(
        /[^a-zA-Z0-9-_]/g,
        "-",
      );

      link.download = layawayReceipt
        ? `DIVINAS-IMPORT-APARTADO-${number}.png`
        : `DIVINAS-IMPORT-PROFORMA-${number}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      window.notify?.(
        layawayReceipt
          ? "Comprobante de apartado descargado correctamente."
          : "Proforma descargada correctamente.",
        "success",
      );
    } catch (error) {
      console.error("Error descargando proforma:", error);

      window.notify?.("No se pudo generar la imagen de la proforma.", "error");
    } finally {
      setDownloading(false);
    }
  }

  function deliveryLabel(value) {
    const labels = {
      POR_DEFINIR: "Por definir",
      ENVIO: "Envío",
      RETIRO: "Retiro en tienda",
      LOCAL: "Compra directa en local",
    };

    return labels[value] || value || "Por definir";
  }

  return (
    <>
      <article className="proformaCard">
        <div className="proformaCardHeader">
          <div>
            <h3>{proforma.proforma_number}</h3>

            <span>{customer.full_name}</span>

            <small>
              {customer.city || "Sin ciudad"}
              {" · "}
              {customer.phone || "Sin teléfono"}
            </small>
          </div>

          <strong>{money(total)}</strong>
        </div>

        <p className={`proformaStatus status-${status?.toLowerCase()}`}>
          Estado: <b>{status}</b>
        </p>

        <label>
          Tipo de entrega
          <select
            value={deliveryType}
            disabled={!canEdit || processing}
            onChange={(e) => onDeliveryChange(proforma.id, e.target.value)}
          >
            <option value="POR_DEFINIR">Por definir</option>
            <option value="ENVIO">Envío</option>
            <option value="RETIRO">Retiro en tienda</option>
            <option value="LOCAL">Compra directa en local</option>
          </select>
        </label>

        <div className="proformaItems">
          {items.map((item) => (
            <div key={item.id}>
              <div className="proformaItemDescription">
                <strong>
                  {item.products?.name ||
                    item.product_name_snapshot ||
                    item.product_name ||
                    "Producto"}
                </strong>

                {item.product_variants && (
                  <small>
                    Modelo: {item.product_variants.sku || "—"} · Color:{" "}
                    {item.product_variants.color || "—"} · Talla:{" "}
                    {item.product_variants.size || "—"}
                  </small>
                )}
              </div>

              <span>
                {item.quantity} × {money(item.unit_price)}
              </span>
            </div>
          ))}
        </div>

        <div className="proformaDownloadActions">
          <button
            type="button"
            className="proformaDownloadButton"
            onClick={downloadProforma}
            disabled={downloading}
          >
            <Download size={17} />
            {downloading
              ? "Generando imagen..."
              : layawayReceipt
                ? "Descargar comprobante de apartado PNG"
                : "Descargar proforma PNG"}
          </button>
        </div>

        {canEdit && (
          <div className="proformaActions">
            <button
              type="button"
              disabled={processing}
              onClick={() => onEdit(proforma)}
            >
              Editar
            </button>

            <button type="button" disabled={processing} onClick={handleCancel}>
              {processing ? "Procesando..." : "Anular"}
            </button>

            <button
              type="button"
              disabled={processing}
              onClick={() => setShowLayaway(true)}
            >
              Apartar con abono
            </button>

            <button
              type="button"
              className="primary"
              disabled={processing}
              onClick={handleConfirm}
            >
              {processing ? "Procesando..." : "Confirmar venta"}
            </button>
          </div>
        )}
      </article>

      {/* FORMULARIO PARA CREAR APARTADO */}
      {showLayaway && (
        <div className="layawayOverlay">
          <form className="layawayForm" onSubmit={handleLayaway}>
            <button
              type="button"
              className="layawayClose"
              onClick={() => setShowLayaway(false)}
              aria-label="Cerrar"
            >
              ×
            </button>

            <h2>Apartar proforma</h2>

            <p>
              Cliente: <strong>{customer.full_name || "No registrado"}</strong>
            </p>

            <p>
              Total sin descuento: <strong>{money(layawayTotal)}</strong>
            </p>

            <label>
              Abono inicial
              <input
                type="number"
                min="0.01"
                max={layawayTotal}
                step="0.01"
                required
                value={initialPayment}
                onChange={(e) => setInitialPayment(e.target.value)}
                placeholder="Ej. 10.00"
              />
            </label>

            <label>
              Método de pago
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="EFECTIVO">Efectivo</option>
                <option value="TRANSFERENCIA">Transferencia</option>
                <option value="TARJETA">Tarjeta</option>
                <option value="CONTRA_ENTREGA">Contra entrega</option>
              </select>
            </label>

            <label>
              Referencia (opcional)
              <input
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="Número de comprobante"
              />
            </label>

            <p>
              Saldo pendiente:{" "}
              <strong>
                {money(Math.max(0, layawayTotal - Number(initialPayment || 0)))}
              </strong>
            </p>

            <small>El apartado tendrá una vigencia de 7 días.</small>

            <button className="primary" type="submit" disabled={processing}>
              {processing ? "Registrando..." : "Confirmar apartado"}
            </button>
          </form>
        </div>
      )}

      {/* COMPROBANTE OCULTO PARA GENERAR PNG */}
      <div className="proformaReceiptCapture">
        <div className="proformaReceipt" ref={receiptRef}>
          <header className="proformaReceiptBrand">
            <div className="proformaReceiptBrandName">
              DIVINAS <span>IMPORT</span>
            </div>

            <p>MODA PARA TODA LA FAMILIA</p>

            <div className="proformaReceiptAccent" />

            <h2>{layawayReceipt ? "COMPROBANTE DE APARTADO" : "PROFORMA"}</h2>

            <span className="proformaReceiptStatus">
              {layawayReceipt ? "APARTADO" : status}
            </span>
          </header>

          <div className="proformaReceiptNumber">
            <span>N.º DE PROFORMA</span>
            <strong>{proforma.proforma_number || "—"}</strong>
          </div>

          <section className="proformaReceiptBlock">
            <h3>DATOS DEL CLIENTE</h3>

            <p>
              <strong>Cliente:</strong> {customer.full_name || "No registrado"}
            </p>

            <p>
              <strong>Teléfono:</strong> {customer.phone || "No registrado"}
            </p>

            <p>
              <strong>Ciudad:</strong> {customer.city || "No registrada"}
            </p>

            {customer.address && (
              <p>
                <strong>Dirección:</strong> {customer.address}
              </p>
            )}
          </section>

          <section className="proformaReceiptBlock">
            <h3>{layawayReceipt ? "INFORMACIÓN DEL APARTADO" : "INFORMACIÓN DE LA PROFORMA"}</h3>

            <p>
              <strong>Fecha:</strong> {saleDate}
            </p>

            {layawayReceipt && (
              <>
                <p>
                  <strong>Válido hasta:</strong>{" "}
                  {layawayReceipt.expiresAt.toLocaleDateString("es-EC")}
                </p>
                <p>
                  <strong>Vigencia:</strong> 7 días
                </p>
              </>
            )}

            <p>
              <strong>Tipo de entrega:</strong> {deliveryLabel(deliveryType)}
            </p>

            {deliveryType === "ENVIO" && (
              <p>
                <strong>Modalidad de pago:</strong> {collectionLabel}
              </p>
            )}
          </section>

          <section className="proformaReceiptBlock">
            <h3>DETALLE DE PRODUCTOS</h3>

            <div className="proformaReceiptTableHeader">
              <span>PRODUCTO</span>
              <span>CANT.</span>
              <span>TOTAL</span>
            </div>

            {items.map((item) => {
              const productName =
                item.products?.name ||
                item.product_name_snapshot ||
                item.product_name ||
                "Producto";

              const variant = item.product_variants;

              const lineTotal = Number(
                item.line_total ??
                  Number(item.unit_price || 0) * Number(item.quantity || 0),
              );

              return (
                <div className="proformaReceiptProduct" key={item.id}>
                  <div>
                    <strong>{productName}</strong>

                    <small>
                      Código:{" "}
                      {item.products?.code || item.product_code_snapshot || "—"}
                    </small>

                    {variant && (
                      <small>
                        Talla: {variant.size || "—"} · Color:{" "}
                        {variant.color || "—"}
                      </small>
                    )}

                    <small>Precio unitario: {money(item.unit_price)}</small>

                    {Number(item.discount_percent) > 0 && (
                      <small>Descuento: {item.discount_percent}%</small>
                    )}
                  </div>

                  <strong>{item.quantity}</strong>

                  <strong>{money(lineTotal)}</strong>
                </div>
              );
            })}
          </section>

          <div className="proformaReceiptTotals">
            <div>
              <span>Unidades</span>
              <strong>{totalItems}</strong>
            </div>

            <div>
              <span>Subtotal de productos</span>
              <strong>
                {money(layawayReceipt ? subtotalWithoutDiscount : subtotal)}
              </strong>
            </div>

            {deliveryType === "ENVIO" && (
              <div>
                <span>Valor del envío</span>
                <strong>{money(shippingCost)}</strong>
              </div>
            )}

            <div>
              <span>IVA</span>
              <strong>{money(vatAmount)}</strong>
            </div>

            <div className="proformaReceiptGrandTotal">
              <span>{layawayReceipt ? "TOTAL DEL APARTADO" : "TOTAL DE LA PROFORMA"}</span>
              <strong>{money(layawayReceipt ? layawayReceipt.total : total)}</strong>
            </div>

            {layawayReceipt && (
              <>
                <div>
                  <span>Abono inicial recibido</span>
                  <strong>{money(layawayReceipt.initialPayment)}</strong>
                </div>
                <div className="proformaReceiptGrandTotal">
                  <span>SALDO PENDIENTE</span>
                  <strong>{money(layawayReceipt.balance)}</strong>
                </div>
              </>
            )}
          </div>

          {deliveryType === "ENVIO" && (
            <section className="proformaReceiptBlock">
              <h3>RESUMEN DE PAGOS</h3>

              <p>
                <strong>Modalidad:</strong> {collectionLabel}
              </p>

              <p>
                <strong>Recibe DIVINAS IMPORT:</strong> {money(amountToDivinas)}
              </p>

              {collectionType === "CONTRA_ENTREGA" && (
                <p>
                  <strong>Paga a la transportadora:</strong>{" "}
                  {money(amountToCarrier)}
                </p>
              )}

              {collectionType === "PREPAID" && (
                <p>
                  <strong>Pago anticipado a DIVINAS IMPORT:</strong>{" "}
                  {money(total)}
                </p>
              )}
            </section>
          )}

          {proforma.notes && (
            <section className="proformaReceiptNotes">
              <strong>Observaciones</strong>
              <p>{proforma.notes}</p>
            </section>
          )}

          <footer className="proformaReceiptFooter">
            <strong>¡GRACIAS POR PREFERIRNOS!</strong>

            <p>DIVINAS IMPORT · Moda para toda la familia</p>

            <small>
              {layawayReceipt
                ? "Comprobante informativo de apartado. El abono inicial queda registrado en el historial del apartado."
                : "Este documento es una proforma y no constituye comprobante de pago."}
            </small>
          </footer>
        </div>
      </div>
    </>
  );
}
