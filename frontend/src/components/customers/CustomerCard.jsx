
import {
  UserRound,
  Phone,
  Mail,
  MapPin,
  Pencil,
  Trash2,
} from "lucide-react";

export default function CustomerCard({
  customer,
  onEdit,
  onDelete,
}) {
  return (
    <article className="customerCard">
      <div className="customerCardHeader">
        <div className="customerAvatar">
          <UserRound size={23} />
        </div>

        <div className="customerCardName">
          <h3>{customer.full_name}</h3>
          <span>Cliente</span>
        </div>
      </div>

      <div className="customerCardDetails">
        <p>
          <Phone size={16} />
          <span>{customer.phone || "Sin teléfono"}</span>
        </p>

        <p>
          <Mail size={16} />
          <span>{customer.email || "Sin correo electrónico"}</span>
        </p>

        <p>
          <MapPin size={16} />
          <span>{customer.city || "Ciudad no registrada"}</span>
        </p>
      </div>

      {customer.address && (
        <div className="customerCardAddress">
          <strong>Dirección:</strong>
          <p>{customer.address}</p>
        </div>
      )}

      <div className="customerCardDate">
        Registrado:{" "}
        {customer.created_at
          ? new Date(customer.created_at).toLocaleDateString("es-EC")
          : "—"}
      </div>

      <div className="customerCardActions">
        <button
          className="customerEditButton"
          onClick={() => onEdit(customer)}
        >
          <Pencil size={15} />
          Editar
        </button>

        <button
          className="customerDeleteButton"
          onClick={() => onDelete(customer)}
        >
          <Trash2 size={15} />
          Eliminar
        </button>
      </div>
    </article>
  );
}
