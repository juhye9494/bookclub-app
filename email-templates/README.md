# 📧 이메일 템플릿 설정 가이드

Supabase 대시보드에서 이메일 디자인을 변경하는 방법입니다.

## 설정 경로

**Supabase Dashboard** → 좌측 메뉴 **Authentication** → **Email Templates**

---

## 1. 비밀번호 재설정 (Reset Password)

1. **Email Templates** 탭에서 **Reset Password** 선택
2. **Subject**: `한경 언더라인 독서클럽 - 비밀번호 재설정`
3. **Body**: `email-templates/reset_password.html` 파일의 내용을 복사하여 붙여넣기
4. **Save** 클릭

---

## 2. 회원가입 인증 (Confirm Signup)

1. **Email Templates** 탭에서 **Confirm Signup** 선택
2. **Subject**: `한경 언더라인 독서클럽 - 이메일 인증을 완료해주세요`
3. **Body**: `email-templates/confirm_signup.html` 파일의 내용을 복사하여 붙여넣기
4. **Save** 클릭

---

## ⚠️ 중요 사항

- `{{ .ConfirmationURL }}` 변수는 Supabase가 자동으로 실제 링크로 변환합니다. **절대 수정하지 마세요**.
- HTML 코드를 그대로 복사-붙여넣기 하면 됩니다.
- 변경 후 테스트 이메일을 보내 디자인을 확인해보세요.
