-- Gate scenario for schema v1.0 (SAMPLE data only). Run: schema/test/run.sh
-- Fails with an exception on the first broken expectation.
\set ON_ERROR_STOP on
BEGIN;

CREATE FUNCTION expect(label text, got bigint, want bigint) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF got IS DISTINCT FROM want THEN RAISE EXCEPTION 'FAIL %: got %, want %', label, got, want; END IF;
      RAISE NOTICE 'ok  %', label; END $$;

INSERT INTO account (id, phone) VALUES ('00000000-0000-0000-0000-00000000000a', '9800000000');
INSERT INTO person (id, account_id, display_name) VALUES
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a', 'Aama Sample');
INSERT INTO document (id, person_id, doc_type) VALUES
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', 'prescription');
INSERT INTO document_page (id, document_id, page_index, image_uri, sha256) VALUES
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000d1', 0, 'sample://p0', 'x');
INSERT INTO extraction_run (id, document_id, reader, engine_version) VALUES
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d1', 'claude', 'v2'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000d1', 'google_vision', 'v1');

-- The checklist (from the rules) expects 3 paths; the readers found only 2 of them.
INSERT INTO checklist_expected (document_id, path, requirement, rules_version) VALUES
  ('00000000-0000-0000-0000-0000000000d1', 'encounters.0.medicines.0.name_as_written', 'each_row', '1.0'),
  ('00000000-0000-0000-0000-0000000000d1', 'encounters.0.medicines.0.dose_as_written', 'each_row', '1.0'),
  ('00000000-0000-0000-0000-0000000000d1', 'encounters.0.follow_up_as_written', 'if_present', '1.0');
INSERT INTO extracted_field (id, run_id, document_id, page_id, path, raw_text) VALUES
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d1',
   '00000000-0000-0000-0000-0000000000f1', 'encounters.0.medicines.0.name_as_written', 'Namunapril'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000d1',
   '00000000-0000-0000-0000-0000000000f1', 'encounters.0.medicines.0.name_as_written', 'Namunapril');
INSERT INTO field_consensus (id, document_id, path, field_claude, field_vision, agreement, prefill, consensus_version) VALUES
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1', 'encounters.0.medicines.0.name_as_written',
   '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2', 'agreed', 'Namunapril', '1');
INSERT INTO document_row_count (document_id, row_group, rows_read) VALUES
  ('00000000-0000-0000-0000-0000000000d1', 'encounters.0.medicines', 1);
INSERT INTO ocr_block (id, run_id, page_id, text, bbox) VALUES
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000f1',
   'Tab Namunapril', '{"x":0,"y":0,"w":1,"h":1}');

SELECT expect('fresh paper: type, person, 2 fields (one never read), count, block all block',
  (SELECT type_unconfirmed + person_unconfirmed FROM document_gate), 2);
SELECT expect('missed each_row field is pending even though nothing was read',
  (SELECT fields_pending FROM document_gate), 2);
SELECT expect('if_present field not read does not block',
  (SELECT count(*) FROM checklist_state WHERE path = 'encounters.0.follow_up_as_written' AND state = 'pending' AND read), 0);
SELECT expect('unconfirmed count blocks', (SELECT counts_unconfirmed FROM document_gate), 1);
SELECT expect('unassigned OCR block blocks', (SELECT blocks_unassigned FROM document_gate), 1);

-- The patient works through it.
UPDATE document SET doc_type_source = 'user' WHERE id = '00000000-0000-0000-0000-0000000000d1';
INSERT INTO document_person_match (document_id, person_id, method, confirmed_by, confirmed_at) VALUES
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', 'single_person_account',
   '00000000-0000-0000-0000-0000000000a1', now());
INSERT INTO verification_event (consensus_id, actor_kind, actor_person_id, action, to_value) VALUES
  ('00000000-0000-0000-0000-0000000000b1', 'patient', '00000000-0000-0000-0000-0000000000a1', 'confirmed', 'Namunapril');
-- The dose was never read: a consensus row from one reader, then "not on the paper".
INSERT INTO extracted_field (id, run_id, document_id, path, raw_text) VALUES
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d1',
   'encounters.0.medicines.0.dose_as_written', NULL);
INSERT INTO field_consensus (id, document_id, path, field_claude, agreement, consensus_version) VALUES
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000d1', 'encounters.0.medicines.0.dose_as_written',
   '00000000-0000-0000-0000-0000000000e3', 'one_reader', '1');
INSERT INTO verification_event (consensus_id, actor_kind, actor_person_id, action) VALUES
  ('00000000-0000-0000-0000-0000000000b2', 'patient', '00000000-0000-0000-0000-0000000000a1', 'marked_absent_on_paper');
UPDATE document_row_count SET rows_confirmed = 1;
INSERT INTO block_assignment (block_id, consensus_id, assigned_as) VALUES
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'field');

SELECT expect('fully worked paper is indexable', (SELECT blocking FROM document_indexable), 0);

-- Reopening a field puts it back.
INSERT INTO verification_event (consensus_id, actor_kind, action) VALUES
  ('00000000-0000-0000-0000-0000000000b1', 'system', 'reopened');
SELECT expect('reopened field blocks again (seq orders events in one transaction)',
  (SELECT blocking FROM document_indexable), 1);

-- Constraints that encode the rules.
DO $$ BEGIN
  BEGIN INSERT INTO field_consensus (document_id, path, field_claude, agreement, prefill, consensus_version)
        VALUES ('00000000-0000-0000-0000-0000000000d1', 'x', '00000000-0000-0000-0000-0000000000e1', 'one_reader', 'guess', '1');
        RAISE EXCEPTION 'FAIL prefill without agreement was accepted';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok  prefill only when both readers agree'; END;
  BEGIN UPDATE verification_event SET note = 'x';
        RAISE EXCEPTION 'FAIL verification_event was updated';
  EXCEPTION WHEN raise_exception THEN RAISE NOTICE 'ok  verification log is append-only'; END;
  BEGIN DELETE FROM document_page; RAISE EXCEPTION 'FAIL page deleted';
  EXCEPTION WHEN raise_exception THEN RAISE NOTICE 'ok  original pages cannot be deleted'; END;
  BEGIN INSERT INTO verification_event (consensus_id, actor_kind, action)
        VALUES ('00000000-0000-0000-0000-0000000000b1', 'clinician', 'confirmed');
        RAISE EXCEPTION 'FAIL unnamed clinician accepted';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok  a clinician must be named'; END;
  BEGIN INSERT INTO share_grant (person_id, created_by, token_hash, scope, expires_at)
        VALUES ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', 't', '{"all":true}',
                now() + interval '1 hour');
        RAISE EXCEPTION 'FAIL 1-hour share accepted';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok  shares last at most 15 minutes'; END;
END $$;

ROLLBACK;
\echo ALL GATE CHECKS PASSED
