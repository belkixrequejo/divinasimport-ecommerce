import { useEffect, useState } from "react";
import { supabase } from "../../supabase";
import ProformaCard from "./ProformaCard";
import ProformaForm from "./ProformaForm";

export default function Proformas({
  products,
  discounts,
  variants = [],
  recoveryDraft = null,
  onRecoveryDraftConsumed,
  onConfirmSale,
}) {
  const [proformas, setProformas] = useState([]);
  const [editing, setEditing] = useState(null);
  const [initialDraft, setInitialDraft] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("TODOS");

  const api = import.meta.env.VITE_API_URL;

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }

  async function request(path, options = {}) {
    const accessToken = await token();

    const response = await fetch(`${api}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Ocurrió un error.");
    }

    return data;
  }

  async function loadProformas() {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("proformas")
        .select(
          `
            *,
            customers(full_name, city, phone, address),
            proforma_items(
                *,
                products(name, code),
                product_variants(size, color, sku)
            )
            `,
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      setProformas(data || []);
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProformas();
  }, []);

  useEffect(() => {
    if (!recoveryDraft) return;

    setEditing(null);
    setInitialDraft(recoveryDraft);
    setShowForm(true);
    onRecoveryDraftConsumed?.();
  }, [recoveryDraft, onRecoveryDraftConsumed]);

  async function saveProforma(payload) {
    try {
      if (editing) {
        await request(`/admin/proformas/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });

        alert("Proforma actualizada correctamente.");
      } else {
        const result = await request("/admin/proformas", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        alert(`Proforma ${result.proforma_number} creada correctamente.`);
      }

      setShowForm(false);
      setEditing(null);
      setInitialDraft(null);
      await loadProformas();
    } catch (error) {
      alert(error.message);
    }
  }

  // Crear apartado desde una proforma pendiente.
  // El backend registra el abono inicial y reserva las existencias.
  async function createLayaway(id, payload) {
    try {
      const result = await request(`/admin/proformas/${id}/layaway`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      window.notify?.(
        "Apartado creado correctamente. Se registró el abono inicial y se reservó el stock.",
        "success",
      );

      await loadProformas();
      return result;
    } catch (error) {
      window.notify?.(
        error.message || "No se pudo crear el apartado.",
        "error",
      );
      throw error;
    }
  }

  async function cancelProforma(id) {
    try {
      await request(`/admin/proformas/${id}/cancel`, {
        method: "PATCH",
      });

      window.notify("Proforma anulada correctamente.", "success");

      await loadProformas();
    } catch (error) {
      window.notify(error.message || "No se pudo anular la proforma.", "error");

      throw error;
    }
  }

  async function changeDelivery(id, delivery) {
    try {
      await request(`/admin/proformas/${id}`, {
        method: "PUT",
        body: JSON.stringify({ delivery_type: delivery }),
      });

      await loadProformas();
    } catch (error) {
      alert(error.message);
    }
  }

  function editProforma(proforma) {
    if (proforma.status !== "PENDIENTE") {
      alert("Solo puedes editar proformas pendientes.");
      return;
    }

    setInitialDraft(null);
    setEditing(proforma);
    setShowForm(true);
  }

  function newProforma() {
    setEditing(null);
    setInitialDraft(null);
    setShowForm(true);
  }

  // Los estados se obtienen de los registros para incluir cualquier
  // estado nuevo que se agregue posteriormente al flujo de proformas.
  const availableStatuses = [
    "TODOS",
    ...Array.from(
      new Set(proformas.map((item) => item.status).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b, "es")),
  ];

  const filteredProformas = proformas.filter(
    (item) => statusFilter === "TODOS" || item.status === statusFilter,
  );

  return (
    <div className="panel">
      <div className="adminhead">
        <div>
          <h2>Gestión de proformas</h2>
          <p>Administra las proformas de la tienda y del administrador.</p>
        </div>

        <button className="primary" onClick={newProforma}>
          + Nueva proforma
        </button>
      </div>

      {showForm && (
        <ProformaForm
          products={products}
          discounts={discounts}
          variants={variants}
          proforma={editing}
          initialDraft={initialDraft}
          onSave={saveProforma}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
            setInitialDraft(null);
          }}
        />
      )}

      {!loading && proformas.length > 0 && (
        <div className="proformaStatusFilters">
          <div className="proformaStatusFiltersHeader">
            <span>Filtrar por estado</span>
            <small>
              {filteredProformas.length} de {proformas.length} proformas
            </small>
          </div>

          <div className="proformaStatusFiltersButtons">
            {availableStatuses.map((status) => (
              <button
                key={status}
                type="button"
                className={statusFilter === status ? "active" : ""}
                onClick={() => setStatusFilter(status)}
              >
                {status === "TODOS" ? "Todos" : status}
                {status !== "TODOS" && (
                  <span>
                    {proformas.filter((item) => item.status === status).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <p>Cargando proformas...</p>
      ) : proformas.length === 0 ? (
        <p>No hay proformas registradas todavía.</p>
      ) : filteredProformas.length === 0 ? (
        <p>No hay proformas con el estado seleccionado.</p>
      ) : (
        <div className="proformasList">
          {filteredProformas.map((proforma) => (
            <ProformaCard
              key={proforma.id}
              proforma={proforma}
              onEdit={editProforma}
              onCancel={cancelProforma}
              onConfirm={onConfirmSale}
              onDeliveryChange={changeDelivery}
              onLayaway={createLayaway}
            />
          ))}
        </div>
      )}
    </div>
  );
}
