
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase";
import SaleCard from "./SaleCard";
import SaleDetail from "./SaleDetail";
import SaleForm from "./SaleForm";
import "./sales.css";

export default function Sales() {
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedSale, setSelectedSale] = useState(null);
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    loadSales();
  }, []);

  const loadSales = async () => {
    setLoading(true);

    try {
      const [salesResult, customersResult] = await Promise.all([
        supabase
          .from("sales")
          .select("*")
          .order("created_at", { ascending: false }),

        supabase
          .from("customers")
          .select("id, full_name, phone, city"),
      ]);

      if (salesResult.error) throw salesResult.error;
      if (customersResult.error) throw customersResult.error;

      setSales(salesResult.data || []);
      setCustomers(customersResult.data || []);
    } catch (error) {
      console.error("Error al cargar ventas:", error);
      window.notify?.("No se pudieron cargar las ventas", "error");
    } finally {
      setLoading(false);
    }
  };

  const customerById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers]
  );

  const filteredSales = useMemo(() => {
    const term = search.trim().toLowerCase();

    return sales.filter((sale) => {
      const customer = customerById.get(sale.customer_id);

      const matchesSearch =
        !term ||
        [
          sale.sale_number,
          sale.payment_method,
          sale.payment_reference,
          customer?.full_name,
          customer?.phone,
        ].some((value) =>
          String(value || "").toLowerCase().includes(term)
        );

      const saleDate = sale.created_at
        ? new Date(sale.created_at).toISOString().slice(0, 10)
        : "";

      const matchesFrom = !dateFrom || saleDate >= dateFrom;
      const matchesTo = !dateTo || saleDate <= dateTo;

      return matchesSearch && matchesFrom && matchesTo;
    });
  }, [sales, customerById, search, dateFrom, dateTo]);

  const totalSales = sales.reduce(
    (sum, sale) => sum + Number(sale.total || 0),
    0
  );

  const filteredTotal = filteredSales.reduce(
    (sum, sale) => sum + Number(sale.total || 0),
    0
  );

  const money = (value) => `$${Number(value || 0).toFixed(2)}`;

  return (
    <div className="salesContainer">
      <div className="salesHeader">
        <div>
          <h1>Ventas</h1>
          <p>Consulta y registra las ventas de DIVINAS IMPORT.</p>
        </div>

        <div className="salesHeaderActions">
          <button
            className="salesNewButton"
            onClick={() => setShowSaleForm(true)}
          >
            + Nueva venta
          </button>

          <button
            className="salesRefreshButton"
            onClick={loadSales}
            disabled={loading}
          >
            Actualizar listado
          </button>
        </div>
      </div>

      <div className="salesSummary">
        <div className="salesSummaryCard">
          <span>Total de ventas</span>
          <strong>{sales.length}</strong>
        </div>

        <div className="salesSummaryCard">
          <span>Facturación acumulada</span>
          <strong>{money(totalSales)}</strong>
        </div>

        <div className="salesSummaryCard">
          <span>Ventas encontradas</span>
          <strong>{filteredSales.length}</strong>
        </div>

        <div className="salesSummaryCard">
          <span>Total del resultado</span>
          <strong>{money(filteredTotal)}</strong>
        </div>
      </div>

      <div className="salesFilters">
        <input
          type="search"
          placeholder="Buscar por número, cliente o teléfono..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <label>
          Desde
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </label>

        <label>
          Hasta
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </label>

        <button
          className="salesClearButton"
          onClick={() => {
            setSearch("");
            setDateFrom("");
            setDateTo("");
          }}
        >
          Limpiar
        </button>
      </div>

      {loading ? (
        <p className="salesMessage">Cargando ventas...</p>
      ) : filteredSales.length === 0 ? (
        <div className="salesEmpty">
          <h3>No hay ventas para mostrar</h3>
          <p>
            Puedes registrar una venta directa con el botón Nueva venta.
          </p>
        </div>
      ) : (
        <div className="salesGrid">
          {filteredSales.map((sale) => (
            <SaleCard
              key={sale.id}
              sale={sale}
              customer={customerById.get(sale.customer_id)}
              onView={() => setSelectedSale(sale)}
            />
          ))}
        </div>
      )}

      {selectedSale && (
        <SaleDetail
          sale={selectedSale}
          customer={customerById.get(selectedSale.customer_id)}
          onClose={() => setSelectedSale(null)}
        />
      )}

      {showSaleForm && (
        <SaleForm
          onClose={() => setShowSaleForm(false)}
          onSuccess={loadSales}
        />
      )}
    </div>
  );
}
