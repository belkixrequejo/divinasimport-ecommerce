
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
}) {
  const [processing, setProcessing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const receiptRef = useRef(null);

  const status = proforma.status;
  const canEdit = status === "PENDIENTE";

  const items = proforma.proforma_items || [];
  const customer = proforma.customers || {};

  const totalItems = items.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );

  const subtotal = Number(
    proforma.subtotal ??
      items.reduce(
        (sum, item) =>
          sum +
          Number(
            item.line_total ??
              Number(item.unit_price || 0) * Number(item.quantity || 0)
          ),
        0
      )
  );

  const deliveryType = proforma.delivery_type || "POR_DEFINIR";

  const shippingCost =
    deliveryType === "ENVIO"
      ? Number(proforma.shipping_cost || 0)
      : 0;

  const collectionType = proforma.collection_type || "PREPAID";

  const vatAmount = Number(proforma.vat_amount || 0);

  const total = subtotal + shippingCost + vatAmount;

  const amountToDivinas =
    collectionType === "CONTRA_ENTREGA"
      ? shippingCost
      : total;

  const amountToCarrier =
    collectionType === "CONTRA_ENTREGA"
      ? subtotal
      : 0;

  const collectionLabel =
    collectionType === "CONTRA_ENTREGA"
      ? "Contra entrega"
      : "Pago anticipado";

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
          "error"
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
        }
      );

      if (!accepted) return;

      setProcessing(true);
      await onCancel(proforma.id);
    } catch (error) {
      console.error("Error al anular proforma:", error);
      window.notify?.(
        error.message || "No se pudo anular la proforma.",
        "error"
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
        }
      );

      if (!accepted) return;

      setProcessing(true);
      await onConfirm(proforma.id);
    } catch (error) {
      window.notify?.(
        error.message || "No se pudo confirmar la venta.",
        "error"
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

      const number = String(
        proforma.proforma_number || proforma.id
      ).replace(/[^a-zA-Z0-9-_]/g, "-");

      link.download = `DIVINAS-IMPORT-PROFORMA-${number}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      window.notify?.(
        "Proforma descargada correctamente.",
        "success"
      );
    } catch (error) {
      console.error("Error descargando proforma:", error);

      window.notify?.(
        "No se pudo generar la imagen de la proforma.",
        "error"
      );
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
            onChange={(e) =>
              onDeliveryChange(proforma.id, e.target.value)
            }
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
              <span>
                {item.products?.name ||
                  item.product_name_snapshot ||
                  item.product_name ||
                  "Producto"}
              </span>

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

            <button
              type="button"
              disabled={processing}
              onClick={handleCancel}
            >
              {processing ? "Procesando..." : "Anular"}
            </button>

            <button
              type="button"
              className="primary"
              disabled={processing}
              onClick={handleConfirm}
            >
              {processing
                ? "Procesando..."
                : "Confirmar venta"}
            </button>
          </div>
        )}
      </article>

      {/* Comprobante oculto para generar PNG */}
      <div className="proformaReceiptCapture">
        <div className="proformaReceipt" ref={receiptRef}>
          <header className="proformaReceiptBrand">
            <div className="proformaReceiptBrandName">
              DIVINAS <span>IMPORT</span>
            </div>

            <p>MODA PARA TODA LA FAMILIA</p>

            <div className="proformaReceiptAccent" />

            <h2>PROFORMA</h2>

            <span className="proformaReceiptStatus">
              {status}
            </span>
          </header>

          <div className="proformaReceiptNumber">
            <span>N.º DE PROFORMA</span>
            <strong>{proforma.proforma_number || "—"}</strong>
          </div>

          <section className="proformaReceiptBlock">
            <h3>DATOS DEL CLIENTE</h3>

            <p>
              <strong>Cliente:</strong>{" "}
              {customer.full_name || "No registrado"}
            </p>

            <p>
              <strong>Teléfono:</strong>{" "}
              {customer.phone || "No registrado"}
            </p>

            <p>
              <strong>Ciudad:</strong>{" "}
              {customer.city || "No registrada"}
            </p>

            {customer.address && (
              <p>
                <strong>Dirección:</strong> {customer.address}
              </p>
            )}
          </section>

          <section className="proformaReceiptBlock">
            <h3>INFORMACIÓN DE LA PROFORMA</h3>

            <p>
              <strong>Fecha:</strong> {saleDate}
            </p>

            <p>
              <strong>Tipo de entrega:</strong>{" "}
              {deliveryLabel(deliveryType)}
            </p>

            {deliveryType === "ENVIO" && (
              <p>
                <strong>Modalidad de pago:</strong>{" "}
                {collectionLabel}
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
                  Number(item.unit_price || 0) *
                    Number(item.quantity || 0)
              );

              return (
                <div
                  className="proformaReceiptProduct"
                  key={item.id}
                >
                  <div>
                    <strong>{productName}</strong>

                    <small>
                      Código:{" "}
                      {item.products?.code ||
                        item.product_code_snapshot ||
                        "—"}
                    </small>

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
                        Descuento: {item.discount_percent}%
                      </small>
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
              <strong>{money(subtotal)}</strong>
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
              <span>TOTAL DE LA PROFORMA</span>
              <strong>{money(total)}</strong>
            </div>
          </div>

          {deliveryType === "ENVIO" && (
            <section className="proformaReceiptBlock">
              <h3>RESUMEN DE PAGOS</h3>

              <p>
                <strong>Modalidad:</strong>{" "}
                {collectionLabel}
              </p>

              <p>
                <strong>Recibe DIVINAS IMPORT:</strong>{" "}
                {money(amountToDivinas)}
              </p>

              {collectionType === "CONTRA_ENTREGA" && (
                <p>
                  <strong>
                    Paga a la transportadora:
                  </strong>{" "}
                  {money(amountToCarrier)}
                </p>
              )}

              {collectionType === "PREPAID" && (
                <p>
                  <strong>
                    Pago anticipado a DIVINAS IMPORT:
                  </strong>{" "}
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
              Este documento es una proforma y no constituye
              comprobante de pago.
            </small>
          </footer>
        </div>
      </div>
    </>
  );
}
