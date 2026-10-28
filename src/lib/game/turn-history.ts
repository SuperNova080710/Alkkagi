import { validBoard, type Board } from './engine';

export type TurnShot = {
 id: string;
 turn_no: number;
 player_id: string;
 piece_id: string;
 input: unknown;
 result_state: unknown;
 created_at: string;
};
export type TurnSummary = {
 id: string;
 turnNo: number;
 playerId: string;
 pieceId: string;
 firstLost: number;
 secondLost: number;
};
export function summarizeTurn(shot: TurnShot, player1: string, player2: string): TurnSummary | null {
 if (!shot.input || typeof shot.input !== 'object' || Array.isArray(shot.input)) return null;
 const before = (shot.input as Record<string, unknown>).expectedBoard;
 const after = shot.result_state;
 if (!validBoard(before) || !validBoard(after)) return null;
 const remaining = new Set(after.pieces.map(p => p.id));
 const removed = before.pieces.filter(p => !remaining.has(p.id));
 return {
  id: shot.id, turnNo: shot.turn_no, playerId: shot.player_id, pieceId: shot.piece_id,
  firstLost: removed.filter(p => p.owner === player1).length,
  secondLost: removed.filter(p => p.owner === player2).length,
 };
}
export function extractFrames(shot: TurnShot): Board[] {
 if (!shot.input || typeof shot.input !== 'object' || Array.isArray(shot.input)) return [];
 const value = (shot.input as Record<string, unknown>).frames;
 if (!Array.isArray(value) || value.length < 2 || value.length > 110 ||
  !value.every(validBoard)) return [];
 return value as Board[];
}
