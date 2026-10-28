/**
 * Runs once when the server starts, before any request.
 *
 * The V2 Blob token was saved in Vercel as BLOG_READ_WRITE_TOKEN (a typo),
 * and a sensitive variable cannot be renamed or read back. @vercel/blob looks
 * only for BLOB_READ_WRITE_TOKEN, so the value is copied across here, on the
 * server, without ever being logged or sent to a browser. Once the variable
 * is re-created under its proper name this does nothing and can be deleted.
 */
export async function register() {
  if (!process.env.BLOB_READ_WRITE_TOKEN && process.env.BLOG_READ_WRITE_TOKEN) {
    process.env.BLOB_READ_WRITE_TOKEN = process.env.BLOG_READ_WRITE_TOKEN;
  }
}
