/** Splits document text into the passages the Reader shows and counts ("passage N" = index N-1). */
export function splitPassages(text:string){return text.match(/[^.!?]+[.!?]+[\]"')]*|[^.!?]+$/g)?.map(value=>value.trim()).filter(Boolean)||[];}
