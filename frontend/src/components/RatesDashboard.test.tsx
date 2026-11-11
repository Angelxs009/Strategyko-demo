import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RatesDashboard } from "./RatesDashboard";
import type { Comparison, CompareResponse, HistoryResponse, PushResponse, RateQuote } from "@/lib/types";

// ---- Fixtures de EJEMPLO (no son tarifas reales) ----
const quote = (carrier: RateQuote["carrier"], base: number, transitDays: number): RateQuote => ({
  carrier,
  origin: "CNSHA",
  destination: "ECGYE",
  container: "40HC",
  baseFreightUsd: base,
  surcharges: [{ code: "THC", name: "Manejo en terminal (THC)", amountUsd: 300 }],
  totalUsd: base + 300,
  transitDays,
  validFrom: "2026-11-09",
  validTo: "2026-11-22",
  currency: "USD",
  source: "demo",
});

const quotes = [quote("MAERSK", 3000, 34), quote("CMA_CGM", 2800, 38), quote("HAPAG_LLOYD", 3100, 30)];

const comparison: Comparison = {
  mode: "demo",
  warning: "Datos simulados (modo demo): no son tarifas reales. No los uses para cotizar.",
  n: 3,
  cheapest: "CMA_CGM",
  fastest: "HAPAG_LLOYD",
  bestBalance: "CMA_CGM",
  ranking: [
    { rank: 1, carrier: "CMA_CGM", totalUsd: 3100, deltaUsd: 0, deltaPct: 0, transitDays: 38, usdPerTransitDay: 81.58, balanceScore: 0.3, validFrom: "2026-11-09", validTo: "2026-11-22", source: "demo" },
    { rank: 2, carrier: "MAERSK", totalUsd: 3300, deltaUsd: 200, deltaPct: 6.45, transitDays: 34, usdPerTransitDay: 97.06, balanceScore: 0.5, validFrom: "2026-11-09", validTo: "2026-11-22", source: "demo" },
    { rank: 3, carrier: "HAPAG_LLOYD", totalUsd: 3400, deltaUsd: 300, deltaPct: 9.68, transitDays: 30, usdPerTransitDay: 113.33, balanceScore: 0.7, validFrom: "2026-11-09", validTo: "2026-11-22", source: "demo" },
  ],
  spread: { usd: 300, pct: 9.68 },
  averageUsd: 3266.67,
  breakdown: [
    { code: "BASE", name: "Flete base", byCarrier: { MAERSK: 3000, CMA_CGM: 2800, HAPAG_LLOYD: 3100 } },
    { code: "THC", name: "Manejo en terminal (THC)", byCarrier: { MAERSK: 300, CMA_CGM: 300, HAPAG_LLOYD: 300 } },
  ],
  insights: ["CMA CGM es la más económica (USD 3100).", "Hapag-Lloyd es la más rápida y llega 8 días antes."],
};

const compareResponse: CompareResponse = {
  query: { origin: "CNSHA", destination: "ECGYE", container: "40HC" },
  quotes,
  errors: [],
  comparison,
};

const history: HistoryResponse = { page: 1, pageSize: 10, total: 0, items: [] };

const pushDryRun: PushResponse = {
  delivered: false,
  dryRun: true,
  status: null,
  message: "dry-run",
  payload: { schemaVersion: "1.0", dataMode: "demo", quotes },
};

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

type Handler = (url: string, init?: RequestInit) => Promise<Response>;

function mockApi(compareHandler: Handler = () => json(compareResponse)) {
  const fn = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/api/compare")) return compareHandler(url, init);
    if (url.includes("/api/rates/history")) return json(history);
    if (url.includes("/api/push")) return json(pushDryRun, 202);
    return json({ message: "no mock" }, 404);
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

/** fetch que nunca responde, pero respeta el AbortSignal como el real. */
const hangingFetch: Handler = (_url, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  });

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("RatesDashboard", () => {
  it("muestra el estado vacío inicial y el formulario con etiquetas", () => {
    mockApi();
    render(<RatesDashboard />);
    expect(screen.getByRole("heading", { name: "Comparativo de tarifas" })).toBeInTheDocument();
    expect(screen.getByLabelText("Puerto de origen (China)")).toBeInTheDocument();
    expect(screen.getByLabelText("Destino (UN/LOCODE)")).toHaveValue("ECGYE");
    expect(screen.getByLabelText("Contenedor")).toHaveValue("40HC");
    expect(screen.getByText("Aún no hay una comparación")).toBeInTheDocument();
  });

  it("renderiza resultados con aviso de modo demo, n por métrica y tablas semánticas", async () => {
    mockApi();
    const user = userEvent.setup();
    render(<RatesDashboard />);
    await user.click(screen.getByRole("button", { name: "Consultar y comparar" }));

    expect(await screen.findByText("Modo demo")).toBeInTheDocument();
    expect(screen.getByText(/no son tarifas reales/i, { selector: "p" })).toBeInTheDocument();

    const summary = screen.getByRole("region", { name: "Resumen de la comparación" });
    expect(within(summary).getAllByText("Base: 3 tarifas")).toHaveLength(4);
    expect(within(summary).getByText("Más económica").nextElementSibling).toHaveTextContent("CMA CGM");
    expect(within(summary).getByText("Más rápida").nextElementSibling).toHaveTextContent("Hapag-Lloyd");

    const ranking = screen.getByRole("table", { name: /Ranking de navieras/ });
    expect(within(ranking).getAllByRole("columnheader").length).toBeGreaterThanOrEqual(6);
    expect(within(ranking).getAllByText("Demo")).toHaveLength(3);
    expect(screen.getByRole("table", { name: /Desglose de flete base/ })).toBeInTheDocument();
    expect(screen.getByText("Hapag-Lloyd es la más rápida y llega 8 días antes.")).toBeInTheDocument();
  });

  it("no muestra aviso demo cuando todos los datos son live", async () => {
    mockApi(() => json({ ...compareResponse, comparison: { ...comparison, mode: "live", warning: null } }));
    const user = userEvent.setup();
    render(<RatesDashboard />);
    await user.click(screen.getByRole("button", { name: "Consultar y comparar" }));
    await screen.findByText("Ranking por costo total");
    expect(screen.queryByText("Modo demo")).not.toBeInTheDocument();
  });

  it("tras 8 s sin respuesta muestra el timeout con «Reintentar» y reintenta", async () => {
    vi.useFakeTimers();
    let calls = 0;
    mockApi((url, init) => {
      calls++;
      return calls === 1 ? hangingFetch(url, init) : json(compareResponse);
    });
    render(<RatesDashboard />);
    fireEvent.click(screen.getByRole("button", { name: "Consultar y comparar" }));
    expect(screen.getByText("Consultando…")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("La consulta tardó más de 8 segundos.");

    fireEvent.click(within(alert).getByRole("button", { name: "Reintentar" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText("Ranking por costo total")).toBeInTheDocument();
    expect(calls).toBe(2);
  });

  it("muestra el error 502 con el detalle por naviera", async () => {
    mockApi(() =>
      json(
        {
          statusCode: 502,
          message: "No hay suficientes tarifas para comparar (obtenidas: 0, mínimo: 2).",
          errors: [{ carrier: "MAERSK", message: "sin credenciales" }],
        },
        502,
      ),
    );
    const user = userEvent.setup();
    render(<RatesDashboard />);
    await user.click(screen.getByRole("button", { name: "Consultar y comparar" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No hay suficientes tarifas para comparar");
    expect(alert).toHaveTextContent("Maersk: sin credenciales");
    expect(within(alert).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });

  it("muestra un error de red claro si el backend no responde", async () => {
    mockApi(() => Promise.reject(new TypeError("Failed to fetch")));
    const user = userEvent.setup();
    render(<RatesDashboard />);
    await user.click(screen.getByRole("button", { name: "Consultar y comparar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo conectar con el servicio de tarifas");
  });

  it("valida el origen en el cliente y no llama a la API", async () => {
    const fetchMock = mockApi();
    const user = userEvent.setup();
    render(<RatesDashboard />);
    await user.selectOptions(screen.getByLabelText("Puerto de origen (China)"), "Otro puerto (UN/LOCODE)…");
    await user.type(screen.getByLabelText("Código UN/LOCODE del puerto de origen"), "USLAX");
    await user.click(screen.getByRole("button", { name: "Consultar y comparar" }));
    expect(await screen.findByText(/puerto de China en formato UN\/LOCODE/)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("/api/compare"))).toBe(false);
  });

  it("«Enviar a Strategyko» muestra el resultado de dry-run", async () => {
    mockApi();
    const user = userEvent.setup();
    render(<RatesDashboard />);
    await user.click(screen.getByRole("button", { name: "Consultar y comparar" }));
    await user.click(await screen.findByRole("button", { name: "Enviar a Strategyko" }));
    expect(await screen.findByText("Simulación de envío (dry-run)")).toBeInTheDocument();
    expect(screen.getByText(/Ver contenido enviado \(3 tarifas\)/)).toBeInTheDocument();
  });

  it("el historial vacío muestra su estado vacío", async () => {
    mockApi();
    render(<RatesDashboard />);
    await waitFor(() => expect(screen.getByText("Aún no hay consultas guardadas")).toBeInTheDocument());
  });
});
