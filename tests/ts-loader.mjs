import {readFile} from 'node:fs/promises';
import ts from 'typescript';
export async function resolve(specifier,context,next){
 try{return await next(specifier,context);}catch(error){
  if(specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier))return next(specifier+'.ts',context);
  throw error;
 }
}
export async function load(url,context,next){
 if(url.endsWith('.ts'))return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText};
 if(url.endsWith('.json'))return {format:'module',shortCircuit:true,source:'export default '+await readFile(new URL(url),'utf8')};
 return next(url,context);
}
