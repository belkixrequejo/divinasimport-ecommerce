
import { useEffect, useState } from "react";

const initialForm = {
  full_name: "",
  phone: "",
  email: "",
  city: "",
  address: "",
};

export default function CustomerForm({
  customer,
  saving,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    if (customer) {
      setForm({
        full_name: customer.full_name || "",
        phone: customer.phone || "",
        email: customer.email || "",
        city: customer.city || "",
        address: customer.address || "",
      });
    } else {
      setForm(initialForm);
    }
  }, [customer]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!form.full_name.trim()) {
      window.notify?.("Ingresa el nombre del cliente", "warning");
      return;
    }

    onSave(form);
  };

  return (
    <div className="customerModalOverlay" onMouseDown={onClose}>
      <div
        className="customerModal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="customerModalHeader">
          <div>
            <h2>
              {customer ? "Editar cliente" : "Nuevo cliente"}
            </h2>
            <p>
              {customer
                ? "Actualiza los datos del cliente."
                : "Completa la información para registrar un cliente."}
            </p>
          </div>

          <button
            type="button"
            className="customerCloseButton"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="customerFormGrid">
            <label className="customerFullWidth">
              Nombres y apellidos *
              <input
                name="full_name"
                value={form.full_name}
                onChange={handleChange}
                placeholder="Ej. María Fernanda Pérez"
                maxLength={150}
                required
                autoFocus
              />
            </label>

            <label>
              Teléfono / WhatsApp
              <input
                name="phone"
                type="tel"
                inputMode="tel"
                value={form.phone}
                onChange={handleChange}
                placeholder="Ej. 0987654321"
                maxLength={30}
              />
            </label>

            <label>
              Correo electrónico
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="cliente@correo.com"
                maxLength={150}
              />
            </label>

            <label className="customerFullWidth">
              Ciudad
              <input
                name="city"
                value={form.city}
                onChange={handleChange}
                placeholder="Ej. Santo Domingo"
                maxLength={100}
              />
            </label>

            <label className="customerFullWidth">
              Dirección
              <textarea
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="Dirección del cliente"
                rows={3}
                maxLength={300}
              />
            </label>
          </div>

          <div className="customerModalActions">
            <button
              type="button"
              className="customerSecondaryButton"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="customerPrimaryButton"
              disabled={saving}
            >
              {saving
                ? "Guardando..."
                : customer
                  ? "Actualizar cliente"
                  : "Registrar cliente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
