-- iOS app support: Apple Sign In mapping + device tokens for push notifications

-- Apple Sign In identity mapping
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS apple_user_id text UNIQUE;
CREATE INDEX IF NOT EXISTS idx_profiles_apple_user_id
  ON profiles(apple_user_id) WHERE apple_user_id IS NOT NULL;

-- Device tokens for push notifications
CREATE TABLE IF NOT EXISTS device_tokens (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expo_token       text        NOT NULL UNIQUE,
  platform         text        NOT NULL CHECK (platform IN ('ios','android')),
  device_name      text,
  app_version      text,
  created_at       timestamptz DEFAULT now(),
  last_active_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS device_tokens_own ON device_tokens;
CREATE POLICY device_tokens_own ON device_tokens
  USING   (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
