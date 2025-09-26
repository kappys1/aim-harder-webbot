import { LoginComponent } from "./login.component"

export async function LoginContainer() {
  // Server-side data fetching if needed (e.g., OAuth providers config)
  // const oauthProviders = await getOAuthProviders()

  return (
    <LoginComponent
      // oauthProviders={oauthProviders}
    />
  )
}