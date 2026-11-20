import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase";
import {
  Search,
  Plus,
  History,
  RefreshCw,
  X,
  Package,
  AlertTriangle,
  Boxes,
} from "lucide-react";
import "./inventory.css";

const moneyStock = (value) => Number(value || 0).toLocaleString("es-EC");

export default function Inventory() {
  const [rows, setRows] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("todos");
  const [modal, setModal] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    type: "entrada",
    quantity: "1",
    reason: "Compra de mercadería",
    notes: "",
  });

  async function load() {
    setLoading(true);
    setError("");
    const { data, error: queryError } = await supabase
      .from("product_variants")
      .select(
        "id, product_id, size, color, sku, stock, products(name, code, image_url)",
      )
      .order("created_at", { ascending: false });
    if (queryError)
      setError(`No se pudo cargar el inventario: ${queryError.message}`);
    else setRows(data || []);
    setLoading(false);
  }

  async function loadMovements() {
    const { data, error: queryError } = await supabase
      .from("inventory_movements")
      .select(
        "id, variant_id, movement_type, quantity, stock_before, stock_after, reason, notes, created_at, product_variants(size, color, sku, products(name, code))",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (queryError)
      setError(`No se pudo cargar el historial: ${queryError.message}`);
    else setMovements(data || []);
  }

  useEffect(() => {
    load();
  }, []);

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const product = row.products || {};
        const text =
          `${product.name || ""} ${product.code || ""} ${row.sku || ""} ${row.size || ""} ${row.color || ""}`.toLowerCase();
        const matches = text.includes(search.toLowerCase());
        const status =
          filter === "disponible"
            ? row.stock > 0
            : filter === "agotado"
              ? row.stock === 0
              : filter === "bajo"
                ? row.stock > 0 && row.stock <= 5
                : true;
        return matches && status;
      }),
    [rows, search, filter],
  );

  const totalUnits = rows.reduce((sum, row) => sum + Number(row.stock || 0), 0);
  const outOfStock = rows.filter((row) => Number(row.stock) === 0).length;
  const lowStock = rows.filter(
    (row) => Number(row.stock) > 0 && Number(row.stock) <= 5,
  ).length;

  function openMovement(row) {
    setSelected(row);
    setForm({
      type: "entrada",
      quantity: "1",
      reason: "Compra de mercadería",
      notes: "",
    });
    setError("");
    setModal(true);
  }

  async function saveMovement(event) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc(
      "register_inventory_movement",
      {
        p_variant_id: selected.id,
        p_movement_type: form.type,
        p_quantity: Number(form.quantity),
        p_reason: form.reason,
        p_notes: form.notes.trim() || null,
      },
    );
    if (rpcError) {
      setError(rpcError.message);
      setSaving(false);
      return;
    }
    setModal(false);
    setSelected(null);
    await load();
    if (historyOpen) await loadMovements();
    setSaving(false);
  }

  async function toggleHistory() {
    if (!historyOpen) await loadMovements();
    setHistoryOpen((value) => !value);
  }

  return (
    <div className="panel inventoryPanel">
      <div className="inventoryHeading">
        <div>
          <h2>Control de inventario</h2>
          <p>
            Consulta y administra las existencias por producto, talla y color.
          </p>
        </div>
        <div className="inventoryHeaderActions">
          <button type="button" className="inventorySecondary" onClick={load}>
            <RefreshCw size={16} /> Actualizar
          </button>
          <button
            type="button"
            className="inventorySecondary"
            onClick={toggleHistory}
          >
            <History size={16} />{" "}
            {historyOpen ? "Ocultar historial" : "Historial"}
          </button>
        </div>
      </div>

      <div className="inventoryStats">
        <div>
          <span>
            <Boxes size={18} /> Unidades disponibles
          </span>
          <strong>{moneyStock(totalUnits)}</strong>
        </div>
        <div>
          <span>
            <Package size={18} /> Variantes registradas
          </span>
          <strong>{moneyStock(rows.length)}</strong>
        </div>
        <div>
          <span>
            <AlertTriangle size={18} /> Stock bajo (1–5)
          </span>
          <strong>{moneyStock(lowStock)}</strong>
        </div>
        <div>
          <span>
            <AlertTriangle size={18} /> Agotadas
          </span>
          <strong>{moneyStock(outOfStock)}</strong>
        </div>
      </div>

      <div className="inventoryToolbar">
        <label className="inventorySearch">
          <Search size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto, código, talla, color o SKU..."
          />
        </label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filtrar inventario"
        >
          <option value="todos">Todas las existencias</option>
          <option value="disponible">Con stock</option>
          <option value="bajo">Stock bajo (1–5)</option>
          <option value="agotado">Agotadas</option>
        </select>
      </div>

      {error && !modal && <div className="inventoryError">{error}</div>}
      {loading ? (
        <p className="inventoryEmpty">Cargando inventario...</p>
      ) : filteredRows.length === 0 ? (
        <p className="inventoryEmpty">
          No se encontraron variantes para este filtro.
        </p>
      ) : (
        <div className="inventoryTableWrap">
          <table className="inventoryTable">
            <thead>
              <tr>
                <th>Producto</th>
                <th>SKU</th>
                <th>Talla</th>
                <th>Color</th>
                <th>Existencias</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>
                      {row.products?.name || "Producto sin nombre"}
                    </strong>
                    <small>{row.products?.code || "Sin código"}</small>
                  </td>
                  <td>{row.sku || "—"}</td>
                  <td>{row.size || "Única"}</td>
                  <td>{row.color || "—"}</td>
                  <td>
                    <strong>{moneyStock(row.stock)}</strong>
                  </td>
                  <td>
                    <span
                      className={`inventoryStatus ${row.stock === 0 ? "isOut" : row.stock <= 5 ? "isLow" : "isAvailable"}`}
                    >
                      {row.stock === 0
                        ? "Agotado"
                        : row.stock <= 5
                          ? "Stock bajo"
                          : "Disponible"}
                    </span>
                  </td>
                  <td>
                    <button
                      className="inventoryAction"
                      onClick={() => openMovement(row)}
                    >
                      <Plus size={15} /> Movimiento
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {historyOpen && (
        <section className="inventoryHistory">
          <h3>Historial de movimientos recientes</h3>
          {movements.length === 0 ? (
            <p>No hay movimientos registrados todavía.</p>
          ) : (
            <div className="inventoryTableWrap">
              <table className="inventoryTable">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Producto / Variante</th>
                    <th>Movimiento</th>
                    <th>Cantidad</th>
                    <th>Antes</th>
                    <th>Después</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {new Date(item.created_at).toLocaleString("es-EC")}
                      </td>
                      <td>
                        <strong>
                          {item.product_variants?.products?.name || "Producto"}
                        </strong>
                        <small>
                          {item.product_variants?.size || "Única"} ·{" "}
                          {item.product_variants?.color || "Sin color"}
                        </small>
                      </td>
                      <td>{item.movement_type}</td>
                      <td>{item.quantity}</td>
                      <td>{item.stock_before}</td>
                      <td>{item.stock_after}</td>
                      <td>{item.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {modal && (
        <div className="inventoryModalOverlay">
          <form className="inventoryModal" onSubmit={saveMovement}>
            <button
              type="button"
              className="inventoryClose"
              onClick={() => setModal(false)}
              aria-label="Cerrar"
            >
              <X />
            </button>
            <h3>Registrar movimiento</h3>
            <p className="inventorySelected">
              {selected?.products?.name} · {selected?.size || "Única"} ·{" "}
              {selected?.color || "Sin color"}
            </p>
            <p className="inventoryCurrent">
              Stock actual: <strong>{selected?.stock}</strong>
            </p>
            <label>
              Tipo de movimiento
              <select
                value={form.type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    type: e.target.value,
                    reason:
                      e.target.value === "entrada"
                        ? "Compra de mercadería"
                        : e.target.value === "salida"
                          ? "Merma o daño"
                          : "Conteo físico",
                  })
                }
              >
                <option value="entrada">Entrada</option>
                <option value="salida">Salida</option>
                <option value="ajuste">Ajuste (stock final real)</option>
              </select>
            </label>
            <label>
              {form.type === "ajuste"
                ? "Cantidad real en existencia"
                : "Cantidad de unidades"}
              <input
                type="number"
                min={form.type === "ajuste" ? "0" : "1"}
                step="1"
                required
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </label>
            <label>
              Motivo
              <select
                required
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              >
                {(form.type === "entrada"
                  ? [
                      "Compra de mercadería",
                      "Fabricación",
                      "Devolución de cliente",
                      "Otro",
                    ]
                  : form.type === "salida"
                    ? [
                        "Merma o daño",
                        "Uso interno",
                        "Devolución a proveedor",
                        "Otro",
                      ]
                    : ["Conteo físico", "Corrección de inventario", "Otro"]
                ).map((reason) => (
                  <option key={reason}>{reason}</option>
                ))}
              </select>
            </label>
            <label>
              Observaciones (opcional)
              <textarea
                rows="3"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Detalle adicional..."
              />
            </label>
            {error && <div className="inventoryError">{error}</div>}
            <div className="inventoryModalActions">
              <button
                type="button"
                className="inventorySecondary"
                onClick={() => setModal(false)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inventorySubmit"
                disabled={saving}
              >
                {saving ? "Guardando..." : "Guardar movimiento"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
