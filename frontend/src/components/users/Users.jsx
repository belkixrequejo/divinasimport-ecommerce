import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase";
import {
  Search,
  Plus,
  RefreshCw,
  Pencil,
  UserCheck,
  UserX,
  X,
  ShieldCheck,
  Users as UsersIcon,
} from "lucide-react";
import "./users.css";

const API_URL = import.meta.env.VITE_API_URL;
const emptyForm = {
  full_name: "",
  email: "",
  password: "",
  role: "VENDEDORA",
  is_active: true,
};

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("TODOS");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  };

  async function request(path, options = {}) {
    const token = await getToken();
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(data.error || "No se pudo completar la operación");
    return data;
  }

  async function loadUsers() {
    setLoading(true);
    setError("");
    try {
      const data = await request("/admin/users");
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = useMemo(
    () =>
      users.filter((u) => {
        const matches = `${u.full_name || ""} ${u.email || ""} ${u.role || ""}`
          .toLowerCase()
          .includes(query.toLowerCase());
        const status =
          filter === "TODOS" ||
          (filter === "ACTIVOS" ? u.is_active : !u.is_active);
        return matches && status;
      }),
    [users, query, filter],
  );

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModal(true);
  }

  function openEdit(user) {
    setEditing(user);
    setForm({
      full_name: user.full_name || "",
      email: user.email || "",
      password: "",
      role: user.role,
      is_active: user.is_active,
    });
    setError("");
    setModal(true);
  }

  async function saveUser(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editing) {
        await request(`/admin/users/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify({
            full_name: form.full_name.trim(),
            email: form.email.trim(),
            role: form.role,
            is_active: form.is_active,
          }),
        });
        setNotice("Usuario actualizado correctamente");
      } else {
        await request("/admin/users", {
          method: "POST",
          body: JSON.stringify({
            ...form,
            full_name: form.full_name.trim(),
            email: form.email.trim(),
          }),
        });
        setNotice("Usuario creado correctamente");
      }
      setModal(false);
      await loadUsers();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user) {
    const action = user.is_active ? "desactivar" : "activar";
    if (!window.confirm(`¿Deseas ${action} a ${user.full_name || user.email}?`))
      return;
    setError("");
    try {
      await request(`/admin/users/${user.id}`, {
        method: "PUT",
        body: JSON.stringify({ is_active: !user.is_active }),
      });
      setNotice(
        `Usuario ${user.is_active ? "desactivado" : "activado"} correctamente`,
      );
      await loadUsers();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <section className="users-module">
      <div className="users-panel">
        <div className="users-heading">
          <div>
            <h2>Administración de usuarios</h2>
            <p>Gestiona las cuentas, roles y accesos al sistema.</p>
          </div>
          <div className="users-actions">
            <button className="users-btn secondary" onClick={loadUsers}>
              <RefreshCw size={16} /> Actualizar
            </button>
            <button className="users-btn primary" onClick={openCreate}>
              <Plus size={17} /> Nuevo usuario
            </button>
          </div>
        </div>

        <div className="users-stats">
          <div>
            <span>
              <UsersIcon size={17} /> Usuarios registrados
            </span>
            <strong>{users.length}</strong>
          </div>
          <div>
            <span>
              <UserCheck size={17} /> Activos
            </span>
            <strong>{users.filter((u) => u.is_active).length}</strong>
          </div>
          <div>
            <span>
              <ShieldCheck size={17} /> Administradores
            </span>
            <strong>
              {users.filter((u) => u.role === "ADMIN" && u.is_active).length}
            </strong>
          </div>
          <div>
            <span>
              <UsersIcon size={17} /> Vendedoras
            </span>
            <strong>
              {
                users.filter((u) => u.role === "VENDEDORA" && u.is_active)
                  .length
              }
            </strong>
          </div>
        </div>

        <div className="users-toolbar">
          <div className="users-search">
            <Search size={18} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o correo..."
            />
          </div>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="TODOS">Todos los usuarios</option>
            <option value="ACTIVOS">Activos</option>
            <option value="INACTIVOS">Inactivos</option>
          </select>
        </div>

        {error && !modal && <div className="users-alert">{error}</div>}
        {notice && <div className="users-notice">{notice}</div>}

        {loading ? (
          <p className="users-empty">Cargando usuarios...</p>
        ) : (
          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th>USUARIO</th>
                  <th>CORREO</th>
                  <th>ROL</th>
                  <th>ESTADO</th>
                  <th>REGISTRO</th>
                  <th>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.full_name || "Sin nombre"}</strong>
                    </td>
                    <td>{u.email || "—"}</td>
                    <td>
                      <span
                        className={`users-role ${u.role === "ADMIN" ? "admin" : "seller"}`}
                      >
                        {u.role === "ADMIN" ? "Administrador" : "Vendedora"}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`users-status ${u.is_active ? "active" : "inactive"}`}
                      >
                        {u.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td>
                      {u.created_at
                        ? new Date(u.created_at).toLocaleDateString("es-EC")
                        : "—"}
                    </td>
                    <td>
                      <div className="users-row-actions">
                        <button title="Editar" onClick={() => openEdit(u)}>
                          <Pencil size={16} />
                        </button>
                        <button
                          title={u.is_active ? "Desactivar" : "Activar"}
                          onClick={() => toggleActive(u)}
                        >
                          {u.is_active ? (
                            <UserX size={16} />
                          ) : (
                            <UserCheck size={16} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredUsers.length && (
                  <tr>
                    <td colSpan="6" className="users-empty">
                      No se encontraron usuarios.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <div
          className="users-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal(false);
          }}
        >
          <form className="users-modal" onSubmit={saveUser}>
            <button
              type="button"
              className="users-close"
              onClick={() => setModal(false)}
            >
              <X size={20} />
            </button>
            <h3>{editing ? "Editar usuario" : "Nuevo usuario"}</h3>
            <p>
              {editing
                ? "Actualiza los datos y permisos de acceso."
                : "Crea una cuenta para acceder al administrador."}
            </p>
            <label>
              Nombre completo
              <input
                required
                value={form.full_name}
                onChange={(e) =>
                  setForm({ ...form, full_name: e.target.value })
                }
              />
            </label>
            <label>
              Correo electrónico
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            {!editing && (
              <label>
                Contraseña temporal
                <input
                  required
                  minLength={8}
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  placeholder="Mínimo 8 caracteres"
                />
              </label>
            )}
            <label>
              Rol
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="VENDEDORA">Vendedora</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </label>
            {editing && (
              <label className="users-check">
                <input
                  type="checkbox"
                  checked={!!form.is_active}
                  onChange={(e) =>
                    setForm({ ...form, is_active: e.target.checked })
                  }
                />{" "}
                Usuario activo
              </label>
            )}
            {error && <div className="users-alert">{error}</div>}
            <div className="users-modal-actions">
              <button
                type="button"
                className="users-btn secondary"
                onClick={() => setModal(false)}
              >
                Cancelar
              </button>
              <button className="users-btn primary" disabled={saving}>
                {saving
                  ? "Guardando..."
                  : editing
                    ? "Guardar cambios"
                    : "Crear usuario"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
