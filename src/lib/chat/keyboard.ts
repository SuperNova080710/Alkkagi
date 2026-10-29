type ChatKeyEvent={
 key:string;
 shiftKey:boolean;
 isComposing:boolean;
 keyCode?:number;
 repeat?:boolean;
};

/** Enter sends, except for Shift+Enter or IME conversion/confirmation. */
export function shouldSubmitChatOnEnter(event:ChatKeyEvent):boolean{
 return event.key==='Enter'
  && !event.shiftKey
  && !event.isComposing
  && event.keyCode!==229
  && !event.repeat;
}
