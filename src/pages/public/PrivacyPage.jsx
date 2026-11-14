import LegalPage from './LegalPage.jsx';

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="14 November 2026">
      <p>
        This Privacy Policy describes how SmartPrint (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) collects, uses, and protects
        your personal information when you use our platform.
      </p>

      <section>
        <h2 className="mb-2 text-[16px] font-semibold text-ink-900">1. Information We Collect</h2>
        <h3 className="mb-1 mt-4 text-[14px] font-semibold text-ink-800">From Customers:</h3>
        <ul className="list-inside list-disc space-y-1">
          <li>Documents uploaded for printing (temporarily stored for order fulfillment)</li>
          <li>Print specifications (page count, copies, color/B&amp;W, paper size)</li>
          <li>Order history and payment transaction records</li>
          <li>Device and browser information (for order tracking)</li>
        </ul>
        <h3 className="mb-1 mt-4 text-[14px] font-semibold text-ink-800">From Shop Owners:</h3>
        <ul className="list-inside list-disc space-y-1">
          <li>Business name, contact details, and address</li>
          <li>Account credentials (stored as hashed passwords)</li>
          <li>Machine configuration and pricing details</li>
          <li>Revenue and transaction data</li>
          <li>Payout/banking information (masked)</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-[16px] font-semibold text-ink-900">2. How We Use Your Information</h2>
        <ul className="list-inside list-disc space-y-1">
          <li>To process and fulfill print orders</li>
          <li>To facilitate payments between customers and shop owners</li>
          <li>To provide customer support and resolve disputes</li>
          <li>To send order status notifications</li>
          <li>To improve Platform functionality and user experience</li>
          <li>To comply with legal obligations</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-[16px] font-semibold text-ink-900">3. Document Retention and Deletion</h2>
        <p>
          Uploaded documents are stored temporarily to fulfill print orders. After order completion
          or cancellation, documents are scheduled for deletion. The exact retention period is
          configurable and documented in the Platform&apos;s operational settings.
        </p>
        <p className="mt-2">
          We do not guarantee instantaneous deletion. Documents may persist in backups for a
          limited period. Permanent deletion from all backups occurs within the backup rotation cycle.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-[16px] font-semibold text-ink-900">4. Data Sharing</h2>
        <p>We do not sell your personal information. We may share data with:</p>
        <ul className="list-inside list-disc space-y-1">
          <li><strong>Shop Owners</strong> — Customer order details necessary for print fulfillment</li>
          <li><strong>Payment processors</strong> — Transaction data required for payment processing</li>
          <li><strong>Service providers</strong> — Hosting, email delivery, and analytics providers under confidentiality obligations</li>
          <li><strong>Legal requirements</strong> — When required by law, court order, or regulation</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-[16px] font-semibold text-ink-900">5. Security</h2>
        <p>
          We implement industry-standard security measures including encryption in transit (TLS/HTTPS),
          secure password hashing (bcrypt), JWT-based authentication, and access controls.
          However, no system is completely secure and we cannot guarantee absolute security.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-[16px] font-semibold text-ink-900">6. Third-Party Services</h2>
        <p>The Platform may integrate with:</p>
        <ul className="list-inside list-disc space-y-1">
          <li>Payment gateways (for processing customer payments)</li>
          <li>Cloud hosting providers (for data storage)</li>
          <li>Email services (for notifications)</li>
        </ul>
        <p className="mt-2">Each third-party service has its own privacy policy.</p>
      </section>

      <section>
        <h2 className="mb-2 text-[16px] font-semibold text-ink-900">7. Your Rights</h2>
        <p>Depending on applicable law, you may have the right to:</p>
        <ul className="list-inside list-disc space-y-1">
          <li>Access your personal data</li>
          <li>Correct inaccurate data</li>
          <li>Request deletion of your data</li>
          <li>Object to processing</li>
          <li>Data portability</li>
          <li>Withdraw consent</li>
        </ul>
        <p className="mt-2">To exercise these rights, use the Platform&apos;s support system.</p>
      </section>

      <section>
        <h2 className="mb-2 text-[16px] font-semibold text-ink-900">8. Cookies</h2>
        <p>
          The Platform uses essential cookies for session management and authentication.
          See our Cookie Policy for details on cookie types and management.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-[16px] font-semibold text-ink-900">9. Children&apos;s Privacy</h2>
        <p>The Platform is not intended for users under 18 years of age. We do not knowingly collect information from children.</p>
      </section>

      <section>
        <h2 className="mb-2 text-[16px] font-semibold text-ink-900">10. Changes to This Policy</h2>
        <p>We may update this Privacy Policy periodically. Changes will be posted on this page with an updated revision date.</p>
      </section>

      <section>
        <h2 className="mb-2 text-[16px] font-semibold text-ink-900">11. Grievance Officer</h2>
        <p>
          For privacy-related concerns or to exercise your rights, use the Platform&apos;s support
          system. Contact details for the grievance officer will be provided once configured.
        </p>
      </section>
    </LegalPage>
  );
}
