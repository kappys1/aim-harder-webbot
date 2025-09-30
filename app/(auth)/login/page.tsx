import { LoginContainer } from "@/modules/auth/pods/login/login.container"

export const metadata = {
  title: "Login - AimHarder CrossFit",
  description: "Access your CrossFit class reservations",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1"
}

export default function LoginPage() {
  return <LoginContainer />
}