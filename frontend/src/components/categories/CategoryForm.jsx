
import { useEffect, useState } from "react";

export default function CategoryForm({
  category,
  saving,
  onClose,
  onSave,
}) {
  const [name, setName] = useState("");

  useEffect(() => {
    setName(category?.name || "");
  }, [category]);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!name.trim()) {
      window.notify?.("Ingresa el nombre de la categoría", "warning");
      return;
    }

    onSave({ name });
  };

  return (
    <div className="categoryModalOverlay" onMouseDown={onClose}>
      <div
        className="categoryModal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="categoryModalHeader">
          <div>
            <h2>{category ? "Editar categoría" : "Nueva categoría"}</h2>
            <p>
              {category
                ? "Actualiza la información de la categoría."
                : "Registra una nueva categoría para tus productos."}
            </p>
          </div>

          <button
            type="button"
            className="categoryCloseButton"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label htmlFor="categoryName">Nombre de la categoría</label>

          <input
            id="categoryName"
            type="text"
            placeholder="Ej. Ropa deportiva"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            autoFocus
            required
          />

          <div className="categoryModalActions">
            <button
              type="button"
              className="categorySecondaryButton"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="categoryPrimaryButton"
              disabled={saving}
            >
              {saving
                ? "Guardando..."
                : category
                  ? "Actualizar categoría"
                  : "Crear categoría"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
