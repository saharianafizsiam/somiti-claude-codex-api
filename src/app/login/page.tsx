import { LoginForm } from "@/components/login";
import { Brand } from "@/components/shell";
export const dynamic = "force-dynamic";
export default function Login() {
  return (
    <main className="login-wrap">
      <section className="login-story">
        <Brand />
        <h1>A clear view of your AI business.</h1>
        <p>
          Connect your models. Give customers access. Keep every request and
          every dollar accounted for.
        </p>
        <div className="login-graphic">
          <span>Customers</span>
          <i />
          <b>Somiti API</b>
          <i />
          <span>Your models</span>
        </div>
      </section>
      <section className="login-card">
        <h2>Admin sign in</h2>
        <p className="muted">
          Enter your username, password, and authenticator code.
        </p>
        <LoginForm />
        <p className="setup-note" style={{ marginTop: 28 }}>
          Private customer dashboard? Open the secure link provided by your
          reseller.
        </p>
        {!process.env.DATABASE_URL && (
          <p className="setup-note">
            Workspace setup required: configure your database and create the
            first owner using the README.
          </p>
        )}
      </section>
    </main>
  );
}
