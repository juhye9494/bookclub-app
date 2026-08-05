export function getAuthErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
  }

  const err = error as Record<string, any>;
  const code = err.code || err.name;
  
  // Log for developers (do not log sensitive data like passwords or tokens)
  console.error('[Auth Error]', {
    code: err.code,
    name: err.name,
    status: err.status,
    message: err.message
  });

  switch (code) {
    case 'invalid_credentials':
      return "이메일 또는 비밀번호가 올바르지 않습니다.";
    case 'email_not_confirmed':
      return "이메일 인증이 완료되지 않았습니다. 인증 메일을 확인해주세요.";
    case 'user_already_exists':
    case 'email_exists':
      return "이미 가입 요청된 이메일입니다. 받은편지함을 확인하거나 인증 메일을 다시 요청해 주세요.";
    case 'weak_password':
      return "비밀번호가 보안 조건을 충족하지 않습니다.";
    case 'same_password':
      return "기존 비밀번호와 다른 비밀번호를 입력해주세요.";
    case 'otp_expired':
      return "인증 링크가 만료되었습니다. 인증 메일을 다시 요청해 주세요.";
    case 'over_email_send_rate_limit':
      return "인증 메일 발송이 잠시 제한되었습니다. 잠시 후 다시 시도해 주세요.";
    case 'over_request_rate_limit':
      return "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";
    case 'signup_disabled':
    case 'email_provider_disabled':
      return "현재 이메일 회원가입을 이용할 수 없습니다.";
    case 'email_address_invalid':
    case 'validation_failed':
      return "올바른 이메일 주소와 입력값을 확인해주세요.";
    case 'session_expired':
    case 'session_not_found':
    case 'refresh_token_not_found':
    case 'refresh_token_already_used':
    case 'AuthSessionMissingError':
      return "로그인 시간이 만료되었습니다. 다시 로그인해주세요.";
    case 'reauthentication_needed':
      return "보안을 위해 다시 로그인한 후 진행해주세요.";
    case 'reauthentication_not_valid':
      return "인증번호가 올바르지 않습니다. 다시 확인해주세요.";
    case 'user_banned':
      return "현재 이용이 제한된 계정입니다. 관리자에게 문의해주세요.";
    case 'request_timeout':
      return "요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.";
    case 'unexpected_failure':
    case 'conflict':
      return "회원가입 처리에 실패했습니다. 브라우저를 닫지 말고 다시 시도해 주세요.";
    case 'captcha_failed':
      return "보안 인증에 실패했습니다. 다시 시도해주세요.";
    case 'flow_state_expired':
    case 'flow_state_not_found':
      return "비밀번호 재설정 인증 정보가 만료되었습니다. 비밀번호 찾기를 다시 진행해주세요.";
    case 'invite_not_found':
      return "인증 링크가 만료되었거나 이미 사용되었습니다. 다시 요청해주세요.";
    case 'email_address_not_authorized':
      return "현재 해당 이메일 주소로 인증 메일을 보낼 수 없습니다. 잠시 후 다시 시도하거나 관리자에게 문의해주세요.";
    case 'bad_code_verifier':
    case 'bad_oauth_state':
    case 'bad_oauth_callback':
      return "인증 진행 정보가 올바르지 않습니다. 처음부터 다시 시도해주세요.";
    default:
      return "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
  }
}
