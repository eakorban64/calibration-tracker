import { useEffect, useState } from "react";

/** A QR code for `value`, drawn in the browser. */
export function QrCode({ value, size = 128 }: { value: string; size?: number }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void import("qrcode").then((QR) =>
      QR.toString(value, { type: "svg", margin: 0, errorCorrectionLevel: "M" }).then((s) => {
        if (live) setSvg(s);
      }),
    );
    return () => {
      live = false;
    };
  }, [value]);
  return (
    <div
      style={{ width: size, height: size }}
      className="shrink-0 [&_svg]:size-full"
      // The SVG comes from the QR library, built from the record's URL.
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
}
