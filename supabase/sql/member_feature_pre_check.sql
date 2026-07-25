-- 배포 전 읽기 전용 사전 검사 쿼리
-- 실제 DB 정리(DELETE) 및 제약조건(UNIQUE) 추가 전에 중복 데이터나 비정상 데이터가 있는지 확인합니다.

-- 1. 중복 group_id + user_id + role 확인 (건수가 0이어야 함)
SELECT group_id, user_id, role, COUNT(*) 
FROM public.group_participants 
GROUP BY group_id, user_id, role 
HAVING COUNT(*) > 1;

-- 2. 같은 그룹에서 leader와 member를 동시에 가진 사용자 확인 (건수가 0이어야 함)
SELECT group_id, user_id 
FROM public.group_participants 
GROUP BY group_id, user_id 
HAVING COUNT(DISTINCT role) > 1;

-- 3. 중복 event_id + user_id 확인 (건수가 0이어야 함)
SELECT event_id, user_id, COUNT(*) 
FROM public.event_participants 
GROUP BY event_id, user_id 
HAVING COUNT(*) > 1;

-- 4. NULL user_id 확인 (건수가 0이어야 함)
SELECT COUNT(*) FROM public.group_participants WHERE user_id IS NULL;
SELECT COUNT(*) FROM public.event_participants WHERE user_id IS NULL;

-- 5. leader 행이 없는 그룹 확인 (건수가 0이어야 함)
SELECT g.id 
FROM public.groups g 
LEFT JOIN public.group_participants gp ON g.id = gp.group_id AND gp.role = 'leader'
WHERE gp.id IS NULL;

-- 6. leader 행이 2개 이상인 그룹 확인 (건수가 0이어야 함)
SELECT group_id, COUNT(*) 
FROM public.group_participants 
WHERE role = 'leader' 
GROUP BY group_id 
HAVING COUNT(*) > 1;

-- 7. groups.membersCount와 실제 행 수가 다른 그룹 확인 (정리 후 0이어야 하지만, 현재 불일치가 있는지 참고용)
SELECT g.id, g."membersCount", COUNT(gp.id) as actual_count
FROM public.groups g
LEFT JOIN public.group_participants gp ON g.id = gp.group_id
GROUP BY g.id, g."membersCount"
HAVING g."membersCount" != COUNT(gp.id);

-- 8. 기존 create_group_with_leader 함수 시그니처 확인 (결과를 확인하여 cutover migration에 반영)
SELECT
  p.oid::regprocedure::text AS function_signature,
  p.prosecdef AS security_definer,
  p.proconfig AS function_config
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'create_group_with_leader';
