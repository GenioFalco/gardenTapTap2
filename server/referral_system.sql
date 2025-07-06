-- Таблица для хранения реферальных кодов пользователей
CREATE TABLE IF NOT EXISTS referral_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id),
  UNIQUE(code)
);

-- Таблица для хранения информации об отправленных приглашениях
CREATE TABLE IF NOT EXISTS referral_invitations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_id TEXT NOT NULL,
  referee_id TEXT,
  is_accepted INTEGER DEFAULT 0,
  coins_rewarded INTEGER DEFAULT 0,
  sent_at TEXT NOT NULL,
  accepted_at TEXT
);

-- Таблица для хранения информации о применении реферальных кодов
CREATE TABLE IF NOT EXISTS referral_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  referrer_id TEXT NOT NULL,
  code TEXT NOT NULL,
  applied_at TEXT NOT NULL,
  UNIQUE(user_id)
);

-- Создаем индексы для ускорения поиска
CREATE INDEX IF NOT EXISTS idx_referral_codes_user_id ON referral_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_invitations_referrer_id ON referral_invitations(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_invitations_referee_id ON referral_invitations(referee_id);
CREATE INDEX IF NOT EXISTS idx_referral_applications_user_id ON referral_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_applications_referrer_id ON referral_applications(referrer_id); 