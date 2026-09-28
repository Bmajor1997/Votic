export type DailyReadingActivity={readingSeconds:number;listeningSeconds:number};
export type SavedPassage={id:string;sentenceIndex:number;text:string;note:string;createdAt:number;updatedAt:number};
export type VoticDocument={id:string;title:string;sourceName:string;plainText:string;importedAt:number;updatedAt:number;lastOpenedAt?:number;completedAt?:number;collection?:string;progress:number;sentenceIndex:number;wordIndex:number;playbackRate:number;activity?:Record<string,DailyReadingActivity>;savedPassages?:SavedPassage[];reviewResponses?:Record<string,string>};
