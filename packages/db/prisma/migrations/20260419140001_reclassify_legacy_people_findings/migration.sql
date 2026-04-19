-- Reclassify rows that were backfilled from the legacy FindingScope enum.
--
-- 20260419120000_unified_findings flattened every legacy people-scope row
-- (`people`, `people_tasks`, `people_devices`, `people_chart`) onto
-- `area = 'people'` so they stayed queryable. That loses the nuance — a
-- `people_chart` finding is about the org chart, not the people directory —
-- and makes those rows look like first-class people-area findings in the
-- new UI.
--
-- Fix:
-- 1. For each legacy row, look up its creation AuditLog entry. The old
--    finding-audit service always wrote the source scope into
--    `data.findingScope`. The presence of that field on the creation log
--    is a precise "this was created via the old scope-based flow" signal
--    — independent of wall-clock timestamps, so it works correctly on
--    both staging (which has already applied the unified migration) and
--    prod (which will apply it in the same deploy as this reclass).
-- 2. Append a human-readable footer to `content` so the detail sheet
--    still shows what the finding was originally about ("Originally
--    logged against People › Devices").
-- 3. Move the row to `area = 'other'` so UI filters can treat it as
--    historical/unclassified.
--
-- Real `area = 'people'` findings created by the new code path have NO
-- creation AuditLog entry with `findingScope` (the new service writes
-- `targetKind`/`area` instead), so they are not matched by the subquery
-- and left untouched. This is stable regardless of when each environment
-- runs migration 20260419120000.
UPDATE "Finding" f
SET
  "area" = 'other',
  "content" = f."content" || E'\n\n— Originally logged against People › ' ||
    CASE legacy.legacy_scope
      WHEN 'people' THEN 'Directory'
      WHEN 'people_tasks' THEN 'Tasks'
      WHEN 'people_devices' THEN 'Devices'
      WHEN 'people_chart' THEN 'Org chart'
      ELSE legacy.legacy_scope
    END
FROM (
  -- Earliest creation log per finding, filtered to rows that have a
  -- non-null legacy findingScope payload.
  SELECT DISTINCT ON (al."entityId")
    al."entityId" AS finding_id,
    al."data"->>'findingScope' AS legacy_scope
  FROM "AuditLog" al
  WHERE al."entityType" = 'finding'
    AND al."data"->>'action' = 'created'
    AND al."data"->>'findingScope' IS NOT NULL
  ORDER BY al."entityId", al."timestamp" ASC
) AS legacy
WHERE f.id = legacy.finding_id
  AND f."area" = 'people';
