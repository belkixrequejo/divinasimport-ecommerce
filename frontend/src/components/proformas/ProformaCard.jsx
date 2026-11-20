import { useState } from "react";
import { money } from "./utils";

export default function ProformaCard({
  proforma,
  onEdit,
  onCancel,
  onConfirm,
  onDeliveryChange,
}) {
  const [processing, setProcessing] = useState(false);

  const status = proforma.status;
  const canEdit = status === "PENDIENTE";

  async function askConfirmation(message, options) {
    if (typeof window.confirmAction === "function") {
      return await window.confirmAction(message, options);
    }

    return window.confirm(message);
  }

  async function handleCancel() {
    if (processing) return;

    try {
      let accepted = false;

      if (typeof window.confirmAction === "function") {
        accepted = await window.confirmAction(
          "¿Deseas anular esta proforma? Se conservará el registro y no se eliminará su historial.",
          {
            title: "Anular proforma",
            confirmText: "Sí, anular",
            cancelText: "Volver",
          },
        );
      } else {
        accepted = window.confirm(
          "¿Deseas anular esta proforma? Se conservará el registro.",
        );
      }

      if (!accepted) return;

      setProcessing(true);

      await onCancel(proforma.id);
    } catch (error) {
      console.error("Error al anular proforma:", error);
      window.alert(error.message || "No se pudo anular la proforma.");
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
      window.alert(error.message || "No se pudo confirmar la venta.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <article className="proformaCard">
      <div className="proformaCardHeader">
        <div>
          <h3>{proforma.proforma_number}</h3>

          <span>{proforma.customers?.full_name}</span>

          <small>
            {proforma.customers?.city || "Sin ciudad"}
            {" · "}
            {proforma.customers?.phone || "Sin teléfono"}
          </small>
        </div>

        <strong>{money(proforma.total)}</strong>
      </div>

      <p className={`proformaStatus status-${status?.toLowerCase()}`}>
        Estado: <b>{status}</b>
      </p>

      <label>
        Tipo de entrega
        <select
          value={proforma.delivery_type || "POR_DEFINIR"}
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
        {proforma.proforma_items?.map((item) => (
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
            className="primary"
            disabled={processing}
            onClick={handleConfirm}
          >
            {processing ? "Procesando..." : "Confirmar venta"}
          </button>
        </div>
      )}
    </article>
  );
}
