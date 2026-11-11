-- ============================================================
-- LifeLink: Organ & Blood Donation Platform
-- Database Schema (PostgreSQL)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- HOSPITALS TABLE
-- ============================================================
CREATE TABLE hospitals (
    hospital_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(200) NOT NULL,
    address         TEXT NOT NULL,
    city            VARCHAR(100) NOT NULL,
    state           VARCHAR(100),
    country         VARCHAR(100) NOT NULL DEFAULT 'India',
    pincode         VARCHAR(20),
    phone           VARCHAR(20),
    email           VARCHAR(200),
    latitude        DECIMAL(10,8),
    longitude       DECIMAL(11,8),
    verified_status BOOLEAN NOT NULL DEFAULT FALSE,
    verified_at     TIMESTAMP,
    verified_by     UUID,  -- references users(user_id) of admin
    license_number  VARCHAR(100) UNIQUE,
    hospital_type   VARCHAR(50) CHECK (hospital_type IN ('Government','Private','NGO','Multi-specialty','Clinic')),
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- USERS TABLE
-- ============================================================
CREATE TABLE users (
    user_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(200) NOT NULL,
    email           VARCHAR(200) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    phone           VARCHAR(20),
    role            VARCHAR(20) NOT NULL CHECK (role IN ('donor','recipient','hospital_admin','admin')),
    age             INTEGER CHECK (age >= 0 AND age <= 120),
    blood_type      VARCHAR(5) CHECK (blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
    organ_type      VARCHAR(50),  -- for donors: organ they can donate
    address         TEXT,
    city            VARCHAR(100),
    state           VARCHAR(100),
    country         VARCHAR(100) DEFAULT 'India',
    latitude        DECIMAL(10,8),
    longitude       DECIMAL(11,8),
    hospital_id     UUID REFERENCES hospitals(hospital_id) ON DELETE SET NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    -- MILESTONE 9: 2FA, offered to hospital_admin/admin roles — the
    -- highest-privilege accounts. two_factor_secret is only ever set
    -- once two_factor_enabled is confirmed true (see auth.js /2fa/verify);
    -- a secret existing without confirmation would mean an
    -- unauthenticated setup attempt could silently protect an account
    -- the real owner never finished enrolling.
    two_factor_secret  VARCHAR(255),
    two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    last_login      TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast email lookup
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_blood_type ON users(blood_type);

-- ============================================================
-- DONATIONS TABLE
-- ============================================================
CREATE TABLE donations (
    donation_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    donor_id            UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    organ_type          VARCHAR(50) NOT NULL,
    blood_type          VARCHAR(5) NOT NULL CHECK (blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
    donation_date       DATE,
    status              VARCHAR(30) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','verified','available','matched','completed','rejected','expired')),
    hospital_id         UUID REFERENCES hospitals(hospital_id),
    notes               TEXT,
    medical_report_url  VARCHAR(500),
    next_eligible_date  DATE,  -- computed: donation_date + 90 days for blood
    verified_by         UUID REFERENCES users(user_id),
    verified_at         TIMESTAMP,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_donations_donor ON donations(donor_id);
CREATE INDEX idx_donations_status ON donations(status);
CREATE INDEX idx_donations_organ ON donations(organ_type);
CREATE INDEX idx_donations_blood ON donations(blood_type);

-- ============================================================
-- REQUESTS TABLE
-- ============================================================
CREATE TABLE requests (
    request_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_id    UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    organ_needed    VARCHAR(50) NOT NULL,
    blood_type      VARCHAR(5) NOT NULL CHECK (blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
    urgency         VARCHAR(20) NOT NULL DEFAULT 'medium'
                    CHECK (urgency IN ('low','medium','high','critical')),
    request_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    status          VARCHAR(30) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','reviewing','matched','completed','cancelled','expired')),
    hospital_id     UUID REFERENCES hospitals(hospital_id),
    doctor_name     VARCHAR(200),
    diagnosis       TEXT,
    notes           TEXT,
    documents_url   VARCHAR(500),
    expires_at      DATE,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_requests_recipient ON requests(recipient_id);
CREATE INDEX idx_requests_status ON requests(status);
CREATE INDEX idx_requests_organ ON requests(organ_needed);
CREATE INDEX idx_requests_blood ON requests(blood_type);
CREATE INDEX idx_requests_urgency ON requests(urgency);

-- ============================================================
-- MATCHES TABLE
-- ============================================================
CREATE TABLE matches (
    match_id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    donation_id         UUID NOT NULL REFERENCES donations(donation_id) ON DELETE CASCADE,
    request_id          UUID NOT NULL REFERENCES requests(request_id) ON DELETE CASCADE,
    match_date          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- MILESTONE 4: 'medical_review' added between 'pending' and 'confirmed'.
    -- Required for organ matches (requires_crossmatch = TRUE) before they
    -- can be confirmed — blood matches can skip straight to 'confirmed'.
    -- See the organ-matching refinement note on requires_crossmatch below.
    status              VARCHAR(30) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','medical_review','confirmed','in_progress','completed','failed','cancelled')),
    compatibility_score INTEGER CHECK (compatibility_score BETWEEN 0 AND 100),
    matched_by          VARCHAR(20) DEFAULT 'algorithm' CHECK (matched_by IN ('algorithm','manual','admin')),
    -- TRUE for anything except Blood. The algorithm's compatibility score
    -- is a candidate-shortlist signal, never a medical decision — this
    -- flag is what the UI uses to show "preliminary suggestion, full
    -- medical evaluation required" and what the backend uses to block
    -- /confirm until medical_review has happened.
    requires_crossmatch BOOLEAN NOT NULL DEFAULT FALSE,
    confirmed_at        TIMESTAMP,
    completed_at        TIMESTAMP,
    hospital_id         UUID REFERENCES hospitals(hospital_id),
    notes               TEXT,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(donation_id, request_id)
);

CREATE INDEX idx_matches_donation ON matches(donation_id);
CREATE INDEX idx_matches_request ON matches(request_id);
CREATE INDEX idx_matches_status ON matches(status);

-- ============================================================
-- MILESTONE 4: match status timeline
-- One row per status transition — powers the visual stepper on the
-- recipient/donor match view instead of just showing the current status.
-- ============================================================
CREATE TABLE match_status_history (
    history_id  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id    UUID NOT NULL REFERENCES matches(match_id) ON DELETE CASCADE,
    status      VARCHAR(30) NOT NULL,
    changed_by  UUID REFERENCES users(user_id),
    note        TEXT,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_match_history_match ON match_status_history(match_id);

-- ============================================================
-- MILESTONE 6: notification preferences
-- One row per user; category toggles are jsonb so new notification
-- types (e.g. Milestone 7's messaging) can add a key without a schema
-- migration. Missing key = defaults to enabled, checked in
-- notificationService.js.
-- ============================================================
CREATE TABLE notification_preferences (
    user_id       UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    sms_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
    categories    JSONB NOT NULL DEFAULT '{}',
    updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- MILESTONE 7: in-app messaging, scoped to a match
-- Only the donor, recipient, and hospital staff on a given match can
-- see or send messages in its thread — enforced in the route/socket
-- auth layer, not just the UI.
-- ============================================================
CREATE TABLE messages (
    message_id  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id    UUID NOT NULL REFERENCES matches(match_id) ON DELETE CASCADE,
    sender_id   UUID NOT NULL REFERENCES users(user_id),
    body        TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at     TIMESTAMP
);

CREATE INDEX idx_messages_match ON messages(match_id);

-- ============================================================
-- MILESTONE 11: blood drive / donation events
-- Community-engagement feature — hospitals post events, donors browse
-- and register interest. Deliberately simple: registration is an
-- expression of intent (for the hospital to plan around and follow up
-- on), not a binding commitment or a real-time capacity system.
-- ============================================================
CREATE TABLE blood_drive_events (
    event_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id  UUID NOT NULL REFERENCES hospitals(hospital_id) ON DELETE CASCADE,
    title        VARCHAR(200) NOT NULL,
    description  TEXT,
    event_date   TIMESTAMP NOT NULL,
    city         VARCHAR(100),
    latitude     DECIMAL(10,8),
    longitude    DECIMAL(11,8),
    created_by   UUID REFERENCES users(user_id),
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE event_registrations (
    event_id      UUID NOT NULL REFERENCES blood_drive_events(event_id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    registered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (event_id, user_id)
);

CREATE INDEX idx_events_date ON blood_drive_events(event_date);
CREATE INDEX idx_events_hospital ON blood_drive_events(hospital_id);

-- ============================================================
-- NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE notifications (
    notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    type            VARCHAR(50) NOT NULL
                    CHECK (type IN ('match_found','request_approved','donation_verified','system','reminder','alert')),
    title           VARCHAR(200) NOT NULL,
    message         TEXT NOT NULL,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    sent_email      BOOLEAN NOT NULL DEFAULT FALSE,
    sent_sms        BOOLEAN NOT NULL DEFAULT FALSE,
    related_id      UUID,  -- polymorphic: match_id / donation_id / request_id
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);

-- ============================================================
-- BLOOD COMPATIBILITY TABLE (reference)
-- ============================================================
CREATE TABLE blood_compatibility (
    donor_type      VARCHAR(5) NOT NULL,
    recipient_type  VARCHAR(5) NOT NULL,
    PRIMARY KEY (donor_type, recipient_type)
);

INSERT INTO blood_compatibility VALUES
('O-','O-'),('O-','O+'),('O-','A-'),('O-','A+'),('O-','B-'),('O-','B+'),('O-','AB-'),('O-','AB+'),
('O+','O+'),('O+','A+'),('O+','B+'),('O+','AB+'),
('A-','A-'),('A-','A+'),('A-','AB-'),('A-','AB+'),
('A+','A+'),('A+','AB+'),
('B-','B-'),('B-','B+'),('B-','AB-'),('B-','AB+'),
('B+','B+'),('B+','AB+'),
('AB-','AB-'),('AB-','AB+'),
('AB+','AB+');

-- ============================================================
-- AUDIT LOG TABLE
-- ============================================================
CREATE TABLE audit_logs (
    log_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES users(user_id),
    action      VARCHAR(100) NOT NULL,
    table_name  VARCHAR(100),
    record_id   UUID,
    old_data    JSONB,
    new_data    JSONB,
    ip_address  VARCHAR(45),
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- MILESTONE 2: refresh tokens (access/refresh split)
-- Stores a hash of the opaque refresh token, never the raw value —
-- mirrors how password_hash works. Lets a token be revoked
-- server-side (logout, or "log out all devices") instead of just
-- waiting for a long-lived JWT to expire on its own.
-- ============================================================
CREATE TABLE refresh_tokens (
    token_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash  VARCHAR(64) NOT NULL UNIQUE, -- sha256 hex digest
    expires_at  TIMESTAMP NOT NULL,
    revoked_at  TIMESTAMP,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- ============================================================
-- TRIGGER: auto-update updated_at timestamps
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_hospitals_updated_at BEFORE UPDATE ON hospitals FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_donations_updated_at BEFORE UPDATE ON donations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_requests_updated_at BEFORE UPDATE ON requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_matches_updated_at BEFORE UPDATE ON matches FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SEED DATA (sample)
-- ============================================================
INSERT INTO hospitals (name, address, city, state, verified_status, hospital_type, license_number)
VALUES
('Apollo Hospital', '154/11, Bannerghatta Rd', 'Bangalore', 'Karnataka', TRUE, 'Multi-specialty', 'KA-HOS-001'),
('AIIMS Delhi', 'Sri Aurobindo Marg', 'New Delhi', 'Delhi', TRUE, 'Government', 'DL-HOS-001'),
('Fortis Healthcare', 'Bannerghatta Road', 'Bangalore', 'Karnataka', FALSE, 'Multi-specialty', 'KA-HOS-002'),
('CMC Vellore', 'Ida Scudder Rd', 'Vellore', 'Tamil Nadu', TRUE, 'Private', 'TN-HOS-001');
