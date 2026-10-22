import type {Client,InValue,InStatement} from "@libsql/client/web";

// The repository needs parameterized SQLite statements and atomic batches,
// independent of the host. D1 satisfies this interface directly.
export interface AccountStatement{
  bind(...values:(string|number|null)[]):AccountStatement;
  all<T=Record<string,unknown>>():Promise<{results:T[]}>;
  first<T=Record<string,unknown>>():Promise<T|null>;
  run():Promise<unknown>;
}
export interface AccountDatabase{
  prepare(sql:string):AccountStatement;
  batch(statements:AccountStatement[]):Promise<{results:unknown[]}[]>;
}
export function libsqlAccountDatabase(client:Client):AccountDatabase{
  class Statement implements AccountStatement{
    constructor(readonly sql:string,readonly args:InValue[]=[]){}
    bind(...values:(string|number|null)[]){return new Statement(this.sql,values);}
    async all<T>(){const result=await client.execute({sql:this.sql,args:this.args});return {results:result.rows as unknown as T[]};}
    async first<T>(){return (await this.all<T>()).results[0]??null;}
    run(){return client.execute({sql:this.sql,args:this.args});}
  }
  return {
    prepare:sql=>new Statement(sql),
    async batch(statements){
      const queries=statements.map(s=>{if(!(s instanceof Statement))throw new Error("Mixed database statements");return {sql:s.sql,args:s.args} satisfies InStatement;});
      // libSQL batch in write mode commits all statements or rolls them all back.
      return (await client.batch(queries,"write")).map(r=>({results:r.rows as unknown[]}));
    },
  };
}
