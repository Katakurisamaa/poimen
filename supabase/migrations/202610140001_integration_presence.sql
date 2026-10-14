-- Limit live integration presence to authenticated members of the same church.
-- The topic format is integration-presence:<church UUID>.

DROP POLICY IF EXISTS integration_presence_read ON realtime.messages;
CREATE POLICY integration_presence_read
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  extension = 'presence'
  AND EXISTS (
    SELECT 1
    FROM public.user_contexts context
    WHERE context.user_id = (SELECT auth.uid())
      AND context.active = true
      AND context.context_type = 'integration'
      AND context.church_id IS NOT NULL
      AND realtime.topic() = 'integration-presence:' || context.church_id::text
  )
  OR extension = 'presence'
  AND EXISTS (
    SELECT 1
    FROM public.profiles profile
    WHERE profile.id = (SELECT auth.uid())
      AND profile.active = true
      AND left(lower(profile.role), 12) = 'integration_'
      AND profile.church_id IS NOT NULL
      AND realtime.topic() = 'integration-presence:' || profile.church_id::text
  )
);

-- A restrictive guard keeps older permissive Realtime policies from widening
-- access to this channel while leaving unrelated Realtime topics untouched.
DROP POLICY IF EXISTS integration_presence_read_scope ON realtime.messages;
CREATE POLICY integration_presence_read_scope
ON realtime.messages
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  extension <> 'presence'
  OR realtime.topic() NOT LIKE 'integration-presence:%'
  OR EXISTS (
    SELECT 1 FROM public.user_contexts context
    WHERE context.user_id = (SELECT auth.uid())
      AND context.active = true
      AND context.context_type = 'integration'
      AND context.church_id IS NOT NULL
      AND realtime.topic() = 'integration-presence:' || context.church_id::text
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles profile
    WHERE profile.id = (SELECT auth.uid())
      AND profile.active = true
      AND left(lower(profile.role), 12) = 'integration_'
      AND profile.church_id IS NOT NULL
      AND realtime.topic() = 'integration-presence:' || profile.church_id::text
  )
);

DROP POLICY IF EXISTS integration_presence_track ON realtime.messages;
CREATE POLICY integration_presence_track
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  extension = 'presence'
  AND EXISTS (
    SELECT 1
    FROM public.user_contexts context
    WHERE context.user_id = (SELECT auth.uid())
      AND context.active = true
      AND context.context_type = 'integration'
      AND context.church_id IS NOT NULL
      AND realtime.topic() = 'integration-presence:' || context.church_id::text
  )
  OR extension = 'presence'
  AND EXISTS (
    SELECT 1
    FROM public.profiles profile
    WHERE profile.id = (SELECT auth.uid())
      AND profile.active = true
      AND left(lower(profile.role), 12) = 'integration_'
      AND profile.church_id IS NOT NULL
      AND realtime.topic() = 'integration-presence:' || profile.church_id::text
  )
);

DROP POLICY IF EXISTS integration_presence_track_scope ON realtime.messages;
CREATE POLICY integration_presence_track_scope
ON realtime.messages
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  extension <> 'presence'
  OR realtime.topic() NOT LIKE 'integration-presence:%'
  OR EXISTS (
    SELECT 1 FROM public.user_contexts context
    WHERE context.user_id = (SELECT auth.uid())
      AND context.active = true
      AND context.context_type = 'integration'
      AND context.church_id IS NOT NULL
      AND realtime.topic() = 'integration-presence:' || context.church_id::text
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles profile
    WHERE profile.id = (SELECT auth.uid())
      AND profile.active = true
      AND left(lower(profile.role), 12) = 'integration_'
      AND profile.church_id IS NOT NULL
      AND realtime.topic() = 'integration-presence:' || profile.church_id::text
  )
);
