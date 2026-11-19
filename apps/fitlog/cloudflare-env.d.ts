declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    FITLOG_MODERATOR_USER_IDS?: string;
  }
}
