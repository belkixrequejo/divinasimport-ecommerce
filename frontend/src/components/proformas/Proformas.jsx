
import { useEffect, useState } from "react";
import { supabase } from "../../supabase";
import ProformaCard from "./ProformaCard";
import ProformaForm from "./ProformaForm";

export default function Proformas({
  products,
  discounts,
  onConfirmSale,
}) {
  const [proformas, setProformas] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

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
          "*,customers(full_name,city,phone),proforma_items(*,products(name,code))"
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
      await loadProformas();
    } catch (error) {
      alert(error.message);
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
    window.notify(
      error.message || "No se pudo anular la proforma.",
      "error"
    );

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

    setEditing(proforma);
    setShowForm(true);
  }

  function newProforma() {
    setEditing(null);
    setShowForm(true);
  }

  return (
    <div className="panel">
      <div className="adminhead">
        <div>
          <h2>Gestión de proformas</h2>
          <p>
            Administra las proformas de la tienda y del administrador.
          </p>
        </div>

        <button className="primary" onClick={newProforma}>
          + Nueva proforma
        </button>
      </div>

      {showForm && (
        <ProformaForm
          products={products}
          discounts={discounts}
          proforma={editing}
          onSave={saveProforma}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      {loading ? (
        <p>Cargando proformas...</p>
      ) : proformas.length === 0 ? (
        <p>No hay proformas registradas todavía.</p>
      ) : (
        <div className="proformasList">
          {proformas.map((proforma) => (
            <ProformaCard
              key={proforma.id}
              proforma={proforma}
              onEdit={editProforma}
              onCancel={cancelProforma}
              onConfirm={onConfirmSale}
              onDeliveryChange={changeDelivery}
            />
          ))}
        </div>
      )}
    </div>
  );
}
