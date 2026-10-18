import { Link } from "@tanstack/react-router";
import { SiteFooter, TopBar } from "@/components/SiteChrome";

export function NotFound() {
  return (
    <>
      <TopBar />
      <main className="wrap section page-pad">
        <div className="stack-6 narrow">
          <p className="meta">Page not found</p>
          <h1 className="pds-display">This court does not exist.</h1>
          <p className="body-lg">The link may be old or mistyped. Your booking is safe.</p>
          <div className="row">
            <Link to="/book" className="pds-btn pds-btn--public pds-btn--primary">Book a court</Link>
            <Link to="/" className="textlink">Back to home</Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
