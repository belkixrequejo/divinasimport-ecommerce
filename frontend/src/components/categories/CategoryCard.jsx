
export default function CategoryCard({
  category,
  onEdit,
  onToggle,
}) {
  return (
    <div className="categoryCard">
      <div className="categoryCardTop">
        <div className="categoryIcon">
          <span>▦</span>
        </div>

        <span
          className={`categoryStatus ${
            category.is_active ? "active" : "inactive"
          }`}
        >
          {category.is_active ? "Activa" : "Inactiva"}
        </span>
      </div>

      <div className="categoryCardInfo">
        <h3>{category.name}</h3>
        <p>/{category.slug}</p>
      </div>

      <div className="categoryCardDate">
        Creada:{" "}
        {category.created_at
          ? new Date(category.created_at).toLocaleDateString("es-EC")
          : "—"}
      </div>

      <div className="categoryCardActions">
        <button
          className="categoryEditButton"
          onClick={() => onEdit(category)}
        >
          Editar
        </button>

        <button
          className="categoryToggleButton"
          onClick={() => onToggle(category)}
        >
          {category.is_active ? "Desactivar" : "Activar"}
        </button>
      </div>
    </div>
  );
}
