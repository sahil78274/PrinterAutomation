import LegalPage from './LegalPage.jsx';

export default function RefundPolicyPage() {
  return (
    <LegalPage title="Refund and Cancellation Policy" lastUpdated="14 November 2026">
      <p>
        This policy describes the refund and cancellation terms for print orders placed through
        the SmartPrint platform.
      </p>

      <section>
        <h2 className="mb-2 text-[16px] font-semibold text-ink-900">1. Order Cancellation by Customer</h2>
        <ul className="list-inside list-disc space-y-1">
          <li>Orders can be cancelled before payment is completed at no charge.</li>
          <li>Once payment is confirmed, orders cannot be cancelled through the Platform — you must request a refund.</li>
          <li>Orders already in &quot;Printing&quot; status cannot be cancelled.</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-[16px] font-semibold text-ink-900">2. Refund Eligibility</h2>
        <p>A full refund may be issued in the following cases:</p>
        <ul className="list-inside list-disc space-y-1">
          <li><strong>Print failure:</strong> The job was not printed due to equipment malfunction or Print Agent failure.</li>
          <li><strong>Duplicate charge:</strong> You were charged more than once for the same order.</li>
          <li><strong>Incorrect order:</strong> The printed output does not match the specifications you selected (wrong pages, wrong copies, wrong color/B&amp;W setting) due to a system error.</li>
          <li><strong>Shop unavailability:</strong> The Shop Owner cannot fulfill the order within a reasonable time.</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-[16px] font-semibold text-ink-900">3. Non-Refundable Cases</h2>
        <ul className="list-inside list-disc space-y-1">
          <li>Customer uploaded the wrong document or selected incorrect specifications.</li>
          <li>Minor quality differences (slight color variation, paper texture) that are within normal printing tolerances.</li>
          <li>The Customer has already collected the printed output.</li>
          <li>Payment was declined or failed — no charge was made.</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-[16px] font-semibold text-ink-900">4. Refund Process</h2>
        <ol className="list-inside list-decimal space-y-1">
          <li>Raise the refund request through the Platform&apos;s support system within 48 hours of the order.</li>
          <li>Provide the order ID and reason for the refund request.</li>
          <li>The Shop Owner and/or Platform team will review the request.</li>
          <li>If approved, the refund will be processed to the original payment method.</li>
          <li>Refunds typically take 5–7 business days to reflect in your account, depending on your bank/payment provider.</li>
        </ol>
      </section>

      <section>
        <h2 className="mb-2 text-[16px] font-semibold text-ink-900">5. Platform Fee</h2>
        <p>
          The SmartPrint platform fee is non-refundable once a print job has been processed.
          Only the base print cost is eligible for refund in case of a verified print failure.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-[16px] font-semibold text-ink-900">6. Subscription Refunds</h2>
        <ul className="list-inside list-disc space-y-1">
          <li>Subscription plans can be cancelled at any time; the subscription remains active until the end of the paid period.</li>
          <li>No pro-rata refunds are issued for partial months.</li>
          <li>Refunds for annual plans (if applicable) will be evaluated case by case.</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-[16px] font-semibold text-ink-900">7. Disputes</h2>
        <p>
          If your refund request is denied and you believe it was unfairly handled, escalate through
          the Platform&apos;s support system. SmartPrint will review the case and provide a final decision.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-[16px] font-semibold text-ink-900">8. Contact</h2>
        <p>
          For refund-related queries, raise a support ticket through the Platform.
          Contact details will be provided once configured by the Platform operator.
        </p>
      </section>
    </LegalPage>
  );
}
