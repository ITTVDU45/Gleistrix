import { z } from "zod"

/**
 * Leere Strings wie unset behandeln (häufig in .env).
 */
function emptyToUndef(v: unknown): unknown {
  if (v === "" || v === undefined || v === null) return undefined
  return v
}

const optionalString = z.preprocess(emptyToUndef, z.string().min(1).optional())

const optionalEmail = z.preprocess(emptyToUndef, z.string().email().optional())

const optionalUrl = z.preprocess(emptyToUndef, z.string().url().optional())

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

    MONGODB_URI: optionalString,
    NEXTAUTH_SECRET: optionalString,
    NEXTAUTH_URL: optionalUrl,
    NEXT_PUBLIC_APP_URL: optionalUrl,
    NEXT_PUBLIC_WS_URL: optionalUrl,

    SUPERADMIN_EMAIL: optionalEmail,
    SUPERADMIN_PASSWORD: optionalString,
    SUPERADMIN_NAME: optionalString,

    MINIO_ENDPOINT: optionalString,
    MINIO_PORT: z.preprocess(
      (v) => (v === "" || v === undefined || v === null ? undefined : String(v)),
      z.string().optional()
    ),
    MINIO_USE_SSL: z.preprocess(emptyToUndef, z.enum(["true", "false"]).optional()),
    MINIO_ACCESS_KEY: optionalString,
    MINIO_SECRET_KEY: optionalString,
    MINIO_ROOT_USER: optionalString,
    MINIO_ROOT_PASSWORD: optionalString,
    MINIO_BUCKET: optionalString,
    MINIO_PUBLIC_URL: optionalUrl,
    MINIO_PATH_STYLE: z.preprocess(emptyToUndef, z.enum(["true", "false"]).optional()),
    MINIO_REGION: optionalString,

    EMAIL_HOST: optionalString,
    EMAIL_SERVER: optionalString,
    SMTP_HOST: optionalString,
    MAIL_HOST: optionalString,
    EMAIL_PORT: optionalString,
    SMTP_PORT: optionalString,
    EMAIL_FROM: optionalString,
    EMAIL_USER: optionalString,
    EMAIL_PASS: optionalString,
    EMAIL_SECURE: z.preprocess(emptyToUndef, z.enum(["true", "false"]).optional()),
    EMAIL_REPLY_TO: optionalString,

    MAX_UPLOAD_SIZE_BYTES: z.preprocess(
      (v) => (v === "" || v === undefined || v === null ? undefined : Number(v)),
      z.number().positive().optional()
    ),

    WS_PORT: optionalString,
  })

export type ParsedEnv = z.infer<typeof envSchema>

export interface AppConfig extends ParsedEnv {
  /** Abgeleitet aus NODE_ENV */
  isProduction: boolean
  isDevelopment: boolean
  minioPort: number
  minioUseSsl: boolean
  minioPathStyle: boolean
  maxUploadSizeBytes: number
}

function buildAppConfig(parsed: ParsedEnv): AppConfig {
  const portRaw = parsed.MINIO_PORT
  const minioPort = portRaw !== undefined && portRaw !== "" ? Number(portRaw) : 9000

  if (parsed.SUPERADMIN_EMAIL && !parsed.SUPERADMIN_PASSWORD) {
    console.warn("[config] SUPERADMIN_EMAIL ist gesetzt, SUPERADMIN_PASSWORD fehlt – ENV-Superadmin ist unwirksam")
  }
  if (parsed.SUPERADMIN_PASSWORD && !parsed.SUPERADMIN_EMAIL) {
    console.warn("[config] SUPERADMIN_PASSWORD ist gesetzt, SUPERADMIN_EMAIL fehlt – ENV-Superadmin ist unwirksam")
  }

  return {
    ...parsed,
    isProduction: parsed.NODE_ENV === "production",
    isDevelopment: parsed.NODE_ENV === "development",
    minioPort: Number.isFinite(minioPort) ? minioPort : 9000,
    minioUseSsl: parsed.MINIO_USE_SSL === "true",
    minioPathStyle: parsed.MINIO_PATH_STYLE === "true",
    maxUploadSizeBytes: parsed.MAX_UPLOAD_SIZE_BYTES ?? 50 * 1024 * 1024,
  }
}

const parsedResult = envSchema.safeParse(process.env)

function loadAppConfig(): AppConfig {
  if (!parsedResult.success) {
    const flat = parsedResult.error.flatten()
    console.error("[config] Ungültige Umgebungsvariablen:", flat.fieldErrors, flat.formErrors)
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "[config] Umgebungsvariablen ungültig (siehe Server-Log). Häufig: ungültige URL bei NEXTAUTH_URL / NEXT_PUBLIC_APP_URL."
      )
    }
    return buildAppConfig(envSchema.parse({ NODE_ENV: process.env.NODE_ENV ?? "development" }))
  }
  return buildAppConfig(parsedResult.data)
}

/**
 * Zentraler, typisierter Zugriff auf relevante `process.env`-Werte (Zod-Parsing beim Import).
 */
export const appConfig: AppConfig = loadAppConfig()

/**
 * Rohes Zod-Ergebnis (z. B. für Tests oder Diagnose).
 */
export function getEnvParseResult() {
  return parsedResult
}
