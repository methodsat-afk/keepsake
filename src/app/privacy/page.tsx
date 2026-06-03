import type { Metadata } from 'next';
import { LegalShell, LegalSection } from '@/components/legal/LegalShell';

export const metadata: Metadata = {
  title: 'Privacy Policy — Keepsake',
  description:
    'How Keepsake collects, uses, and protects your data, including Google user data accessed through the Gmail API.',
};

const CONTACT_EMAIL = 'support@keepsake.app';

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="May 31, 2026">
      <p>
        Keepsake (“we”, “us”) helps you find and rescue personal photos buried in
        your email. This policy explains what we collect, how we use it, and the
        choices you have. We collect as little as possible and never sell your
        data.
      </p>

      <LegalSection heading="Information we collect">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong style={{ color: 'var(--foreground)' }}>Account info:</strong> the
            email address you sign up with, used to authenticate you.
          </li>
          <li>
            <strong style={{ color: 'var(--foreground)' }}>Google authorization:</strong>{' '}
            an OAuth token that lets us scan your inbox for photo attachments
            and, with your consent, move junk mail to your Trash. We never
            receive your Google password.
          </li>
          <li>
            <strong style={{ color: 'var(--foreground)' }}>Rescued photos:</strong> the
            image attachments our AI identifies as personal photos, plus basic
            metadata (sender, subject, date) so we can organize them.
          </li>
          <li>
            <strong style={{ color: 'var(--foreground)' }}>Payment info:</strong>{' '}
            processed by Stripe. We store a customer and payment reference, never
            your full card number.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="How we use Google user data">
        <p>
          We request Gmail access for two purposes only: to locate and retrieve the
          photo attachments you ask us to rescue, and — with your permission — to
          move unwanted bulk mail to your Trash so you can reclaim storage. Items
          are only ever moved to Trash, where Gmail keeps them recoverable for about
          30 days; we do not permanently delete your mail. We do not read, store, or
          index the body text of your emails, we never use Gmail data for
          advertising, and we never send email on your behalf. High-confidence junk
          may be cleared automatically only if you opt in; otherwise we ask you to
          review and approve before anything is moved.
        </p>
        <p>
          To decide whether an attachment is a genuine personal photo (versus a
          logo, receipt, or tracking pixel), images are sent to our AI provider
          (Anthropic) for classification. They are processed transiently for this
          purpose and not used to train models.
        </p>
        <p style={{ color: 'var(--foreground)' }}>
          Keepsake’s use and transfer of information received from Google APIs to
          any other app will adhere to the{' '}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
            style={{ color: 'var(--or-light)' }}
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
      </LegalSection>

      <LegalSection heading="Who we share data with">
        <p>We use a small number of trusted processors to run Keepsake:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong style={{ color: 'var(--foreground)' }}>Supabase</strong> — authentication, database, and secure photo storage.</li>
          <li><strong style={{ color: 'var(--foreground)' }}>Stripe</strong> — payment processing.</li>
          <li><strong style={{ color: 'var(--foreground)' }}>Anthropic</strong> — transient AI image classification.</li>
        </ul>
        <p>We do not sell your personal information to anyone.</p>
      </LegalSection>

      <LegalSection heading="Retention and deletion">
        <p>
          You can disconnect your inbox at any time, which revokes our access. You
          may request deletion of your account and all rescued photos by emailing{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2" style={{ color: 'var(--or-light)' }}>
            {CONTACT_EMAIL}
          </a>
          . We delete your data within 30 days of a verified request.
        </p>
      </LegalSection>

      <LegalSection heading="Security">
        <p>
          Data is encrypted in transit. Access tokens and stored photos are kept in
          access-controlled infrastructure. No system is perfectly secure, but we
          work to protect your memories as if they were our own.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Questions about this policy? Email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2" style={{ color: 'var(--or-light)' }}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
    </LegalShell>
  );
}
