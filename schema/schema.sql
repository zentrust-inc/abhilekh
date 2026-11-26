-- abhilekh — schema v1.0 (locked 26 Nov 2026)
-- SCHEMA v0.1 + approved change set C1–C7. PostgreSQL 13+.
-- Pipeline: capture → extract → verify → derive → share.
-- The printed paper is the record; everything else points back at it.
--
-- Invariants
--  I1  Every value is stored *_as_written, verbatim. Derived values never overwrite it.
--  I2  Images are immutable. A re-shot paper is a new document; the old one is superseded, never deleted.
--  I3  extracted_field and verification_event are append-only. Current state is a view over them.
--  I4  Every item traces to one field_consensus row → its reader fields → one page and one normalised box.
--  I5  Every derived row carries derivation_version and links to its source item; the derived layer can be rebuilt.
--  I6  A document is indexable only when document_gate.blocking = 0.
--  I7  'absent' (not on the paper) and 'unreadable' (cannot be read) are distinct and never merged.
--  I8  No derived value encodes interpretation: no interaction checks, dose warnings, invented
--      abnormal flags, app-computed "outside range", or brand→generic mapping.
--  I9  Share tokens are opaque; no patient details in a URL; shares last at most 15 minutes.
--  I10 Every derived date carries table_version and precision. Day precision is verified for
--      BS 2000–2090 (derived/verify_calendar.py); outside it precision = 'approximate_day'.

-- ───────────────────────── 1. Identity ─────────────────────────

CREATE TABLE account (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    phone      text UNIQUE NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE person (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      uuid NOT NULL REFERENCES account(id) ON DELETE CASCADE,
    display_name    text NOT NULL,          -- what the person wants to be called
    name_as_written text,                   -- on the paper
    name_script     text CHECK (name_script IN ('nepali','latin','mixed')),
    name_norm       text,                   -- transliterated + folded; for MATCHING only, never displayed
    dob             date,
    age_years       int,
    phone           text,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX person_account_idx   ON person (account_id);
CREATE INDEX person_name_norm_idx ON person (name_norm);

-- ───────────────────────── 2. Original document (immutable) ─────────────────────────

CREATE TABLE document (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id         uuid NOT NULL REFERENCES person(id),
    doc_type          text NOT NULL,        -- page.v2 document_type
    doc_type_source   text NOT NULL DEFAULT 'model',
    status            text NOT NULL DEFAULT 'captured',
    captured_at       timestamptz NOT NULL DEFAULT now(),
    source            text NOT NULL DEFAULT 'camera',
    superseded_by     uuid REFERENCES document(id),
    CONSTRAINT document_type_ck   CHECK (doc_type IN ('prescription','opd_note','lab_report','imaging_report',
                                     'discharge_summary','notebook_page','booklet_cover','referral','bill','other')),
    CONSTRAINT document_status_ck CHECK (status IN ('captured','extracted','verified','indexed','superseded')),
    CONSTRAINT document_type_source_ck CHECK (doc_type_source IN ('model','user'))
);
CREATE INDEX document_person_idx ON document (person_id, captured_at DESC);

-- Rule group of a paper type (mirrors schema/checklist.json "type_groups").
CREATE FUNCTION doc_type_group(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE
        WHEN t IN ('prescription','opd_note') THEN 'prescription'
        WHEN t = 'lab_report'                 THEN 'lab_report'
        WHEN t = 'discharge_summary'          THEN 'discharge'
        WHEN t = 'imaging_report'             THEN 'imaging'
        ELSE 'other' END $$;

CREATE TABLE document_page (               -- several pages = one document (two-sided, multi-page)
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id uuid NOT NULL REFERENCES document(id) ON DELETE RESTRICT,
    page_index  int  NOT NULL,
    image_uri   text NOT NULL,
    width_px    int,
    height_px   int,
    sha256      text NOT NULL,
    UNIQUE (document_id, page_index)
);

CREATE TABLE document_person_match (
    document_id  uuid NOT NULL REFERENCES document(id),
    person_id    uuid NOT NULL REFERENCES person(id),
    method       text NOT NULL CHECK (method IN ('name_match','user_asserted','single_person_account')),
    confidence   real,
    confirmed_by uuid REFERENCES person(id),
    confirmed_at timestamptz,
    PRIMARY KEY (document_id, person_id)
);

-- Immutability of originals (I2): pages cannot be changed or removed.
CREATE FUNCTION forbid_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION '% is append-only', TG_TABLE_NAME; END $$;
CREATE TRIGGER document_page_immutable BEFORE UPDATE OR DELETE ON document_page
    FOR EACH ROW EXECUTE FUNCTION forbid_change();

-- ───────────────────────── 3. Visit ─────────────────────────

CREATE TABLE visit (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id                uuid NOT NULL REFERENCES person(id),
    facility_as_written      text,
    doctor_name_as_written   text,
    doctor_reg_no_as_written text,           -- exactly as printed; never checked against a registry (C7)
    complaint_as_written     text,
    created_at               timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX visit_person_idx ON visit (person_id);

CREATE TABLE document_visit (               -- a page may hold several dated visits
    document_id uuid NOT NULL REFERENCES document(id),
    visit_id    uuid NOT NULL REFERENCES visit(id),
    PRIMARY KEY (document_id, visit_id)
);

-- ───────────────────────── 4. Extracted (machine output, append-only) ─────────────────────────

CREATE TABLE extraction_run (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id    uuid NOT NULL REFERENCES document(id),
    reader         text NOT NULL CHECK (reader IN ('claude','google_vision')),
    engine_version text NOT NULL,
    prompt_version text,
    started_at     timestamptz NOT NULL DEFAULT now(),
    finished_at    timestamptz,
    status         text NOT NULL DEFAULT 'running' CHECK (status IN ('running','ok','failed','partial')),
    superseded_by  uuid REFERENCES extraction_run(id)     -- a re-read retires the older run (C2)
);
CREATE INDEX extraction_run_doc_idx ON extraction_run (document_id, started_at DESC);

CREATE TABLE extracted_field (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id         uuid NOT NULL REFERENCES extraction_run(id),
    document_id    uuid NOT NULL REFERENCES document(id),
    page_id        uuid REFERENCES document_page(id),
    path           text NOT NULL,     -- page.v2 path, 0-based: encounters.0.medicines.2.name_as_written
    raw_text       text,              -- exactly as read
    bbox           jsonb,             -- {x,y,w,h} normalised 0..1
    created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX extracted_field_doc_idx ON extracted_field (document_id, path);
CREATE INDEX extracted_field_run_idx ON extracted_field (run_id);
CREATE TRIGGER extracted_field_append_only BEFORE UPDATE OR DELETE ON extracted_field
    FOR EACH ROW EXECUTE FUNCTION forbid_change();

-- Two readers, one result per path (C2). Only 'agreed' may be pre-filled (rule 4).
CREATE TABLE field_consensus (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id       uuid NOT NULL REFERENCES document(id),
    path              text NOT NULL,
    field_claude      uuid REFERENCES extracted_field(id),
    field_vision      uuid REFERENCES extracted_field(id),
    agreement         text NOT NULL CHECK (agreement IN ('agreed','one_reader','uncertain')),
    prefill           text,
    needs_own_tap     boolean NOT NULL DEFAULT false,   -- a date or a value with a decimal point
    consensus_version text NOT NULL,
    superseded_by     uuid REFERENCES field_consensus(id),
    created_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT prefill_only_if_agreed_ck CHECK (prefill IS NULL OR agreement = 'agreed'),
    CONSTRAINT consensus_has_a_reader_ck CHECK (field_claude IS NOT NULL OR field_vision IS NOT NULL)
);
CREATE UNIQUE INDEX field_consensus_current_idx ON field_consensus (document_id, path) WHERE superseded_by IS NULL;

-- ───────────────────────── 5. Verification (append-only) ─────────────────────────

CREATE TABLE verification_event (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    seq             bigserial NOT NULL,       -- ordering key; created_at is transaction time and can tie
    consensus_id    uuid NOT NULL REFERENCES field_consensus(id),
    actor_kind      text NOT NULL CHECK (actor_kind IN ('patient','family','clinician','system')),
    actor_person_id uuid REFERENCES person(id),
    actor_name      text,                     -- a named clinician (CLAUDE.md: patient or a named clinician confirms)
    action          text NOT NULL CHECK (action IN ('confirmed','corrected','marked_absent_on_paper',
                                                    'marked_unreadable','reopened')),
    from_value      text,
    to_value        text,
    note            text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT clinician_is_named_ck CHECK (actor_kind <> 'clinician' OR actor_name IS NOT NULL),
    CONSTRAINT system_only_reopens_ck CHECK (actor_kind <> 'system' OR action = 'reopened')
);
CREATE INDEX verification_event_idx ON verification_event (consensus_id, seq DESC);
CREATE TRIGGER verification_event_append_only BEFORE UPDATE OR DELETE ON verification_event
    FOR EACH ROW EXECUTE FUNCTION forbid_change();

CREATE VIEW current_field AS
SELECT fc.id AS consensus_id, fc.document_id, fc.path, fc.agreement, fc.prefill, fc.needs_own_tap,
       COALESCE(lv.to_value, fc.prefill) AS value,
       CASE COALESCE(lv.action, 'pending')
            WHEN 'confirmed'              THEN 'verified'
            WHEN 'corrected'              THEN 'verified'
            WHEN 'marked_absent_on_paper' THEN 'absent'
            WHEN 'marked_unreadable'      THEN 'unreadable'
            ELSE 'pending' END AS state
FROM field_consensus fc
LEFT JOIN LATERAL (SELECT v.action, v.to_value FROM verification_event v
                   WHERE v.consensus_id = fc.id ORDER BY v.seq DESC LIMIT 1) lv ON true
WHERE fc.superseded_by IS NULL;

-- ───────────────────────── 6. Checklist and gate (C1, C4) ─────────────────────────
-- Rules live in schema/checklist.json. reader/checklist.mjs expand() writes the expected paths
-- for a document (from the RULES, not from what was read) into checklist_expected.

CREATE TABLE checklist_expected (
    document_id   uuid NOT NULL REFERENCES document(id),
    path          text NOT NULL,                 -- 0-based concrete path
    requirement   text NOT NULL CHECK (requirement IN ('each_row','if_present')),
    rules_version text NOT NULL,
    PRIMARY KEY (document_id, path)
);

CREATE TABLE document_row_count (           -- each row group's count, confirmed by the patient
    document_id    uuid NOT NULL REFERENCES document(id),
    row_group      text NOT NULL,             -- encounters.0.medicines | lab.sections.0.rows | dates
    rows_read      int  NOT NULL CHECK (rows_read >= 0),
    min_rows       int  NOT NULL DEFAULT 0,
    rows_confirmed int  CHECK (rows_confirmed >= 0),
    confirmed_by   uuid REFERENCES person(id),
    PRIMARY KEY (document_id, row_group)
);

CREATE TABLE ocr_block (                    -- every text block Google Vision found
    id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id  uuid NOT NULL REFERENCES extraction_run(id),
    page_id uuid NOT NULL REFERENCES document_page(id),
    text    text NOT NULL,
    bbox    jsonb NOT NULL
);

CREATE TABLE block_assignment (             -- coverage: nothing on the page silently dropped
    block_id     uuid PRIMARY KEY REFERENCES ocr_block(id),
    consensus_id uuid REFERENCES field_consensus(id),
    assigned_as  text NOT NULL CHECK (assigned_as IN ('field','text_block','not_text_confirmed')),
    CONSTRAINT field_needs_consensus_ck CHECK (assigned_as <> 'field' OR consensus_id IS NOT NULL)
);

CREATE VIEW checklist_state AS
SELECT e.document_id, e.path, e.requirement,
       cf.consensus_id IS NOT NULL       AS read,
       COALESCE(cf.state, 'pending')     AS state
FROM checklist_expected e
LEFT JOIN current_field cf ON cf.document_id = e.document_id AND cf.path = e.path;

CREATE VIEW document_gate AS
SELECT d.id AS document_id,
       (d.doc_type_source <> 'user')::int                                            AS type_unconfirmed,
       (NOT EXISTS (SELECT 1 FROM document_person_match m
                    WHERE m.document_id = d.id AND m.confirmed_at IS NOT NULL))::int  AS person_unconfirmed,
       (SELECT count(*) FROM checklist_state c
         WHERE c.document_id = d.id AND c.state = 'pending'
           AND (c.requirement = 'each_row' OR c.read))                               AS fields_pending,
       (SELECT count(*) FROM document_row_count r
         WHERE r.document_id = d.id
           AND (r.rows_confirmed IS NULL OR r.rows_confirmed <> r.rows_read))         AS counts_unconfirmed,
       (NOT EXISTS (SELECT 1 FROM checklist_expected e WHERE e.document_id = d.id))::int AS checklist_missing,
       (SELECT count(*) FROM ocr_block b
          JOIN extraction_run r ON r.id = b.run_id AND r.superseded_by IS NULL
          JOIN document_page p ON p.id = b.page_id AND p.document_id = d.id
          LEFT JOIN block_assignment a ON a.block_id = b.id
         WHERE a.block_id IS NULL)                                                   AS blocks_unassigned
FROM document d;

CREATE VIEW document_indexable AS
SELECT document_id,
       type_unconfirmed + person_unconfirmed + fields_pending + counts_unconfirmed
         + checklist_missing + blocks_unassigned AS blocking
FROM document_gate;

-- ───────────────────────── 7. Items (the confirmed copy, verbatim) ─────────────────────────
-- Written from current_field.value when a path leaves 'pending'; rebuilt on 'corrected' or 'reopened' (C3).

CREATE TABLE item (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id       uuid NOT NULL REFERENCES person(id),
    document_id     uuid NOT NULL REFERENCES document(id),
    visit_id        uuid REFERENCES visit(id),
    consensus_id    uuid NOT NULL UNIQUE REFERENCES field_consensus(id),
    kind            text NOT NULL CHECK (kind IN ('medicine','lab_result','diagnosis','vital','allergy','procedure',
                                                   'investigation','vaccine','instruction','text_block','date')),
    ordinal         int  NOT NULL DEFAULT 0,
    text_as_written text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX item_visit_idx       ON item (visit_id, ordinal);
CREATE INDEX item_person_kind_idx ON item (person_id, kind);

CREATE TABLE item_medicine (
    item_id                 uuid PRIMARY KEY REFERENCES item(id),
    drug_name_as_written    text NOT NULL,
    strength_as_written     text,
    form_as_written         text,
    dose_as_written         text,
    frequency_as_written    text,
    duration_as_written     text,
    instructions_as_written text,
    struck_through          boolean NOT NULL DEFAULT false   -- kept and shown as struck, never offered as a medicine
);

CREATE TABLE item_lab_result (               -- verbatim only; numbers live in the derived layer (C5)
    item_id                  uuid PRIMARY KEY REFERENCES item(id),
    test_name_as_written     text NOT NULL,
    value_as_written         text NOT NULL,
    unit_as_written          text,
    printed_range_as_written text,
    printed_flag_as_written  text            -- the lab's own flag; never substituted
);

CREATE TABLE item_vital       (item_id uuid PRIMARY KEY REFERENCES item(id), name_as_written text NOT NULL,
                               value_as_written text, unit_as_written text);
CREATE TABLE item_allergy     (item_id uuid PRIMARY KEY REFERENCES item(id), substance_as_written text NOT NULL,
                               reaction_as_written text);
CREATE TABLE item_text        (item_id uuid PRIMARY KEY REFERENCES item(id), text_as_written text NOT NULL);
-- diagnosis, procedure, investigation, vaccine, instruction and text_block items use item.text_as_written only.

CREATE TABLE item_date (                     -- verbatim layer (C5)
    item_id      uuid PRIMARY KEY REFERENCES item(id),
    role         text NOT NULL CHECK (role IN ('visit_date','prescribed_on','sample_collected_on','reported_on',
                                                'admitted_on','discharged_on','follow_up_on','birth_date','other')),
    label_as_printed text,                   -- the word beside it on the paper, if any
    printed_text text NOT NULL               -- never altered
);

-- ───────────────────────── 8. Derived layer (rebuildable, I5) ─────────────────────────

CREATE TABLE derived_date (
    item_id             uuid NOT NULL REFERENCES item_date(item_id),
    derivation_version  text NOT NULL,
    parsed_y int, parsed_m int, parsed_d int,  -- from derived/date_tokens.py
    parse_status        text NOT NULL CHECK (parse_status IN ('parsed','ambiguous_order','partial','unparsed')),
    status              text NOT NULL CHECK (status IN ('ok','ambiguous','out_of_table','out_of_window','invalid','not_converted')),
    calendar_assumption text NOT NULL CHECK (calendar_assumption IN ('BS','AD','UNKNOWN')),
    derived_ad          date,
    derived_bs_year int, derived_bs_month int, derived_bs_day int,
    precision           text CHECK (precision IN ('day','approximate_day','month','year')),
    table_version       text NOT NULL,
    resolution_basis    text NOT NULL CHECK (resolution_basis IN ('calendar_filter','calendar_hint','role_window',
                                                                   'trusted_anchor','human','none')),
    event_check         text NOT NULL CHECK (event_check IN ('pass','fail','not_evaluated')),
    anchor_item_id      uuid REFERENCES item_date(item_id),
    anchor_trusted      boolean NOT NULL DEFAULT false,
    alternatives        jsonb,
    note                text,
    PRIMARY KEY (item_id, derivation_version)
);

CREATE TABLE derived_value (                 -- normalised names, units, numbers
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_item_id     uuid NOT NULL REFERENCES item(id),
    source_field       text NOT NULL,        -- item_lab_result.value_as_written
    derived_key        text NOT NULL,        -- number.value | unit.canonical | test.canonical | drug.canonical
    derived_value      jsonb NOT NULL,
    method             text NOT NULL CHECK (method IN ('lexical','numeric_parse','register_lookup')),
    derivation_version text NOT NULL,
    UNIQUE (source_item_id, source_field, derived_key, derivation_version)
);

CREATE TABLE derived_episode (               -- spine of "medicines over time"
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_item_id     uuid NOT NULL REFERENCES item(id),
    canonical_key      text NOT NULL,
    start_date         date NOT NULL,
    end_date           date,
    start_basis        text NOT NULL,        -- prescribed_on | printed_start
    end_basis          text,                 -- printed_duration | printed_end
    derivation_version text NOT NULL,
    UNIQUE (source_item_id, canonical_key, derivation_version)
);

CREATE TABLE derived_result_series (         -- spine of "results over time, per test"; no app-computed flag (C7)
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_item_id     uuid NOT NULL REFERENCES item(id),
    canonical_test_key text NOT NULL,
    sample_date        date NOT NULL,
    numeric_value      numeric,
    value_type         text NOT NULL CHECK (value_type IN ('numeric','qualitative','semi_quantitative','range','free_text')),
    derivation_version text NOT NULL,
    UNIQUE (source_item_id, canonical_test_key, derivation_version)
);

-- ───────────────────────── 9. Share ─────────────────────────

CREATE TABLE share_grant (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id   uuid NOT NULL REFERENCES person(id),
    created_by  uuid NOT NULL REFERENCES person(id),
    token_hash  text NOT NULL UNIQUE,        -- the QR carries the token; never patient details
    code_hash   text,                        -- spoken fallback for clinics with no scanner
    scope       jsonb NOT NULL,              -- {"document_ids":[...]} | {"visit_ids":[...]} | {"all":true}
    created_at  timestamptz NOT NULL DEFAULT now(),
    expires_at  timestamptz NOT NULL,
    revoked_at  timestamptz,
    CONSTRAINT share_15_minutes_ck CHECK (expires_at <= created_at + interval '15 minutes'),
    CONSTRAINT share_expires_after_start_ck CHECK (expires_at > created_at)
);
CREATE INDEX share_grant_person_idx ON share_grant (person_id, expires_at);

CREATE TABLE share_access_log (              -- shown to the patient
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    grant_id    uuid NOT NULL REFERENCES share_grant(id),
    accessed_at timestamptz NOT NULL DEFAULT now(),
    reader_kind text NOT NULL CHECK (reader_kind IN ('clinician','unknown')),
    reader_label text,
    action      text NOT NULL CHECK (action IN ('opened','viewed_page','stopped_by_patient')),
    ip_hash     text
);
CREATE INDEX share_access_grant_idx ON share_access_log (grant_id, accessed_at DESC);
CREATE TRIGGER share_access_log_append_only BEFORE UPDATE OR DELETE ON share_access_log
    FOR EACH ROW EXECUTE FUNCTION forbid_change();
