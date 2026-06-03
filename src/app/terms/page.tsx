import type { Metadata } from 'next';
import { LegalShell, LegalSection } from '@/components/legal/LegalShell';

export const metadata: Metadata = {
  title: 'Terms of Service — Keepsake',
  description: 'The terms governing your use of Keepsake.',
};

const CONTACT_EMAIL = 'support@keepsake.app';

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="May 31, 2026">
      <p>
        These terms govern your use of Keepsake. By creating an account or using
        the service, you agree to them.
      </p>

      <LegalSection heading="What Keepsake does">
        <p>
          Keepsake scans your connected inbox, uses AI to
          identify personal photos, and lets you preview them for free. A one-time
          payment of $19 unlocks downloading the full set as a ZIP organized by
          year, plus a private gallery.
        </p>
      </LegalSection>

      <LegalSection heading="Your content">
        <p>
          Your photos are yours. You retain all rights to the images you rescue.
          You grant us only the limited permission needed to process, store, and
          deliver them back to you. We claim no ownership of your memories.
        </p>
      </LegalSection>

      <LegalSection heading="Payment and refunds">
        <p>
          Keepsake costs a single $19 payment — there is no subscription. If you’re
          not satisfied, you may request a full refund within 30 days of purchase
          from your{' '}
          <a href="/refund" className="underline underline-offset-2" style={{ color: 'var(--or-light)' }}>
            account refund page
          </a>
          . Refunds return your payment to its original method and revoke download
          access.
        </p>
      </LegalSection>

      <LegalSection heading="Acceptable use">
        <p>
          You agree to use Keepsake only with inboxes you own or are authorized to
          access, and not to misuse, disrupt, or attempt to gain unauthorized
          access to the service.
        </p>
      </LegalSection>

      <LegalSection heading="Disclaimers">
        <p>
          Keepsake is provided “as is.” AI photo detection is not perfect and may
          occasionally miss a photo or include a non-photo. We do our best but
          can’t guarantee every image is captured. To the maximum extent permitted
          by law, we are not liable for indirect or consequential damages.
        </p>
      </LegalSection>

      <LegalSection heading="Changes and contact">
        <p>
          We may update these terms from time to time; material changes will be
          reflected by the “last updated” date above. Questions? Email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2" style={{ color: 'var(--or-light)' }}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
    </LegalShell>
  );
}
