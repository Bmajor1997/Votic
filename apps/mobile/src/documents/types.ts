export type DailyReadingActivity={readingSeconds:number;listeningSeconds:number};
export type NoteType="note"|"key-point"|"question"|"definition";
export type SavedPassage={id:string;sentenceIndex:number;text:string;note:string;createdAt:number;updatedAt:number;title?:string;noteType?:NoteType;pinned?:boolean;tags?:string[]};
export type VoticDocument={id:string;title:string;sourceName:string;plainText:string;importedAt:number;updatedAt:number;lastOpenedAt?:number;completedAt?:number;collection?:string;progress:number;sentenceIndex:number;wordIndex:number;playbackRate:number;activity?:Record<string,DailyReadingActivity>;savedPassages?:SavedPassage[];reviewResponses?:Record<string,string>};
