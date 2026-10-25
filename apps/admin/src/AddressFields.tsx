import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin } from "lucide-react";
import { Field } from "./components";
import type { Address } from "../../../shared/types";
export default function AddressFields({ value }: { value?: Address }) {
  const [show, setShow] = useState(false),
    [locating, setLocating] = useState(false),
    [pin, setPin] = useState<[number, number] | null>(
      value?.lat !== undefined && value.lng !== undefined
        ? [value.lat, value.lng]
        : null,
    ),
    [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  function locate() {
    if (!navigator.geolocation) {
      setError("Location is not available in this browser. Choose a map pin or enter your address.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPin([p.coords.latitude, p.coords.longitude]);
        setShow(false);
        setError("");
        setLocating(false);
      },
      () => {
        setError(
          "Location unavailable. Choose a pin on the map or enter your address.",
        );
        setLocating(false);
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  }
  useEffect(() => {
    if (!show || !ref.current) return;
    const map = L.map(ref.current).setView(pin || [13.0827, 80.2707], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    let marker: L.CircleMarker | undefined;
    if (pin)
      marker = L.circleMarker(pin, {
        radius: 9,
        color: "#145c48",
        fillOpacity: 1,
      }).addTo(map);
    map.on("click", (e) => {
      const p: [number, number] = [e.latlng.lat, e.latlng.lng];
      setPin(p);
      if (marker) marker.setLatLng(p);
      else
        marker = L.circleMarker(p, {
          radius: 9,
          color: "#145c48",
          fillOpacity: 1,
        }).addTo(map);
    });
    return () => {
      map.remove();
    };
  }, [show]);
  return (
    <>
      <div className="form-grid">
        {[
          ["name", "Recipient name"],
          ["phone", "Phone"],
          ["line1", "Street / address"],
          ["city", "City"],
          ["state", "State"],
          ["pincode", "PIN code"],
        ].map(([key, label]) => (
          <Field key={key} label={label}>
            <input
              name={"address_" + key}
              defaultValue={(value as any)?.[key]}
              required
              pattern={
                key === "pincode"
                  ? "[1-9][0-9]{5}"
                  : key === "phone"
                    ? "[+]?[0-9]{10,15}"
                    : undefined
              }
            />
          </Field>
        ))}
      </div>
      <div className="row-actions">
        <button
          type="button"
          className="secondary"
          onClick={() => setShow(!show)}
        >
          <MapPin size={15} />
          {show ? "Hide map" : "Select delivery pin"}
        </button>
        <button
          type="button"
          className="text-link"
          disabled={locating}
          onClick={() =>
            locate()
          }
        >
          {locating ? "Finding location…" : "Use my location"}
        </button>
        {pin && (
          <button
            type="button"
            className="text-link"
            onClick={() => setPin(null)}
          >
            Clear delivery pin
          </button>
        )}
      </div>
      {show && (
        <>
          <p className="muted">
            Tap the map to place your pin. Address fields remain required.
          </p>
          <div ref={ref} className="map" />
        </>
      )}
      {pin && (
        <p className="muted">
          Delivery pin: {pin[0].toFixed(5)}, {pin[1].toFixed(5)}
        </p>
      )}
      {error && <p className="error">{error}</p>}
      <input type="hidden" name="address_lat" value={pin?.[0] ?? ""} />
      <input type="hidden" name="address_lng" value={pin?.[1] ?? ""} />
    </>
  );
}
