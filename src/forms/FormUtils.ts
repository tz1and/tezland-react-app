/**
 * -1 = undecided
 * 0 = error
 * 1 = success
 */
 export type FormTrisate = -1 | 0 | 1

 export function triHelper<T>(state: FormTrisate, undecided: T, error: T, success: T): T {
     if(state === -1) return undecided;
     if(state === 0) return error;
     return success;
 }