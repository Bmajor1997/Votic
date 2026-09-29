import { splitPassages } from "../documents/passages";

export const SECTION_TARGET_CHARS=3000;
// Well under the server's 400,000-character limit, and keeps each question affordable.
export const ASK_CONTEXT_BUDGET_CHARS=48_000;
export const ASK_CONTEXT_MAX_SECTIONS=40;

export type AskSection={heading:string;text:string};
/** Where a section lives in the Reader, so an answer can link back to it. */
export type AskLink={documentId:string;sentenceIndex:number};
export type LinkedSection={section:AskSection;link:AskLink|null};

function passageHeading(start:number,end:number,continued:boolean){
  const range=start===end?`Passage ${start+1}`:`Passages ${start+1}–${end+1}`;
  return continued?range+" (continued)":range;
}

/** Splits document text into ~3,000-character sections on Reader passage boundaries. */
export function chunkDocument(documentId:string,plainText:string,targetChars=SECTION_TARGET_CHARS):LinkedSection[]{
  const sections:LinkedSection[]=[];
  let parts:string[]=[],size=0,start=0,end=0,continued=false;
  function push(){
    if(!parts.length)return;
    sections.push({section:{heading:passageHeading(start,end,continued),text:parts.join(" ")},link:{documentId,sentenceIndex:start}});
    parts=[];size=0;
  }
  splitPassages(plainText).forEach((passage,index)=>{
    // A passage longer than a section (e.g. text without punctuation) is split into pieces.
    for(let offset=0;offset<passage.length;offset+=targetChars){
      const piece=passage.slice(offset,offset+targetChars);
      if(parts.length&&size+piece.length+1>targetChars)push();
      if(!parts.length){start=index;continued=offset>0;}
      parts.push(piece);size+=piece.length+1;end=index;
    }
  });
  push();
  return sections;
}

const STOP_WORDS=new Set("the and for are but not you your with this that from what which who whom whose when where why how does did has have had was were will would can could should about into over than then them they their there these those its it's his her our out all any some such only own same very just also more most other been being here each few both after before again once document section passage passages text tell explain summarize summary please".split(" "));
export function questionTerms(question:string){
  return [...new Set((question.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu)||[]).filter(word=>word.length>2&&!STOP_WORDS.has(word)))];
}
function occurrences(text:string,term:string){let count=0,at=text.indexOf(term);while(at!==-1){count+=1;at=text.indexOf(term,at+term.length);}return count;}

/**
 * Keeps sections within the budget. When everything fits, all sections are kept. Otherwise the section
 * at `anchorIndex` (the reading position) comes first, then sections matching the question, then an even
 * spread across the rest so broad questions ("summarize this") still see the whole document.
 */
export function selectSections<T extends {section:AskSection}>(items:T[],question:string,{anchorIndex,budgetChars=ASK_CONTEXT_BUDGET_CHARS,maxSections=ASK_CONTEXT_MAX_SECTIONS}:{anchorIndex?:number;budgetChars?:number;maxSections?:number}={}):{items:T[];partial:boolean}{
  const sizes=items.map(item=>item.section.heading.length+item.section.text.length);
  if(items.length<=maxSections&&sizes.reduce((sum,size)=>sum+size,0)<=budgetChars)return {items,partial:false};
  const chosen=new Set<number>();let used=0;
  function add(index:number){
    if(chosen.has(index)||chosen.size>=maxSections||used+sizes[index]>budgetChars)return;
    chosen.add(index);used+=sizes[index];
  }
  if(anchorIndex!==undefined&&anchorIndex>=0&&anchorIndex<items.length)add(anchorIndex);
  const terms=questionTerms(question);
  if(terms.length){
    const lowered=items.map(item=>item.section.text.toLocaleLowerCase());
    const weights=terms.map(term=>{const found=lowered.filter(text=>text.includes(term)).length;return found?Math.log(1+items.length/found):0;});
    const scores=lowered.map(text=>terms.reduce((score,term,t)=>{const count=weights[t]?occurrences(text,term):0;return count?score+(1+Math.log(count))*weights[t]:score;},0));
    scores.map((score,index)=>({score,index})).filter(item=>item.score>0).sort((a,b)=>b.score-a.score||a.index-b.index).forEach(item=>add(item.index));
  }
  const averageSize=Math.max(1,sizes.reduce((sum,size)=>sum+size,0)/items.length);
  const spread=Math.min(maxSections-chosen.size,Math.floor((budgetChars-used)/averageSize));
  for(let k=0;k<spread;k+=1)add(Math.floor((k+.5)*items.length/spread));
  return {items:[...chosen].sort((a,b)=>a-b).map(index=>items[index]),partial:true};
}
