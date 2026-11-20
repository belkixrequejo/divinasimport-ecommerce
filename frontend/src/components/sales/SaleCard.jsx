
import { Eye, Receipt, CalendarDays, UserRound } from "lucide-react";

export default function SaleCard({ sale, customer, onView }) {
  const money = (value) =>
    `$${Number(value || 0).toFixed(2)}`;

  return (
    <article className="saleCard">
      <div className="saleCardHeader">
        <div className="saleIcon">
          <Receipt size={22} />
        </div>

        <span className="saleStatus">
          Venta registrada
        </span>
      </div>

      <div className="saleNumber">
        <small>Número de venta</small>
        <h3>{sale.sale_number}</h3>
      </div>

      <div className="saleCardInfo">
        <p>
          <UserRound size={16} />
          <span>{customer?.full_name || "Cliente no disponible"}</span>
        </p>

        <p>
          <CalendarDays size={16} />
          <span>
            {sale.created_at
              ? new Date(sale.created_at).toLocaleString("es-EC")
              : "Fecha no disponible"}
          </span>
        </p>
      </div>

      <div className="saleCardTotal">
        <span>Total de venta</span>
        <strong>{money(sale.total)}</strong>
      </div>

      <button className="saleViewButton" onClick={onView}>
        <Eye size={17} />
        Ver detalle
      </button>
    </article>
  );
}
