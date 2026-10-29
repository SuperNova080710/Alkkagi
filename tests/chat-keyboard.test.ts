import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {shouldSubmitChatOnEnter} from '../src/lib/chat/keyboard';

describe('chat keyboard shortcuts',()=>{
 const enter={key:'Enter',shiftKey:false,isComposing:false,keyCode:13,repeat:false};
 it('sends on a plain Enter, including after IME composition finished',()=>{
  expect(shouldSubmitChatOnEnter(enter)).toBe(true);
 });
 it('keeps Shift+Enter as a line break, without submitting',()=>{
  expect(shouldSubmitChatOnEnter({...enter,shiftKey:true})).toBe(false);
 });
 it('does not send while a Korean IME is composing or confirming',()=>{
  expect(shouldSubmitChatOnEnter({...enter,isComposing:true})).toBe(false);
  expect(shouldSubmitChatOnEnter({...enter,keyCode:229})).toBe(false);
 });
 it('ignores other keys and held-down key repeat',()=>{
  expect(shouldSubmitChatOnEnter({...enter,key:'a'})).toBe(false);
  expect(shouldSubmitChatOnEnter({...enter,repeat:true})).toBe(false);
 });
 it('invokes the existing form submission route instead of bypassing server restrictions',()=>{
  const source=readFileSync(new URL('../src/components/game/match-chat.tsx',import.meta.url),'utf8');
  expect(source).toContain('onKeyDown={onChatKeyDown}');
  expect(source).toContain('event.preventDefault()');
  expect(source).toContain('event.currentTarget.form?.requestSubmit()');
  expect(source).toContain("if(sending||closed||!draft.trim())return;");
  expect(source).toContain('Enter 전송 · Shift+Enter 줄바꿈');
  expect(source).toContain('<form onSubmit={submit}');
  expect(source).toContain('readOnly={sending} disabled={closed}');
 });
});
