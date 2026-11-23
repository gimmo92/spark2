// Auth gate from the core (session + 2-step cookie). The matcher must stay a literal in this file.
export { proxy } from "@spark/core/server";

export const config = {
  // everything except static assets and image optimisation
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
