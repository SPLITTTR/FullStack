-- V3: Add DOC item type (documents stored in Mongo via mdb-service)

-- Expand allowed item.type values
ALTER TABLE item DROP CONSTRAINT IF EXISTS item_type_check;
ALTER TABLE item
  ADD CONSTRAINT item_type_check CHECK (type IN ('FOLDER', 'FILE', 'DOC'));

-- Replace the shape constraint:
-- FOLDER -> no s3 fields
-- FILE   -> s3_key required
-- DOC    -> no s3 fields (content lives in Mongo)
ALTER TABLE item DROP CONSTRAINT IF EXISTS item_file_shape_check;
ALTER TABLE item
  ADD CONSTRAINT item_file_shape_check CHECK (
    (type = 'FOLDER' AND s3_key IS NULL AND size_bytes IS NULL AND mime_type IS NULL)
    OR
    (type = 'FILE' AND s3_key IS NOT NULL)
    OR
    (type = 'DOC' AND s3_key IS NULL AND size_bytes IS NULL)
  );
