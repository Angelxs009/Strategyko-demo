import { CARRIER_LABELS } from "@/lib/format";
import type { CarrierError } from "@/lib/types";
import { AlertIcon } from "./Icons";

/** Aviso cuando alguna naviera no respondió pero hay resultados de las demás. */
export function CarrierErrorsBanner({ errors }: { errors: CarrierError[] }) {
  if (errors.length === 0) return null;
  return (
    <div className="banner banner--warn" role="status">
      <AlertIcon size={20} />
      <div>
        <p className="banner__title">Algunas navieras no respondieron</p>
        <ul>
          {errors.map((e) => (
            <li key={e.carrier}>
              {CARRIER_LABELS[e.carrier]}: {e.message}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
