BEGIN;

INSERT INTO "city_sm" ("city_id","name","full_name","x_location","created_at","updated_at")
VALUES (
           '1720920299',
           'Москва',
           'Москва',
           'H4sIAAAAAAAAAL2Vz2rbQBDGX0XsKSEmaGX99a0oKhG1JaPKgbYUoSZqENgWyErABEOchF5a8KWnkkNy6a1g3IS6Tu1nmH2jjmzStKnWLqXNRbuaHfT9mPl2dET2o6SexO2MVI5IM8RFUTY1RdGpUSLNpE0qZW1TpZoqy71Snvw4au9GHVJ5cfTjzd4jFUKprEplUTIMcpfnhK0Iz+AjXMOUnbBjGMINe4f7t/BVYGcYvoLre2GYwYQds1P4vPhSNexGaY53u1/oibp4pzaPm8lerua4TmC6tZq7ZfvPgueuY5Fer/Q7rqwqHNxzmLE+TGAEw+UIklSMUHtkeq6J8kXKoiHL2mplYY312QkW4wbG7A0M1zE9i9I0zpK0u/iSJonGfYIiSk6hfMvzbN/1iigV3TAMDuRFDomYYzYoYJIVXUFFSpdDiRwo0204fiES1cqKrD5g4SiP8em2Xa9Zjs81l2hoP7uTS4qb3P0jBO3DFIZsIMAXJJ/Ojfd33ZZ50Ja3Y5vWkgtBdcplvoQPG6Kw1vDNjfL6CrtRjt3s2jJ1RV11KWYwmq9YpoAGcB4g1SW8D34pKT6m7HQ+a8YCfMvT4WoFcLkYeMuq2juWx58hOqXSH7V5gB3FQYdzrS9gDI0Jk//EVKaKLD3kdFE5fqvb5pNGPai79pKLoqNdeVP4Iu/wJ+wvmuPfFOtl/kvbDbM4aReP+tvTanQYNfHY9bctD+Nxx0zar+O0FaFglh5EJRIehnEzfBU346xrNg86WU5GWkknjfZJ7zvc83UVWAcAAA==',
           now(), now()
       )
    ON CONFLICT ("city_id") DO UPDATE
                                   SET "name" = EXCLUDED."name",
                                   "full_name" = EXCLUDED."full_name",
                                   "x_location" = EXCLUDED."x_location",
                                   "updated_at" = now();

ALTER TABLE "account" ALTER COLUMN "city_id" SET DEFAULT '1720920299';

UPDATE "account"
SET "city_id" = '1720920299'
WHERE "city_id" IS DISTINCT FROM '1720920299';

DELETE FROM "user_city_sm";

DELETE FROM "city_sm" WHERE "city_id" <> '1720920299';

COMMIT;
