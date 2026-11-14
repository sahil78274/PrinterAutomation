import LegalPage from './LegalPage.jsx';

export default function CookiePolicyPage() {
  return (
    <LegalPage title="Cookie Policy" lastUpdated="14 November 2026">
      <p>
        This Cookie Policy explains how SmartPrint uses cookies and similar technologies
        when you use our platform.
      </p>

      <section>
        <h2 className="mb-2 text-[16px] font-semibold text-ink-900">1. What Are Cookies</h2>
        <p>
          Cookies are small text files stored on your device when you visit a website. They help
          the website remember your preferences and improve your experience.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-[16px] font-semibold text-ink-900">2. Cookies We Use</h2>
        <h3 className="mb-1 mt-4 text-[14px] font-semibold text-ink-800">Essential Cookies</h3>
        <p>These are required for the Platform to function:</p>
        <ul className="list-inside list-disc space-y-1">
          <li><strong>Session token (localStorage):</strong> Stores your authentication token so you remain logged in during your session.</li>
          <li><strong>CSRF protection:</strong> Helps prevent cross-site request forgery attacks.</li>
        </ul>

        <h3 className="mb-1 mt-4 text-[14px] font-semibold text-ink-800">Functional Cookies</h3>
        <p>These improve your experience but are not strictly necessary:</p>
        <ul className="list-inside list-disc space-y-1">
          <li><strong>Preferences:</strong> Remember your settings such as theme or layout preferences.</li>
          <li><strong>Print portal state:</strong> Remember your upload progress and print options during a session.</li>
        </ul>

        <h3 className="mb-1 mt-4 text-[14px] font-semibold text-ink-800">Analytics Cookies</h3>
        <p>
          Currently, the Platform does not use third-party analytics cookies. If introduced in the
          future, this policy will be updated and consent will be requested where required.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-[16px] font-semibold text-ink-900">3. Local Storage</h2>
        <p>
          In addition to cookies, the Platform uses browser local storage to persist your
          authentication session and preferences. This data stays on your device and is not
          transmitted to our servers except when making API requests.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-[16px] font-semibold text-ink-900">4. Managing Cookies</h2>
        <p>You can control cookies through your browser settings:</p>
        <ul className="list-inside list-disc space-y-1">
          <li>View and delete existing cookies</li>
          <li>Block all cookies (this may break Platform functionality)</li>
          <li>Block third-party cookies</li>
          <li>Clear cookies when you close your browser</li>
        </ul>
        <p className="mt-2">
          Note: Blocking essential cookies will prevent you from logging in or using the Platform.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-[16px] font-semibold text-ink-900">5. Third-Party Services</h2>
        <p>
          The Platform does not embed third-party content (social media widgets, ads, etc.) that
          would set third-party cookies. If payment gateway redirects occur, those sites have
          their own cookie policies.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-[16px] font-semibold text-ink-900">6. Updates to This Policy</h2>
        <p>
          We may update this Cookie Policy as the Platform evolves. Check this page periodically
          for changes.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-[16px] font-semibold text-ink-900">7. Contact</h2>
        <p>
          For questions about our use of cookies, use the Platform&apos;s support system.
        </p>
      </section>
    </LegalPage>
  );
}
