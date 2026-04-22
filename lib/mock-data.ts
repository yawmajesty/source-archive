// ─────────────────────────────────────────
// Kōru Mock Data — swap this file for Supabase
// ─────────────────────────────────────────

export type ClientStatus = "active" | "onboarding" | "paused";
export type ProjectStatus = "active" | "completed" | "on_hold";
export type Stage =
  | "brief"
  | "sourcing"
  | "sampling"
  | "approved"
  | "production"
  | "qc"
  | "shipped";
export type SampleStatus = "sent" | "in_transit" | "received" | "approved" | "rejected";
export type MilestoneStatus = "completed" | "overdue" | "upcoming";
export type CostCategory =
  | "sampling"
  | "shipping"
  | "factory"
  | "travel"
  | "translation"
  | "inspection"
  | "agency_fee"
  | "other";
export type CostDirection = "in" | "out";
export type CostType = "cogs" | "operating";
export type Currency = "GBP" | "USD" | "CNY" | "EUR";
export type TaskStatus = "todo" | "in_progress" | "waiting_client" | "waiting_factory" | "done";

export interface Client {
  id: string;
  name: string;
  slug: string;
  country: string;
  industry: string;
  logo_initial: string;
  status: ClientStatus;
  contact_name: string;
  contact_email: string;
  has_new_activity: boolean;
  created_at: string;
}

export interface Project {
  id: string;
  client_id: string;
  name: string;
  season: string;
  status: ProjectStatus;
  start_date: string;
  target_completion: string;
  portal_unlocked_at: string | null;
  notes: string;
  created_at: string;
}

export type LeadStatus = "new" | "contacted" | "qualified" | "proposal_sent" | "converted" | "lost";

export interface Lead {
  id: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  country: string;
  industry: string;
  product_interest: string;
  estimated_budget: string;
  message: string;
  status: LeadStatus;
  source: "brief_form" | "referral" | "direct";
  created_at: string;
}

export interface Factory {
  id: string;
  name: string;
  city: string;
  country: string;
  categories: string[];
  specialities: string[];
  rating: number;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  min_order_value: number;
  moq_units: number;
  sample_lead_time_days: number;
  lead_time_days: number;
  capacity_per_month: number;
  established_year: number;
  notes: string;
  created_at: string;
}

export interface Product {
  id: string;
  project_id: string;
  name: string;
  category: string;
  stage: Stage;
  factory_id: string | null;
  target_cost_usd: number;
  quoted_cost_usd: number | null;
  quoted_cost_currency: Currency;
  quoted_cost_local: number | null;
  moq: number;
  order_qty: number | null;
  lead_time_days: number;
  colorways: string[];
  bom: BomItem[];
  notes: string;
  created_at: string;
}

export interface BomItem {
  id: string;
  material: string;
  supplier: string;
  unit_cost_usd: number;
  notes: string;
}

export interface Sample {
  id: string;
  product_id: string;
  round: number;
  status: SampleStatus;
  courier: string;
  tracking_number: string;
  sent_date: string;
  received_date: string | null;
  feedback: string;
  approved_at: string | null;
}

export interface Milestone {
  id: string;
  product_id: string;
  title: string;
  due_date: string;
  completed_at: string | null;
  notes: string;
}

export interface Document {
  id: string;
  product_id: string;
  filename: string;
  type: "pdf" | "image" | "spreadsheet" | "other";
  version: string;
  size_kb: number;
  visible_to_client: boolean;
  uploaded_at: string;
}

export interface Cost {
  id: string;
  project_id: string;
  product_id: string | null;
  category: CostCategory;
  description: string;
  amount: number;
  currency: Currency;
  fx_rate: number;
  amount_gbp: number;
  direction: CostDirection;
  cost_type: CostType;
  billable_to_client: boolean;
  paid_by: string;
  date_paid: string;
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  product_id: string | null;
  title: string;
  status: TaskStatus;
  assigned_to: string;
  assigned_initials: string;
  due_date: string | null;
  notes: string;
  created_at: string;
}

export interface Update {
  id: string;
  product_id: string;
  author: string;
  author_initials: string;
  text: string;
  visible_to_client: boolean;
  created_at: string;
}

// ─────────────────────────────────────────
// DATA
// ─────────────────────────────────────────

const clients: Client[] = [
  {
    id: "client-1",
    name: "Marble & Co",
    slug: "marble-co",
    country: "UK",
    industry: "Premium Homeware",
    logo_initial: "M",
    status: "active",
    contact_name: "Sophia Hartley",
    contact_email: "sophia@marbleandco.com",
    has_new_activity: true,
    created_at: "2024-09-01T09:00:00Z",
  },
  {
    id: "client-2",
    name: "Vaux Studio",
    slug: "vaux-studio",
    country: "France",
    industry: "Fashion",
    logo_initial: "V",
    status: "active",
    contact_name: "Léa Moreau",
    contact_email: "lea@vauxstudio.fr",
    has_new_activity: false,
    created_at: "2024-11-15T10:00:00Z",
  },
  {
    id: "client-3",
    name: "Nōrd Objects",
    slug: "nord-objects",
    country: "Denmark",
    industry: "Scandinavian Furniture",
    logo_initial: "N",
    status: "active",
    contact_name: "Erik Lindqvist",
    contact_email: "erik@nordobjects.dk",
    has_new_activity: true,
    created_at: "2025-01-10T08:00:00Z",
  },
];

const projects: Project[] = [
  {
    id: "proj-1",
    client_id: "client-1",
    name: "SS26 Collection",
    season: "SS26",
    status: "active",
    start_date: "2025-09-01",
    target_completion: "2026-04-30",
    portal_unlocked_at: "2025-11-01T10:00:00Z",
    notes:
      "Primary spring/summer collection. Focus on tactile materials and muted palette.",
    created_at: "2025-09-01T09:00:00Z",
  },
  {
    id: "proj-2",
    client_id: "client-1",
    name: "AW26 Gifting Range",
    season: "AW26",
    status: "active",
    start_date: "2026-01-15",
    target_completion: "2026-09-30",
    portal_unlocked_at: null,
    notes: "Holiday gifting line. Portal locked pending product sign-off.",
    created_at: "2026-01-15T09:00:00Z",
  },
  {
    id: "proj-3",
    client_id: "client-2",
    name: "Resort 2026",
    season: "Resort 26",
    status: "active",
    start_date: "2025-10-01",
    target_completion: "2026-05-15",
    portal_unlocked_at: "2026-01-20T14:00:00Z",
    notes: "Resort collection, lightweight fabrics, coastal references.",
    created_at: "2025-10-01T10:00:00Z",
  },
  {
    id: "proj-4",
    client_id: "client-3",
    name: "Core Collection AW26",
    season: "AW26",
    status: "active",
    start_date: "2026-02-01",
    target_completion: "2026-10-31",
    portal_unlocked_at: null,
    notes: "Foundational furniture pieces, oak and ash focus.",
    created_at: "2026-02-01T08:00:00Z",
  },
];

const factories: Factory[] = [
  {
    id: "factory-1",
    name: "Shengda Textile Co.",
    city: "Guangzhou",
    country: "China",
    categories: ["Apparel", "Accessories", "Technical Fabrics"],
    specialities: ["Jersey knit", "Woven shirting", "Bonded fabrics", "Cut & sew"],
    rating: 4,
    contact_name: "Chen Wei",
    contact_email: "wei.chen@shengdatextile.com",
    contact_phone: "+86 20 8888 7654",
    min_order_value: 3000,
    moq_units: 300,
    sample_lead_time_days: 18,
    lead_time_days: 75,
    capacity_per_month: 15000,
    established_year: 2003,
    notes: "Strong on jersey and woven. Fast sampling. Weak on luxury finishing.",
    created_at: "2024-08-01T00:00:00Z",
  },
  {
    id: "factory-2",
    name: "Donghua Ceramics",
    city: "Jingdezhen",
    country: "China",
    categories: ["Ceramics", "Homeware", "Tableware", "Decorative Objects"],
    specialities: ["Porcelain tableware", "Reactive glazes", "Custom colour development", "Multi-piece sets"],
    rating: 5,
    contact_name: "Liu Yan",
    contact_email: "yan.liu@donghuaceramics.com",
    contact_phone: "+86 798 555 0123",
    min_order_value: 2000,
    moq_units: 100,
    sample_lead_time_days: 21,
    lead_time_days: 60,
    capacity_per_month: 8000,
    established_year: 1987,
    notes: "Best-in-class ceramics. Third-generation family operation. Exceptional quality control. Waitlist for premium slots.",
    created_at: "2024-06-15T00:00:00Z",
  },
  {
    id: "factory-3",
    name: "Hansson & Björk",
    city: "Malmö",
    country: "Sweden",
    categories: ["Furniture", "Wood Products", "Interior Objects"],
    specialities: ["Solid wood furniture", "FSC-certified timber", "Joinery", "Lacquer & oil finishing"],
    rating: 3,
    contact_name: "Magnus Hansson",
    contact_email: "magnus@hanssonbjork.se",
    contact_phone: "+46 40 123 456",
    min_order_value: 5000,
    moq_units: 50,
    sample_lead_time_days: 30,
    lead_time_days: 90,
    capacity_per_month: 400,
    established_year: 1998,
    notes: "Good craftsmanship, slow communication. Better for smaller bespoke runs. MOQ flexibility on repeat orders.",
    created_at: "2025-01-20T00:00:00Z",
  },
];

const leads: Lead[] = [
  { id: "lead-1", company_name: "Cove Interiors", contact_name: "Amelia Cross", contact_email: "amelia@coveinteriors.co.uk", country: "UK", industry: "Luxury Homeware", product_interest: "Ceramic tableware, candle holders", estimated_budget: "£15,000–£30,000", message: "We're launching a new AW collection and need a sourcing partner for ceramic and textile pieces. Heard great things about your work with other UK brands.", status: "qualified", source: "brief_form", created_at: "2026-04-08T10:30:00Z" },
  { id: "lead-2", company_name: "Soleil Paris", contact_name: "Camille Dupont", contact_email: "c.dupont@soleilparis.fr", country: "France", industry: "Fashion", product_interest: "Knitwear, silk accessories", estimated_budget: "€20,000–€50,000", message: "We are a Paris-based fashion house looking to expand production to Asia. We currently source in Italy but costs are no longer viable.", status: "contacted", source: "referral", created_at: "2026-04-12T14:15:00Z" },
  { id: "lead-3", company_name: "Bloom & Co.", contact_name: "Jack Morrison", contact_email: "jack@bloomandco.com", country: "UK", industry: "Lifestyle & Gifting", product_interest: "Candles, diffusers, packaging", estimated_budget: "£8,000–£15,000", message: "We're a DTC gifting brand looking to move production to a dedicated factory partner. Currently using multiple suppliers which is causing quality inconsistency.", status: "new", source: "brief_form", created_at: "2026-04-18T09:00:00Z" },
  { id: "lead-4", company_name: "Studio Veld", contact_name: "Pieter van Dijk", contact_email: "pieter@studioveld.nl", country: "Netherlands", industry: "Interior Design", product_interest: "Soft furnishings, cushions, throws", estimated_budget: "€10,000–€25,000", message: "Interior design studio sourcing for a hospitality project. Need sustainable fabrics and consistent quality across 3 colourways.", status: "proposal_sent", source: "brief_form", created_at: "2026-03-28T11:00:00Z" },
];

const products: Product[] = [
  // ─ Marble & Co SS26 (proj-1) ──────────────
  {
    id: "prod-1",
    project_id: "proj-1",
    name: "Travertine Dinner Plate",
    category: "Tableware",
    stage: "production",
    factory_id: "factory-2",
    target_cost_usd: 22,
    quoted_cost_usd: 19.5,
    quoted_cost_currency: "CNY",
    quoted_cost_local: 141,
    moq: 200,
    order_qty: 400,
    lead_time_days: 60,
    colorways: ["Travertine White", "Bone", "Sage"],
    bom: [
      { id: "bom-1a", material: "Kaolin clay blend", supplier: "Jingdezhen Raw Co.", unit_cost_usd: 3.2, notes: "Premium grade" },
      { id: "bom-1b", material: "Reactive glaze — matte", supplier: "Donghua internal", unit_cost_usd: 1.8, notes: "Exclusive formula" },
    ],
    notes: "Flagship plate. Texture inspired by natural stone.",
    created_at: "2025-09-10T09:00:00Z",
  },
  {
    id: "prod-2",
    project_id: "proj-1",
    name: "Alabaster Serving Bowl",
    category: "Tableware",
    stage: "qc",
    factory_id: "factory-2",
    target_cost_usd: 38,
    quoted_cost_usd: 34,
    quoted_cost_currency: "CNY",
    quoted_cost_local: 246,
    moq: 100,
    order_qty: 200,
    lead_time_days: 65,
    colorways: ["Alabaster", "Sand"],
    bom: [
      { id: "bom-2a", material: "Kaolin clay blend", supplier: "Jingdezhen Raw Co.", unit_cost_usd: 5.5, notes: "" },
      { id: "bom-2b", material: "Dip glaze — satin", supplier: "Donghua internal", unit_cost_usd: 2.1, notes: "" },
    ],
    notes: "Large format. Two-stage firing required.",
    created_at: "2025-09-12T09:00:00Z",
  },
  {
    id: "prod-3",
    project_id: "proj-1",
    name: "Linen Napkin Set",
    category: "Table Linen",
    stage: "shipped",
    factory_id: "factory-1",
    target_cost_usd: 12,
    quoted_cost_usd: 10.8,
    quoted_cost_currency: "USD",
    quoted_cost_local: 10.8,
    moq: 500,
    order_qty: 1000,
    lead_time_days: 45,
    colorways: ["Ecru", "Charcoal", "Dusty Rose"],
    bom: [
      { id: "bom-3a", material: "Belgian linen 200gsm", supplier: "Lintex EU", unit_cost_usd: 4.2, notes: "Deadstock preferred" },
      { id: "bom-3b", material: "Cotton-linen binding tape", supplier: "Shengda internal", unit_cost_usd: 0.4, notes: "" },
    ],
    notes: "Set of 4. Mitered corners.",
    created_at: "2025-09-15T09:00:00Z",
  },
  {
    id: "prod-4",
    project_id: "proj-1",
    name: "Marble-effect Side Plate",
    category: "Tableware",
    stage: "sampling",
    factory_id: "factory-2",
    target_cost_usd: 16,
    quoted_cost_usd: 15,
    quoted_cost_currency: "CNY",
    quoted_cost_local: 108,
    moq: 300,
    order_qty: null,
    lead_time_days: 60,
    colorways: ["White Marble", "Grey Marble"],
    bom: [
      { id: "bom-4a", material: "Kaolin clay blend", supplier: "Jingdezhen Raw Co.", unit_cost_usd: 3.0, notes: "" },
      { id: "bom-4b", material: "Marbling glaze technique", supplier: "Donghua internal", unit_cost_usd: 2.5, notes: "Hand-applied" },
    ],
    notes: "Marbling effect — may need multiple sample rounds.",
    created_at: "2025-10-01T09:00:00Z",
  },
  {
    id: "prod-5",
    project_id: "proj-1",
    name: "Beeswax Taper Candle",
    category: "Candles",
    stage: "approved",
    factory_id: null,
    target_cost_usd: 8,
    quoted_cost_usd: 7.2,
    quoted_cost_currency: "GBP",
    quoted_cost_local: 5.7,
    moq: 500,
    order_qty: 500,
    lead_time_days: 30,
    colorways: ["Natural Beeswax", "Ivory", "Sage Green"],
    bom: [
      { id: "bom-5a", material: "Pure beeswax", supplier: "UK Beeswax Ltd", unit_cost_usd: 2.1, notes: "Certified organic" },
      { id: "bom-5b", material: "Cotton wick", supplier: "UK Beeswax Ltd", unit_cost_usd: 0.2, notes: "" },
    ],
    notes: "UK-sourced. No factory assigned yet — evaluating UK vs Poland.",
    created_at: "2025-10-20T09:00:00Z",
  },
  // ─ Marble & Co AW26 Gifting (proj-2) ─────
  {
    id: "prod-6",
    project_id: "proj-2",
    name: "Cedarwood Diffuser",
    category: "Home Fragrance",
    stage: "sourcing",
    factory_id: null,
    target_cost_usd: 24,
    quoted_cost_usd: null,
    quoted_cost_currency: "USD",
    quoted_cost_local: null,
    moq: 300,
    order_qty: null,
    lead_time_days: 50,
    colorways: ["Amber Glass"],
    bom: [],
    notes: "RFQ sent to 3 factories. Awaiting responses.",
    created_at: "2026-01-20T09:00:00Z",
  },
  // ─ Vaux Studio Resort 26 (proj-3) ────────
  {
    id: "prod-7",
    project_id: "proj-3",
    name: "Bias-cut Slip Dress",
    category: "Dresses",
    stage: "sampling",
    factory_id: "factory-1",
    target_cost_usd: 55,
    quoted_cost_usd: 48,
    quoted_cost_currency: "USD",
    quoted_cost_local: 48,
    moq: 100,
    order_qty: null,
    lead_time_days: 70,
    colorways: ["Champagne", "Midnight Blue", "Coral"],
    bom: [
      { id: "bom-7a", material: "100% silk charmeuse", supplier: "Suzhou Silk Mills", unit_cost_usd: 18, notes: "16 momme weight" },
      { id: "bom-7b", material: "Silk bias binding", supplier: "Suzhou Silk Mills", unit_cost_usd: 1.5, notes: "" },
      { id: "bom-7c", material: "Invisible zip", supplier: "YKK Guangzhou", unit_cost_usd: 0.6, notes: "" },
    ],
    notes: "Key hero piece. Requires precise bias cutting.",
    created_at: "2025-10-15T10:00:00Z",
  },
  {
    id: "prod-8",
    project_id: "proj-3",
    name: "Broderie Anglaise Blouse",
    category: "Tops",
    stage: "brief",
    factory_id: null,
    target_cost_usd: 38,
    quoted_cost_usd: null,
    quoted_cost_currency: "USD",
    quoted_cost_local: null,
    moq: 150,
    order_qty: null,
    lead_time_days: 65,
    colorways: ["White", "Ecru"],
    bom: [],
    notes: "Brief submitted. Factory shortlist TBD.",
    created_at: "2026-02-01T10:00:00Z",
  },
  {
    id: "prod-9",
    project_id: "proj-3",
    name: "Crinkle Linen Trousers",
    category: "Trousers",
    stage: "approved",
    factory_id: "factory-1",
    target_cost_usd: 42,
    quoted_cost_usd: 39,
    quoted_cost_currency: "USD",
    quoted_cost_local: 39,
    moq: 120,
    order_qty: 120,
    lead_time_days: 60,
    colorways: ["Sand", "Olive", "White"],
    bom: [
      { id: "bom-9a", material: "Crinkle linen 180gsm", supplier: "Lintex EU via Shengda", unit_cost_usd: 7.5, notes: "" },
      { id: "bom-9b", material: "Elastic waistband", supplier: "Shengda internal", unit_cost_usd: 0.4, notes: "" },
    ],
    notes: "Wide leg. Elastic + drawstring waist.",
    created_at: "2025-11-01T10:00:00Z",
  },
  // ─ Nōrd Objects AW26 (proj-4) ────────────
  {
    id: "prod-10",
    project_id: "proj-4",
    name: "Ash Side Table",
    category: "Furniture",
    stage: "sourcing",
    factory_id: "factory-3",
    target_cost_usd: 280,
    quoted_cost_usd: 310,
    quoted_cost_currency: "EUR",
    quoted_cost_local: 286,
    moq: 20,
    order_qty: null,
    lead_time_days: 90,
    colorways: ["Natural Ash", "Smoked Ash"],
    bom: [
      { id: "bom-10a", material: "Solid ash timber", supplier: "Scandinavian Timber AS", unit_cost_usd: 95, notes: "FSC certified" },
      { id: "bom-10b", material: "Oil wax finish", supplier: "Osmo GmbH", unit_cost_usd: 8, notes: "Water-based" },
      { id: "bom-10c", material: "Brass hardware", supplier: "Local Malmö supplier", unit_cost_usd: 12, notes: "" },
    ],
    notes: "Quote slightly over target. Negotiation ongoing.",
    created_at: "2026-02-10T08:00:00Z",
  },
];

const samples: Sample[] = [
  {
    id: "sample-1",
    product_id: "prod-4",
    round: 1,
    status: "received",
    courier: "DHL Express",
    tracking_number: "1234567890",
    sent_date: "2026-02-10",
    received_date: "2026-02-17",
    feedback:
      "Marbling effect inconsistent across pieces. Central vein too pronounced. Glaze pooling on rim on 3/5 pieces. Return for R2.",
    approved_at: null,
  },
  {
    id: "sample-2",
    product_id: "prod-4",
    round: 2,
    status: "in_transit",
    courier: "FedEx International",
    tracking_number: "794644823714",
    sent_date: "2026-03-20",
    received_date: null,
    feedback: "",
    approved_at: null,
  },
  {
    id: "sample-3",
    product_id: "prod-7",
    round: 1,
    status: "received",
    courier: "DHL Express",
    tracking_number: "9876543210",
    sent_date: "2026-01-15",
    received_date: "2026-01-22",
    feedback:
      "Bias cut slightly off on Champagne colorway — 3mm deviation at hem. Side seam puckering on all colors. Need re-cut and re-stitch.",
    approved_at: null,
  },
  {
    id: "sample-4",
    product_id: "prod-7",
    round: 2,
    status: "sent",
    courier: "SF Express",
    tracking_number: "SF1234567890",
    sent_date: "2026-03-10",
    received_date: null,
    feedback: "",
    approved_at: null,
  },
];

const milestones: Milestone[] = [
  // prod-1 (Travertine Dinner Plate — production)
  { id: "ms-1-1", product_id: "prod-1", title: "Brief signed off", due_date: "2025-09-15", completed_at: "2025-09-14T10:00:00Z", notes: "" },
  { id: "ms-1-2", product_id: "prod-1", title: "Factory confirmed", due_date: "2025-10-01", completed_at: "2025-09-30T09:00:00Z", notes: "" },
  { id: "ms-1-3", product_id: "prod-1", title: "Sample R1 approved", due_date: "2025-11-15", completed_at: "2025-11-12T16:00:00Z", notes: "" },
  { id: "ms-1-4", product_id: "prod-1", title: "Production order placed", due_date: "2025-12-01", completed_at: "2025-11-28T11:00:00Z", notes: "" },
  { id: "ms-1-5", product_id: "prod-1", title: "Production complete", due_date: "2026-02-15", completed_at: "2026-02-12T00:00:00Z", notes: "" },
  { id: "ms-1-6", product_id: "prod-1", title: "Shipment departs Jingdezhen", due_date: "2026-03-01", completed_at: null, notes: "Awaiting customs clearance docs" },
  { id: "ms-1-7", product_id: "prod-1", title: "UK warehouse receipt", due_date: "2026-03-28", completed_at: null, notes: "" },

  // prod-4 (Marble-effect Side Plate — sampling)
  { id: "ms-4-1", product_id: "prod-4", title: "Brief signed off", due_date: "2025-10-10", completed_at: "2025-10-08T09:00:00Z", notes: "" },
  { id: "ms-4-2", product_id: "prod-4", title: "Factory confirmed", due_date: "2025-10-20", completed_at: "2025-10-19T09:00:00Z", notes: "" },
  { id: "ms-4-3", product_id: "prod-4", title: "Sample R1 received", due_date: "2026-02-20", completed_at: "2026-02-17T09:00:00Z", notes: "" },
  { id: "ms-4-4", product_id: "prod-4", title: "Sample R2 approved", due_date: "2026-04-10", completed_at: null, notes: "R2 in transit" },
  { id: "ms-4-5", product_id: "prod-4", title: "Production order placed", due_date: "2026-05-01", completed_at: null, notes: "" },

  // prod-7 (Bias-cut Slip Dress — sampling)
  { id: "ms-7-1", product_id: "prod-7", title: "Brief signed off", due_date: "2025-10-20", completed_at: "2025-10-18T10:00:00Z", notes: "" },
  { id: "ms-7-2", product_id: "prod-7", title: "Factory confirmed", due_date: "2025-11-01", completed_at: "2025-10-31T10:00:00Z", notes: "" },
  { id: "ms-7-3", product_id: "prod-7", title: "Tech pack submitted", due_date: "2025-11-20", completed_at: "2025-11-19T14:00:00Z", notes: "" },
  { id: "ms-7-4", product_id: "prod-7", title: "Sample R1 received", due_date: "2026-01-25", completed_at: "2026-01-22T09:00:00Z", notes: "" },
  { id: "ms-7-5", product_id: "prod-7", title: "Sample R2 approved", due_date: "2026-03-25", completed_at: null, notes: "OVERDUE" },
  { id: "ms-7-6", product_id: "prod-7", title: "Production order placed", due_date: "2026-04-15", completed_at: null, notes: "" },

  // prod-10 (Ash Side Table — sourcing)
  { id: "ms-10-1", product_id: "prod-10", title: "Brief signed off", due_date: "2026-02-15", completed_at: "2026-02-14T09:00:00Z", notes: "" },
  { id: "ms-10-2", product_id: "prod-10", title: "RFQ sent to factories", due_date: "2026-02-20", completed_at: "2026-02-20T11:00:00Z", notes: "" },
  { id: "ms-10-3", product_id: "prod-10", title: "Quote review + factory selection", due_date: "2026-03-10", completed_at: null, notes: "OVERDUE" },
  { id: "ms-10-4", product_id: "prod-10", title: "Sample order placed", due_date: "2026-04-01", completed_at: null, notes: "" },
  { id: "ms-10-5", product_id: "prod-10", title: "Sample received", due_date: "2026-06-01", completed_at: null, notes: "" },
];

const costs: Cost[] = [
  // proj-1 — COGS out (sampling/production)
  { id: "cost-1",  project_id: "proj-1", product_id: "prod-1", category: "sampling",    description: "R1 sample production — Travertine Dinner Plate", amount: 580,  currency: "CNY", fx_rate: 0.11, amount_gbp: 63.8,   direction: "out", cost_type: "cogs",      billable_to_client: true,  paid_by: "Agency", date_paid: "2025-11-05", created_at: "2025-11-06T09:00:00Z" },
  { id: "cost-2",  project_id: "proj-1", product_id: "prod-1", category: "shipping",    description: "DHL sample shipping — JDZ to London",             amount: 89,   currency: "GBP", fx_rate: 1,    amount_gbp: 89,     direction: "out", cost_type: "cogs",      billable_to_client: true,  paid_by: "Agency", date_paid: "2025-11-08", created_at: "2025-11-08T09:00:00Z" },
  { id: "cost-3",  project_id: "proj-1", product_id: "prod-3", category: "factory",     description: "Linen Napkin Set — production deposit 50%",       amount: 5400, currency: "USD", fx_rate: 0.79, amount_gbp: 4266,   direction: "out", cost_type: "cogs",      billable_to_client: true,  paid_by: "Client", date_paid: "2026-01-10", created_at: "2026-01-10T09:00:00Z" },
  { id: "cost-4",  project_id: "proj-1", product_id: "prod-3", category: "shipping",    description: "Sea freight — Guangzhou to Tilbury",               amount: 420,  currency: "USD", fx_rate: 0.79, amount_gbp: 331.8,  direction: "out", cost_type: "cogs",      billable_to_client: true,  paid_by: "Agency", date_paid: "2026-02-28", created_at: "2026-02-28T09:00:00Z" },
  { id: "cost-5",  project_id: "proj-1", product_id: null,     category: "travel",      description: "Factory visit — Jingdezhen trip",                  amount: 1240, currency: "GBP", fx_rate: 1,    amount_gbp: 1240,   direction: "out", cost_type: "operating", billable_to_client: false, paid_by: "Agency", date_paid: "2025-10-22", created_at: "2025-10-22T09:00:00Z" },
  { id: "cost-6",  project_id: "proj-1", product_id: "prod-4", category: "sampling",    description: "R1 sample — Marble-effect Side Plate",             amount: 420,  currency: "CNY", fx_rate: 0.11, amount_gbp: 46.2,   direction: "out", cost_type: "cogs",      billable_to_client: true,  paid_by: "Agency", date_paid: "2026-02-05", created_at: "2026-02-05T09:00:00Z" },
  { id: "cost-7",  project_id: "proj-1", product_id: "prod-4", category: "shipping",    description: "DHL — R1 plate sample",                            amount: 72,   currency: "GBP", fx_rate: 1,    amount_gbp: 72,     direction: "out", cost_type: "cogs",      billable_to_client: true,  paid_by: "Agency", date_paid: "2026-02-08", created_at: "2026-02-08T09:00:00Z" },
  { id: "cost-8",  project_id: "proj-1", product_id: null,     category: "translation", description: "Tech spec translation (EN→CN) — SS26",             amount: 160,  currency: "GBP", fx_rate: 1,    amount_gbp: 160,    direction: "out", cost_type: "operating", billable_to_client: false, paid_by: "Agency", date_paid: "2025-09-25", created_at: "2025-09-25T09:00:00Z" },
  // Agency fee income for proj-1
  { id: "cost-r1", project_id: "proj-1", product_id: null,     category: "agency_fee",  description: "Agency fee — SS26 Q1 instalment",                  amount: 3500, currency: "GBP", fx_rate: 1,    amount_gbp: 3500,   direction: "in",  cost_type: "operating", billable_to_client: true,  paid_by: "Client", date_paid: "2025-10-01", created_at: "2025-10-01T09:00:00Z" },

  // proj-2
  { id: "cost-9",  project_id: "proj-2", product_id: "prod-6", category: "sampling",    description: "RFQ pack preparation — Cedarwood Diffuser",       amount: 85,   currency: "GBP", fx_rate: 1,    amount_gbp: 85,     direction: "out", cost_type: "operating", billable_to_client: false, paid_by: "Agency", date_paid: "2026-01-25", created_at: "2026-01-25T09:00:00Z" },

  // proj-3
  { id: "cost-10", project_id: "proj-3", product_id: "prod-7", category: "sampling",    description: "Slip Dress R1 sample — Shengda",                   amount: 3200, currency: "CNY", fx_rate: 0.11, amount_gbp: 352,    direction: "out", cost_type: "cogs",      billable_to_client: true,  paid_by: "Client", date_paid: "2026-01-12", created_at: "2026-01-12T09:00:00Z" },
  { id: "cost-11", project_id: "proj-3", product_id: "prod-7", category: "shipping",    description: "DHL — Slip Dress R1 sample",                       amount: 94,   currency: "GBP", fx_rate: 1,    amount_gbp: 94,     direction: "out", cost_type: "cogs",      billable_to_client: true,  paid_by: "Agency", date_paid: "2026-01-18", created_at: "2026-01-18T09:00:00Z" },
  { id: "cost-12", project_id: "proj-3", product_id: "prod-9", category: "factory",     description: "Crinkle Linen Trousers — full production",         amount: 4680, currency: "USD", fx_rate: 0.79, amount_gbp: 3697.2, direction: "out", cost_type: "cogs",      billable_to_client: true,  paid_by: "Client", date_paid: "2026-03-01", created_at: "2026-03-01T09:00:00Z" },
  { id: "cost-13", project_id: "proj-3", product_id: null,     category: "inspection",  description: "Pre-shipment inspection — Resort 26",               amount: 320,  currency: "GBP", fx_rate: 1,    amount_gbp: 320,    direction: "out", cost_type: "cogs",      billable_to_client: true,  paid_by: "Agency", date_paid: "2026-03-15", created_at: "2026-03-15T09:00:00Z" },
  { id: "cost-r3", project_id: "proj-3", product_id: null,     category: "agency_fee",  description: "Agency fee — Resort 26",                           amount: 2800, currency: "GBP", fx_rate: 1,    amount_gbp: 2800,   direction: "in",  cost_type: "operating", billable_to_client: true,  paid_by: "Client", date_paid: "2026-02-01", created_at: "2026-02-01T09:00:00Z" },

  // proj-4
  { id: "cost-14", project_id: "proj-4", product_id: "prod-10", category: "sampling",   description: "Ash Side Table sample prototyping",                amount: 380,  currency: "EUR", fx_rate: 0.86, amount_gbp: 326.8,  direction: "out", cost_type: "cogs",      billable_to_client: false, paid_by: "Agency", date_paid: "2026-03-05", created_at: "2026-03-05T09:00:00Z" },
  { id: "cost-15", project_id: "proj-4", product_id: null,      category: "travel",     description: "Malmö factory visit",                              amount: 680,  currency: "GBP", fx_rate: 1,    amount_gbp: 680,    direction: "out", cost_type: "operating", billable_to_client: false, paid_by: "Agency", date_paid: "2026-03-08", created_at: "2026-03-08T09:00:00Z" },
];

const updates: Update[] = [
  { id: "upd-1",  product_id: "prod-1", author: "Priya Nair",    author_initials: "PN", text: "Production confirmed at 400 units. Factory has allocated a dedicated kiln bay for this order. ETA on completion: 12 Feb.", visible_to_client: true,  created_at: "2026-01-08T14:30:00Z" },
  { id: "upd-2",  product_id: "prod-1", author: "Priya Nair",    author_initials: "PN", text: "QC pre-check photos received from Liu Yan — glaze consistency looks excellent on this batch. Sharing with Sophia.", visible_to_client: true,  created_at: "2026-02-14T10:15:00Z" },
  { id: "upd-3",  product_id: "prod-1", author: "James Cole",    author_initials: "JC", text: "Internal note: customs docs need to be filed by 25 Feb. Chasing freight forwarder.", visible_to_client: false, created_at: "2026-02-18T16:00:00Z" },
  { id: "upd-4",  product_id: "prod-4", author: "Priya Nair",    author_initials: "PN", text: "R1 sample feedback sent to Donghua. Requested R2 within 3 weeks with improved marbling consistency — mid-vein should be softer.", visible_to_client: false, created_at: "2026-02-18T11:00:00Z" },
  { id: "upd-5",  product_id: "prod-4", author: "Priya Nair",    author_initials: "PN", text: "R2 sample despatched from Jingdezhen — FedEx 794644823714. Expected arrival 28 Mar.", visible_to_client: true,  created_at: "2026-03-20T09:30:00Z" },
  { id: "upd-6",  product_id: "prod-7", author: "James Cole",    author_initials: "JC", text: "R1 feedback compiled from Léa. Key issues: bias cut deviation 3mm at hem and side seam puckering. Chen Wei has acknowledged and will re-cut.", visible_to_client: false, created_at: "2026-01-24T15:00:00Z" },
  { id: "upd-7",  product_id: "prod-7", author: "James Cole",    author_initials: "JC", text: "R2 sample sent from Guangzhou — SF Express SF1234567890. Expected 10 days. Client update sent.", visible_to_client: true,  created_at: "2026-03-10T10:00:00Z" },
  { id: "upd-8",  product_id: "prod-10", author: "Priya Nair",   author_initials: "PN", text: "Quote from Hansson & Björk received: €286/unit for Ash Side Table. 3% above our target. Pushing back on hardware cost — they confirmed brass fitting is a £12 add-on that can be substituted.", visible_to_client: false, created_at: "2026-03-06T11:00:00Z" },
  { id: "upd-9",  product_id: "prod-9", author: "James Cole",    author_initials: "JC", text: "Production completed and packed. Pre-shipment inspection booked for 14 Mar.", visible_to_client: true,  created_at: "2026-03-12T09:00:00Z" },
  { id: "upd-10", product_id: "prod-3", author: "Priya Nair",    author_initials: "PN", text: "Container loaded at Guangzhou. B/L received. ETA Tilbury: 4 April.", visible_to_client: true,  created_at: "2026-03-01T14:00:00Z" },
];

const tasks: Task[] = [
  // proj-1 SS26
  { id: "task-1",  project_id: "proj-1", product_id: "prod-1", title: "Chase customs docs from freight forwarder", status: "in_progress",      assigned_to: "James Cole",  assigned_initials: "JC", due_date: "2026-04-25", notes: "", created_at: "2026-02-18T09:00:00Z" },
  { id: "task-2",  project_id: "proj-1", product_id: "prod-4", title: "Review R2 sample on arrival",              status: "todo",              assigned_to: "Priya Nair",  assigned_initials: "PN", due_date: "2026-04-28", notes: "", created_at: "2026-03-20T09:00:00Z" },
  { id: "task-3",  project_id: "proj-1", product_id: "prod-4", title: "Send R2 feedback to Donghua",              status: "todo",              assigned_to: "Priya Nair",  assigned_initials: "PN", due_date: "2026-05-02", notes: "", created_at: "2026-03-20T09:00:00Z" },
  { id: "task-4",  project_id: "proj-1", product_id: "prod-5", title: "Confirm beeswax candle factory — UK vs PL", status: "todo",             assigned_to: "James Cole",  assigned_initials: "JC", due_date: "2026-04-30", notes: "UK Beeswax Ltd or Polish Candle Co.", created_at: "2026-04-01T09:00:00Z" },
  { id: "task-5",  project_id: "proj-1", product_id: "prod-2", title: "Book pre-shipment inspection",             status: "done",              assigned_to: "Priya Nair",  assigned_initials: "PN", due_date: "2026-03-10", notes: "", created_at: "2026-03-01T09:00:00Z" },

  // proj-2 AW26 Gifting
  { id: "task-6",  project_id: "proj-2", product_id: "prod-6", title: "Follow up RFQ responses — 3 factories",   status: "in_progress",       assigned_to: "Priya Nair",  assigned_initials: "PN", due_date: "2026-04-22", notes: "Sent to: Donghua, BauHua, CJ Fragrance", created_at: "2026-01-25T09:00:00Z" },
  { id: "task-7",  project_id: "proj-2", product_id: null,     title: "Prepare project brief for Marble AW26",   status: "done",              assigned_to: "James Cole",  assigned_initials: "JC", due_date: "2026-01-20", notes: "", created_at: "2026-01-15T09:00:00Z" },

  // proj-3 Resort 26
  { id: "task-8",  project_id: "proj-3", product_id: "prod-7", title: "Confirm sample R2 delivery with Léa",     status: "waiting_client",    assigned_to: "James Cole",  assigned_initials: "JC", due_date: "2026-04-15", notes: "", created_at: "2026-03-10T09:00:00Z" },
  { id: "task-9",  project_id: "proj-3", product_id: "prod-8", title: "Send broderie anglaise brief to factory shortlist", status: "todo",    assigned_to: "Priya Nair",  assigned_initials: "PN", due_date: "2026-04-30", notes: "", created_at: "2026-03-15T09:00:00Z" },

  // proj-4 Nōrd AW26
  { id: "task-10", project_id: "proj-4", product_id: "prod-10", title: "Negotiate brass hardware cost with Hansson", status: "in_progress",   assigned_to: "James Cole",  assigned_initials: "JC", due_date: "2026-04-20", notes: "Target: remove or swap to steel fitting", created_at: "2026-03-06T09:00:00Z" },
  { id: "task-11", project_id: "proj-4", product_id: "prod-10", title: "Confirm FSC certification from Scandinavian Timber", status: "waiting_factory", assigned_to: "Priya Nair", assigned_initials: "PN", due_date: "2026-04-25", notes: "", created_at: "2026-03-08T09:00:00Z" },
];

export type ContractStatus = "signed" | "pending";

export interface Contract {
  id: string;
  client_id: string;
  name: string;
  status: ContractStatus;
  date: string;
  filename: string;
  size_kb: number;
}

export type FileSource = "client" | "agency";

export interface PortalFile {
  id: string;
  client_id: string;
  project_id: string | null;
  filename: string;
  size_kb: number;
  source: FileSource;
  uploaded_at: string;
}

const contracts: Contract[] = [
  { id: "ctr-1", client_id: "client-1", name: "Sourcing Agreement — SS26",        status: "signed",  date: "2025-12-10", filename: "sourcing_agreement_ss26.pdf",        size_kb: 240 },
  { id: "ctr-2", client_id: "client-1", name: "Non-Disclosure Agreement",          status: "signed",  date: "2025-11-01", filename: "nda_marble_co.pdf",                  size_kb: 120 },
  { id: "ctr-3", client_id: "client-1", name: "Sourcing Agreement — AW26 Gifting", status: "signed",  date: "2026-01-15", filename: "sourcing_agreement_aw26_gifting.pdf", size_kb: 238 },
  { id: "ctr-4", client_id: "client-2", name: "Sourcing Agreement — Resort 26",    status: "pending", date: "2026-03-20", filename: "sourcing_agreement_resort26.pdf",     size_kb: 242 },
  { id: "ctr-5", client_id: "client-3", name: "Sourcing Agreement — Nōrd AW26",    status: "pending", date: "2026-04-01", filename: "sourcing_agreement_nord_aw26.pdf",    size_kb: 242 },
];

const portal_files: PortalFile[] = [
  { id: "pf-1", client_id: "client-1", project_id: "proj-1", filename: "SS26_moodboard_v2.pdf",       size_kb: 8240,  source: "client", uploaded_at: "2025-12-05T10:00:00Z" },
  { id: "pf-2", client_id: "client-1", project_id: "proj-1", filename: "celadon_glaze_reference.jpg", size_kb: 2100,  source: "client", uploaded_at: "2025-12-08T14:30:00Z" },
  { id: "pf-3", client_id: "client-1", project_id: "proj-1", filename: "prod1_QC_report_Feb26.pdf",   size_kb: 1840,  source: "agency", uploaded_at: "2026-02-20T09:00:00Z" },
  { id: "pf-4", client_id: "client-1", project_id: "proj-1", filename: "shipping_schedule_SS26.pdf",  size_kb: 95,    source: "agency", uploaded_at: "2026-03-01T11:00:00Z" },
  { id: "pf-5", client_id: "client-1", project_id: "proj-2", filename: "AW26_gifting_brief.pdf",      size_kb: 3200,  source: "client", uploaded_at: "2026-01-20T09:00:00Z" },
  { id: "pf-6", client_id: "client-2", project_id: "proj-3", filename: "Resort26_lookbook_ref.pdf",   size_kb: 12400, source: "client", uploaded_at: "2026-01-10T10:00:00Z" },
  { id: "pf-7", client_id: "client-2", project_id: "proj-3", filename: "slip_dress_tech_pack_R2.pdf", size_kb: 540,   source: "agency", uploaded_at: "2026-03-10T14:00:00Z" },
  { id: "pf-8", client_id: "client-3", project_id: "proj-4", filename: "nord_aw26_product_brief.pdf", size_kb: 1650,  source: "client", uploaded_at: "2026-03-08T09:00:00Z" },
];

export const db = {
  clients,
  projects,
  factories,
  products,
  samples,
  milestones,
  costs,
  updates,
  tasks,
  contracts,
  portal_files,
  leads,
};
