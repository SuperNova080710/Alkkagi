export const NICKNAME_RULE = /^[A-Za-z0-9_가-힣]{2,24}$/u;
export const NICKNAME_GUIDE = '한글·영문·숫자·밑줄(_)을 사용해 2~24자로 입력하세요.';
export function validNickname(value:string):boolean {
 return NICKNAME_RULE.test(value);
}
export function nicknameError(value:string):string {
 return validNickname(value)?'':NICKNAME_GUIDE;
}
