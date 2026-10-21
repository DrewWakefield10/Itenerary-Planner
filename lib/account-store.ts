import {tripSchema,type Trip} from "./trip";
import {AccountError,type AccountTrip,type Bookmark} from "./account-contract";
import {discoveryPlace} from "./discovery";
type Row={owner_id:string;id:string;snapshot:string;revision:number;created_at:string;updated_at:string;mutation_id:string};
const decode=(r:Row):AccountTrip=>({trip:tripSchema.parse(JSON.parse(r.snapshot)),ownerId:r.owner_id,revision:r.revision,createdAt:r.created_at,updatedAt:r.updated_at});
/** All queries bind the authenticated server-side owner. Composite keys prevent
 * ID guessing and imports with a matching ID from crossing account boundaries. */
export class AccountStore{
  constructor(private db:D1Database,private ownerId:string){}
  async list(offset=0){
    const {results}=await this.db.prepare("SELECT * FROM personal_trips WHERE owner_id=? ORDER BY updated_at DESC,id LIMIT 21 OFFSET ?").bind(this.ownerId,offset).all<Row>();
    return {trips:results.slice(0,20).map(decode),hasMore:results.length>20,nextOffset:offset+20};
  }
  async find(id:string){const r=await this.db.prepare("SELECT * FROM personal_trips WHERE owner_id=? AND id=?").bind(this.ownerId,id).first<Row>();return r?decode(r):null;}
  async save(trip:Trip,revision:number,mutationId:string){
    const snapshot=JSON.stringify(tripSchema.parse(trip)),now=new Date().toISOString();
    const previous=await this.db.prepare("SELECT * FROM personal_trips WHERE owner_id=? AND id=?").bind(this.ownerId,trip.id).first<Row>();
    if(previous?.mutation_id===mutationId){if(previous.snapshot!==snapshot)throw new AccountError(409,"This save ID was already used for different content.");return decode(previous);}
    if(previous?.snapshot===snapshot)return decode(previous);
    if((previous?.revision||0)!==revision)throw new AccountError(409,"This trip changed in another tab or device. Your edits are preserved. Reload the account version or save a copy.");
    const guard="EXISTS(SELECT 1 FROM personal_trips WHERE owner_id=? AND id=? AND mutation_id=?)";
    const results=await this.db.batch([
      this.db.prepare("INSERT INTO personal_trips(owner_id,id,snapshot,revision,mutation_id,created_at,updated_at) VALUES(?,?,?,1,?,?,?) ON CONFLICT(owner_id,id) DO UPDATE SET snapshot=excluded.snapshot,revision=personal_trips.revision+1,mutation_id=excluded.mutation_id,updated_at=excluded.updated_at WHERE personal_trips.revision=? RETURNING *").bind(this.ownerId,trip.id,snapshot,mutationId,now,now,revision),
      this.db.prepare(`DELETE FROM itinerary_stops WHERE owner_id=? AND trip_id=? AND ${guard}`).bind(this.ownerId,trip.id,this.ownerId,trip.id,mutationId),
      this.db.prepare(`INSERT INTO itinerary_stops(owner_id,trip_id,activity_id,day_index,stop_index,location_id,name) SELECT ?,?,json_extract(a.value,'$.id'),CAST(d.key AS INTEGER),CAST(a.key AS INTEGER),json_extract(a.value,'$.catalogStopId'),json_extract(a.value,'$.name') FROM json_each(?,'$.days') d,json_each(d.value,'$.activities') a WHERE ${guard}`).bind(this.ownerId,trip.id,snapshot,this.ownerId,trip.id,mutationId),
    ]);
    const saved=results[0].results?.[0] as Row|undefined;
    if(!saved)throw new AccountError(409,"This trip changed while saving. Your edits are preserved; reload or save a copy.");
    return decode(saved);
  }
  async remove(id:string,revision:number){
    const result=await this.db.prepare("DELETE FROM personal_trips WHERE owner_id=? AND id=? AND revision=? RETURNING id").bind(this.ownerId,id,revision).all();
    if(!result.results.length){if(await this.find(id))throw new AccountError(409,"This trip changed. Refresh before deleting it.");throw new AccountError(404,"Trip not found in this account.");}
  }
  async bookmarks():Promise<Bookmark[]>{
    const {results}=await this.db.prepare("SELECT * FROM bookmarks WHERE owner_id=? ORDER BY created_at DESC,place_id").bind(this.ownerId).all<{place_id:string;snapshot:string;created_at:string}>();
    return results.map(r=>({...JSON.parse(r.snapshot),placeId:r.place_id,createdAt:r.created_at,available:!!discoveryPlace(r.place_id)}));
  }
  async bookmark(placeId:string){
    const p=discoveryPlace(placeId);if(!p)throw new AccountError(404,"This place is no longer in the directory.");
    const snapshot=JSON.stringify({name:p.name,description:p.description,municipality:p.directory?.city_municipality||null,destination:p.directory?.destination_group||p.baseSlug});
    await this.db.prepare("INSERT INTO bookmarks(owner_id,place_id,snapshot,created_at) VALUES(?,?,?,?) ON CONFLICT(owner_id,place_id) DO NOTHING").bind(this.ownerId,placeId,snapshot,new Date().toISOString()).run();
  }
  async unbookmark(placeId:string){await this.db.prepare("DELETE FROM bookmarks WHERE owner_id=? AND place_id=?").bind(this.ownerId,placeId).run();}
}
