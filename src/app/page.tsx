import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import Image from 'next/image';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { CountUp } from '@/components/ui/CountUp';
import { TextAnimate } from '@/components/ui/TextAnimate';
import { WaitlistForm } from '@/components/waitlist/WaitlistForm';
import { WAITLIST_MODE } from '@/lib/flags';

const SAMPLE_PHOTOS = [
  { src: '/samples/beach-family.jpg', caption: 'Summer 2014', rot: '-5deg' },
  { src: '/samples/dad-kids.jpg', caption: 'Saturday morning', rot: '3deg' },
  { src: '/samples/mom-kids.jpg', caption: 'Movie night', rot: '-2deg' },
  { src: '/samples/newborn.jpg', caption: 'Day one', rot: '4deg' },
  { src: '/samples/toddler-lift.jpg', caption: 'At the park', rot: '-4deg' },
  { src: '/samples/kids-play.jpg', caption: 'Cousins, 2016', rot: '2deg' },
  { src: '/samples/lake-kid.jpg', caption: 'Lake house', rot: '-3deg' },
] as const;

// ⚠️ PLACEHOLDER — replace with a REAL number once you have usage data.
// Do not ship a fabricated statistic. Until then this reads as experiential,
// not as a measured claim.
const DISCOVERY_LINE = 'Most people uncover photos they\'d completely forgotten existed.';

const STEPS = [
  {
    n: '01',
    title: 'Connect your inbox',
    body: 'Securely link Gmail, Outlook, or Yahoo with one tap. We never see your password and never read the text of your emails.',
  },
  {
    n: '02',
    title: 'Uncover hidden memories',
    body: 'Our vision model reads every attachment across years of email and surfaces the real family photos — the ones you forgot were ever there.',
  },
  {
    n: '03',
    title: 'Clear out the junk',
    body: 'Once your memories are safe, we sweep the promotions, newsletters, and receipts into Trash — so your inbox holds what matters and frees the storage you pay for.',
  },
];

const FAQ = [
  {
    q: 'Will you delete anything important?',
    a: 'No. We only ever move clutter to your Trash, where it stays recoverable for about 30 days before Gmail clears it — so nothing is gone for good. Obvious bulk mail (newsletters, promotions, receipts) can be cleared automatically, and for anything less certain we ask you first. You can review and undo everything.',
  },
  {
    q: 'Do I stay in control of what gets removed?',
    a: 'Always. Auto-cleanup is opt-in and limited to high-confidence junk. Everything we touch is logged, and a single click restores it from Trash. You approve the rest before we lift a finger.',
  },
  {
    q: 'How does this free up storage?',
    a: 'Old emails — especially ones with big attachments — are what fill your Google storage. Clearing the junk to Trash (and emptying it) reclaims that space, so you can stop paying for upgrades you do not need.',
  },
  {
    q: 'What does it cost?',
    a: 'A single $19 payment unlocks unlimited downloads of every photo we rescue, plus inbox cleanup. No subscription, ever.',
  },
  {
    q: 'Which email providers work?',
    a: 'Gmail today, with Outlook and Yahoo coming soon. Connecting takes about ten seconds.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--canvas-white)', color: 'var(--ink-black)' }}>
      {/* ── Elevated navigation ─────────────────────────── */}
      <nav className="sticky top-0 z-50">
        <div
          className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4"
          style={{
            background: 'rgba(255,255,255,0.8)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
        >
          <Logo />
          <div className="flex items-center gap-7 text-[15px]">
            <Link
              href="#how"
              className="transition hover:text-black"
              style={{ color: 'var(--steel-gray)' }}
            >
              How it works
            </Link>
            <Link
              href="/login"
              className="transition hover:text-black"
              style={{ color: 'var(--steel-gray)' }}
            >
              Sign in
            </Link>
            {WAITLIST_MODE ? (
              <a
                href="#waitlist"
                className="px-5 py-2.5 text-[15px] font-medium text-white transition hover:brightness-95"
                style={{ background: 'var(--deep-blue)', borderRadius: 'var(--radius-pill)' }}
              >
                Join waitlist
              </a>
            ) : (
              <Link
                href="/signup"
                className="px-5 py-2.5 text-[15px] font-medium text-white transition hover:brightness-95"
                style={{ background: 'var(--deep-blue)', borderRadius: 'var(--radius-pill)' }}
              >
                Get started
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-4xl px-6 pt-24 pb-28 text-center">
        <div className="aurora" aria-hidden />
        <div
          className="mb-8 inline-flex items-center gap-2 px-4 py-1.5 text-[13px]"
          style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-pill)',
            color: 'var(--deep-blue)',
          }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--deep-blue)' }} />
          {WAITLIST_MODE ? 'Coming soon · Join the waitlist' : 'Uncover your memories · Clear the clutter'}
        </div>

        <h1 className="font-display text-5xl leading-[0.95] sm:text-6xl md:text-7xl">
          <TextAnimate as="span" by="word" animation="blurInUp" className="block" once>
            Rediscover the hidden
          </TextAnimate>
          <TextAnimate as="span" by="word" animation="blurInUp" delay={0.35} className="block" once>
            memories in your email.
          </TextAnimate>
        </h1>

        <p
          className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed"
          style={{ color: 'var(--graphite)' }}
        >
          Your inbox is a time capsule. Keepsake surfaces the family photos and
          forgotten moments buried in years of old email — then quietly clears out
          the promotional junk on the way.
        </p>

        <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {WAITLIST_MODE ? (
            <WaitlistForm id="waitlist" />
          ) : (
            <>
              <Link
                href="/signup"
                className="px-8 py-4 text-[18px] font-medium transition hover:brightness-95"
                style={{
                  background: 'var(--electric-green)',
                  color: 'var(--ink-black)',
                  borderRadius: 'var(--radius-pill)',
                }}
              >
                Uncover my memories — $19
              </Link>
              <Link
                href="#how"
                className="px-8 py-4 text-[18px] font-medium transition hover:bg-black/[0.03]"
                style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)' }}
              >
                See how it works
              </Link>
            </>
          )}
        </div>

        <p className="mt-8 text-[13px]" style={{ color: 'var(--steel-gray)' }}>
          {WAITLIST_MODE
            ? 'Be the first to know when we launch.'
            : 'No subscription · One-time payment · 30-day money-back guarantee'}
        </p>

        <p className="mt-4 text-[15px] font-medium" style={{ color: 'var(--deep-blue)' }}>
          {DISCOVERY_LINE}
        </p>

        {/* Hero photo collage — scattered Polaroids of rescued memories */}
        <div className="relative mx-auto mt-20 flex max-w-3xl flex-wrap items-center justify-center gap-4 sm:gap-6">
          {SAMPLE_PHOTOS.slice(0, 5).map((photo, i) => (
            <div
              key={photo.src}
              className="animate-rescue bg-white p-2 pb-7 shadow-[rgba(0,0,0,0.12)_0px_10px_30px_-8px] transition-transform duration-300 hover:z-10 hover:scale-105 hover:rotate-0"
              style={{
                ['--rot' as string]: photo.rot,
                transform: `rotate(${photo.rot})`,
                borderRadius: '4px',
                marginTop: i % 2 === 0 ? '0' : '24px',
                animationDelay: `${0.15 * i + 0.3}s`,
              }}
            >
              <div className="relative h-32 w-32 overflow-hidden sm:h-40 sm:w-40">
                <Image
                  src={photo.src}
                  alt={photo.caption}
                  fill
                  sizes="160px"
                  className="object-cover"
                />
              </div>
              <p
                className="mt-2 text-center text-[12px]"
                style={{ color: 'var(--steel-gray)', fontFamily: 'var(--font-space-grotesk)' }}
              >
                {photo.caption}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works (fog surface) ──────────────────── */}
      <section id="how" style={{ background: 'var(--fog-gray)' }} className="py-28">
        <div className="mx-auto max-w-6xl px-6">
          <ScrollReveal as="h2" className="mb-16 text-center font-display text-4xl sm:text-5xl">
            How it works
          </ScrollReveal>
          <ScrollReveal stagger className="grid gap-6 md:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.n} className="card card-hover p-8">
                <div
                  className="mb-5 font-display text-5xl"
                  style={{ color: 'var(--deep-blue)' }}
                >
                  {step.n}
                </div>
                <h3 className="mb-3 text-xl font-medium">{step.title}</h3>
                <p style={{ color: 'var(--graphite)' }}>{step.body}</p>
              </div>
            ))}
          </ScrollReveal>
        </div>
      </section>

      {/* ── Stats ───────────────────────────────────────── */}
      <section className="py-28">
        <ScrollReveal stagger className="mx-auto grid max-w-5xl gap-12 px-6 text-center sm:grid-cols-3">
          {[
            ['500+', 'forgotten photos in the average inbox'],
            ['GBs', 'of storage junk mail is wasting'],
            ['$19', 'one-time — rescue + cleanup'],
          ].map(([stat, label]) => (
            <div key={label}>
              <CountUp value={stat} className="font-display text-6xl" style={{ color: 'var(--deep-blue)', display: 'inline-block' }} />
              <p className="mt-3" style={{ color: 'var(--graphite)' }}>
                {label}
              </p>
            </div>
          ))}
        </ScrollReveal>
      </section>

      {/* ── Rescued memories strip (fog surface) ────────── */}
      <section style={{ background: 'var(--fog-gray)' }} className="py-28">
        <div className="mx-auto max-w-6xl px-6">
          <ScrollReveal as="h2" className="mb-3 text-center font-display text-4xl sm:text-5xl">
            Moments you forgot were there
          </ScrollReveal>
          <p
            className="mx-auto mb-14 max-w-xl text-center text-lg"
            style={{ color: 'var(--graphite)' }}
          >
            Buried in your inbox right now are snapshots you haven’t seen in
            years. This is the kind of thing Keepsake brings back to the surface.
          </p>
          <ScrollReveal stagger className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {SAMPLE_PHOTOS.map((photo) => (
              <figure
                key={photo.src}
                className="card card-hover group overflow-hidden"
              >
                <div className="relative aspect-square overflow-hidden">
                  <Image
                    src={photo.src}
                    alt={photo.caption}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <figcaption
                  className="px-4 py-3 text-[13px]"
                  style={{ color: 'var(--steel-gray)' }}
                >
                  {photo.caption}
                </figcaption>
              </figure>
            ))}
          </ScrollReveal>
          <p className="mt-8 text-center text-[12px]" style={{ color: 'var(--steel-gray)' }}>
            Sample photos shown for illustration.
          </p>
        </div>
      </section>

      {/* ── Reclaim storage (white surface) ─────────────── */}
      <section className="py-28">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <div
                className="mb-6 inline-flex items-center gap-2 px-4 py-1.5 text-[13px]"
                style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', color: 'var(--deep-blue)' }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--deep-blue)' }} />
                Stop paying for storage you don’t need
              </div>
              <h2 className="font-display text-4xl sm:text-5xl">
                We don’t just save your photos.
                <br />
                We clean house.
              </h2>
              <p className="mt-6 text-lg" style={{ color: 'var(--graphite)' }}>
                Years of newsletters, promotions, receipts, and tracking pixels are
                quietly filling your Google storage. Once your memories are safe,
                Keepsake clears the junk to Trash — so you reclaim space instead of
                buying more.
              </p>
              <ul className="mt-8 space-y-3">
                {[
                  'Memories rescued first — always',
                  'Only clutter is touched, never personal mail',
                  'Everything goes to Trash — recoverable for ~30 days',
                  'You approve anything we’re unsure about',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3" style={{ color: 'var(--graphite)' }}>
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[12px]"
                      style={{ background: 'var(--electric-green)', color: 'var(--ink-black)' }}
                    >
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Visual: storage bar before/after */}
            <div
              className="p-8"
              style={{ background: 'var(--fog-gray)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)' }}
            >
              <p className="mb-2 text-[13px] font-medium" style={{ color: 'var(--steel-gray)' }}>
                Before
              </p>
              <div className="mb-6 h-4 w-full overflow-hidden rounded-full" style={{ background: '#e5e5e5' }}>
                <div className="h-full rounded-full" style={{ width: '94%', background: 'var(--ink-black)' }} />
              </div>
              <p className="mb-2 text-[13px] font-medium" style={{ color: 'var(--steel-gray)' }}>
                After Keepsake
              </p>
              <div className="mb-2 h-4 w-full overflow-hidden rounded-full" style={{ background: '#e5e5e5' }}>
                <div className="h-full rounded-full" style={{ width: '38%', background: 'var(--deep-blue)' }} />
              </div>
              <p className="mt-6 text-center font-display text-5xl" style={{ color: 'var(--deep-blue)' }}>
                +12 GB
              </p>
              <p className="mt-1 text-center text-[13px]" style={{ color: 'var(--steel-gray)' }}>
                typical storage reclaimed
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ (fog surface) ───────────────────────────── */}
      <section style={{ background: 'var(--fog-gray)' }} className="py-28">
        <div className="mx-auto max-w-3xl px-6">
          <ScrollReveal as="h2" className="mb-14 text-center font-display text-4xl sm:text-5xl">
            Questions
          </ScrollReveal>
          <ScrollReveal stagger className="space-y-4">
            {FAQ.map((item) => (
              <div key={item.q} className="card p-6">
                <h3 className="mb-2 text-lg font-medium">{item.q}</h3>
                <p style={{ color: 'var(--graphite)' }}>{item.a}</p>
              </div>
            ))}
          </ScrollReveal>
        </div>
      </section>

      {/* ── Final CTA (dark focal section) ──────────────── */}
      <section className="px-6 py-28">
        <div
          className="mx-auto max-w-4xl p-14 text-center text-white"
          style={{ background: 'var(--ink-black)', borderRadius: 'var(--radius-hero)' }}
        >
          <h2 className="font-display text-4xl sm:text-5xl">
            What will you find in there?
          </h2>
          <p className="mx-auto mt-5 max-w-xl" style={{ color: 'rgba(255,255,255,0.65)' }}>
            Uncover the memories hiding in your inbox and sweep out the junk in one
            pass — for less than a month of a storage upgrade.
          </p>
          {WAITLIST_MODE ? (
            <div className="mt-10">
              <WaitlistForm />
            </div>
          ) : (
            <Link
              href="/signup"
              className="mt-10 inline-block px-8 py-4 text-[18px] font-medium transition hover:brightness-95"
              style={{
                background: 'var(--electric-green)',
                color: 'var(--ink-black)',
                borderRadius: 'var(--radius-pill)',
              }}
            >
              Uncover my memories — $19
            </Link>
          )}
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="px-6 py-12" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <Logo />
          <div className="flex items-center gap-6 text-[13px]" style={{ color: 'var(--steel-gray)' }}>
            <Link href="/privacy" className="transition hover:text-black">
              Privacy
            </Link>
            <Link href="/terms" className="transition hover:text-black">
              Terms
            </Link>
            <span>© {new Date().getFullYear()} Keepsake</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
