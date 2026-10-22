# Transparency, navigation and demonstration data

Public routes `/privacy` and `/terms` explain the current prototype rather than
claiming regulatory approval or absolute security. They disclose the data actually
collected, Gemini processing, browser speech/cloud audio paths, authentication,
private attachment storage, backend OCR caches and retention limitations.
They prohibit reliance on AI for diagnosis, prescribing or treatment decisions.
Google's unpaid-service restrictions and official terms are linked. Until an
official support address is available, the existing feedback form is the published
contact route. No fictional address or legal entity is invented.

The footer links to both policies and the feedback section. Scanner and feedback
interfaces provide contextual privacy notices. The custom App Router `not-found`
page returns users to the home page or catalog. A decorative scroll-progress
indicator runs locally with passive scroll listeners and resize observation;
it makes no network requests and stores no user activity.

Synthetic marketplace data remains in an explicitly labeled demonstration.
Catalog, cart, order and concierge views disclose simulated pharmacies, licenses,
stock and fulfillment. Orders associated with demo inventory are marked as demo,
even when the buyer is not the seeded demo account or the note lacks `[DEMO]`.
Admin analytics default to explicitly labeled simulated metrics for presentations;
an explicit switch opens non-demo activity. Both groups use their own totals, category demand,
queues and low-stock lists. Legacy combined response fields remain compatible,
but `real_metrics` / `demo_metrics` drive the current dashboard.

The runtime homepage has no fabricated testimonial section, and the local app
databases contained no feedback rows at the audit. Genuine feedback is not erased
based on guessed names. Automated test fixtures remain isolated and are not
presented as real users, sales or reviews.

Verification: isolated backend pytest, `node scripts/build-web-isolated.cjs`, and
the catalog, marketplace, private-upload and OCR-concierge frontend checks. The
demo analytics regressions verify independent metrics and order classification.
