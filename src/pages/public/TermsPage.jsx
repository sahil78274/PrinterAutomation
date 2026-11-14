import LegalPage from './LegalPage.jsx';

export default function TermsPage() {
  return (
    <LegalPage title="Terms and Conditions" lastUpdated="14 November 2026">
      <p>
        These Terms and Conditions govern your use of the SmartPrint platform (&quot;Platform&quot;),
        including the website, customer print portal, shop owner dashboard, and related services.
        By accessing or using the Platform, you agree to be bound by these terms.
      </p>

      <section>
        <h2 className="mb-2 text-[16px] font-semibold text-ink-900">1. Definitions</h2>
        <ul className="list-inside list-disc space-y-1">
          <li><strong>&quot;Platform&quot;</strong> refers to the SmartPrint service, including all web interfaces, APIs, and related software.</li>
          <li><strong>&quot;Shop Owner&quot;</strong> refers to a print business registered on the Platform to offer printing services.</li>
          <li><strong>&quot;Customer&quot;</strong> refers to an end user who uploads documents and orders prints through the Platform.</li>
          <li><strong>&quot;Print Job&quot;</strong> refers to a single print order including document, specifications, and payment.</li>
          <li><strong>&quot;Print Agent&quot;</strong> refers to the local software installed at a shop that receives and processes print jobs.</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-[16px] font-semibold text-ink-900">2. Eligibility</h2>
        <p>You must be at least 18 years old and capable of forming a binding contract to use this Platform. Shop Owners must be legally registered businesses where required by local law.</p>
      </section>

      <section>
        <h2 className="mb-2 text-[16px] font-semibold text-ink-900">3. Customer Responsibilities</h2>
        <ul className="list-inside list-disc space-y-1">
          <li>You are responsible for the content of all documents you upload.</li>
          <li>You must not upload content that infringes intellectual property rights, is obscene, defamatory, or illegal.</li>
          <li>You must not upload content containing malware or harmful code.</li>
          <li>You acknowledge that uploaded documents are processed for printing and may be retained temporarily for order fulfillment.</li>
          <li>You are responsible for verifying print specifications (page count, copies, color/B&amp;W) before payment.</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-[16px] font-semibold text-ink-900">4. Shop Owner Responsibilities</h2>
        <ul className="list-inside list-disc space-y-1">
          <li>Shop Owners must maintain accurate business information and pricing.</li>
          <li>Shop Owners must ensure their Print Agent software is kept up to date.</li>
          <li>Shop Owners are responsible for fulfilling accepted print orders in a timely manner.</li>
          <li>Shop Owners must maintain functional printing equipment and consumables.</li>
          <li>Shop Owners must not use the Platform for fraudulent transactions.</li>
          <li>Shop Owners are responsible for their own tax obligations and regulatory compliance.</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-[16px] font-semibold text-ink-900">5. Payments</h2>
        <ul className="list-inside list-disc space-y-1">
          <li>All prices are displayed in Indian Rupees (INR) inclusive of applicable taxes unless stated otherwise.</li>
          <li>Payment must be completed before a print job is queued for printing.</li>
          <li>SmartPrint acts as an intermediary facilitating payments between Customers and Shop Owners.</li>
          <li>A platform fee may be applied to each transaction as disclosed during checkout.</li>
          <li>Payment processing is handled by third-party payment providers subject to their own terms.</li>
          <li>SmartPrint does not store complete payment card details on its servers.</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-[16px] font-semibold text-ink-900">6. Subscription Plans</h2>
        <ul className="list-inside list-disc space-y-1">
          <li>Shop Owners subscribe to Platform plans (Starter, Growth, Scale) billed monthly.</li>
          <li>Subscription fees are separate from print transaction charges.</li>
          <li>Plans may be upgraded or downgraded at any time; changes take effect at the next billing cycle.</li>
          <li>Unpaid subscriptions may result in service suspension after a grace period.</li>
          <li>Cancelled subscriptions remain accessible until the end of the paid period.</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-[16px] font-semibold text-ink-900">7. Printing Failures and Disputes</h2>
        <ul className="list-inside list-disc space-y-1">
          <li>If a print job fails due to equipment malfunction, the Shop Owner should notify the Customer and initiate a refund.</li>
          <li>SmartPrint is not liable for print quality issues caused by Shop Owner equipment or settings.</li>
          <li>Disputes between Customers and Shop Owners should first be raised through the Platform&apos;s support system.</li>
          <li>SmartPrint will facilitate dispute resolution but is not a party to the printing transaction.</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-[16px] font-semibold text-ink-900">8. Intellectual Property</h2>
        <p>The SmartPrint platform, including its software, designs, and trademarks, is owned by the Platform operator. Users retain ownership of their uploaded documents. By uploading documents, you grant a limited license to process them for print order fulfillment.</p>
      </section>

      <section>
        <h2 className="mb-2 text-[16px] font-semibold text-ink-900">9. Limitation of Liability</h2>
        <p>The Platform is provided &quot;as is&quot; without warranties of any kind. SmartPrint shall not be liable for indirect, incidental, or consequential damages. Total liability is limited to the fees paid by you to the Platform in the preceding three months.</p>
      </section>

      <section>
        <h2 className="mb-2 text-[16px] font-semibold text-ink-900">10. Termination</h2>
        <p>Either party may terminate their use of the Platform at any time. SmartPrint reserves the right to suspend accounts that violate these terms or applicable law.</p>
      </section>

      <section>
        <h2 className="mb-2 text-[16px] font-semibold text-ink-900">11. Governing Law and Disputes</h2>
        <p>These terms are governed by the laws of India. Any disputes shall be subject to the jurisdiction of the courts at the Platform operator&apos;s registered location.</p>
      </section>

      <section>
        <h2 className="mb-2 text-[16px] font-semibold text-ink-900">12. Changes to Terms</h2>
        <p>We may update these terms from time to time. Material changes will be communicated via the Platform or email. Continued use after changes constitutes acceptance.</p>
      </section>

      <section>
        <h2 className="mb-2 text-[16px] font-semibold text-ink-900">13. Contact</h2>
        <p>
          For questions about these Terms, use the Platform&apos;s support system or contact
          the grievance officer through the contact details provided on the Platform once configured.
        </p>
      </section>
    </LegalPage>
  );
}
