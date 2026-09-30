CREATE TABLE essays (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL DEFAULT '',
  published_on TEXT NOT NULL,
  minutes INTEGER NOT NULL DEFAULT 1,
  tags_json TEXT NOT NULL DEFAULT '[]',
  paragraphs_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE newsletter_subscribers (
  email TEXT PRIMARY KEY,
  consent_at TEXT NOT NULL,
  confirmed_at TEXT,
  active INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE newsletter_tokens (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('confirm', 'unsubscribe')),
  expires_at INTEGER NOT NULL
);

CREATE TABLE admin_login_attempts (
  ip_hash TEXT PRIMARY KEY,
  failures INTEGER NOT NULL DEFAULT 0,
  window_started_at INTEGER NOT NULL
);

CREATE TABLE newsletter_rate_limits (
  rate_key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_started_at INTEGER NOT NULL
);

CREATE TABLE newsletter_campaigns (
  id TEXT PRIMARY KEY,
  essay_slug TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sending', 'sent', 'failed')),
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_at TEXT
);

CREATE INDEX essays_status_date ON essays(status, published_on DESC);
CREATE INDEX newsletter_active ON newsletter_subscribers(active, confirmed_at);
CREATE INDEX newsletter_token_email ON newsletter_tokens(email, purpose);

INSERT INTO essays (slug, title, excerpt, published_on, minutes, tags_json, paragraphs_json, status) VALUES
('on-writing-slowly', 'On Writing Slowly', 'Why the first draft is not the thinking, and what happens when you let a sentence sit for a week.', '2026-08-14', 6, '["Writing"]', '["The fastest way to sound certain is to write quickly. The fastest way to be right is not. A sentence written in a hurry carries the shape of the mood it was written in. Read it a week later and you can still feel the impatience in it — the clauses stacked to get somewhere, the qualifiers dropped because they slowed the rhythm. Slowness is not a virtue in itself. It is simply the only reliable way to notice that the thing you meant is not the thing you said. I have started keeping essays in a drawer for seven days before publishing them. Almost nothing survives untouched. Usually a paragraph I was proud of turns out to be an ornament, and a throwaway line in the middle turns out to be the argument. The revision is not cleanup. The revision is where the thinking actually happens, and the draft was only the excuse to get there."]', 'published'),
('the-cost-of-a-default', 'The Cost of a Default', 'Every default setting is an argument about how people should live, made quietly and at scale.', '2026-06-02', 8, '["Tools"]', '["A default is a decision someone made once, on your behalf, for millions of people who will never learn it was a decision at all. This is why the small toggles matter more than the manifestos. A stated value is cheap; a default is what actually happens. If a system claims to respect attention but ships with every notification on, the claim is decoration and the default is the policy. The useful question about any tool is not what it allows but what it makes easiest. Ease is a form of persuasion, and it works on people who believe they are immune to persuasion. So when you build something, count your defaults. They are the only part of your intentions that scales."]', 'published'),
('notes-on-quiet-interfaces', 'Notes on Quiet Interfaces', 'Restraint as a design method: what to remove, what to keep, and why silence reads as confidence.', '2026-03-19', 5, '["Design"]', '["A loud interface is usually an interface that does not trust its own content. Decoration accumulates where meaning is thin. The border appears because the hierarchy failed; the gradient appears because the typography did not carry the weight. Remove enough of it and you find out quickly whether there was anything underneath. Quiet does not mean empty. It means every visible element is load-bearing: one typeface doing two jobs well, one accent used once per page so it still means something when it arrives, generous space treated as material rather than leftover. The test is simple. Take something away. If nothing is lost, it was never there."]', 'published');
