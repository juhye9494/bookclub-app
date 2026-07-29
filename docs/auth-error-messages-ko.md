# Supabase 인증 오류 한글 메시지 매핑 (Auth Error Messages)

본 문서는 프로젝트에서 사용되는 Supabase 인증 오류 코드와 한글 사용자 메시지의 매핑 규칙을 정의합니다.

## 공통 처리 함수

`src/utils/authErrorMessage.ts`의 `getAuthErrorMessage(error)`를 통해 모든 인증 오류를 한글로 변환하여 사용자에게 노출합니다. 사용자의 화면에는 영어 원문 에러나 내부 에러가 노출되지 않습니다.

## 매핑 목록

| Supabase 오류 코드 (code / name) | 사용자 안내 문구 (한글) | 주요 발생 기능 | 관리자 확인 |
| :--- | :--- | :--- | :--- |
| `invalid_credentials` | 이메일 또는 비밀번호가 올바르지 않습니다. | 로그인 | X |
| `email_not_confirmed` | 이메일 인증이 완료되지 않았습니다. 인증 메일을 확인해주세요. | 로그인 | X |
| `user_already_exists`, `email_exists` | 이미 가입된 이메일입니다. 로그인해주세요. | 회원가입 | X |
| `weak_password` | 비밀번호가 보안 조건을 충족하지 않습니다. | 회원가입, 비밀번호 변경 | X |
| `same_password` | 기존 비밀번호와 다른 비밀번호를 입력해주세요. | 비밀번호 변경 | X |
| `otp_expired` | 인증번호 또는 인증 링크가 만료되었습니다. 다시 요청해주세요. | 인증 메일, 비밀번호 재설정 | X |
| `over_email_send_rate_limit` | 인증 메일 요청이 너무 많습니다. 잠시 후 다시 시도해주세요. | 인증 메일 발송 | X |
| `over_request_rate_limit` | 요청이 너무 많습니다. 잠시 후 다시 시도해주세요. | 전체 | X |
| `signup_disabled`, `email_provider_disabled` | 현재 이메일 회원가입을 이용할 수 없습니다. | 회원가입 | O |
| `email_address_invalid`, `validation_failed` | 올바른 이메일 주소와 입력값을 확인해주세요. | 회원가입, 로그인 | X |
| `session_expired`, `session_not_found`, `refresh_token_not_found`, `refresh_token_already_used`, `AuthSessionMissingError` | 로그인 시간이 만료되었습니다. 다시 로그인해주세요. | 전체 (세션) | X |
| `reauthentication_needed` | 보안을 위해 다시 로그인한 후 진행해주세요. | 정보 수정 | X |
| `reauthentication_not_valid` | 인증번호가 올바르지 않습니다. 다시 확인해주세요. | 인증 메일 | X |
| `user_banned` | 현재 이용이 제한된 계정입니다. 관리자에게 문의해주세요. | 로그인 | O |
| `request_timeout` | 요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요. | 전체 | X |
| `unexpected_failure`, `conflict` | 일시적인 인증 오류가 발생했습니다. 잠시 후 다시 시도해주세요. | 전체 | O |
| `captcha_failed` | 보안 인증에 실패했습니다. 다시 시도해주세요. | 전체 | X |
| *(기타 공식 목록에 없는 오류)* | 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요. | 전체 | O |

## 보안 정책

- 로그인 실패 시 존재하지 않는 계정, 잘못된 비밀번호, 소셜 로그인 계정 여부를 구분하지 않고 모두 "이메일 또는 비밀번호가 올바르지 않습니다."로 통합 안내하여 계정 존재 여부(Enum) 취약점을 방지합니다.
- 콘솔/서버 로그에는 `error.code`, `error.name`, `error.status`, `error.message`만 남기며, 민감 정보(비밀번호, 토큰 등)는 기록하지 않습니다.
