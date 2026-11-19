import { defineEveryApp } from "@every-app/sdk";

export default defineEveryApp({
  id: "calibration-tracker",
  name: "Calibration Tracker",
  description:
    "Keep a register of measuring equipment, record calibrations, print certificates and QR labels, and see what is due.",
  icon: "/icon.svg",
  access: "everyone",
  resources: {
    d1: ["DB"],
    // Equipment photos, supplier documents and external calibration reports.
    r2: ["files"],
  },
  // A calibration label's QR code opens this record summary and its
  // certificate for whoever scans it, signed in or not. The pages load the
  // built assets and the icon.
  public: [
    { path: "/c/:code", methods: ["GET"] },
    { path: "/c/:code/certificate", methods: ["GET"] },
  ],
  publicAssets: ["/assets/**", "/icon.svg"],
  capabilities: {
    email: {
      access: "write",
      why: "Sends calibration due reminders and the weekly digest.",
    },
  },
  features: {
    reminders: {
      name: "Email reminders",
      why: "Emails equipment owners before calibrations fall due.",
      capabilities: ["email"],
    },
  },
});
