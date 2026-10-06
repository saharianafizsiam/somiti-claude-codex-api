import Link from "next/link";
import { Brand } from "@/components/shell";
import { HomeConnection } from "@/components/home-connection";
import { KeyRound, ScanLine, Wallet, ArrowUpRight } from "lucide-react";

export default function Home() {
  return (
    <main className="landing">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="landing-nav">
        <Brand />
        <nav aria-label="Main navigation">
          <a href="#connect">API setup</a>
          <a href="#access">Your access</a>
          <Link className="button button-secondary" href="/login">
            Sign in <ArrowUpRight size={15} />
          </Link>
        </nav>
      </header>
      <section className="landing-hero" id="main-content">
        <div className="hero-copy">
          <span className="hero-tag">
            <span /> Your models. One workspace.
          </span>
          <h1>
            Your next idea.
            <br />
            Connected.
          </h1>
          <p>
            Bring AI into what you build. Access your available models, manage
            your API credit, and see exactly what each request costs with SOMITI
            API.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#connect">
              Explore API setup <ArrowUpRight size={17} />
            </a>
            <Link className="button button-secondary" href="/dashboard">
              Open workspace
            </Link>
          </div>
          <p className="hero-footnote">
            Already have access? Your private dashboard link has your key,
            models, and balance.
          </p>
        </div>
        <div
          className="connection-art"
          aria-label="One Somiti key connects to API v1 and API v2"
        >
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="glass-key">
            <KeyRound size={25} />
            <span>Your Somiti key</span>
            <code>sk-somiti_••••••••</code>
          </div>
          <div className="connection-stem" />
          <div className="provider-pair">
            <div className="provider-tile">
              <span className="route-chip">/v1</span>
              <strong>API v1</strong>
              <span>Your enabled models</span>
            </div>
            <div className="provider-tile">
              <span className="route-chip">/v2</span>
              <strong>API v2</strong>
              <span>Your enabled models</span>
            </div>
          </div>
          <div className="connection-caption">
            <Wallet size={15} /> One key. A shared credit balance.
          </div>
        </div>
      </section>
      <section
        className="landing-benefits"
        id="access"
        aria-label="Manage your API access"
      >
        <article>
          <KeyRound size={23} />
          <h2>Access that stays yours.</h2>
          <p>
            Use your Somiti key with the models assigned to you. Keep it secure
            in your own application.
          </p>
        </article>
        <article>
          <Wallet size={23} />
          <h2>Know your balance.</h2>
          <p>
            Check available, used, and reserved credit from your private
            customer dashboard.
          </p>
        </article>
        <article>
          <ScanLine size={23} />
          <h2>Follow every request.</h2>
          <p>
            Review request history, reported token usage, and settled costs in
            one place.
          </p>
        </article>
      </section>
      <section className="landing-connect" id="connect">
        <div>
          <h2>
            A familiar API.
            <br />A clear way in.
          </h2>
          <p>
            Choose your model’s API route, then use an enabled model ID from
            your private dashboard. Both routes use the same Somiti key.
          </p>
          <p className="muted">
            Model availability and supported endpoints depend on your assigned
            access.
          </p>
        </div>
        <HomeConnection />
      </section>
      <section className="landing-faq">
        <h2>A few things to know</h2>
        <details>
          <summary>How do I get an API key?</summary>
          <p>
            Ask your Somiti reseller for access. They provide a private
            dashboard link where you can reveal your key, see your allowed
            models, and check your credit. Workspace sign-in is for account
            administrators.
          </p>
        </details>
        <details>
          <summary>Which base URL should I use?</summary>
          <p>
            Your private dashboard shows the complete API v1 and API v2 URLs.
            Use the route listed beside your model. A model only works on its
            assigned API route.
          </p>
        </details>
        <details>
          <summary>Do the two routes have separate balances?</summary>
          <p>
            No. Both routes use your Somiti key’s shared credit balance and
            access permissions. Your dashboard brings usage from both routes
            together.
          </p>
        </details>
      </section>
      <footer className="landing-footer">
        <Brand />
        <span>Build something worth connecting.</span>
        <Link href="/login">Workspace sign in</Link>
      </footer>
    </main>
  );
}
