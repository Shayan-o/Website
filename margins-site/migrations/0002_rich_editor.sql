ALTER TABLE essays ADD COLUMN content_html TEXT NOT NULL DEFAULT '';

CREATE TABLE site_content (
  page_key TEXT PRIMARY KEY,
  content_html TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO site_content (page_key, content_html) VALUES
('home-intro', '<h1>Essays, written slowly.</h1><p>Short pieces on writing, the quiet decisions inside the tools we use, and paying attention on purpose. New writing a few times a year.</p>'),
('home-newsletter', '<h2>NEWSLETTER</h2><p>Get new essays by email. Low volume, no noise.</p>'),
('footer-note', '<p>No tracking, no reader accounts. Essays are stored in the site database; newsletter email is handled by the configured delivery provider.</p>'),
('privacy', '<p>This site does not use analytics or advertising trackers. Reading essays does not require an account.</p><p>If you subscribe, we collect your email address and the time you gave consent. We send a confirmation message first; an address is added to the active newsletter list only after you confirm.</p><p>Cloudflare D1 stores the subscriber list and consent status. Resend receives your email address and the message content to send confirmation, unsubscribe, and newsletter emails. Each newsletter is sent only after the site owner chooses to send it. The signup form explains this before you submit.</p><p>You can unsubscribe using the link in any newsletter. You can also ask the site owner to remove your address. Unconfirmed signup requests are not added to the active list; stale confirmation records are cleaned up during subsequent signup processing. Active subscriptions are retained until you unsubscribe or request removal.</p><p>For privacy requests, contact <strong>[replace with the site owner’s contact email before launch]</strong>.</p>');
