INSERT INTO users (name, email, role, password_hash)
VALUES
  ('Sam Submitter', 'submitter@productpulse.dev', 'submitter', 'password123'),
  ('Paula Product', 'owner@productpulse.dev', 'product_owner', 'password123'),
  ('Alex Admin', 'admin@productpulse.dev', 'admin', 'password123')
ON CONFLICT (email) DO NOTHING;

INSERT INTO feedback_requests (title, description, status, priority, tags, created_by)
VALUES
  (
    'Dark mode for roadmap view',
    'Provide dark mode option for users in the roadmap and release pages.',
    'planned',
    'high',
    ARRAY['ui', 'accessibility'],
    (SELECT id FROM users WHERE email = 'submitter@productpulse.dev')
  ),
  (
    'Slack notifications for comments',
    'Notify product teams in Slack when high-priority requests receive updates.',
    'in_progress',
    'critical',
    ARRAY['integrations', 'notifications'],
    (SELECT id FROM users WHERE email = 'owner@productpulse.dev')
  ),
  (
    'CSV export for feedback list',
    'Allow export of filtered feedback as CSV for stakeholder meetings.',
    'shipped',
    'medium',
    ARRAY['reporting'],
    (SELECT id FROM users WHERE email = 'admin@productpulse.dev')
  )
ON CONFLICT DO NOTHING;

UPDATE feedback_requests
SET assigned_to = (SELECT id FROM users WHERE email = 'owner@productpulse.dev')
WHERE title = 'Slack notifications for comments';

INSERT INTO releases (title, summary, version, status, shipped_at)
VALUES
  ('Roadmap v1', 'Initial roadmap dashboard with status lanes.', '1.0.0', 'shipped', NOW() - INTERVAL '21 days'),
  ('Feedback Filters', 'Advanced search, tags, and priority filters.', '1.1.0', 'shipped', NOW() - INTERVAL '7 days'),
  ('Analytics Beta', 'Most requested features and velocity chart.', '1.2.0', 'in_progress', NULL)
ON CONFLICT DO NOTHING;

INSERT INTO milestones (name, target_date, status)
VALUES
  ('Public Feedback Portal', CURRENT_DATE + INTERVAL '14 days', 'in_progress'),
  ('Release Automation', CURRENT_DATE + INTERVAL '30 days', 'planned'),
  ('Enterprise SSO', CURRENT_DATE + INTERVAL '45 days', 'planned')
ON CONFLICT DO NOTHING;
