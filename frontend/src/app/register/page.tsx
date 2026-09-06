import { Suspense } from "react";
import RegisterPage from "../../components/login/RegisterPage";

export default function RegisterRoute() {
  return (
    <Suspense fallback={null}>
      <RegisterPage />
    </Suspense>
  );
}
