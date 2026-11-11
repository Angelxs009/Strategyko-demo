import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RatesDashboard } from "./RatesDashboard";
import type { Departure, HistoryResponse, SchedulesResponse, TrackingResponse } from "@/lib/types";

// ---- Fixtures de EJEMPLO (no son datos reales) ----
const dep = (carrier: Departure["carrier"], etd: string, eta: string, transitDays: number, vessel: string): Departure => ({
  carrier,
  origin: "CNSHA",
  destination: "ECGYE",
  vessel,
  voyage: "4626E",
  service: "DEMO-PAC-A",
  etd,
  eta,
  transitDays,
  source: "demo",
});

const schedules: SchedulesResponse = {
  query: { origin: "CNSHA", destination: "ECGYE", weeks: 4 },
  n: 3,
  mode: "demo",
  warning: "Salidas simuladas (modo demo): no son datos reales. No los uses para operar.",
  departures: [
    dep("HAPAG_LLOYD", "2026-11-17", "2026-12-19", 32, "DEMO ATLAS"),
    dep("MAERSK", "2026-11-12", "2026-12-16", 34, "DEMO AURORA"),
    dep("CMA_CGM", "2026-11-14", "2026-12-22", 38, "DEMO CORAL"),
  ].sort((a, b) => a.etd.localeCompare(b.etd)),
  errors: [],
};

const tracking: TrackingResponse = {
  mode: "demo",
  warning: "Seguimiento y eventos simulados (modo demo): no son datos reales. No los uses para operar.",
  tracking: {
    carrier: "MAERSK",
    reference: "CSQU3054383",
    referenceType: "container",
    status: "IN_TRANSIT",
    vessel: "DEMO AURORA",
    voyage: "4626E",
    origin: "CNSHA",
    destination: "ECGYE",
    eta: "2026-12-16",
    source: "demo",
    events: [
      { code: "GATE_IN", description: "Ingreso de la carga a la terminal de origen", location: "CNSHA", locationName: "Shanghái", date: "2026-11-01", completed: true },
      { code: "DEPARTED", description: "Zarpe del buque", location: "CNSHA", locationName: "Shanghái", date: "2026-11-04", completed: true },
      { code: "ARRIVED", description: "Arribo del buque al puerto de destino", location: "ECGYE", locationName: "Guayaquil", date: "2026-12-16", completed: false },
    ],
  },
};

const history: HistoryResponse = { page: 1, pageSize: 10, total: 0, items: [] };

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

type Handler = (url: string, init?: RequestInit) => Promise<Response>;

function mockApi(handlers: { schedules?: Handler; tracking?: Handler } = {}) {
  const fn = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/api/schedules")) return (handlers.schedules ?? (() => json(schedules)))(url, init);
    if (url.includes("/api/tracking/")) return (handlers.tracking ?? (() => json(tracking)))(url, init);
    if (url.includes("/api/rates/history")) return json(history);
    return json({ message: "no mock" }, 404);
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const hangingFetch: Handler = (_url, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  });

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const goTo = async (name: string) => {
  const user = userEvent.setup();
  await user.click(screen.getByRole("tab", { name }));
  return user;
};

describe("Pestañas", () => {
  it("muestra Tarifas por defecto y cambia de sección con clic", async () => {
    mockApi();
    render(<RatesDashboard />);
    expect(screen.getByRole("tab", { name: "Tarifas" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Comparativo de tarifas" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Próximas salidas" })).not.toBeInTheDocument();

    await goTo("Próximas salidas");
    expect(screen.getByRole("tab", { name: "Próximas salidas" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Próximas salidas" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Comparativo de tarifas" })).not.toBeInTheDocument();
  });

  it("se navega con el teclado (flechas, Inicio y Fin)", async () => {
    mockApi();
    render(<RatesDashboard />);
    const user = userEvent.setup();
    screen.getByRole("tab", { name: "Tarifas" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Próximas salidas" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Próximas salidas" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Seguimiento" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Tarifas" })).toHaveAttribute("aria-selected", "true");
  });

  it("conserva los resultados de una sección al volver a ella", async () => {
    mockApi();
    render(<RatesDashboard />);
    const user = await goTo("Próximas salidas");
    await user.click(screen.getByRole("button", { name: "Buscar salidas" }));
    await screen.findByText("Calendario de salidas");
    await user.click(screen.getByRole("tab", { name: "Seguimiento" }));
    await user.click(screen.getByRole("tab", { name: "Próximas salidas" }));
    expect(screen.getByText("Calendario de salidas")).toBeInTheDocument();
  });
});

describe("Próximas salidas", () => {
  it("muestra el estado vacío inicial", async () => {
    mockApi();
    render(<RatesDashboard />);
    await goTo("Próximas salidas");
    expect(screen.getByText("Aún no hay una búsqueda")).toBeInTheDocument();
    expect(screen.getByLabelText("Semanas a mostrar")).toHaveValue("4");
  });

  it("renderiza el calendario con aviso demo, n y la próxima salida", async () => {
    const fetchMock = mockApi();
    render(<RatesDashboard />);
    const user = await goTo("Próximas salidas");
    await user.selectOptions(screen.getByLabelText("Semanas a mostrar"), "6");
    await user.click(screen.getByRole("button", { name: "Buscar salidas" }));

    expect(await screen.findByText("Modo demo")).toBeInTheDocument();
    const summary = screen.getByRole("region", { name: "Resumen de salidas" });
    expect(within(summary).getAllByText("Base: 3 salidas")).toHaveLength(3);
    expect(within(summary).getByText("Próxima salida").nextElementSibling).toHaveTextContent("12/11/2026");
    expect(within(summary).getByText("Tránsito más corto").nextElementSibling).toHaveTextContent("32 días");

    const table = screen.getByRole("table", { name: /Próximas salidas por naviera/ });
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(4); // encabezado + 3
    expect(within(rows[1]).getByText("Próxima")).toBeInTheDocument();
    expect(within(table).getAllByText("Demo")).toHaveLength(3);
    expect(within(table).getByText(/DEMO AURORA/)).toBeInTheDocument();

    const url = String(fetchMock.mock.calls.find(([u]) => String(u).includes("/api/schedules"))![0]);
    expect(url).toContain("origin=CNSHA");
    expect(url).toContain("weeks=6");
  });

  it("si no hay salidas muestra el estado vacío y los errores por naviera", async () => {
    mockApi({
      schedules: () =>
        json({
          ...schedules,
          n: 0,
          departures: [],
          errors: [{ carrier: "MAERSK", message: "contrato no verificado" }],
        }),
    });
    render(<RatesDashboard />);
    const user = await goTo("Próximas salidas");
    await user.click(screen.getByRole("button", { name: "Buscar salidas" }));
    expect(await screen.findByText("No hay salidas para mostrar")).toBeInTheDocument();
    expect(screen.getByText("Maersk: contrato no verificado")).toBeInTheDocument();
  });

  it("tras 8 s sin respuesta muestra el timeout con «Reintentar»", async () => {
    vi.useFakeTimers();
    mockApi({ schedules: hangingFetch });
    render(<RatesDashboard />);
    fireEvent.click(screen.getByRole("tab", { name: "Próximas salidas" }));
    fireEvent.click(screen.getByRole("button", { name: "Buscar salidas" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("La consulta tardó más de 8 segundos.");
    expect(within(alert).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });

  it("valida el origen en el cliente", async () => {
    const fetchMock = mockApi();
    render(<RatesDashboard />);
    const user = await goTo("Próximas salidas");
    const panel = within(screen.getByRole("tabpanel"));
    await user.selectOptions(panel.getByLabelText("Puerto de origen (China)"), "Otro puerto (UN/LOCODE)…");
    await user.type(panel.getByLabelText("Código UN/LOCODE del puerto de origen"), "USLAX");
    await user.click(screen.getByRole("button", { name: "Buscar salidas" }));
    expect(await screen.findByText(/puerto de China en formato UN\/LOCODE/)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("/api/schedules"))).toBe(false);
  });
});

describe("Seguimiento", () => {
  const search = async (reference: string) => {
    const user = await goTo("Seguimiento");
    await user.type(screen.getByLabelText("Número de contenedor o BL"), reference);
    await user.click(screen.getByRole("button", { name: "Rastrear" }));
    return user;
  };

  it("muestra el estado vacío inicial y las instrucciones", async () => {
    mockApi();
    render(<RatesDashboard />);
    await goTo("Seguimiento");
    expect(screen.getByText("Aún no hay un seguimiento")).toBeInTheDocument();
    expect(screen.getByText(/se valida el dígito verificador/)).toBeInTheDocument();
  });

  it("no consulta si la referencia está vacía", async () => {
    const fetchMock = mockApi();
    render(<RatesDashboard />);
    const user = await goTo("Seguimiento");
    await user.click(screen.getByRole("button", { name: "Rastrear" }));
    expect(screen.getByText("Ingresa un número de contenedor o un BL.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("/api/tracking/"))).toBe(false);
  });

  it("renderiza estado, ETA, aviso demo y la línea de tiempo con Realizado/Previsto", async () => {
    const fetchMock = mockApi();
    render(<RatesDashboard />);
    await search("csqu3054383");

    expect(await screen.findByText("Modo demo")).toBeInTheDocument();
    expect(screen.getByText(/Seguimiento y eventos simulados/)).toBeInTheDocument();
    const summary = screen.getByRole("region", { name: "Resumen del seguimiento" });
    expect(within(summary).getByText("En tránsito")).toBeInTheDocument();
    expect(within(summary).getByText(/Contenedor CSQU3054383/)).toBeInTheDocument();
    expect(within(summary).getByText("Base: 2 de 3 eventos realizados")).toBeInTheDocument();
    expect(within(summary).getByText("Llegada estimada (ETA)").nextElementSibling).toHaveTextContent("16/12/2026");

    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(within(items[0]).getByText("Realizado")).toBeInTheDocument();
    expect(within(items[2]).getByText("Previsto")).toBeInTheDocument();
    expect(within(items[1]).getByText(/Shanghái \(CNSHA\) · 04\/11\/2026/)).toBeInTheDocument();

    const url = String(fetchMock.mock.calls.find(([u]) => String(u).includes("/api/tracking/"))![0]);
    expect(url).toContain("/api/tracking/csqu3054383?carrier=MAERSK");
  });

  it("una referencia inválida (400) se muestra junto al campo, sin pantalla de error del servicio", async () => {
    mockApi({
      tracking: () => json({ statusCode: 400, message: "El número de contenedor CSQU3054384 tiene un dígito verificador inválido (ISO 6346)." }, 400),
    });
    render(<RatesDashboard />);
    await search("CSQU3054384");
    expect(await screen.findByText(/dígito verificador inválido/)).toBeInTheDocument();
    expect(screen.getByLabelText("Número de contenedor o BL")).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("si la naviera falla (502) muestra el error con «Reintentar»", async () => {
    let calls = 0;
    mockApi({
      tracking: () => {
        calls++;
        return calls === 1
          ? json({ statusCode: 502, message: "No se pudo obtener el seguimiento de MAERSK: no está verificado", errors: [{ carrier: "MAERSK", message: "no está verificado" }] }, 502)
          : json(tracking);
      },
    });
    render(<RatesDashboard />);
    const user = await search("CSQU3054383");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No se pudo obtener el seguimiento");
    await user.click(within(alert).getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Línea de tiempo")).toBeInTheDocument();
    expect(calls).toBe(2);
  });
});
