
import { useEffect, useState } from "react";
import { supabase } from "../../supabase";
import CategoryForm from "./CategoryForm";
import CategoryCard from "./CategoryCard";
import "./categories.css";

const createSlug = (name) =>
  name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export default function Categories({ onCategoriesChange }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("TODAS");

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      window.notify?.("Error al cargar las categorías", "error");
    } else {
      setCategories(data || []);
    }

    setLoading(false);
  };

  const saveCategory = async (formData) => {
    const name = formData.name.trim();
    const slug = createSlug(name);

    if (!name || !slug) {
      window.notify?.("Ingresa un nombre válido", "warning");
      return;
    }

    setSaving(true);

    try {
      let query = supabase
        .from("categories")
        .select("id")
        .or(`name.ilike.${name},slug.eq.${slug}`);

      if (editingCategory) {
        query = query.neq("id", editingCategory.id);
      }

      const { data: duplicated, error: duplicateError } = await query;

      if (duplicateError) throw duplicateError;

      if (duplicated?.length) {
        window.notify?.(
          "Ya existe una categoría con ese nombre",
          "warning"
        );
        return;
      }

      let result;

      if (editingCategory) {
        result = await supabase
          .from("categories")
          .update({ name, slug })
          .eq("id", editingCategory.id);
      } else {
        result = await supabase
          .from("categories")
          .insert([{ name, slug }]);
      }

      if (result.error) throw result.error;

      window.notify?.(
        editingCategory
          ? "Categoría actualizada correctamente"
          : "Categoría creada correctamente",
        "success"
      );

      setShowForm(false);
      setEditingCategory(null);
      await loadCategories();
    } catch (error) {
      console.error(error);
      window.notify?.("No se pudo guardar la categoría", "error");
    } finally {
      setSaving(false);
    }
  };

  const editCategory = (category) => {
    setEditingCategory(category);
    setShowForm(true);
  };

  const toggleCategory = async (category) => {
    const action = category.is_active ? "desactivar" : "activar";

    const accepted = await window.confirmAction?.(
      `¿Deseas ${action} la categoría "${category.name}"?`,
      {
        title: `${action.charAt(0).toUpperCase() + action.slice(1)} categoría`,
        confirmText: "Sí, continuar",
        cancelText: "Cancelar",
        type: "warning",
      }
    );

    if (!accepted) return;

    const { error } = await supabase
      .from("categories")
      .update({ is_active: !category.is_active })
      .eq("id", category.id);

    if (error) {
      window.notify?.("No se pudo actualizar la categoría", "error");
      return;
    }

    window.notify?.(
      `Categoría ${category.is_active ? "desactivada" : "activada"} correctamente`,
      "success"
    );

    loadCategories();
  };

  const filteredCategories = categories.filter((category) => {
    const matchesSearch = category.name
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesFilter =
      filter === "TODAS" ||
      (filter === "ACTIVAS" && category.is_active) ||
      (filter === "INACTIVAS" && !category.is_active);

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="categoriesContainer">
      <div className="categoriesHeader">
        <div>
          <h1>Categorías</h1>
          <p>Administra las categorías de tus productos.</p>
        </div>

        <button
          className="categoryPrimaryButton"
          onClick={() => {
            setEditingCategory(null);
            setShowForm(true);
          }}
        >
          + Nueva categoría
        </button>
      </div>

      <div className="categoriesToolbar">
        <input
          type="text"
          placeholder="Buscar categoría..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="TODAS">Todas</option>
          <option value="ACTIVAS">Activas</option>
          <option value="INACTIVAS">Inactivas</option>
        </select>
      </div>

      <div className="categoriesSummary">
        <div>
          <strong>{categories.length}</strong>
          <span>Total categorías</span>
        </div>
        <div>
          <strong>{categories.filter(c => c.is_active).length}</strong>
          <span>Activas</span>
        </div>
        <div>
          <strong>{categories.filter(c => !c.is_active).length}</strong>
          <span>Inactivas</span>
        </div>
      </div>

      {loading ? (
        <p className="categoriesMessage">Cargando categorías...</p>
      ) : filteredCategories.length === 0 ? (
        <p className="categoriesMessage">
          No se encontraron categorías.
        </p>
      ) : (
        <div className="categoriesGrid">
          {filteredCategories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              onEdit={editCategory}
              onToggle={toggleCategory}
            />
          ))}
        </div>
      )}

      {showForm && (
        <CategoryForm
          category={editingCategory}
          saving={saving}
          onClose={() => {
            setShowForm(false);
            setEditingCategory(null);
          }}
          onSave={saveCategory}
        />
      )}
    </div>
  );
}
