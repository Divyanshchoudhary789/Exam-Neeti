import { redirect } from "next/navigation";

// Middleware already guarantees only an authenticated super_admin reaches this
// point (anyone else is redirected to /login before this ever renders).
export default function RootPage() {
  redirect("/dashboard");
}
