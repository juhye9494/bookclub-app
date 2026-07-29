BEGIN;

ALTER TABLE public.groups
ADD CONSTRAINT "groups_maxMembers_check"
CHECK ("maxMembers" >= 2 AND "maxMembers" <= 20);

COMMIT;
