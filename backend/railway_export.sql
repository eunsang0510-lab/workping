-- Railway -> Supabase migration
-- Supabase SQL Editor에 붙여넣고 Run 하세요

-- ===== CREATE TABLES =====
CREATE TABLE attendances (
	id VARCHAR NOT NULL, 
	user_id VARCHAR NOT NULL, 
	type VARCHAR NOT NULL, 
	latitude FLOAT NOT NULL, 
	longitude FLOAT NOT NULL, 
	address VARCHAR, 
	is_remote BOOLEAN, 
	recorded_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
);

CREATE TABLE companies (
	id VARCHAR NOT NULL, 
	name VARCHAR NOT NULL, 
	admin_id VARCHAR NOT NULL, 
	plan VARCHAR, 
	leave_enabled BOOLEAN, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
);

CREATE TABLE company_locations (
	id VARCHAR NOT NULL, 
	company_id VARCHAR NOT NULL, 
	name VARCHAR NOT NULL, 
	latitude FLOAT NOT NULL, 
	longitude FLOAT NOT NULL, 
	radius INTEGER, 
	is_active BOOLEAN, 
	address VARCHAR, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
);

CREATE TABLE company_members (
	id VARCHAR NOT NULL, 
	company_id VARCHAR NOT NULL, 
	user_id VARCHAR NOT NULL, 
	user_email VARCHAR NOT NULL, 
	user_name VARCHAR, 
	birth_date VARCHAR, 
	is_admin BOOLEAN, 
	is_manager BOOLEAN, 
	home_address VARCHAR, 
	home_latitude FLOAT, 
	home_longitude FLOAT, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
);

CREATE TABLE leave_balances (
	id VARCHAR NOT NULL, 
	company_id VARCHAR NOT NULL, 
	user_id VARCHAR NOT NULL, 
	total_days INTEGER, 
	used_days FLOAT, 
	year INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
);

CREATE TABLE leaves (
	id VARCHAR NOT NULL, 
	company_id VARCHAR NOT NULL, 
	user_id VARCHAR NOT NULL, 
	user_name VARCHAR, 
	leave_type VARCHAR, 
	start_date VARCHAR NOT NULL, 
	end_date VARCHAR NOT NULL, 
	days INTEGER, 
	is_half BOOLEAN, 
	reason TEXT, 
	status VARCHAR, 
	approved_by VARCHAR, 
	approved_at TIMESTAMP WITHOUT TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
);

CREATE TABLE locations (
	id VARCHAR NOT NULL, 
	user_id VARCHAR NOT NULL, 
	latitude FLOAT NOT NULL, 
	longitude FLOAT NOT NULL, 
	place_name VARCHAR, 
	place_type VARCHAR, 
	recorded_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
);

CREATE TABLE notices (
	id VARCHAR NOT NULL, 
	title VARCHAR NOT NULL, 
	content TEXT NOT NULL, 
	notice_type VARCHAR, 
	company_id VARCHAR, 
	created_by VARCHAR NOT NULL, 
	is_active BOOLEAN, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
);

CREATE TABLE payments (
	id VARCHAR NOT NULL, 
	company_id VARCHAR NOT NULL, 
	order_id VARCHAR NOT NULL, 
	payment_key VARCHAR, 
	plan VARCHAR NOT NULL, 
	amount INTEGER NOT NULL, 
	status VARCHAR, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (order_id)
);

CREATE TABLE subscriptions (
	id VARCHAR NOT NULL, 
	company_id VARCHAR NOT NULL, 
	plan VARCHAR, 
	status VARCHAR, 
	started_at TIMESTAMP WITHOUT TIME ZONE, 
	expires_at TIMESTAMP WITHOUT TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
);

CREATE TABLE team_members (
	id VARCHAR NOT NULL, 
	team_id VARCHAR NOT NULL, 
	user_id VARCHAR NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
);

CREATE TABLE teams (
	id VARCHAR NOT NULL, 
	company_id VARCHAR NOT NULL, 
	name VARCHAR NOT NULL, 
	manager_id VARCHAR, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
);

CREATE TABLE users (
	id VARCHAR NOT NULL, 
	email VARCHAR NOT NULL, 
	name VARCHAR, 
	company_id VARCHAR, 
	is_admin BOOLEAN, 
	plan VARCHAR, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (email)
);

CREATE TABLE notice_reads (
	id VARCHAR NOT NULL, 
	notice_id VARCHAR NOT NULL, 
	user_id VARCHAR NOT NULL, 
	read_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(notice_id) REFERENCES notices (id)
);


-- ===== INSERT DATA =====
-- users (7 rows)
INSERT INTO "users" ("id", "email", "name", "company_id", "is_admin", "plan", "created_at") VALUES ('LzVt54WTt5V5a3i50r6ki6ATnTH2', 'eunsang0510@gmail.com', 'Eunsang Cho', NULL, FALSE, 'free', '2026-04-21 12:28:23.242042');
INSERT INTO "users" ("id", "email", "name", "company_id", "is_admin", "plan", "created_at") VALUES ('oEzAMBsaGHcwFxYMLh0UFrDwdVt1', 'kelgod@naver.com', '쥬바라기', NULL, FALSE, 'free', '2026-05-01 07:01:34.575399');
INSERT INTO "users" ("id", "email", "name", "company_id", "is_admin", "plan", "created_at") VALUES ('syQve7F1J7fmXmedQJwS0VG5sEn2', 'kksgood806@gmail.com', '김경섭', NULL, FALSE, 'free', '2026-05-09 13:42:10.260407');
INSERT INTO "users" ("id", "email", "name", "company_id", "is_admin", "plan", "created_at") VALUES ('vVrlRlZhaRY2LMPDVQDtcRQDJhs1', 'netjjangkim@gmail.com', '김은규', NULL, FALSE, 'free', '2026-05-10 13:49:19.799438');
INSERT INTO "users" ("id", "email", "name", "company_id", "is_admin", "plan", "created_at") VALUES ('HRGIS58dS0OpMcFHjmPNldh9ATs1', 'hasuyoon1211@gmail.com', '윤하수', NULL, FALSE, 'free', '2026-05-10 14:42:09.841312');
INSERT INTO "users" ("id", "email", "name", "company_id", "is_admin", "plan", "created_at") VALUES ('3UFtoL0ce8SZLWXeJovpQovSZB62', 'lyricepic@gmail.com', '박종광', NULL, FALSE, 'free', '2026-05-11 12:35:03.123765');
INSERT INTO "users" ("id", "email", "name", "company_id", "is_admin", "plan", "created_at") VALUES ('uhTxv25OTRbJOyO2DNRabojGRkh1', 'yaskp1220@gmail.com', '김예슬', NULL, FALSE, 'free', '2026-05-12 14:08:37.259714');

-- companies (2 rows)
INSERT INTO "companies" ("id", "name", "admin_id", "plan", "created_at", "leave_enabled") VALUES ('49809b5c-d65a-4c53-bd93-a042f5948141', '기아자동차', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 'team', '2026-04-19 23:36:17.966443', TRUE);
INSERT INTO "companies" ("id", "name", "admin_id", "plan", "created_at", "leave_enabled") VALUES ('4efaf324-2435-483d-b21f-70e98d0dd0f5', '현대자동차', 'superadmin', 'team', '2026-04-20 23:15:28.006457', TRUE);

-- payments (7 rows)
INSERT INTO "payments" ("id", "company_id", "order_id", "payment_key", "plan", "amount", "status", "created_at") VALUES ('cfe790ee-a06f-4ec1-93a8-236acf85d9eb', '4efaf324-2435-483d-b21f-70e98d0dd0f5', 'workping-4efaf324-7ad93e42', NULL, 'starter', 9900, 'pending', '2026-04-26 14:42:36.842032');
INSERT INTO "payments" ("id", "company_id", "order_id", "payment_key", "plan", "amount", "status", "created_at") VALUES ('c001e23c-89b3-428f-9d5d-b20a99e2bbe8', '4efaf324-2435-483d-b21f-70e98d0dd0f5', 'workping-4efaf324-53e6eb30', NULL, 'starter', 9900, 'pending', '2026-04-26 14:44:21.070200');
INSERT INTO "payments" ("id", "company_id", "order_id", "payment_key", "plan", "amount", "status", "created_at") VALUES ('116991a8-a3d7-4c2e-b555-895b54b82fb1', '4efaf324-2435-483d-b21f-70e98d0dd0f5', 'workping-4efaf324-d7cb96dc', NULL, 'starter', 9900, 'pending', '2026-04-26 14:44:49.210469');
INSERT INTO "payments" ("id", "company_id", "order_id", "payment_key", "plan", "amount", "status", "created_at") VALUES ('79a6b673-d496-4f9e-a385-0a4c14889858', '4efaf324-2435-483d-b21f-70e98d0dd0f5', 'workping-4efaf324-c964cd7b', NULL, 'starter', 9900, 'pending', '2026-04-26 14:46:23.644386');
INSERT INTO "payments" ("id", "company_id", "order_id", "payment_key", "plan", "amount", "status", "created_at") VALUES ('09fd3367-7be5-47b4-82f8-ef4e056133c6', '4efaf324-2435-483d-b21f-70e98d0dd0f5', 'workping-4efaf324-286e06da', NULL, 'starter', 9900, 'pending', '2026-04-26 14:47:12.927152');
INSERT INTO "payments" ("id", "company_id", "order_id", "payment_key", "plan", "amount", "status", "created_at") VALUES ('163e61ee-013a-4a85-b69a-cdcbbe22f9a7', '4efaf324-2435-483d-b21f-70e98d0dd0f5', 'workping-4efaf324-bd156978', NULL, 'starter', 9900, 'pending', '2026-04-26 14:50:17.475519');
INSERT INTO "payments" ("id", "company_id", "order_id", "payment_key", "plan", "amount", "status", "created_at") VALUES ('3a9d8258-653d-4cdc-ba93-7b4de3f1ac31', '4efaf324-2435-483d-b21f-70e98d0dd0f5', 'workping-4efaf324-a933e2c7', NULL, 'starter', 9900, 'pending', '2026-04-26 14:50:27.105269');

-- company_members (5 rows)
INSERT INTO "company_members" ("id", "company_id", "user_id", "user_email", "user_name", "is_admin", "created_at", "birth_date", "is_manager", "home_address", "home_latitude", "home_longitude") VALUES ('e796b270-2fd1-4a73-a4bf-c391ac4c3e05', '49809b5c-d65a-4c53-bd93-a042f5948141', 'q1buQ76OrZWHJxTGMDSTzY8VsLt2', '1234@naver.com', '김예슬', FALSE, '2026-04-20 04:52:26.420182', NULL, FALSE, NULL, NULL, NULL);
INSERT INTO "company_members" ("id", "company_id", "user_id", "user_email", "user_name", "is_admin", "created_at", "birth_date", "is_manager", "home_address", "home_latitude", "home_longitude") VALUES ('eb0dd531-6a47-46ff-9a0b-fd5af6ad66ab', '49809b5c-d65a-4c53-bd93-a042f5948141', '', 'eqwewqe@naver.com', '길동', FALSE, '2026-04-21 11:20:20.086139', NULL, FALSE, NULL, NULL, NULL);
INSERT INTO "company_members" ("id", "company_id", "user_id", "user_email", "user_name", "is_admin", "created_at", "birth_date", "is_manager", "home_address", "home_latitude", "home_longitude") VALUES ('f91e2464-1fef-4fb6-b65a-77663fd479c3', '4efaf324-2435-483d-b21f-70e98d0dd0f5', 'Vy98SbjjtdVAGNk9qyXnp2axX7r2', 'bronze@naver.com', '동동동', FALSE, '2026-05-07 05:59:14.236372', '19880510', FALSE, NULL, NULL, NULL);
INSERT INTO "company_members" ("id", "company_id", "user_id", "user_email", "user_name", "is_admin", "created_at", "birth_date", "is_manager", "home_address", "home_latitude", "home_longitude") VALUES ('ce88fd8a-5265-42e5-91a1-b2aea5564c59', '4efaf324-2435-483d-b21f-70e98d0dd0f5', 'dAh1BMfn3VOQiyPvynZZSdxwqWW2', '5678@naver.com', 'Test1', FALSE, '2026-05-07 05:58:49.378662', '19880510', FALSE, NULL, NULL, NULL);
INSERT INTO "company_members" ("id", "company_id", "user_id", "user_email", "user_name", "is_admin", "created_at", "birth_date", "is_manager", "home_address", "home_latitude", "home_longitude") VALUES ('5882ca08-9f89-4d29-99ac-9cc8f7644436', '4efaf324-2435-483d-b21f-70e98d0dd0f5', '6VVz6b4QtvTTD95eLs3Z2cWxRcw1', 'hiddink12345@naver.com', '조은상', TRUE, '2026-05-04 14:51:07.677283', '19880510', TRUE, '서울 동대문구 장한로27가길 37', 37.5750495880554, 127.070885574157);

-- company_locations (2 rows)
INSERT INTO "company_locations" ("id", "company_id", "name", "latitude", "longitude", "radius", "is_active", "created_at", "address") VALUES ('92920f96-7df6-461c-9da8-54fd7cf33e68', '49809b5c-d65a-4c53-bd93-a042f5948141', '테스트 ', 37.29233, 127.1421, 100, TRUE, '2026-04-21 11:21:55.987130', NULL);
INSERT INTO "company_locations" ("id", "company_id", "name", "latitude", "longitude", "radius", "is_active", "created_at", "address") VALUES ('dfb585d1-4897-4d64-aa99-f38de02b73c8', '4efaf324-2435-483d-b21f-70e98d0dd0f5', '본진', 37.497259, 127.027374, 100, TRUE, '2026-05-11 05:27:00.784140', '서울 서초구 서초대로78길 5');

-- teams (1 rows)
INSERT INTO "teams" ("id", "company_id", "name", "manager_id", "created_at") VALUES ('eb6be19e-0f79-46fe-be2a-5abd9d1725e0', '4efaf324-2435-483d-b21f-70e98d0dd0f5', '개발팀', '6VVz6b4QtvTTD95eLs3Z2cWxRcw1', '2026-05-06 04:31:05.222342');

-- attendances (48 rows)
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('f634e4d1-731b-4e2d-8cfa-706caa649676', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 'checkin', 37.57436642636673, 127.07215722913945, '동대문구 장안동', '2026-04-19 14:14:20.136000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('d581f1db-b5d7-4043-bdd9-f94ac99bf6ee', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 'checkin', 37.57428452449089, 127.0721617312682, '동대문구 장안동', '2026-04-19 14:21:15.727000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('eb428b74-24e3-41eb-b544-98fd59352b30', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 'checkin', 37.57438357344441, 127.07214875076505, '동대문구 장안동', '2026-04-20 05:15:46.035000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('30891880-f305-496e-9397-bec768b27f64', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 'checkin', 37.57437345816084, 127.07215399911294, '동대문구 장안동', '2026-04-20 14:20:01.054000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('9e7486e6-7b0f-4ad9-bb8a-c876b2b3b447', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 'checkout', 37.57437345816084, 127.07215399911294, '동대문구 장안동', '2026-04-20 14:20:08.859000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('724cf71c-f3e0-42ce-b628-d5c39db8820f', 'q1buQ76OrZWHJxTGMDSTzY8VsLt2', 'checkin', 37.57433741472666, 127.07214938503793, '동대문구 장안동', '2026-04-21 02:24:01.223000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('c4b2bee8-275c-4fa3-a972-5b406e8b0534', 'q1buQ76OrZWHJxTGMDSTzY8VsLt2', 'checkout', 37.57433741472666, 127.07214938503793, '동대문구 장안동', '2026-04-21 02:24:05.783000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('d6cb3801-c5d6-4d14-ae2b-846e7b1c80a6', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 'checkin', 37.57422825190669, 127.07215941369194, '동대문구 장안동', '2026-04-21 06:24:12.724000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('6424ac8c-f6c1-4580-a03f-1d139fc95fee', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 'checkout', 37.57422825190669, 127.07215941369194, '동대문구 장안동', '2026-04-21 06:24:19.883000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('8dd64dd6-ab48-40c4-8b22-8e74cf859987', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 'checkin', 37.57437310647076, 127.07214925952302, '동대문구 장안동', '2026-04-22 14:00:13.595000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('2cd31058-27b4-4cae-b19d-1a18e684f167', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 'checkout', 37.574384174402056, 127.07213889133148, '동대문구 장안동', '2026-04-22 14:21:48.042000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('5a8c6375-3b0e-4b0d-bdeb-482ff038c713', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 'checkin', 37.574356815862906, 127.07215248861995, '동대문구 장안동', '2026-04-23 04:34:58.360000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('28ef8c05-e710-47cd-8dfd-6ae807084992', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 'checkout', 37.574356815862906, 127.07215248861995, '동대문구 장안동', '2026-04-23 04:35:01.183000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('65e27e05-87ed-49e7-bd10-ec023d815479', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 'checkin', 37.572676, 127.0701696, '동대문구 장안동', '2026-04-28 00:59:19.132000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('3d78177a-50e0-4a8a-b65b-b90d4bef14ed', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 'checkout', 37.574626, 127.0710715, '동대문구 장안동', '2026-04-28 03:35:33.322000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('7bae4cf3-69fa-4e95-89c1-90164bb05642', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 'checkin', 37.5746241, 127.0710616, '동대문구 장안동', '2026-04-28 04:05:35.215000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('f864ad48-e145-499e-8928-568de7544fa8', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 'checkin', 37.5753464, 127.0709021, '동대문구 장안동', '2026-04-28 06:36:07.641000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('5105dcf4-164d-4a23-adee-58f904d1ec8b', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 'checkin', 37.5745999, 127.0710776, '동대문구 장안동', '2026-04-28 14:14:50.107000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('19e1cf94-dee2-4089-8d92-10a57a649b05', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 'checkout', 37.5745999, 127.0710776, '동대문구 장안동', '2026-04-28 14:14:52.621000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('9d39d8f1-140a-44e4-bf4f-4fd12468fa68', '6VVz6b4QtvTTD95eLs3Z2cWxRcw1', 'checkin', 37.574364714027645, 127.07214936572053, '동대문구 장안동', '2026-04-28 14:27:19.009000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('1c133d72-42f4-4739-929f-92a82fa98394', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 'checkin', 37.5719073, 127.0712349, '동대문구 장안동', '2026-04-30 01:06:57.896000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('7d4a4d00-dd9c-4f0b-bb65-a61628dacefa', 'oEzAMBsaGHcwFxYMLh0UFrDwdVt1', 'checkin', 37.87697754973499, 127.79117505043251, '춘천시 동면 만천리', '2026-05-01 13:03:13.215000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('beefef33-7dca-4964-8970-52c81d7a0570', 'oEzAMBsaGHcwFxYMLh0UFrDwdVt1', 'checkout', 37.87697793658945, 127.79117587887339, '춘천시 동면 만천리', '2026-05-01 13:08:07.995000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('31396e5a-8d1d-4dc8-8483-86a50fcb0f82', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 'checkin', 37.876823, 127.79089, '춘천시 동면 만천리', '2026-05-01 23:44:08.978000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('345dd59e-7ade-480d-9d87-aa3566d98d9a', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 'checkin', 37.5748676, 127.0706322, '동대문구 장안동', '2026-05-03 14:20:19.070000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('a5dafff1-4e15-4ee7-8ba5-4b78ede0ba43', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 'checkin', 37.574609, 127.07108, '동대문구 장안동', '2026-05-03 15:34:45.148000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('75c85967-dcc2-4a52-8bb4-4ab67be4b7ee', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 'checkout', 37.5746152, 127.0710703, '동대문구 장안동', '2026-05-04 00:19:10.845000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('0cebe2e0-d883-4692-936e-4f0ab2193bcb', '6VVz6b4QtvTTD95eLs3Z2cWxRcw1', 'checkin', 37.57433913676483, 127.07214906681105, '동대문구 장안동', '2026-05-05 13:59:07.722000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('3df4e985-ba28-4abb-960c-436beb5abd72', '6VVz6b4QtvTTD95eLs3Z2cWxRcw1', 'checkout', 37.57438660069833, 127.07214217204445, '동대문구 장안동', '2026-05-05 14:09:01.950000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('ba65cde2-163a-42c8-923d-4b08930a3379', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 'checkin', 37.5746079, 127.0710827, '동대문구 장안동', '2026-05-05 14:24:23.452000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('df4f3edb-7ea9-4137-832b-b6c49dd76e9b', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 'checkin', 37.5746067, 127.0710728, '동대문구 장안동', '2026-05-06 02:20:34.584000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('93ea1139-32e8-48a7-8b23-5379a6ab3452', '6VVz6b4QtvTTD95eLs3Z2cWxRcw1', 'checkin', 37.5746138, 127.0710684, '동대문구 장안동', '2026-05-06 02:23:19.228000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('fef8c960-2f4d-48b9-8e7f-b03e7735ef51', '6VVz6b4QtvTTD95eLs3Z2cWxRcw1', 'checkout', 37.5745957, 127.0710646, '동대문구 장안동', '2026-05-06 09:46:11.748000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('3bdb7cf3-6394-4f6f-a5b0-2b5f3fbdb1d6', '6VVz6b4QtvTTD95eLs3Z2cWxRcw1', 'checkin', 37.5746001, 127.0710716, '동대문구 장안동', '2026-05-07 14:33:35.479000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('3e7ba4b7-2be4-4e6a-81ba-44ca007e1add', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 'checkin', 37.5658197, 126.9906284, '중구 을지로3가', '2026-05-08 03:21:59.832000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('b7b3db1e-e935-4603-a256-9ce7e2309fa1', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 'checkout', 37.5658197, 126.9906284, '중구 을지로3가', '2026-05-08 03:22:04.396000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('508e9d03-0785-4386-a5c3-bc29ccbc9b7d', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 'checkin', 37.5726569, 127.0707915, '동대문구 장안동', '2026-05-09 07:24:01.880000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('403a5ca3-25d7-4756-91af-95d98e5b485b', '6VVz6b4QtvTTD95eLs3Z2cWxRcw1', 'checkin', 37.5726569, 127.0707915, '동대문구 장안동', '2026-05-09 07:24:50.017000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('2e329af2-5c1f-4bfe-b625-b9c7f8bb74f6', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 'checkout', 37.5746042, 127.0710672, '동대문구 장안동', '2026-05-09 08:10:51.431000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('2f172af2-0351-4d50-a365-454d654f1c5f', '6VVz6b4QtvTTD95eLs3Z2cWxRcw1', 'checkout', 37.5745919, 127.0710764, '동대문구 장안동', '2026-05-09 12:16:59.897000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('54eac69a-acad-4048-811b-4af1ffca4f6c', '6VVz6b4QtvTTD95eLs3Z2cWxRcw1', 'checkin', 37.5746022, 127.0710814, '동대문구 장안동', '2026-05-10 14:23:44.242000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('ddcfc160-7467-4366-b779-ebdf71880187', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 'checkin', 37.5746138, 127.0710685, '동대문구 장안동', '2026-05-10 14:43:38.289000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('a2e82225-8f0b-426a-ac6a-9d405f3c0fc0', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 'checkin', 37.57438177095681, 127.07214338992605, '동대문구 장안동', '2026-05-11 04:20:27.864000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('2381dcd8-37fd-45cf-b07c-f0febf1fb42d', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 'checkin', 37.57437743601585, 127.0721438164042, '동대문구 장안동', '2026-05-11 05:08:20.333000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('d43737e6-1d6f-4ee9-84cf-53550765d5ff', '6VVz6b4QtvTTD95eLs3Z2cWxRcw1', 'checkin', 37.57437743601585, 127.0721438164042, '서울특별시 동대문구 장한로 158 대흥빌딩', '2026-05-11 05:36:15.950000', TRUE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('952fcb24-81d5-4a2e-80f8-2efe082134f7', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 'checkout', 37.574325321019124, 127.07214802285243, '서울특별시 동대문구 장한로 158 대흥빌딩', '2026-05-11 12:37:01.163000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('bf7e2bf1-4939-414d-ad9f-229cc4dc515d', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 'checkin', 37.4661849, 126.3873344, '인천광역시 중구 공항문화로 127', '2026-05-12 07:38:34.013000', FALSE);
INSERT INTO "attendances" ("id", "user_id", "type", "latitude", "longitude", "address", "recorded_at", "is_remote") VALUES ('17af35bd-3c56-4f48-8e4b-755382317786', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 'checkout', 37.4661849, 126.3873344, '인천광역시 중구 공항문화로 127', '2026-05-12 07:38:37.386000', FALSE);

-- locations (48 rows)
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('5550d9b6-e689-443f-b10e-4659cb372c54', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 37.57436642636673, 127.07215722913945, '동대문구 장안동', NULL, '2026-04-19 14:14:20.136000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('a8247ef8-e0d0-4c11-a71f-05fa6958cf17', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 37.57428452449089, 127.0721617312682, '동대문구 장안동', NULL, '2026-04-19 14:21:15.727000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('9c13d6b1-7590-4b11-8033-4634acaa1130', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 37.57438357344441, 127.07214875076505, '동대문구 장안동', NULL, '2026-04-20 05:15:46.035000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('5b82fb1e-12b9-4436-8ee2-f9c5b60583f4', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 37.57437345816084, 127.07215399911294, '동대문구 장안동', NULL, '2026-04-20 14:20:01.054000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('4a23d4bc-c0ce-46bc-b9c0-b7ecd4c29206', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 37.57437345816084, 127.07215399911294, '동대문구 장안동', NULL, '2026-04-20 14:20:08.859000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('c11afc04-9906-41ed-9bc5-6959bf26453c', 'q1buQ76OrZWHJxTGMDSTzY8VsLt2', 37.57433741472666, 127.07214938503793, '동대문구 장안동', NULL, '2026-04-21 02:24:01.223000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('a7350a45-1be2-4905-9b27-943a48a78f92', 'q1buQ76OrZWHJxTGMDSTzY8VsLt2', 37.57433741472666, 127.07214938503793, '동대문구 장안동', NULL, '2026-04-21 02:24:05.783000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('d67bdf7a-3893-44ca-950d-864f07479a9f', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 37.57422825190669, 127.07215941369194, '동대문구 장안동', NULL, '2026-04-21 06:24:12.724000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('7427aa86-027c-466a-b57b-881ad04f133c', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 37.57422825190669, 127.07215941369194, '동대문구 장안동', NULL, '2026-04-21 06:24:19.883000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('efe98701-4ad7-4ccb-bd8e-10aaa60af856', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 37.57437310647076, 127.07214925952302, '동대문구 장안동', NULL, '2026-04-22 14:00:13.595000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('8f8ca0a8-cb6b-4d3b-addd-0569c1e2d0a5', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 37.574384174402056, 127.07213889133148, '동대문구 장안동', NULL, '2026-04-22 14:21:48.042000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('563da701-1017-412b-816d-42253542b2fe', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 37.574356815862906, 127.07215248861995, '동대문구 장안동', NULL, '2026-04-23 04:34:58.360000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('4bcd385f-36ef-4fab-b1ba-3a00fa305a77', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 37.574356815862906, 127.07215248861995, '동대문구 장안동', NULL, '2026-04-23 04:35:01.183000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('a2936190-8ed9-4c75-8153-d472bf08337d', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 37.572676, 127.0701696, '동대문구 장안동', NULL, '2026-04-28 00:59:19.132000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('269fbe3a-43f0-4b7c-a52b-66acb7d037d4', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 37.574626, 127.0710715, '동대문구 장안동', NULL, '2026-04-28 03:35:33.322000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('c8052d55-d13c-4f1c-bd7a-bfbdd0a5abe1', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 37.5746241, 127.0710616, '동대문구 장안동', NULL, '2026-04-28 04:05:35.215000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('48628530-66e9-4bd0-a465-505a484fa3dc', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 37.5753464, 127.0709021, '동대문구 장안동', NULL, '2026-04-28 06:36:07.641000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('c07b9330-bb05-4571-8ecf-6e07cc05b86a', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 37.5745999, 127.0710776, '동대문구 장안동', NULL, '2026-04-28 14:14:50.107000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('d3029698-d47e-405e-9cf2-dcfabfc089d2', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 37.5745999, 127.0710776, '동대문구 장안동', NULL, '2026-04-28 14:14:52.621000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('f8cdc79f-c6fa-4853-828d-6c4d2896ce8e', '6VVz6b4QtvTTD95eLs3Z2cWxRcw1', 37.574364714027645, 127.07214936572053, '동대문구 장안동', NULL, '2026-04-28 14:27:19.009000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('3f62ecec-28d5-4fe8-a909-67d3fe02fd30', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 37.5719073, 127.0712349, '동대문구 장안동', NULL, '2026-04-30 01:06:57.896000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('bcd7e398-1f2d-4398-b508-9b1fd7544758', 'oEzAMBsaGHcwFxYMLh0UFrDwdVt1', 37.87697754973499, 127.79117505043251, '춘천시 동면 만천리', NULL, '2026-05-01 13:03:13.215000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('7c7514a2-852f-4caf-be5f-c30cd8a1b847', 'oEzAMBsaGHcwFxYMLh0UFrDwdVt1', 37.87697793658945, 127.79117587887339, '춘천시 동면 만천리', NULL, '2026-05-01 13:08:07.995000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('ae2b3c7e-4c27-4723-8c98-643da23d6583', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 37.876823, 127.79089, '춘천시 동면 만천리', NULL, '2026-05-01 23:44:08.978000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('6b5d9a40-1d54-42d0-b2ae-b4a43bdb6e18', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 37.5748676, 127.0706322, '동대문구 장안동', NULL, '2026-05-03 14:20:19.070000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('af92b2d8-7650-4b68-b4e1-adfb6af34b5e', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 37.574609, 127.07108, '동대문구 장안동', NULL, '2026-05-03 15:34:45.148000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('bb97602c-af0f-4618-9516-c7c3b52f04a8', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 37.5746152, 127.0710703, '동대문구 장안동', NULL, '2026-05-04 00:19:10.845000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('849471a1-eb15-4796-9419-40657b39d017', '6VVz6b4QtvTTD95eLs3Z2cWxRcw1', 37.57433913676483, 127.07214906681105, '동대문구 장안동', NULL, '2026-05-05 13:59:07.722000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('44abbb1a-b460-4c72-9422-abb8169d3714', '6VVz6b4QtvTTD95eLs3Z2cWxRcw1', 37.57438660069833, 127.07214217204445, '동대문구 장안동', NULL, '2026-05-05 14:09:01.950000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('a797aa8a-5bff-42db-a1fa-81d9ce104d64', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 37.5746079, 127.0710827, '동대문구 장안동', NULL, '2026-05-05 14:24:23.452000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('a85bdeb7-036c-44fb-8406-7fab43ac352d', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 37.5746067, 127.0710728, '동대문구 장안동', NULL, '2026-05-06 02:20:34.584000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('89773cc1-321e-43a8-8d09-d9f3f53de38a', '6VVz6b4QtvTTD95eLs3Z2cWxRcw1', 37.5746138, 127.0710684, '동대문구 장안동', NULL, '2026-05-06 02:23:19.228000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('2484b144-8737-4df8-972c-01a2c579c582', '6VVz6b4QtvTTD95eLs3Z2cWxRcw1', 37.5745957, 127.0710646, '동대문구 장안동', NULL, '2026-05-06 09:46:11.748000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('616084d7-3781-4f74-b0a9-a88cf0be3c04', '6VVz6b4QtvTTD95eLs3Z2cWxRcw1', 37.5746001, 127.0710716, '동대문구 장안동', NULL, '2026-05-07 14:33:35.479000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('b7ba6e41-0c7f-4db3-97a7-6bafd8edaff0', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 37.5658197, 126.9906284, '중구 을지로3가', NULL, '2026-05-08 03:21:59.832000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('2447c96c-6662-4947-8123-95055494a920', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 37.5658197, 126.9906284, '중구 을지로3가', NULL, '2026-05-08 03:22:04.396000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('d0e347d3-fada-49e9-a7e1-8a77e132bd78', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 37.5726569, 127.0707915, '동대문구 장안동', NULL, '2026-05-09 07:24:01.880000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('7473ca4d-7920-4910-b96c-7c0ab6d20d39', '6VVz6b4QtvTTD95eLs3Z2cWxRcw1', 37.5726569, 127.0707915, '동대문구 장안동', NULL, '2026-05-09 07:24:50.017000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('4526cf2d-5a60-4437-9099-9a7972068223', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 37.5746042, 127.0710672, '동대문구 장안동', NULL, '2026-05-09 08:10:51.431000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('b64b5c57-a705-49cf-aa64-53f3528ab427', '6VVz6b4QtvTTD95eLs3Z2cWxRcw1', 37.5745919, 127.0710764, '동대문구 장안동', NULL, '2026-05-09 12:16:59.897000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('06d5f86b-7ca9-4b67-8d78-5f78e18ab8d1', '6VVz6b4QtvTTD95eLs3Z2cWxRcw1', 37.5746022, 127.0710814, '동대문구 장안동', NULL, '2026-05-10 14:23:44.242000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('b3e2c749-bef4-4891-81d7-8a23e7dff573', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 37.5746138, 127.0710685, '동대문구 장안동', NULL, '2026-05-10 14:43:38.289000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('051f4158-d218-4247-b20a-22f4da35894e', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 37.57438177095681, 127.07214338992605, '동대문구 장안동', NULL, '2026-05-11 04:20:27.864000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('c1ebc396-fafa-41fb-be50-1bd183124132', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 37.57437743601585, 127.0721438164042, '동대문구 장안동', NULL, '2026-05-11 05:08:20.333000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('17aed36e-478e-482c-9b69-fe98224af967', '6VVz6b4QtvTTD95eLs3Z2cWxRcw1', 37.57437743601585, 127.0721438164042, '서울특별시 동대문구 장한로 158 대흥빌딩', NULL, '2026-05-11 05:36:15.950000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('4a44a269-8aa6-4b4d-9f68-f76e0d94f3f2', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 37.574325321019124, 127.07214802285243, '서울특별시 동대문구 장한로 158 대흥빌딩', NULL, '2026-05-11 12:37:01.163000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('6e47eb1e-b75c-4b7d-b919-da4aaef0956b', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 37.4661849, 126.3873344, '인천광역시 중구 공항문화로 127', NULL, '2026-05-12 07:38:34.013000');
INSERT INTO "locations" ("id", "user_id", "latitude", "longitude", "place_name", "place_type", "recorded_at") VALUES ('5aed8e16-3ccc-4f86-b287-1aa4035015bd', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', 37.4661849, 126.3873344, '인천광역시 중구 공항문화로 127', NULL, '2026-05-12 07:38:37.386000');

-- notices (2 rows)
INSERT INTO "notices" ("id", "title", "content", "notice_type", "company_id", "created_by", "is_active", "created_at", "updated_at") VALUES ('793bcec0-cec7-4b1c-bf0d-a2add84fb680', '개선사항 접수의 건', '안녕하세요, 근로시간관리 app workping 운영자입니다. App 사용시 불편사항을 접수합니다. 
workpingofficial@gmail.com', 'system', NULL, 'LzVt54WTt5V5a3i50r6ki6ATnTH2', TRUE, '2026-05-04 14:47:42.973520', '2026-05-04 14:47:42.973523');
INSERT INTO "notices" ("id", "title", "content", "notice_type", "company_id", "created_by", "is_active", "created_at", "updated_at") VALUES ('69a1f5c0-82db-408a-8263-94f706b3b411', 'iOS 개발중입니다.', '안녕하세요, iOS용 App은 개발중입니다. 일반 웹페이지에서 접속해주세요. ', 'company', '4efaf324-2435-483d-b21f-70e98d0dd0f5', '6VVz6b4QtvTTD95eLs3Z2cWxRcw1', FALSE, '2026-05-05 13:56:44.400409', '2026-05-05 13:57:12.769702');

-- notice_reads (11 rows)
INSERT INTO "notice_reads" ("id", "notice_id", "user_id", "read_at") VALUES ('213e0b3e-8904-41ed-95ed-72459faa467e', '793bcec0-cec7-4b1c-bf0d-a2add84fb680', 'LzVt54WTt5V5a3i50r6ki6ATnTH2', '2026-05-04 14:47:51.921107');
INSERT INTO "notice_reads" ("id", "notice_id", "user_id", "read_at") VALUES ('01face9f-2dfc-47c9-a6c5-57d4c9856309', '793bcec0-cec7-4b1c-bf0d-a2add84fb680', '6VVz6b4QtvTTD95eLs3Z2cWxRcw1', '2026-05-04 15:04:33.448972');
INSERT INTO "notice_reads" ("id", "notice_id", "user_id", "read_at") VALUES ('bf2cb30e-0e64-41fc-9645-33ebbd344fcd', '69a1f5c0-82db-408a-8263-94f706b3b411', '6VVz6b4QtvTTD95eLs3Z2cWxRcw1', '2026-05-05 13:56:51.469597');
INSERT INTO "notice_reads" ("id", "notice_id", "user_id", "read_at") VALUES ('60a7c823-c1d8-46df-9c6a-6c6993ce201f', '793bcec0-cec7-4b1c-bf0d-a2add84fb680', 'Vy98SbjjtdVAGNk9qyXnp2axX7r2', '2026-05-07 05:59:38.075153');
INSERT INTO "notice_reads" ("id", "notice_id", "user_id", "read_at") VALUES ('46c24b44-0f43-4566-834f-01e2e6af85ec', '793bcec0-cec7-4b1c-bf0d-a2add84fb680', 'AgT36AgIqFe8XhH4X2rkzcxd3jQ2', '2026-05-09 13:34:59.367235');
INSERT INTO "notice_reads" ("id", "notice_id", "user_id", "read_at") VALUES ('f70f2c05-d70d-4a13-b330-783740068a10', '793bcec0-cec7-4b1c-bf0d-a2add84fb680', 'syQve7F1J7fmXmedQJwS0VG5sEn2', '2026-05-09 13:42:16.495954');
INSERT INTO "notice_reads" ("id", "notice_id", "user_id", "read_at") VALUES ('94a8026b-3979-40bb-ba42-e6b9040fef26', '793bcec0-cec7-4b1c-bf0d-a2add84fb680', 'oEzAMBsaGHcwFxYMLh0UFrDwdVt1', '2026-05-09 14:09:37.266263');
INSERT INTO "notice_reads" ("id", "notice_id", "user_id", "read_at") VALUES ('d7e41a1c-270d-443d-a577-540fccba38cb', '793bcec0-cec7-4b1c-bf0d-a2add84fb680', 'vVrlRlZhaRY2LMPDVQDtcRQDJhs1', '2026-05-10 13:49:21.934723');
INSERT INTO "notice_reads" ("id", "notice_id", "user_id", "read_at") VALUES ('efc0e3ef-4ea0-4e67-bc8b-b18b3b03170b', '793bcec0-cec7-4b1c-bf0d-a2add84fb680', 'HRGIS58dS0OpMcFHjmPNldh9ATs1', '2026-05-10 14:42:15.804733');
INSERT INTO "notice_reads" ("id", "notice_id", "user_id", "read_at") VALUES ('77635005-d896-454b-b257-9b1882ff0363', '793bcec0-cec7-4b1c-bf0d-a2add84fb680', '3UFtoL0ce8SZLWXeJovpQovSZB62', '2026-05-11 12:35:06.504660');
INSERT INTO "notice_reads" ("id", "notice_id", "user_id", "read_at") VALUES ('5b50ba32-42a2-46ad-a360-bfbf6e75b13b', '793bcec0-cec7-4b1c-bf0d-a2add84fb680', 'uhTxv25OTRbJOyO2DNRabojGRkh1', '2026-05-12 14:08:39.614788');

-- leave_balances (1 rows)
INSERT INTO "leave_balances" ("id", "company_id", "user_id", "total_days", "used_days", "year", "created_at", "updated_at") VALUES ('c09f3eb3-4d3b-41c4-a64c-51f2cc7d11c2', '4efaf324-2435-483d-b21f-70e98d0dd0f5', '6VVz6b4QtvTTD95eLs3Z2cWxRcw1', 20, 1.5, 2026, '2026-05-06 02:22:38.808831', '2026-05-06 03:55:35.790191');

-- leaves (3 rows)
INSERT INTO "leaves" ("id", "company_id", "user_id", "user_name", "leave_type", "start_date", "end_date", "days", "is_half", "reason", "status", "approved_by", "approved_at", "created_at") VALUES ('783ea289-a910-49a4-939a-20658e933e81', '4efaf324-2435-483d-b21f-70e98d0dd0f5', '6VVz6b4QtvTTD95eLs3Z2cWxRcw1', '조은상', 'annual', '2026-05-07', '2026-05-07', 1, TRUE, '개인사유', 'approved', '6VVz6b4QtvTTD95eLs3Z2cWxRcw1', '2026-05-06 02:23:12.498362', '2026-05-06 02:22:54.553886');
INSERT INTO "leaves" ("id", "company_id", "user_id", "user_name", "leave_type", "start_date", "end_date", "days", "is_half", "reason", "status", "approved_by", "approved_at", "created_at") VALUES ('4f25b201-dc83-4816-a252-cd6cd87ef10a', '4efaf324-2435-483d-b21f-70e98d0dd0f5', '6VVz6b4QtvTTD95eLs3Z2cWxRcw1', '조은상', 'annual', '2026-05-08', '2026-05-08', 1, TRUE, '테스트', 'rejected', '6VVz6b4QtvTTD95eLs3Z2cWxRcw1', '2026-05-06 03:55:10.510681', '2026-05-06 03:55:00.901846');
INSERT INTO "leaves" ("id", "company_id", "user_id", "user_name", "leave_type", "start_date", "end_date", "days", "is_half", "reason", "status", "approved_by", "approved_at", "created_at") VALUES ('242067fe-6ecd-4951-a5ff-dae76974b221', '4efaf324-2435-483d-b21f-70e98d0dd0f5', '6VVz6b4QtvTTD95eLs3Z2cWxRcw1', '조은상', 'annual', '2026-05-11', '2026-05-11', 1, TRUE, '테스트', 'approved', '6VVz6b4QtvTTD95eLs3Z2cWxRcw1', '2026-05-06 03:55:35.783945', '2026-05-06 03:55:28.702184');

