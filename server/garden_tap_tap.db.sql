BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "achievement_congratulations" (
	"id"	INTEGER,
	"user_id"	TEXT NOT NULL,
	"achievement_id"	INTEGER NOT NULL,
	"achievement_name"	TEXT NOT NULL,
	"achievement_description"	TEXT NOT NULL,
	"image_path"	TEXT NOT NULL,
	"is_shown"	INTEGER NOT NULL DEFAULT 0,
	"created_at"	TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"shown_at"	TEXT,
	PRIMARY KEY("id" AUTOINCREMENT),
	UNIQUE("user_id","achievement_id")
);
CREATE TABLE IF NOT EXISTS "achievements" (
	"id"	INTEGER,
	"name"	TEXT NOT NULL,
	"description"	TEXT NOT NULL,
	"condition_type"	TEXT NOT NULL,
	"condition_value"	INTEGER NOT NULL,
	"image_path"	TEXT NOT NULL,
	PRIMARY KEY("id")
);
CREATE TABLE IF NOT EXISTS "character_appearances" (
	"id"	INTEGER,
	"character_id"	INTEGER NOT NULL,
	"tool_id"	INTEGER NOT NULL,
	"image_path"	TEXT NOT NULL,
	"animation_type"	TEXT NOT NULL,
	"animation_path"	TEXT NOT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("character_id") REFERENCES "characters"("id"),
	FOREIGN KEY("tool_id") REFERENCES "tools"("id")
);
CREATE TABLE IF NOT EXISTS "characters" (
	"id"	INTEGER,
	"name"	TEXT NOT NULL,
	"animation_type"	TEXT NOT NULL,
	"animation_path"	TEXT NOT NULL,
	"frame_count"	INTEGER,
	PRIMARY KEY("id")
);
CREATE TABLE IF NOT EXISTS "currencies" (
	"id"	INTEGER,
	"name"	TEXT NOT NULL,
	"code"	TEXT NOT NULL UNIQUE,
	"image_path"	TEXT NOT NULL,
	"created_at"	TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	"updated_at"	TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id")
);
CREATE TABLE IF NOT EXISTS "helper_levels" (
	"helper_id"	INTEGER NOT NULL,
	"level"	INTEGER NOT NULL,
	"income_per_hour"	REAL NOT NULL,
	"upgrade_cost"	INTEGER NOT NULL,
	"currency_id"	INTEGER NOT NULL,
	PRIMARY KEY("helper_id","level"),
	FOREIGN KEY("currency_id") REFERENCES "currencies"("id"),
	FOREIGN KEY("helper_id") REFERENCES "helpers"("id")
);
CREATE TABLE IF NOT EXISTS "helpers" (
	"id"	INTEGER,
	"name"	TEXT NOT NULL,
	"location_id"	INTEGER NOT NULL,
	"unlock_level"	INTEGER NOT NULL,
	"unlock_cost"	INTEGER NOT NULL,
	"currency_id"	INTEGER NOT NULL,
	"max_level"	INTEGER NOT NULL,
	"image_path"	TEXT NOT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("currency_id") REFERENCES "currencies"("id"),
	FOREIGN KEY("location_id") REFERENCES "locations"("id")
);
CREATE TABLE IF NOT EXISTS "levels" (
	"level"	INTEGER,
	"required_exp"	INTEGER NOT NULL,
	PRIMARY KEY("level")
);
CREATE TABLE IF NOT EXISTS "locations" (
	"id"	INTEGER,
	"name"	TEXT NOT NULL,
	"background"	TEXT NOT NULL,
	"currency_id"	INTEGER NOT NULL,
	"character_id"	INTEGER NOT NULL,
	"unlock_level"	INTEGER NOT NULL,
	"unlock_cost"	INTEGER NOT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("character_id") REFERENCES "characters"("id"),
	FOREIGN KEY("currency_id") REFERENCES "currencies"("id")
);
CREATE TABLE IF NOT EXISTS "player_achievements" (
	"id"	INTEGER,
	"user_id"	TEXT NOT NULL,
	"achievement_id"	INTEGER NOT NULL,
	"date_unlocked"	TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id" AUTOINCREMENT),
	UNIQUE("user_id","achievement_id")
);
CREATE TABLE IF NOT EXISTS "player_currencies" (
	"user_id"	TEXT NOT NULL,
	"currency_id"	INTEGER NOT NULL,
	"amount"	REAL NOT NULL DEFAULT 0,
	PRIMARY KEY("user_id","currency_id"),
	FOREIGN KEY("currency_id") REFERENCES "currencies"("id")
);
CREATE TABLE IF NOT EXISTS "player_equipped_tools" (
	"user_id"	TEXT NOT NULL,
	"character_id"	INTEGER NOT NULL,
	"tool_id"	INTEGER NOT NULL,
	PRIMARY KEY("user_id","character_id"),
	FOREIGN KEY("character_id") REFERENCES "characters"("id"),
	FOREIGN KEY("tool_id") REFERENCES "tools"("id")
);
CREATE TABLE IF NOT EXISTS "player_helpers" (
	"user_id"	TEXT NOT NULL,
	"helper_id"	INTEGER NOT NULL,
	"level"	INTEGER NOT NULL DEFAULT 1,
	PRIMARY KEY("user_id","helper_id"),
	FOREIGN KEY("helper_id") REFERENCES "helpers"("id")
);
CREATE TABLE IF NOT EXISTS "player_locations" (
	"user_id"	TEXT NOT NULL,
	"location_id"	INTEGER NOT NULL,
	PRIMARY KEY("user_id","location_id"),
	FOREIGN KEY("location_id") REFERENCES "locations"("id")
);
CREATE TABLE IF NOT EXISTS "player_login_history" (
	"id"	INTEGER,
	"user_id"	TEXT NOT NULL,
	"login_date"	TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id" AUTOINCREMENT),
	UNIQUE("user_id","login_date")
);
CREATE TABLE IF NOT EXISTS "player_notifications" (
	"id"	INTEGER,
	"user_id"	TEXT NOT NULL,
	"type"	TEXT NOT NULL,
	"title"	TEXT NOT NULL,
	"message"	TEXT NOT NULL,
	"related_id"	INTEGER,
	"image_path"	TEXT,
	"is_read"	INTEGER NOT NULL DEFAULT 0,
	"created_at"	TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"read_at"	TEXT,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "player_pending_income" (
	"user_id"	TEXT NOT NULL,
	"currency_id"	INTEGER NOT NULL,
	"amount"	REAL NOT NULL DEFAULT 0,
	PRIMARY KEY("user_id","currency_id"),
	FOREIGN KEY("currency_id") REFERENCES "currencies"("id")
);
CREATE TABLE IF NOT EXISTS "player_profile" (
	"user_id"	TEXT,
	"current_rank_id"	INTEGER,
	"highest_rank_id"	INTEGER,
	"last_rank_id"	INTEGER,
	"featured_achievement_id"	INTEGER,
	"avatar_path"	TEXT,
	"total_points"	INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY("user_id"),
	FOREIGN KEY("current_rank_id") REFERENCES "ranks"("id"),
	FOREIGN KEY("featured_achievement_id") REFERENCES "achievements"("id"),
	FOREIGN KEY("highest_rank_id") REFERENCES "ranks"("id"),
	FOREIGN KEY("last_rank_id") REFERENCES "ranks"("id")
);
CREATE TABLE IF NOT EXISTS "player_progress" (
	"user_id"	TEXT,
	"level"	INTEGER NOT NULL DEFAULT 1,
	"experience"	INTEGER NOT NULL DEFAULT 0,
	"energy"	INTEGER NOT NULL DEFAULT 100,
	"max_energy"	INTEGER NOT NULL DEFAULT 100,
	"last_energy_refill_time"	TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	"last_login"	TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("user_id")
);
CREATE TABLE IF NOT EXISTS "player_season" (
	"user_id"	TEXT NOT NULL,
	"season_id"	INTEGER NOT NULL,
	"points"	INTEGER NOT NULL DEFAULT 0,
	"rank_id"	INTEGER,
	"highest_rank_id"	INTEGER,
	PRIMARY KEY("user_id","season_id"),
	FOREIGN KEY("highest_rank_id") REFERENCES "ranks"("id"),
	FOREIGN KEY("rank_id") REFERENCES "ranks"("id"),
	FOREIGN KEY("season_id") REFERENCES "seasons"("id")
);
CREATE TABLE IF NOT EXISTS "player_stats" (
	"user_id"	TEXT,
	"total_taps"	INTEGER NOT NULL DEFAULT 0,
	"total_resources_gained"	INTEGER NOT NULL DEFAULT 0,
	"total_energy_spent"	INTEGER NOT NULL DEFAULT 0,
	"last_updated"	TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("user_id")
);
CREATE TABLE IF NOT EXISTS "player_storage_limits" (
	"user_id"	TEXT NOT NULL,
	"location_id"	INTEGER NOT NULL,
	"currency_id"	INTEGER NOT NULL,
	"storage_level"	INTEGER NOT NULL DEFAULT 1,
	"capacity"	INTEGER NOT NULL,
	PRIMARY KEY("user_id","location_id","currency_id"),
	FOREIGN KEY("currency_id") REFERENCES "currencies"("id"),
	FOREIGN KEY("location_id") REFERENCES "locations"("id")
);
CREATE TABLE IF NOT EXISTS "player_tools" (
	"user_id"	TEXT NOT NULL,
	"tool_id"	INTEGER NOT NULL,
	PRIMARY KEY("user_id","tool_id"),
	FOREIGN KEY("tool_id") REFERENCES "tools"("id")
);
CREATE TABLE IF NOT EXISTS "ranks" (
	"id"	INTEGER,
	"name"	TEXT NOT NULL,
	"min_points"	INTEGER NOT NULL,
	"image_path"	TEXT NOT NULL,
	PRIMARY KEY("id")
);
CREATE TABLE IF NOT EXISTS "rewards" (
	"id"	INTEGER,
	"level_id"	INTEGER NOT NULL,
	"reward_type"	TEXT NOT NULL,
	"currency_id"	INTEGER,
	"amount"	INTEGER,
	"target_id"	INTEGER,
	PRIMARY KEY("id"),
	FOREIGN KEY("currency_id") REFERENCES "currencies"("id"),
	FOREIGN KEY("level_id") REFERENCES "levels"("level")
);
CREATE TABLE IF NOT EXISTS "seasons" (
	"id"	INTEGER,
	"name"	TEXT NOT NULL,
	"start_date"	TIMESTAMP NOT NULL,
	"end_date"	TIMESTAMP NOT NULL,
	"description"	TEXT,
	"is_active"	BOOLEAN DEFAULT FALSE,
	PRIMARY KEY("id")
);
CREATE TABLE IF NOT EXISTS "storage_upgrade_levels" (
	"location_id"	INTEGER NOT NULL,
	"level"	INTEGER NOT NULL,
	"capacity"	INTEGER NOT NULL,
	"upgrade_cost"	INTEGER NOT NULL,
	"currency_id"	INTEGER NOT NULL,
	PRIMARY KEY("location_id","level"),
	FOREIGN KEY("currency_id") REFERENCES "currencies"("id"),
	FOREIGN KEY("location_id") REFERENCES "locations"("id")
);
CREATE TABLE IF NOT EXISTS "tools" (
	"id"	INTEGER,
	"name"	TEXT NOT NULL,
	"character_id"	INTEGER NOT NULL,
	"power"	INTEGER NOT NULL,
	"unlock_level"	INTEGER NOT NULL,
	"unlock_cost"	INTEGER NOT NULL,
	"currency_id"	INTEGER NOT NULL,
	"image_path"	TEXT NOT NULL,
	"main_coins_power"	REAL DEFAULT 1.0,
	"location_coins_power"	REAL DEFAULT 1.0,
	PRIMARY KEY("id"),
	FOREIGN KEY("character_id") REFERENCES "characters"("id")
);
INSERT INTO "achievement_congratulations" VALUES (3,'test_user',4,'Почти легенда','Достигни 15 уровня','achievements/almost_legend.png',1,'2025-07-01 14:13:30','2025-07-01 14:13:42');
INSERT INTO "achievements" VALUES (1,'Первый шаг','Достигни 2 уровня','level',2,'achievements/first_step.png');
INSERT INTO "achievements" VALUES (2,'Уверенный путь','Достигни 5 уровня','level',5,'achievements/level_5.png');
INSERT INTO "achievements" VALUES (3,'Полпути','Достигни 10 уровня','level',10,'achievements/level_10.png');
INSERT INTO "achievements" VALUES (4,'Почти легенда','Достигни 15 уровня','level',15,'achievements/almost_legend.png');
INSERT INTO "achievements" VALUES (5,'Легенда','Достигни 20 уровня','level',20,'achievements/legend.png');
INSERT INTO "achievements" VALUES (6,'Мастер','Получи ранг Золото I или выше','rank',5,'achievements/master.png');
INSERT INTO "achievements" VALUES (7,'Мастер ранга','Получи максимальный ранг','rank',9,'achievements/rank_master.png');
INSERT INTO "achievements" VALUES (8,'Ветеран','Участвуй в 3 сезонах','seasons_participated',3,'achievements/veteran.png');
INSERT INTO "achievements" VALUES (9,'Вернувшийся герой','Вернись в игру после 7 дней отсутствия','days_inactive',7,'achievements/comeback.png');
INSERT INTO "achievements" VALUES (10,'Путь продолжается','Играй ежедневно в течение 7 дней подряд','daily_streak',7,'achievements/streak.png');
INSERT INTO "character_appearances" VALUES (1,1,1,'/assets/characters/lumberjack_static1.png','png','/assets/characters/lumberjack1.png');
INSERT INTO "character_appearances" VALUES (2,1,2,'/assets/characters/lumberjack_static2.png','png','/assets/characters/lumberjack2.png');
INSERT INTO "character_appearances" VALUES (3,1,3,'/assets/characters/lumberjack_static3.png','png','/assets/characters/lumberjack3.png');
INSERT INTO "characters" VALUES (1,'Лесоруб','gif','/assets/characters/lumberjack.png',NULL);
INSERT INTO "currencies" VALUES (1,'Монеты','main','/assets/currencies/garden_coin.png','2025-06-28 15:42:53','2025-06-28 15:42:53');
INSERT INTO "currencies" VALUES (2,'Брёвна','forest','/assets/currencies/wood.png','2025-06-28 15:42:54','2025-06-28 15:42:54');
INSERT INTO "helper_levels" VALUES (1,1,10.0,0,1);
INSERT INTO "helper_levels" VALUES (1,2,25.0,1000,1);
INSERT INTO "helper_levels" VALUES (1,3,60.0,2500,1);
INSERT INTO "helper_levels" VALUES (1,4,150.0,5000,1);
INSERT INTO "helper_levels" VALUES (1,5,300.0,10000,1);
INSERT INTO "helpers" VALUES (1,'Ученик лесоруба',1,3,500,2,5,'/assets/helpers/apprentice.png');
INSERT INTO "levels" VALUES (1,100);
INSERT INTO "levels" VALUES (2,15);
INSERT INTO "levels" VALUES (3,5);
INSERT INTO "levels" VALUES (4,5);
INSERT INTO "levels" VALUES (5,5);
INSERT INTO "levels" VALUES (6,5);
INSERT INTO "levels" VALUES (7,5);
INSERT INTO "levels" VALUES (8,5);
INSERT INTO "levels" VALUES (9,5);
INSERT INTO "levels" VALUES (10,5);
INSERT INTO "levels" VALUES (11,261);
INSERT INTO "levels" VALUES (12,3);
INSERT INTO "levels" VALUES (13,3);
INSERT INTO "levels" VALUES (14,3);
INSERT INTO "levels" VALUES (15,3);
INSERT INTO "levels" VALUES (16,3);
INSERT INTO "levels" VALUES (17,65684);
INSERT INTO "levels" VALUES (18,98526);
INSERT INTO "levels" VALUES (19,147789);
INSERT INTO "levels" VALUES (20,221683);
INSERT INTO "locations" VALUES (1,'Лес','/assets/backgrounds/forest.jpg',2,1,1,0);
INSERT INTO "player_achievements" VALUES (1,'test_user',1,'2025-07-01 11:42:44');
INSERT INTO "player_achievements" VALUES (2,'test_user',2,'2025-07-01 11:42:44');
INSERT INTO "player_achievements" VALUES (3,'test_user',3,'2025-07-01 11:42:45');
INSERT INTO "player_achievements" VALUES (8,'test_user',4,'2025-07-01 14:13:30');
INSERT INTO "player_currencies" VALUES ('test_user',2,5003.0);
INSERT INTO "player_currencies" VALUES ('test_user',1,100.0);
INSERT INTO "player_equipped_tools" VALUES ('test_user',1,1);
INSERT INTO "player_helpers" VALUES ('test_user',1,3);
INSERT INTO "player_locations" VALUES ('test_user',1);
INSERT INTO "player_login_history" VALUES (1,'test_user','2025-07-01 11:42:44');
INSERT INTO "player_notifications" VALUES (1,'test_user','achievement','Новое достижение!','Вы получили достижение "Первый шаг"',1,'achievements/first_step.png',0,'2025-07-01 11:42:45',NULL);
INSERT INTO "player_notifications" VALUES (2,'test_user','achievement','Новое достижение!','Вы получили достижение "Уверенный путь"',2,'achievements/level_5.png',0,'2025-07-01 11:42:45',NULL);
INSERT INTO "player_notifications" VALUES (3,'test_user','achievement','Новое достижение!','Вы получили достижение "Полпути"',3,'achievements/level_10.png',0,'2025-07-01 11:42:45',NULL);
INSERT INTO "player_notifications" VALUES (4,'test_user','achievement','Новое достижение!','Вы получили достижение "Почти легенда"',4,'achievements/level_15.png',0,'2025-07-01 11:42:45',NULL);
INSERT INTO "player_notifications" VALUES (5,'test_user','achievement','Новое достижение!','Вы получили достижение "Почти легенда"',4,'achievements/level_15.png',0,'2025-07-01 12:34:17',NULL);
INSERT INTO "player_notifications" VALUES (6,'test_user','achievement','Новое достижение!','Вы получили достижение "Почти легенда"',4,'achievements/almost_legend.png',0,'2025-07-01 14:01:44',NULL);
INSERT INTO "player_notifications" VALUES (7,'test_user','achievement','Новое достижение!','Вы получили достижение "Почти легенда"',4,'achievements/almost_legend.png',0,'2025-07-01 14:03:14',NULL);
INSERT INTO "player_notifications" VALUES (8,'test_user','achievement','Новое достижение!','Вы получили достижение "Почти легенда"',4,'achievements/almost_legend.png',0,'2025-07-01 14:13:30',NULL);
INSERT INTO "player_pending_income" VALUES ('test_user',2,18.58);
INSERT INTO "player_profile" VALUES ('test_user',1,1,NULL,4,'/assets/avatars/default.png',0);
INSERT INTO "player_progress" VALUES ('test_user',16,87,110,110,'2025-07-01T18:35:46.051Z','2025-07-01 18:45:46');
INSERT INTO "player_season" VALUES ('test_user',1,100,1,1);
INSERT INTO "player_stats" VALUES ('test_user',57,114,57,'2025-07-01 18:33:29');
INSERT INTO "player_storage_limits" VALUES ('test_user',1,2,3,5000);
INSERT INTO "player_tools" VALUES ('test_user',1);
INSERT INTO "player_tools" VALUES ('test_user',2);
INSERT INTO "player_tools" VALUES ('test_user',3);
INSERT INTO "ranks" VALUES (1,'Бронза I',0,'ranks/bronze_1.png');
INSERT INTO "ranks" VALUES (2,'Бронза II',100,'ranks/bronze_2.png');
INSERT INTO "ranks" VALUES (3,'Серебро I',300,'ranks/silver_1.png');
INSERT INTO "ranks" VALUES (4,'Серебро II',600,'ranks/silver_2.png');
INSERT INTO "ranks" VALUES (5,'Золото I',1000,'ranks/gold_1.png');
INSERT INTO "ranks" VALUES (6,'Золото II',1500,'ranks/gold_2.png');
INSERT INTO "ranks" VALUES (7,'Платина',2200,'ranks/platinum.png');
INSERT INTO "ranks" VALUES (8,'Бриллиант',3000,'ranks/diamond.png');
INSERT INTO "ranks" VALUES (9,'Легенда',5000,'ranks/legend.png');
INSERT INTO "rewards" VALUES (1,1,'main_currency',1,100,NULL);
INSERT INTO "rewards" VALUES (2,2,'main_currency',1,200,NULL);
INSERT INTO "rewards" VALUES (3,3,'main_currency',1,300,NULL);
INSERT INTO "rewards" VALUES (4,4,'forest_currency',2,400,NULL);
INSERT INTO "rewards" VALUES (5,5,'energy',NULL,10,'');
INSERT INTO "seasons" VALUES (1,'Летний сезон','2025-06-01','2025-08-25','Жара, валка, прокачка!',1);
INSERT INTO "storage_upgrade_levels" VALUES (1,1,1000,0,1);
INSERT INTO "storage_upgrade_levels" VALUES (1,2,2500,500,1);
INSERT INTO "storage_upgrade_levels" VALUES (1,3,5000,1500,1);
INSERT INTO "storage_upgrade_levels" VALUES (1,4,10000,3000,1);
INSERT INTO "storage_upgrade_levels" VALUES (1,5,25000,7500,1);
INSERT INTO "tools" VALUES (1,'Топор',1,1,1,0,2,'/assets/tools/axe.png',1.0,1.0);
INSERT INTO "tools" VALUES (2,'Ручная пила',1,3,5,300,2,'/assets/tools/handsaw.png',1.2,1.5);
INSERT INTO "tools" VALUES (3,'Бензопила',1,10,10,1000,2,'/assets/tools/chainsaw.png',1.5,2.0);
CREATE INDEX IF NOT EXISTS "idx_achievement_congratulations_user_id" ON "achievement_congratulations" (
	"user_id"
);
CREATE INDEX IF NOT EXISTS "idx_player_currencies" ON "player_currencies" (
	"user_id",
	"currency_id"
);
CREATE INDEX IF NOT EXISTS "idx_player_helpers" ON "player_helpers" (
	"user_id"
);
CREATE INDEX IF NOT EXISTS "idx_player_locations" ON "player_locations" (
	"user_id"
);
CREATE INDEX IF NOT EXISTS "idx_player_login_history_user_id" ON "player_login_history" (
	"user_id"
);
CREATE INDEX IF NOT EXISTS "idx_player_notifications_user_id" ON "player_notifications" (
	"user_id"
);
CREATE INDEX IF NOT EXISTS "idx_player_tools" ON "player_tools" (
	"user_id"
);
COMMIT;
