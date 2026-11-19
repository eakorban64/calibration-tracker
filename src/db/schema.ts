import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`);

/** The install's one workspace: certificate wording, the certificate counter and reminder choices. */
export const workspace = sqliteTable("workspace", {
  id: text("id").primaryKey(),
  // The Gateway organization the install belongs to, for background mail.
  orgId: text("org_id"),
  companyName: text("company_name").notNull().default(""),
  disclaimer: text("disclaimer").notNull().default(""),
  certCounter: integer("cert_counter").notNull().default(0),
  reminderMode: text("reminder_mode").notNull().default("off"),
  reminderOffsets: text("reminder_offsets").notNull().default("30,14,7,0"),
  reminderCc: text("reminder_cc").notNull().default(""),
  digestWeekday: integer("digest_weekday").notNull().default(1),
  digestRecipients: text("digest_recipients").notNull().default(""),
});

/** People who opened the app, keyed by the Gateway's user id. Admin comes from the Gateway, not this row. */
export const members = sqliteTable("members", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  role: text("role").notNull().default("technician"),
  // As the Gateway said on their latest visit; shown on the team list.
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
});

export const equipment = sqliteTable(
  "equipment",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    serial: text("serial").notNull().default(""),
    manufacturer: text("manufacturer").notNull().default(""),
    model: text("model").notNull().default(""),
    category: text("category").notNull().default(""),
    location: text("location").notNull().default(""),
    owner: text("owner").notNull().default(""),
    ownerEmail: text("owner_email").notNull().default(""),
    range: text("range").notNull().default(""),
    condition: text("condition").notNull().default("good"),
    intervalDays: integer("interval_days").notNull(),
    toleranceNotes: text("tolerance_notes").notNull().default(""),
    referenceStandard: text("reference_standard").notNull().default(""),
    status: text("status").notNull().default("active"),
    lastCalDate: text("last_cal_date"),
    nextDueDate: text("next_due_date"),
    lastResult: text("last_result"),
    holder: text("holder"),
    holderLocation: text("holder_location"),
    expectedReturn: text("expected_return"),
    checkedOutAt: text("checked_out_at"),
    createdAt: createdAt(),
    updatedAt: text("updated_at"),
  },
  (t) => [uniqueIndex("equipment_code_unique").on(t.code)],
);

export const calibrationRecords = sqliteTable(
  "calibration_records",
  {
    id: text("id").primaryKey(),
    equipmentId: text("equipment_id")
      .notNull()
      .references(() => equipment.id),
    certNumber: integer("cert_number").notNull(),
    shortCode: text("short_code").notNull(),
    calDate: text("cal_date").notNull(),
    technician: text("technician").notNull(),
    procedure: text("procedure").notNull().default(""),
    temperature: real("temperature"),
    temperatureUnit: text("temperature_unit").notNull().default("C"),
    humidity: real("humidity"),
    result: text("result").notNull(),
    adjusted: integer("adjusted", { mode: "boolean" }).notNull().default(false),
    notes: text("notes").notNull().default(""),
    createdBy: text("created_by").notNull(),
    createdAt: createdAt(),
    updatedBy: text("updated_by"),
    updatedAt: text("updated_at"),
  },
  (t) => [
    uniqueIndex("records_cert_unique").on(t.certNumber),
    uniqueIndex("records_code_unique").on(t.shortCode),
    index("records_equipment").on(t.equipmentId, t.calDate),
  ],
);

export const recordPoints = sqliteTable(
  "record_points",
  {
    id: text("id").primaryKey(),
    recordId: text("record_id")
      .notNull()
      .references(() => calibrationRecords.id),
    position: integer("position").notNull(),
    nominal: real("nominal").notNull(),
    measured: real("measured").notNull(),
    lower: real("lower").notNull(),
    upper: real("upper").notNull(),
    pass: integer("pass", { mode: "boolean" }).notNull(),
  },
  (t) => [index("points_record").on(t.recordId, t.position)],
);

/** Photos, supplier PDFs and external reports; the bytes are in R2 under `key`. */
export const attachments = sqliteTable(
  "attachments",
  {
    id: text("id").primaryKey(),
    equipmentId: text("equipment_id")
      .notNull()
      .references(() => equipment.id),
    recordId: text("record_id"),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    key: text("key").notNull(),
    uploadedBy: text("uploaded_by").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("attachments_equipment").on(t.equipmentId)],
);

export const cribMovements = sqliteTable(
  "crib_movements",
  {
    id: text("id").primaryKey(),
    equipmentId: text("equipment_id")
      .notNull()
      .references(() => equipment.id),
    kind: text("kind").notNull(),
    person: text("person").notNull(),
    location: text("location").notNull().default(""),
    expectedReturn: text("expected_return"),
    condition: text("condition"),
    byEmail: text("by_email").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("crib_equipment").on(t.equipmentId, t.createdAt)],
);

/** Append-only: who did what, written by the server with each change. */
export const activity = sqliteTable(
  "activity",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email").notNull(),
    action: text("action").notNull(),
    subject: text("subject").notNull().default(""),
    link: text("link"),
    createdAt: createdAt(),
  },
  (t) => [index("activity_time").on(t.createdAt)],
);

/** One row per reminder sent, so none goes out twice. */
export const reminderLog = sqliteTable("reminder_log", {
  key: text("key").primaryKey(),
  recipients: text("recipients").notNull(),
  createdAt: createdAt(),
});
