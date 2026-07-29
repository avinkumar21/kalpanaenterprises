// Image Relevance Enhancement V1 - Image Resolver Utility
// Employs a strict 4-level fallback hierarchy:
// 1. Service/Permit specific Image (Priority 1)
// 2. Category Domain Image (Priority 2)
// 3. Module/Category ID Image (Priority 3)
// 4. Portal Default Image (Priority 4)

// Priority 2: Category Domain Images
export const CATEGORY_IMAGES = {
  landProperty: "https://images.unsplash.com/photo-1503387873255-3a4a2345e824?q=80&w=600&auto=format&fit=crop", // Land surveys, maps, blueprints
  revenueCertificates: "https://images.unsplash.com/photo-1568992687947-868a62a9f521?q=80&w=600&auto=format&fit=crop", // Office documents, folders
  welfare: "https://images.unsplash.com/photo-1593113598332-cd288d649433?q=80&w=600&auto=format&fit=crop", // Helping/volunteering hands (social welfare)
  agriculture: "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?q=80&w=600&auto=format&fit=crop", // Crop fields
  utilities: "https://images.unsplash.com/photo-1509391366360-2e959784a276?q=80&w=600&auto=format&fit=crop", // Electric grids, water infrastructure
  transport: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=600&auto=format&fit=crop", // Road transport, highway
  education: "https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?q=80&w=600&auto=format&fit=crop", // Digital classroom, learning
  health: "https://images.unsplash.com/photo-1538108176447-2af0512ef735?q=80&w=600&auto=format&fit=crop", // Hospitals, clinic
  employment: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?q=80&w=600&auto=format&fit=crop", // Job seekers, careers
  businessLicenses: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=600&auto=format&fit=crop", // Corporate startup offices, charts
  legalRTI: "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?q=80&w=600&auto=format&fit=crop", // Courtroom scale, gavel
  templeDarshan: "https://images.unsplash.com/photo-1590130651268-223405f6b216?q=80&w=600&auto=format&fit=crop", // Temple architecture
  travelPermitDefault: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=600&auto=format&fit=crop", // Highway road
};

// Priority 3: Module Level Images
export const MODULE_IMAGES: Record<string, string> = {
  central: "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?q=80&w=600&auto=format&fit=crop", // Parliament / central admin
  state: "https://images.unsplash.com/photo-1599009893802-db3e40acc3a4?q=80&w=600&auto=format&fit=crop", // State assembly / landmark
  temple: "https://images.unsplash.com/photo-1602631985686-2bb0f3010ae8?q=80&w=600&auto=format&fit=crop", // Temple banner
  permits: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=600&auto=format&fit=crop", // Travel permits road
  travel: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=600&auto=format&fit=crop", // Travel map
  bookings: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=600&auto=format&fit=crop", // Ticket reservation
  ca: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?q=80&w=600&auto=format&fit=crop", // Financial document
  health: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=600&auto=format&fit=crop", // Clinic/ward
  education: "/images/education_banner.png",
  updates: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=600&auto=format&fit=crop", // Newspaper / alerts
};

// Priority 4: Portal Default Image
export const PORTAL_DEFAULT_IMAGE = "https://images.unsplash.com/photo-1555899434-94d1368aa7af?q=80&w=600&auto=format&fit=crop";

// Resolve image for standard digital service cards
export const resolveServiceImage = (
  tag: string | undefined,
  categoryId: string | undefined,
  specificImage: string | undefined
): string => {
  // 1. Service Specific Image (Priority 1)
  if (specificImage && specificImage.trim() !== "") {
    return specificImage;
  }

  // 2. Category Domain Image (Priority 2)
  if (tag) {
    const t = tag.toLowerCase();
    
    // Land & Property
    if (
      t.includes("land") ||
      t.includes("property") ||
      t.includes("real estate") ||
      t.includes("housing") ||
      t.includes("bhoomi") ||
      t.includes("kaveri")
    ) {
      return CATEGORY_IMAGES.landProperty;
    }

    // Welfare (Social support, direct benefit transfers)
    if (
      t.includes("welfare") ||
      t.includes("social") ||
      t.includes("pension") ||
      t.includes("disabled") ||
      t.includes("unemployed") ||
      t.includes("benefit")
    ) {
      return CATEGORY_IMAGES.welfare;
    }

    // Revenue & Certificates
    if (
      t.includes("revenue") ||
      t.includes("certificates") ||
      t.includes("document") ||
      t.includes("records") ||
      t.includes("pan") ||
      t.includes("voter") ||
      t.includes("identity") ||
      t.includes("democracy")
    ) {
      return CATEGORY_IMAGES.revenueCertificates;
    }

    // Agriculture
    if (
      t.includes("agriculture") ||
      t.includes("rural") ||
      t.includes("farming") ||
      t.includes("crop") ||
      t.includes("tractor")
    ) {
      return CATEGORY_IMAGES.agriculture;
    }

    // Utilities
    if (
      t.includes("utilities") ||
      t.includes("electricity") ||
      t.includes("water") ||
      t.includes("telecom") ||
      t.includes("power") ||
      t.includes("eb") ||
      t.includes("sewerage") ||
      t.includes("grid") ||
      t.includes("telecommunications")
    ) {
      return CATEGORY_IMAGES.utilities;
    }

    // Transport
    if (
      t.includes("transport") ||
      t.includes("licence") ||
      t.includes("driver") ||
      t.includes("vehicle") ||
      t.includes("rto") ||
      t.includes("bus") ||
      t.includes("car") ||
      t.includes("rail") ||
      t.includes("train") ||
      t.includes("metro") ||
      t.includes("air") ||
      t.includes("aviation")
    ) {
      return CATEGORY_IMAGES.transport;
    }

    // Education
    if (
      t.includes("education") ||
      t.includes("scholarship") ||
      t.includes("admissions") ||
      t.includes("school") ||
      t.includes("student") ||
      t.includes("learning") ||
      t.includes("sslc") ||
      t.includes("puc")
    ) {
      return CATEGORY_IMAGES.education;
    }

    // Health
    if (
      t.includes("health") ||
      t.includes("vaccine") ||
      t.includes("blood") ||
      t.includes("hospital") ||
      t.includes("clinic") ||
      t.includes("medical") ||
      t.includes("doctor")
    ) {
      return CATEGORY_IMAGES.health;
    }

    // Employment
    if (
      t.includes("employment") ||
      t.includes("job") ||
      t.includes("career") ||
      t.includes("recruitment") ||
      t.includes("labour") ||
      t.includes("skill")
    ) {
      return CATEGORY_IMAGES.employment;
    }

    // Business & Licenses
    if (
      t.includes("business") ||
      t.includes("gst") ||
      t.includes("startup") ||
      t.includes("licenses") ||
      t.includes("company") ||
      t.includes("trade")
    ) {
      return CATEGORY_IMAGES.businessLicenses;
    }

    // Legal & RTI
    if (
      t.includes("legal") ||
      t.includes("court") ||
      t.includes("justice") ||
      t.includes("rti") ||
      t.includes("law")
    ) {
      return CATEGORY_IMAGES.legalRTI;
    }

    // Temple & Darshan
    if (
      t.includes("temple") ||
      t.includes("darshan") ||
      t.includes("pooja")
    ) {
      return CATEGORY_IMAGES.templeDarshan;
    }
  }

  // 3. Module/Category Level Image (Priority 3)
  if (categoryId && MODULE_IMAGES[categoryId]) {
    return MODULE_IMAGES[categoryId];
  }

  // 4. Portal Default Image (Priority 4)
  return PORTAL_DEFAULT_IMAGE;
};

// Travel Permit Categories Images Mapping (Priority 2)
export const PERMIT_CATEGORY_IMAGES: Record<string, string> = {
  pc_hill: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=600&auto=format&fit=crop",
  pc_forest: "https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=600&auto=format&fit=crop",
  pc_eco: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=600&auto=format&fit=crop",
  pc_vehicle: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?q=80&w=600&auto=format&fit=crop",
  pc_camping: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?q=80&w=600&auto=format&fit=crop",
  pc_tourism: "https://images.unsplash.com/photo-1500835595337-f7400171aa6b?q=80&w=600&auto=format&fit=crop",
  pc_restricted: "https://images.unsplash.com/photo-1486916856992-e4db22c8df33?q=80&w=600&auto=format&fit=crop",
  pc_special: "https://images.unsplash.com/photo-1473163928189-364b2c4e1135?q=80&w=600&auto=format&fit=crop"
};

// Resolve image for Travel Permit cards
export const resolvePermitImage = (permit: {
  image?: string;
  category?: string;
}): string => {
  // 1. Specific Permit Image (Priority 1)
  if (permit.image && permit.image.trim() !== "") {
    return permit.image;
  }

  // 2. Permit Category Image (Priority 2)
  if (permit.category && PERMIT_CATEGORY_IMAGES[permit.category]) {
    return PERMIT_CATEGORY_IMAGES[permit.category];
  }

  // 3. Module level fallback (Priority 3)
  if (MODULE_IMAGES.permits) {
    return MODULE_IMAGES.permits;
  }

  // 4. Default Portal Image fallback (Priority 4)
  return PORTAL_DEFAULT_IMAGE;
};
