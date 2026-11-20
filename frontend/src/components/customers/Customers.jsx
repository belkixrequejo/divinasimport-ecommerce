
import { useEffect, useState } from "react";
import { supabase } from "../../supabase";
import CustomerForm from "./CustomerForm";
import CustomerCard from "./CustomerCard";
import "./customers.css";

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error al cargar clientes:", error);
      window.notify?.("No se pudieron cargar los clientes", "error");
    } else {
      setCustomers(data || []);
    }

    setLoading(false);
  };

  const saveCustomer = async (formData) => {
    const payload = {
      full_name: formData.full_name.trim(),
      phone: formData.phone.trim() || null,
      email: formData.email.trim() || null,
      city: formData.city.trim() || null,
      address: formData.address.trim() || null,
    };

    if (!payload.full_name) {
      window.notify?.("Ingresa el nombre del cliente", "warning");
      return;
    }

    setSaving(true);

    try {
      let result;

      if (editingCustomer) {
        result = await supabase
          .from("customers")
          .update(payload)
          .eq("id", editingCustomer.id);
      } else {
        result = await supabase
          .from("customers")
          .insert([payload]);
      }

      if (result.error) throw result.error;

      window.notify?.(
        editingCustomer
          ? "Cliente actualizado correctamente"
          : "Cliente registrado correctamente",
        "success"
      );

      setShowForm(false);
      setEditingCustomer(null);
      await loadCustomers();
    } catch (error) {
      console.error("Error al guardar cliente:", error);
      window.notify?.(
        error.message || "No se pudo guardar el cliente",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  const editCustomer = (customer) => {
    setEditingCustomer(customer);
    setShowForm(true);
  };

  const deleteCustomer = async (customer) => {
    const accepted = await window.confirmAction(
      `¿Estás segura de eliminar al cliente "${customer.full_name}"?`,
      {
        title: "Eliminar cliente",
        confirmText: "Sí, eliminar",
        cancelText: "Cancelar",
        type: "warning",
      }
    );

    if (!accepted) return;

    try {
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", customer.id);

      if (error) throw error;

      window.notify?.("Cliente eliminado correctamente", "success");
      await loadCustomers();
    } catch (error) {
      console.error("Error al eliminar cliente:", error);

      window.notify?.(
        "No se pudo eliminar el cliente. Verifica si tiene proformas o ventas relacionadas.",
        "error"
      );
    }
  };

  const filteredCustomers = customers.filter((customer) => {
    const searchText = search.toLowerCase();

    return [
      customer.full_name,
      customer.phone,
      customer.email,
      customer.city,
      customer.address,
    ].some((value) =>
      String(value || "").toLowerCase().includes(searchText)
    );
  });

  return (
    <div className="customersContainer">
      <div className="customersHeader">
        <div>
          <h1>Clientes</h1>
          <p>Administra la información de tus clientes.</p>
        </div>

        <button
          className="customerPrimaryButton"
          onClick={() => {
            setEditingCustomer(null);
            setShowForm(true);
          }}
        >
          + Nuevo cliente
        </button>
      </div>

      <div className="customersToolbar">
        <input
          type="text"
          placeholder="Buscar por nombre, teléfono, correo o ciudad..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="customersSummary">
        <div>
          <strong>{customers.length}</strong>
          <span>Clientes registrados</span>
        </div>
        <div>
          <strong>{filteredCustomers.length}</strong>
          <span>Resultados encontrados</span>
        </div>
      </div>

      {loading ? (
        <p className="customersMessage">Cargando clientes...</p>
      ) : filteredCustomers.length === 0 ? (
        <div className="customersEmpty">
          <h3>No se encontraron clientes</h3>
          <p>
            {search
              ? "Intenta con otro término de búsqueda."
              : "Registra tu primer cliente para comenzar."}
          </p>
        </div>
      ) : (
        <div className="customersGrid">
          {filteredCustomers.map((customer) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              onEdit={editCustomer}
              onDelete={deleteCustomer}
            />
          ))}
        </div>
      )}

      {showForm && (
        <CustomerForm
          customer={editingCustomer}
          saving={saving}
          onClose={() => {
            setShowForm(false);
            setEditingCustomer(null);
          }}
          onSave={saveCustomer}
        />
      )}
    </div>
  );
}
