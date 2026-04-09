export const JWT_SECRET = process.env.JWT_SECRET || "tfa-dev-secret-change-me";

if (JWT_SECRET === "tfa-dev-secret-change-me" && process.env.NODE_ENV === "production") {
  console.error("FATAL: JWT_SECRET must be set in production");
  process.exit(1);
}
