// @ts-nocheck
/** Helper rendering halaman dengan Layout. */
import type { Child } from "hono/jsx";
import { Layout } from "./layout";
import type { AppContext } from "../middleware/session";

export function pageProps(c: AppContext) {
  return {
    user: c.get("user"),
    isGuest: c.get("isGuest"),
    flash: c.get("flash") ?? {},
    csrfToken: c.get("csrfToken"),
  };
}

export async function renderPage(
  c: AppContext,
  meta: Parameters<typeof Layout>[0]["meta"],
  content: Child,
  bodyClass = "",
): Promise<Response> {
  const props = pageProps(c);
  const html = await (
    <Layout meta={meta} {...props} bodyClass={bodyClass}>
      {content}
    </Layout>
  );
  return c.html(html);
}

/** CSRF hidden input. */
export function csrfInput(token: string) {
  return <input type="hidden" name="_csrf" value={token} />;
}
