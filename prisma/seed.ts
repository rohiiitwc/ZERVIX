import { PrismaClient, RedactionMode, Role, DocumentType, ProcessingStatus, ExportFormat } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("[ZERVIX SEED] Seeding PostgreSQL database...");

  const demoPasswordHash = await bcrypt.hash("ZervixDemo#2026", 12);

  const demoUser = await prisma.user.upsert({
    where: { email: "demo@zervix.ai" },
    update: {},
    create: {
      email: "demo@zervix.ai",
      name: "Aarav Mehta (Demo Analyst)",
      passwordHash: demoPasswordHash,
      role: Role.USER,
      emailVerified: true,
      avatarColor: "#8B5CF6",
      preferences: {
        create: {
          theme: "DARK",
          defaultRedactionMode: "PSEUDONYMIZE",
          enabledCategories: ["EMAIL", "PHONE", "IPV4", "PAN", "AADHAAR", "CREDIT_CARD"],
          emailNotifications: true,
          securityAlerts: true,
          auditDigest: true,
        },
      },
      subscription: {
        create: {
          tier: "PRO_SHIELD",
          status: "ACTIVE",
          monthlyDocLimit: 1000,
        },
      },
    },
  });

  // Seed admin account only when explicit environment credentials are supplied
  const adminSeedEmail = process.env.ADMIN_SEED_EMAIL?.trim().toLowerCase();
  const adminSeedPassword = process.env.ADMIN_SEED_PASSWORD;
  if (adminSeedEmail && adminSeedPassword) {
    const adminPasswordHash = await bcrypt.hash(adminSeedPassword, 12);
    await prisma.user.upsert({
      where: { email: adminSeedEmail },
      update: {},
      create: {
        email: adminSeedEmail,
        name: "Security Operations Admin",
        passwordHash: adminPasswordHash,
        role: Role.ADMIN,
        emailVerified: true,
        avatarColor: "#22D3EE",
        preferences: {
          create: {
            theme: "DARK",
            defaultRedactionMode: "FULL_MASK",
            enabledCategories: ["EMAIL", "PHONE", "IPV4", "PAN", "AADHAAR", "CREDIT_CARD"],
          },
        },
        subscription: {
          create: {
            tier: "ENTERPRISE_VAULT",
            status: "ACTIVE",
            monthlyDocLimit: 10000,
          },
        },
      },
    });
  }

  // Seed non-sensitive synthetic demonstration metadata ONLY if demoUser has no activities yet
  const existingActivities = await prisma.processingActivity.count({
    where: { userId: demoUser.id },
  });

  if (existingActivities === 0) {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const syntheticMetadataSamples: Array<{
      daysAgo: number;
      fileName: string;
      fileType: DocumentType;
      fileSizeBytes: number;
      rowCount: number;
      mode: RedactionMode;
      counts: Record<string, number>;
      luhnValidCards: number;
      luhnInvalidCandidates: number;
      aadhaarValidFormat: number;
      durationMs: number;
      exportedFormat: ExportFormat;
    }> = [
      {
        daysAgo: 6,
        fileName: "[SYNTHETIC DEMO] customer_support_tickets.csv",
        fileType: DocumentType.CSV,
        fileSizeBytes: 18420,
        rowCount: 42,
        mode: RedactionMode.PSEUDONYMIZE,
        counts: { EMAIL: 18, PHONE: 14, IPV4: 9, PAN: 4, AADHAAR: 2, CREDIT_CARD: 3 },
        luhnValidCards: 3,
        luhnInvalidCandidates: 1,
        aadhaarValidFormat: 2,
        durationMs: 24,
        exportedFormat: ExportFormat.CSV,
      },
      {
        daysAgo: 5,
        fileName: "[SYNTHETIC DEMO] incident_postmortem_log.txt",
        fileType: DocumentType.TXT,
        fileSizeBytes: 6410,
        rowCount: 0,
        mode: RedactionMode.FULL_MASK,
        counts: { EMAIL: 7, PHONE: 4, IPV4: 15, PAN: 1, AADHAAR: 0, CREDIT_CARD: 1 },
        luhnValidCards: 1,
        luhnInvalidCandidates: 2,
        aadhaarValidFormat: 0,
        durationMs: 11,
        exportedFormat: ExportFormat.TXT,
      },
      {
        daysAgo: 4,
        fileName: "[SYNTHETIC DEMO] vendor_onboarding_batch.csv",
        fileType: DocumentType.CSV,
        fileSizeBytes: 29100,
        rowCount: 68,
        mode: RedactionMode.PARTIAL_MASK,
        counts: { EMAIL: 25, PHONE: 22, IPV4: 4, PAN: 16, AADHAAR: 11, CREDIT_CARD: 2 },
        luhnValidCards: 2,
        luhnInvalidCandidates: 0,
        aadhaarValidFormat: 11,
        durationMs: 36,
        exportedFormat: ExportFormat.CSV,
      },
      {
        daysAgo: 2,
        fileName: "[SYNTHETIC DEMO] fintech_audit_extract.csv",
        fileType: DocumentType.CSV,
        fileSizeBytes: 14800,
        rowCount: 30,
        mode: RedactionMode.PSEUDONYMIZE,
        counts: { EMAIL: 12, PHONE: 9, IPV4: 6, PAN: 9, AADHAAR: 5, CREDIT_CARD: 6 },
        luhnValidCards: 6,
        luhnInvalidCandidates: 3,
        aadhaarValidFormat: 5,
        durationMs: 19,
        exportedFormat: ExportFormat.CSV,
      },
      {
        daysAgo: 1,
        fileName: "[SYNTHETIC DEMO] pasted_compliance_note.txt",
        fileType: DocumentType.TEXT,
        fileSizeBytes: 2340,
        rowCount: 0,
        mode: RedactionMode.PARTIAL_MASK,
        counts: { EMAIL: 4, PHONE: 3, IPV4: 2, PAN: 2, AADHAAR: 1, CREDIT_CARD: 1 },
        luhnValidCards: 1,
        luhnInvalidCandidates: 1,
        aadhaarValidFormat: 1,
        durationMs: 6,
        exportedFormat: ExportFormat.COPY,
      },
    ];

    for (const item of syntheticMetadataSamples) {
      const totalDetections = Object.values(item.counts).reduce((a, b) => a + b, 0);
      const uniqueEntities = Math.max(1, Math.round(totalDetections * 0.78));
      const createdAt = new Date(now - item.daysAgo * dayMs);

      const activity = await prisma.processingActivity.create({
        data: {
          userId: demoUser.id,
          fileName: item.fileName,
          fileType: item.fileType,
          fileSizeBytes: item.fileSizeBytes,
          rowCount: item.rowCount,
          sanitizationMode: item.mode,
          enabledCategories: ["EMAIL", "PHONE", "IPV4", "PAN", "AADHAAR", "CREDIT_CARD"],
          totalDetections,
          uniqueEntities,
          categoryCounts: item.counts,
          luhnValidCards: item.luhnValidCards,
          luhnInvalidCandidates: item.luhnInvalidCandidates,
          aadhaarValidFormat: item.aadhaarValidFormat,
          durationMs: item.durationMs,
          status: ProcessingStatus.COMPLETED,
          exportedFormat: item.exportedFormat,
          createdAt,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: demoUser.id,
          activityId: activity.id,
          action: "DOCUMENT_SANITIZED",
          fileName: item.fileName,
          sanitizationMode: item.mode,
          enabledCategories: ["EMAIL", "PHONE", "IPV4", "PAN", "AADHAAR", "CREDIT_CARD"],
          detectionCount: totalDetections,
          uniqueEntityCount: uniqueEntities,
          durationMs: item.durationMs,
          exportStatus: item.exportedFormat === "NONE" ? "NOT_EXPORTED" : `EXPORTED_${item.exportedFormat}`,
          metadata: { syntheticDemo: true, fileType: item.fileType },
          createdAt,
        },
      });
    }

    await prisma.notification.createMany({
      data: [
        {
          userId: demoUser.id,
          title: "Zero-Upload Guarantee Active",
          message: "All document parsing and PII redaction executes locally inside your browser.",
          type: "SUCCESS",
        },
        {
          userId: demoUser.id,
          title: "Synthetic Demo Dataset Loaded",
          message: "Dashboard metrics reflect non-sensitive synthetic demonstration metadata.",
          type: "INFO",
        },
      ],
    });
  }

  // Seed default ApplicationSetting values
  const defaultSettings = [
    {
      key: "MAX_FILE_SIZE_MB",
      value: "15",
      category: "WORKSPACE",
      description: "Maximum client-side document size recommended for instant browser sanitization.",
    },
    {
      key: "AI_RATE_LIMIT_PER_MIN",
      value: "20",
      category: "AI_ASSISTANT",
      description: "Maximum ZERVIX AI Assistant requests allowed per authenticated user per minute.",
    },
    {
      key: "SESSION_TTL_HOURS",
      value: "24",
      category: "SECURITY",
      description: "HTTP-only session cookie lifetime before forced re-authentication.",
    },
    {
      key: "PRIVACY_STRICT_PREFLIGHT",
      value: "true",
      category: "PRIVACY",
      description: "Enforce client + server PII preflight blocking on ZERVIX AI Assistant prompts.",
    },
  ];

  for (const s of defaultSettings) {
    await prisma.applicationSetting.upsert({
      where: { key: s.key },
      update: {},
      create: {
        ...s,
        updatedBy: adminSeedEmail ?? "system-seed",
      },
    });
  }

  // Seed genuine Prompt Engineering Log entries if empty
  const promptCount = await prisma.promptLogEntry.count();
  if (promptCount === 0) {
    await prisma.promptLogEntry.createMany({
      data: [
        {
          phase: "Phase 1 — Architecture & Design Lock",
          category: "Master Development Prompt",
          title: "ZERVIX Privacy-First Holographic Platform Blueprint",
          summary: "Defined zero-upload browser PII architecture, #050509/#8B5CF6/#22D3EE palette, and strict metadata-only persistence.",
          promptNotes: "Specified strict separation between local browser document processing and server-side metadata/auth/AI endpoints.",
          outcome: "Established PostgreSQL Prisma schema without raw document or PII storage columns.",
        },
        {
          phase: "Phase 2 — Core Detection Engine",
          category: "PII Detection & Validation",
          title: "6-Category Detector with Luhn & Verhoeff Validation",
          summary: "Implemented Email, Phone, IPv4, Indian PAN, Aadhaar-format, and Credit Card candidate detectors with deterministic overlap resolution.",
          promptNotes: "Required complete Mod-10 Luhn validation for cards and Verhoeff checksum check for 12-digit Aadhaar candidates without claiming issuance.",
          outcome: "Zero-dependency browser TypeScript modules with full character offset preservation.",
        },
        {
          phase: "Phase 3 — Sanitization & CSV Serialization",
          category: "Document Processing",
          title: "Three Redaction Modes & RFC-Safe PapaParse CSV Engine",
          summary: "Built Full Mask ([REDACTED]), Partial Mask, and session-scoped Consistent Pseudonymization (EMAIL_01, PAN_01, etc.).",
          promptNotes: "Mandated PapaParse to preserve headers, quoted commas, escaped quotes, multiline fields, and empty cells.",
          outcome: "Client-side TXT/CSV live diff preview and downloadable sanitized exports.",
        },
        {
          phase: "Phase 4 — Backend & Authentication",
          category: "Security & Persistence",
          title: "Argon/Bcrypt Auth, HTTP-Only Sessions & RBAC",
          summary: "Implemented bcryptjs (cost 12) password hashing, SHA-256 hashed HTTP-only session tokens, rate limiting, and USER/ADMIN isolation.",
          promptNotes: "Prohibited plaintext passwords, localStorage tokens, and admin access to user documents.",
          outcome: "Server-verified sessions, password reset tokens, and security event telemetry.",
        },
        {
          phase: "Phase 5 — ZERVIX AI Assistant",
          category: "AI Integration & Privacy Guard",
          title: "Server-Side ZERVIX AI Chatbot with Dual PII Preflight",
          summary: "Integrated ZERVIX AI strictly server-side with client + server PII preflight blocking and strict system instructions.",
          promptNotes: "Server AI credentials stay strictly in server env; sensitive messages are blocked before transmission.",
          outcome: "Floating ZERVIX AI Assistant with streaming-ready UX, suggested prompts, and safety guardrails.",
        },
      ],
    });
  }

  console.log("[ZERVIX SEED] Completed successfully.");
}

main()
  .catch((err) => {
    console.error("[ZERVIX SEED] Error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
