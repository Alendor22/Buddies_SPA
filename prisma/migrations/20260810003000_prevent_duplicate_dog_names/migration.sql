CREATE OR REPLACE FUNCTION prevent_duplicate_dog_name_per_owner()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Dog"
    WHERE "ownerId" = NEW."ownerId"
      AND lower(btrim("name")) = lower(btrim(NEW."name"))
      AND "id" <> NEW."id"
  ) THEN
    RAISE EXCEPTION 'duplicate dog name for owner'
      USING ERRCODE = '23505',
            DETAIL = 'Each owner may only have one dog profile with a given normalized name.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_duplicate_dog_name_per_owner_trigger ON "Dog";

CREATE TRIGGER prevent_duplicate_dog_name_per_owner_trigger
BEFORE INSERT OR UPDATE OF "name", "ownerId" ON "Dog"
FOR EACH ROW
EXECUTE FUNCTION prevent_duplicate_dog_name_per_owner();
